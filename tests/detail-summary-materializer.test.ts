import { describe, expect, it } from "vitest";
import type { ContentItem } from "../src/shared/content";
import { buildStoredAcademicDetailSummary, materializeStoredFields } from "../src/server/detail-summary-materializer";

function createAcademicItem(overrides: Partial<ContentItem> = {}): ContentItem {
  return {
    id: "academic-test",
    source_name: "Journal of Autism and Developmental Studies",
    source_type: "academic",
    source_region: "国际",
    source_url: "https://example.org/article",
    canonical_url: "https://example.org/article",
    title_original: "Autism support in school transitions",
    title_zh: "研究：Autism support in school transitions",
    summary_original: "Background: The global prevalence of autism spectrum diagnosis (ASD) is increasing.",
    summary_zh: "",
    excerpt: "Background: The global prevalence of autism spectrum diagnosis (ASD) is increasing.",
    language: "en",
    published_at: "2026-03-02T00:00:00.000Z",
    content_type: "research",
    topics: ["自闭症", "教育"],
    audiences: ["educator", "family", "researcher"],
    conditions: ["autism"],
    review_status: "approved",
    review_notes: "",
    ingested_at: "2026-03-07T00:00:00.000Z",
    metadata: {
      authors: "Alex Chen; Rui Wang; Mei Lin; John Doe",
      credibility: "high",
      tags: ["academic-enriched"],
      analysis: {
        template: "academic",
        publication_info: "Journal of Autism and Developmental Studies，2026年3月2日",
        research_method: "Based on academic article auto detection.",
        key_findings: "Background: The global prevalence of autism spectrum diagnosis (ASD) is increasing.",
        practical_significance: "This article is useful for school support planning.",
        conclusion: "Background: The global prevalence of autism spectrum diagnosis (ASD) is increasing.",
      },
    },
    ...overrides,
  };
}

describe("detail summary materializer", () => {
  it("builds a stored academic detail summary without leaking raw English fallback text", () => {
    const summary = buildStoredAcademicDetailSummary(createAcademicItem());
    expect(summary.title).toContain("Autism support in school transitions");
    expect(summary.author_text).toContain("Alex Chen、Rui Wang、Mei Lin 等");
    expect(summary.sections).toHaveLength(5);
    expect(summary.sections.some((section) => /Background:/i.test(section.body))).toBe(false);
    expect(summary.sections.some((section) => /global prevalence/i.test(section.body))).toBe(false);
    expect(summary.sections.some((section) => /研究类型：/.test(section.body))).toBe(false);
    expect(summary.sections.some((section) => /自动识别|PMC 全文页/.test(section.body))).toBe(false);
    expect(summary.conclusion).not.toMatch(/Background:/i);
  });

  it("materializes detail_summary onto academic items before persistence", () => {
    const item = materializeStoredFields(createAcademicItem());
    expect(item.metadata.detail_summary).toBeDefined();
    expect(item.metadata.detail_summary?.sections[0].index).toBe("4.1");
    expect(item.metadata.detail_summary?.sections[4].title).toBe("实践启示");
  });
});
