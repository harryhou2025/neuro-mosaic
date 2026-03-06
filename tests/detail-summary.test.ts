import { describe, expect, it } from "vitest";
import type { ContentItem } from "../src/shared/content";
import { deriveDetailSummary } from "../src/shared/detail-summary";

function createBaseItem(overrides: Partial<ContentItem> = {}): ContentItem {
  return {
    id: "item-1",
    source_name: "Journal of Learning Disabilities",
    source_type: "academic",
    source_region: "国际",
    source_url: "https://example.org/article",
    canonical_url: "https://example.org/article",
    title_original: "Understanding, Educating, and Supporting Children with Specific Learning Disabilities",
    title_zh: "理解、教育与支持学习困难儿童",
    summary_original:
      "This article reviews support strategies, assessment, and individualized instruction for children with specific learning disabilities.",
    summary_zh: "这篇文章回顾了学习困难儿童的支持策略、评估方式和个别化教学路径。",
    excerpt: "文章强调跨学科评估、个别化教学和家校协作的重要性。",
    language: "bilingual",
    published_at: "2026-03-01T00:00:00.000Z",
    content_type: "review",
    topics: ["学习困难", "教育"],
    audiences: ["educator", "family", "researcher"],
    conditions: ["learning-difficulties"],
    review_status: "approved",
    review_notes: "",
    ingested_at: "2026-03-07T00:00:00.000Z",
    metadata: {
      authors: "Elena L Grigorenko; Donald Compton; Yaacov Petscher",
      credibility: "high",
      tags: ["academic-enriched"],
      analysis: {
        template: "academic",
        publication_info: "Journal of Learning Disabilities，2026年3月1日",
        research_method: "文章采用系统性文献回顾的方法，梳理了学习困难领域的重要证据。",
        key_findings: "核心发现是评估与教学需要联动，个别化支持比单一标签更重要。",
        practical_significance: "对学校教师和特殊教育工作者来说，这篇文章提供了循证实践框架。",
        conclusion: "学习困难支持不能只靠诊断标签，还要把评估、教学和家庭合作放进同一个支持系统。",
        content_sections: [
          {
            title: "文章概览",
            items: [
              "文章系统回顾了学习困难儿童在识别、评估和支持上的关键议题。",
              "重点问题是如何把评估结果真正转化为课堂和家庭中的个别化支持。",
            ],
          },
        ],
      },
    },
    ...overrides,
  };
}

describe("deriveDetailSummary", () => {
  it("uses an existing detail_summary with normalized numbering", () => {
    const item = createBaseItem({
      metadata: {
        credibility: "high",
        tags: [],
        detail_summary: {
          title: "《我如何带着 ADHD 经营公司》（How I run a company with ADHD）",
          time_text: "该文章最初发布于约 7 年前。",
          author_text: "Andrew Askins（Krit 公司的创始人）",
          sections: [
            { index: "4.9", title: "背景经历", body: "作者先描述了长期的自我怀疑。" },
            { index: "4.7", title: "应对策略", body: "后来他逐渐形成了清晰的管理办法。" },
          ],
          conclusion: "ADHD 不应成为逃避责任的借口。",
        },
      },
    });

    const result = deriveDetailSummary(item);
    expect(result.title).toContain("我如何带着 ADHD 经营公司");
    expect(result.sections[0].index).toBe("4.1");
    expect(result.sections[1].index).toBe("4.2");
    expect(result.author_text).toContain("Andrew Askins");
    expect(result.conclusion).toContain("ADHD");
  });

  it("builds an academic fallback summary in the required Chinese order", () => {
    const result = deriveDetailSummary(createBaseItem());
    expect(result.title).toContain("理解、教育与支持学习困难儿童");
    expect(result.time_text).toContain("Journal of Learning Disabilities");
    expect(result.author_text).toContain("Elena L Grigorenko");
    expect(result.sections.length).toBeGreaterThanOrEqual(3);
    expect(result.sections[0].index).toBe("4.1");
    expect(result.sections[0].title).toBe("研究背景");
    expect(result.sections[1].title).toBe("研究对象或问题");
    expect(result.sections[2].title).toBe("研究方法");
    expect(result.conclusion).toContain("学习困难支持");
  });

  it("builds a practice fallback summary with strategy folded into section 4.x", () => {
    const item = createBaseItem({
      source_name: "ADDitude",
      source_type: "media",
      content_type: "news",
      title_zh: "我如何带着 ADHD 经营公司",
      title_original: "How I run a company with ADHD",
      summary_zh: "作者回顾了确诊 ADHD 后，如何借助任务清单、外部压力和热爱驱动来经营公司。",
      summary_original:
        "The author describes shame, diagnosis, and the strategies he uses to run a company with ADHD, including prioritization and external accountability.",
      metadata: {
        credibility: "medium",
        tags: [],
        analysis: {
          template: "practice",
          key_findings: "作者发现 ADHD 既带来执行困难，也带来创造性和战略思维优势。",
          strategy_points: [
            "使用简单任务清单做极度优先排序。",
            "通过外部问责和环境减法降低分心概率。",
          ],
          conclusion: "只有承认挑战并建立机制，ADHD 才可能转化为可管理的优势。",
        },
      },
    });

    const result = deriveDetailSummary(item);
    expect(result.sections[0].index).toBe("4.1");
    expect(result.sections.some((section) => section.title === "应对策略")).toBe(true);
    expect(result.sections.find((section) => section.title === "应对策略")?.body).toContain("任务清单");
    expect(result.conclusion).toContain("ADHD");
  });

  it("does not leak raw English abstract labels into academic sections or conclusion", () => {
    const item = createBaseItem({
      summary_zh: "",
      summary_original: "Background: The global prevalence of autism spectrum diagnosis (ASD) is increasing.",
      metadata: {
        authors: "Alex Chen",
        credibility: "high",
        tags: [],
        analysis: {
          template: "academic",
          research_method: "Based on academic article auto detection.",
          key_findings: "Background: The global prevalence of autism spectrum diagnosis (ASD) is increasing.",
          conclusion: "Background: The global prevalence of autism spectrum diagnosis (ASD) is increasing.",
        },
      },
    });

    const result = deriveDetailSummary(item);
    expect(result.sections.some((section) => /Background:/i.test(section.body))).toBe(false);
    expect(result.sections.some((section) => /The global prevalence/i.test(section.body))).toBe(false);
    expect(result.conclusion).not.toMatch(/Background:/i);
    expect(result.conclusion).not.toMatch(/The global prevalence/i);
  });
});
