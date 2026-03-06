#!/usr/bin/env python3
"""
Search PubMed via NCBI E-utilities and export results.

Design goals:
- No third-party deps (stdlib only).
- Reproducible: query + date filters are explicit in CLI args.
- Polite: throttle requests; support optional API key/email via env.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import ssl
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from typing import List, Optional, Sequence, Tuple


EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
TOOL = "codex-neuro-lit-search"


@dataclass(frozen=True)
class PubmedRecord:
    pmid: str
    title: str
    journal: str
    pub_year: str
    doi: str
    first_author: str
    authors: str
    pub_types: str
    url: str
    abstract: str = ""


def _http_get(url: str, *, timeout_s: int = 30, ssl_context: Optional[ssl.SSLContext] = None) -> bytes:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": f"{TOOL}/1.0 (+https://openai.com/)",
            "Accept": "application/xml,text/xml,application/json,text/plain,*/*",
        },
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=timeout_s, context=ssl_context) as resp:
        return resp.read()


def _throttle_sleep(last_request_ts: float, *, has_api_key: bool) -> None:
    # NCBI guidance (rough): 3 req/s without key, up to 10 req/s with key.
    min_interval = 0.12 if has_api_key else 0.34
    now = time.time()
    delta = now - last_request_ts
    if delta < min_interval:
        time.sleep(min_interval - delta)


def _eutils_url(endpoint: str, params: dict) -> str:
    base = f"{EUTILS}/{endpoint}"
    return f"{base}?{urllib.parse.urlencode(params)}"


def _parse_years(spec: str) -> Tuple[Optional[int], Optional[int]]:
    if not spec:
        return (None, None)
    if ":" not in spec:
        y = int(spec)
        return (y, y)
    start_s, end_s = spec.split(":", 1)
    start = int(start_s) if start_s else None
    end = int(end_s) if end_s else None
    return (start, end)


def _safe_text(elem: Optional[ET.Element]) -> str:
    if elem is None or elem.text is None:
        return ""
    return " ".join(elem.text.split())


def esearch(
    query: str,
    *,
    retmax: int,
    mindate: Optional[str],
    maxdate: Optional[str],
    api_key: Optional[str],
    email: Optional[str],
    ssl_context: Optional[ssl.SSLContext],
) -> List[str]:
    params = {
        "db": "pubmed",
        "term": query,
        "retmode": "xml",
        "retmax": str(retmax),
        "tool": TOOL,
    }
    if api_key:
        params["api_key"] = api_key
    if email:
        params["email"] = email

    # Use date filtering if provided.
    if mindate or maxdate:
        params["datetype"] = "pdat"
        if mindate:
            params["mindate"] = mindate
        if maxdate:
            params["maxdate"] = maxdate

    url = _eutils_url("esearch.fcgi", params)
    data = _http_get(url, ssl_context=ssl_context)
    root = ET.fromstring(data)
    ids = [id_el.text.strip() for id_el in root.findall(".//IdList/Id") if id_el.text]
    return ids


def esummary(
    pmids: Sequence[str],
    *,
    api_key: Optional[str],
    email: Optional[str],
    ssl_context: Optional[ssl.SSLContext],
) -> List[PubmedRecord]:
    if not pmids:
        return []
    params = {
        "db": "pubmed",
        "id": ",".join(pmids),
        "retmode": "xml",
        "tool": TOOL,
    }
    if api_key:
        params["api_key"] = api_key
    if email:
        params["email"] = email

    url = _eutils_url("esummary.fcgi", params)
    data = _http_get(url, ssl_context=ssl_context)
    root = ET.fromstring(data)

    records: List[PubmedRecord] = []
    for docsum in root.findall(".//DocSum"):
        pmid = _safe_text(docsum.find("./Id"))
        items = {it.get("Name"): it for it in docsum.findall("./Item") if it.get("Name")}
        title = _safe_text(items.get("Title"))
        journal = _safe_text(items.get("FullJournalName")) or _safe_text(items.get("Source"))
        pubdate = _safe_text(items.get("PubDate"))
        pub_year = ""
        for tok in pubdate.split():
            if tok.isdigit() and len(tok) == 4:
                pub_year = tok
                break
        if not pub_year and pubdate[:4].isdigit():
            pub_year = pubdate[:4]

        author_list_item = items.get("AuthorList")
        authors: List[str] = []
        if author_list_item is not None:
            for a in author_list_item.findall("./Item"):
                if a.text:
                    authors.append(" ".join(a.text.split()))
        first_author = authors[0] if authors else ""

        elocation = _safe_text(items.get("ELocationID"))
        doi = ""
        # ELocationID sometimes contains "doi: 10.x" or the raw DOI.
        if elocation:
            lower = elocation.lower()
            if "doi" in lower:
                doi = elocation.split()[-1].strip()
            else:
                doi = elocation.strip()

        pubtype_item = items.get("PubTypeList")
        pub_types: List[str] = []
        if pubtype_item is not None:
            for p in pubtype_item.findall("./Item"):
                if p.text:
                    pub_types.append(" ".join(p.text.split()))

        url = f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/" if pmid else ""
        records.append(
            PubmedRecord(
                pmid=pmid,
                title=title,
                journal=journal,
                pub_year=pub_year,
                doi=doi,
                first_author=first_author,
                authors="; ".join(authors),
                pub_types="; ".join(pub_types),
                url=url,
            )
        )
    return records


def efetch_abstracts(
    pmids: Sequence[str],
    *,
    api_key: Optional[str],
    email: Optional[str],
    ssl_context: Optional[ssl.SSLContext],
) -> dict:
    if not pmids:
        return {}

    params = {
        "db": "pubmed",
        "id": ",".join(pmids),
        "retmode": "xml",
        "rettype": "abstract",
        "tool": TOOL,
    }
    if api_key:
        params["api_key"] = api_key
    if email:
        params["email"] = email

    url = _eutils_url("efetch.fcgi", params)
    data = _http_get(url, ssl_context=ssl_context)
    root = ET.fromstring(data)

    abstracts_by_pmid: dict = {}
    for article in root.findall(".//PubmedArticle"):
        pmid_el = article.find(".//MedlineCitation/PMID")
        pmid = _safe_text(pmid_el)
        if not pmid:
            continue
        parts: List[str] = []
        for a in article.findall(".//Abstract/AbstractText"):
            label = a.get("Label")
            text = _safe_text(a)
            if not text:
                continue
            if label:
                parts.append(f"{label}: {text}")
            else:
                parts.append(text)
        abstracts_by_pmid[pmid] = "\n".join(parts).strip()
    return abstracts_by_pmid


def _write_csv(path: str, records: Sequence[PubmedRecord]) -> None:
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(
            f,
            fieldnames=[
                "pmid",
                "title",
                "journal",
                "pub_year",
                "doi",
                "first_author",
                "authors",
                "pub_types",
                "url",
                "abstract",
            ],
        )
        w.writeheader()
        for r in records:
            w.writerow(
                {
                    "pmid": r.pmid,
                    "title": r.title,
                    "journal": r.journal,
                    "pub_year": r.pub_year,
                    "doi": r.doi,
                    "first_author": r.first_author,
                    "authors": r.authors,
                    "pub_types": r.pub_types,
                    "url": r.url,
                    "abstract": r.abstract,
                }
            )


def _write_jsonl(path: str, records: Sequence[PubmedRecord]) -> None:
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        for r in records:
            f.write(
                json.dumps(
                    {
                        "pmid": r.pmid,
                        "title": r.title,
                        "journal": r.journal,
                        "pub_year": r.pub_year,
                        "doi": r.doi,
                        "first_author": r.first_author,
                        "authors": r.authors,
                        "pub_types": r.pub_types,
                        "url": r.url,
                        "abstract": r.abstract,
                    },
                    ensure_ascii=False,
                )
                + "\n"
            )


def main(argv: Optional[Sequence[str]] = None) -> int:
    p = argparse.ArgumentParser(
        description="Search PubMed via NCBI E-utilities and export metadata/abstracts."
    )
    p.add_argument("--query", required=True, help="PubMed query string (E-utilities term=...)")
    p.add_argument("--years", default="", help="Year range like 2019:2026, :2020, 2021:")
    p.add_argument("--retmax", type=int, default=200, help="Max PMIDs to retrieve (default: 200)")
    p.add_argument(
        "--fetch-abstracts",
        type=int,
        default=0,
        help="Fetch abstracts for top N records (default: 0)",
    )
    p.add_argument(
        "--out",
        required=True,
        help="Output path. Suffix .csv or .jsonl controls format.",
    )
    p.add_argument(
        "--email",
        default=os.environ.get("NCBI_EMAIL", ""),
        help="Optional email to include in NCBI requests (or set NCBI_EMAIL).",
    )
    p.add_argument(
        "--cafile",
        default="",
        help="Custom CA bundle path for TLS verification (useful behind corporate proxy).",
    )
    p.add_argument(
        "--insecure",
        action="store_true",
        help="Disable TLS certificate verification (testing only).",
    )
    args = p.parse_args(argv)

    api_key = os.environ.get("NCBI_API_KEY", "").strip() or None
    has_api_key = bool(api_key)

    ssl_context: Optional[ssl.SSLContext]
    if args.insecure:
        ssl_context = ssl._create_unverified_context()
    elif args.cafile:
        ssl_context = ssl.create_default_context(cafile=args.cafile)
    else:
        ssl_context = ssl.create_default_context()

    year_start, year_end = _parse_years(args.years)
    mindate = str(year_start) if year_start else None
    maxdate = str(year_end) if year_end else None

    last_ts = 0.0
    _throttle_sleep(last_ts, has_api_key=has_api_key)
    last_ts = time.time()
    pmids = esearch(
        args.query,
        retmax=args.retmax,
        mindate=mindate,
        maxdate=maxdate,
        api_key=api_key,
        email=args.email.strip() or None,
        ssl_context=ssl_context,
    )
    if not pmids:
        print("No results.", file=sys.stderr)
        # Still create an empty file to make pipelines predictable.
        if args.out.endswith(".jsonl"):
            _write_jsonl(args.out, [])
        else:
            _write_csv(args.out, [])
        return 0

    _throttle_sleep(last_ts, has_api_key=has_api_key)
    last_ts = time.time()
    records = esummary(
        pmids, api_key=api_key, email=args.email.strip() or None, ssl_context=ssl_context
    )

    fetch_n = max(0, int(args.fetch_abstracts))
    if fetch_n:
        # Keep ordering stable: fetch abstracts for the first N IDs returned by esearch.
        top_ids = [r.pmid for r in records][:fetch_n]
        if top_ids:
            _throttle_sleep(last_ts, has_api_key=has_api_key)
            last_ts = time.time()
            abstracts = efetch_abstracts(
                top_ids, api_key=api_key, email=args.email.strip() or None, ssl_context=ssl_context
            )
            records = [
                PubmedRecord(**{**r.__dict__, "abstract": abstracts.get(r.pmid, "")}) for r in records
            ]

    if args.out.endswith(".jsonl"):
        _write_jsonl(args.out, records)
    else:
        _write_csv(args.out, records)

    print(f"Wrote {len(records)} records to {args.out}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
