import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import type { ContentItem } from "../shared/content";
import { classifyItem, safeExcerpt } from "../shared/content-ops";
import { storagePaths } from "./storage";

const execFileAsync = promisify(execFile);

type CsvRow = Record<string, string>;

function parseCsv(text: string): CsvRow[] {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        i += 1;
      }
      row.push(current);
      if (row.some((cell) => cell.trim().length > 0)) {
        rows.push(row);
      }
      current = "";
      row = [];
      continue;
    }
    current += char;
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current);
    rows.push(row);
  }

  const [header = [], ...dataRows] = rows;
  return dataRows.map((dataRow) =>
    Object.fromEntries(header.map((key, index) => [key, dataRow[index] ?? ""])),
  );
}

export async function ingestPubMedContent(): Promise<ContentItem[]> {
  const script = path.join(process.cwd(), "skills", "neuro-lit-search", "scripts", "pubmed_search.py");
  const outFile = path.join(storagePaths.temp, "pubmed.csv");
  const query =
    '(neurodiversity[Title/Abstract] OR autism[Title/Abstract] OR ADHD[Title/Abstract]) AND (support[Title/Abstract] OR education[Title/Abstract] OR workplace[Title/Abstract])';

  try {
    await execFileAsync("python3", [script, "--query", query, "--years", "2021:2026", "--retmax", "6", "--fetch-abstracts", "4", "--out", outFile], {
      cwd: process.cwd(),
      timeout: 60_000,
    });
  } catch {
    return [];
  }

  const { readFile } = await import("node:fs/promises");
  const rawCsv = await readFile(outFile, "utf8");
  const rows = parseCsv(rawCsv);

  return rows
    .filter((row) => row.title && row.url)
    .map((row, index) =>
      classifyItem({
        id: `pubmed-${row.pmid || index}`,
        source_name: row.journal || "PubMed",
        source_type: "academic",
        source_url: row.url,
        canonical_url: row.url,
        title_original: row.title,
        title_zh: `研究：${row.title}`,
        summary_original: row.abstract || row.title,
        summary_zh: `学术摘要待人工润色。${safeExcerpt(row.abstract || row.title, 120)}`,
        excerpt: row.abstract || row.title,
        language: "en",
        published_at: `${row.pub_year || "2025"}-01-01T00:00:00.000Z`,
        content_type: /review/i.test(row.pub_types) ? "review" : "research",
        review_status: "pending",
        review_notes: "来自 PubMed 自动抓取，需人工审核摘要与标签。",
        ingested_at: new Date().toISOString(),
        metadata: {
          doi: row.doi || undefined,
          pmid: row.pmid || undefined,
          credibility: "high",
          tags: row.pub_types ? row.pub_types.split(";").map((tag) => tag.trim()).filter(Boolean) : [],
        },
      }),
    );
}
