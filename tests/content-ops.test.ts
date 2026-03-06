import { describe, expect, it } from "vitest";
import type { ContentItem } from "../src/shared/content";
import { buildPublicIndex, classifyItem, dedupeItems, safeExcerpt } from "../src/shared/content-ops";

function makeItem(overrides: Partial<ContentItem> = {}): ContentItem {
  return classifyItem({
    id: "item-1",
    source_name: "CDC",
    source_type: "official",
    source_url: "https://example.com/a",
    canonical_url: "https://example.com/a",
    title_original: "Autism support in school",
    title_zh: "学校中的自闭症支持",
    summary_original: "School accommodations can help autistic students and families.",
    summary_zh: "学校支持可以帮助自闭症学生和家庭。",
    excerpt: "School accommodations can help autistic students and families.",
    language: "bilingual",
    published_at: "2025-01-01T00:00:00.000Z",
    content_type: "guide",
    review_status: "approved",
    review_notes: "",
    ingested_at: "2025-01-01T00:00:00.000Z",
    metadata: { credibility: "high", tags: [] },
    ...overrides,
  });
}

describe("content ops", () => {
  it("truncates long excerpts without exposing full text", () => {
    expect(safeExcerpt("a".repeat(400), 50)).toHaveLength(50);
  });

  it("auto classifies topics, audience and conditions", () => {
    const item = makeItem();
    expect(item.topics).toContain("教育");
    expect(item.conditions).toContain("autism");
    expect(item.audiences).toContain("family");
    expect(item.source_region).toBe("美国");
  });

  it("dedupes DOI-based duplicates and keeps the latest ingest", () => {
    const first = makeItem({
      id: "a",
      metadata: { credibility: "high", tags: [], doi: "10.1/abc" },
      ingested_at: "2025-01-01T00:00:00.000Z",
    });
    const second = makeItem({
      id: "b",
      source_url: "https://example.com/b",
      canonical_url: "https://example.com/b",
      metadata: { credibility: "high", tags: [], doi: "10.1/abc" },
      ingested_at: "2025-01-02T00:00:00.000Z",
    });
    const result = dedupeItems([first, second]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("b");
  });

  it("publishes only approved items", () => {
    const approved = makeItem({ id: "approved" });
    const pending = makeItem({ id: "pending", review_status: "pending" });
    const index = buildPublicIndex([approved, pending]);
    expect(index.items).toHaveLength(1);
    expect(index.items[0].id).toBe("approved");
    expect(index.counts.by_region["美国"]).toBe(1);
  });
});
