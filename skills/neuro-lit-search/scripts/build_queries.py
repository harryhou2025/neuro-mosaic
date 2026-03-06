#!/usr/bin/env python3
"""
Build database-specific query drafts for neurodiversity/autism/ADHD literature searching.

This does NOT hit any external services; it only prints query strings you can copy-paste
into different databases.
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from typing import List, Sequence


def _q(s: str) -> str:
    s = s.strip()
    if not s:
        return ""
    if " " in s and not (s.startswith('"') and s.endswith('"')):
        return f"\"{s}\""
    return s


def _or(parts: Sequence[str]) -> str:
    parts = [p for p in parts if p]
    if not parts:
        return ""
    if len(parts) == 1:
        return parts[0]
    return "(" + " OR ".join(parts) + ")"


def _and(parts: Sequence[str]) -> str:
    parts = [p for p in parts if p]
    if not parts:
        return ""
    if len(parts) == 1:
        return parts[0]
    return "(" + " AND ".join(parts) + ")"


@dataclass(frozen=True)
class QueryPack:
    pubmed: str
    wos: str
    scopus: str
    scholar: str


def build_query_pack(
    *,
    topic: str,
    conditions: Sequence[str],
    aspects: Sequence[str],
    population: str,
) -> QueryPack:
    # Core terms (keep conservative; user can extend).
    cond_terms: List[str] = []
    for c in conditions:
        lc = c.strip().lower()
        if lc in {"autism", "asd", "autism spectrum disorder"}:
            cond_terms += ["autism", "ASD", "autism spectrum disorder"]
        elif lc in {"adhd", "attention deficit hyperactivity disorder", "add"}:
            cond_terms += ["ADHD", "attention deficit hyperactivity disorder"]
        else:
            cond_terms.append(c)

    topic_terms = []
    if topic:
        topic_terms.append(topic)
        if topic.strip().lower() == "neurodiversity":
            topic_terms += ["neurodivergent", "neurodivergence"]

    aspect_terms = list(aspects)

    # PubMed: prefer Title/Abstract for keywords; optionally add MeSH stubs.
    def pm_field(term: str) -> str:
        t = term.strip()
        if not t:
            return ""
        # Keep acronyms as-is; quote phrases.
        return f"{_q(t)}[Title/Abstract]"

    pubmed = _and(
        [
            _or([pm_field(t) for t in topic_terms] + [pm_field(t) for t in cond_terms]),
            _or([pm_field(t) for t in aspect_terms]) if aspect_terms else "",
            pm_field(population) if population else "",
        ]
    )

    # WoS: TS= topic search (title, abstract, keywords).
    def wos_term(term: str) -> str:
        return _q(term)

    wos = _and(
        [
            _or([wos_term(t) for t in topic_terms] + [wos_term(t) for t in cond_terms]),
            _or([wos_term(t) for t in aspect_terms]) if aspect_terms else "",
            wos_term(population) if population else "",
        ]
    )
    if wos:
        wos = f"TS={wos}"

    # Scopus: TITLE-ABS-KEY(...)
    def sc_term(term: str) -> str:
        return _q(term)

    scopus_inner = _and(
        [
            _or([sc_term(t) for t in topic_terms] + [sc_term(t) for t in cond_terms]),
            _or([sc_term(t) for t in aspect_terms]) if aspect_terms else "",
            sc_term(population) if population else "",
        ]
    )
    scopus = f"TITLE-ABS-KEY({scopus_inner})" if scopus_inner else ""

    # Google Scholar: very simple (quotes + AND/OR are implicit).
    scholar = " ".join([_q(t) for t in (topic_terms + list(cond_terms) + list(aspect_terms)) if t])
    if population:
        scholar = (scholar + " " + _q(population)).strip()

    return QueryPack(pubmed=pubmed, wos=wos, scopus=scopus, scholar=scholar)


def main(argv: Sequence[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Build draft queries for multiple databases.")
    p.add_argument("--topic", default="neurodiversity", help="Topic keyword (default: neurodiversity)")
    p.add_argument(
        "--conditions",
        nargs="*",
        default=["autism", "adhd"],
        help="Conditions keywords (default: autism adhd)",
    )
    p.add_argument(
        "--aspects",
        nargs="*",
        default=[],
        help="Aspect keywords like masking, executive function, sensory, workplace, education...",
    )
    p.add_argument(
        "--population",
        default="",
        help="Population keyword like adult, adolescent, child, women, late diagnosis...",
    )
    p.add_argument(
        "--years",
        default="",
        help="Year range for humans to apply as filters (e.g., 2019:2026). Printed only.",
    )
    args = p.parse_args(argv)

    qp = build_query_pack(
        topic=args.topic,
        conditions=args.conditions,
        aspects=args.aspects,
        population=args.population,
    )

    print("# Query Drafts")
    if args.years:
        print(f"- Suggested year filter: {args.years}")
    print("")
    print("## PubMed")
    print(qp.pubmed or "(empty)")
    print("")
    print("## Web of Science (WoS)")
    print(qp.wos or "(empty)")
    print("")
    print("## Scopus")
    print(qp.scopus or "(empty)")
    print("")
    print("## Google Scholar (keywords)")
    print(qp.scholar or "(empty)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

