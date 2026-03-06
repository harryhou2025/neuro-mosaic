import type { ContentItem } from "./content";

export type DetailSummarySection = {
  index: string;
  title: string;
  body: string;
};

export type DetailSummary = {
  title: string;
  time_text: string;
  author_text: string;
  sections: DetailSummarySection[];
  conclusion: string;
};

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/[。！？.!?]\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function ensureSentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return "";
  }
  return /[。！？.!?]$/.test(trimmed) ? trimmed : `${trimmed}。`;
}

function getBaseText(item: ContentItem): string {
  return [item.summary_zh, item.summary_original, item.excerpt].filter(Boolean).join(" ");
}

function formatDateText(input: string): string {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return "时间信息待补充。";
  }
  return `发表于 ${new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date)}。`;
}

function deriveTitle(item: ContentItem): string {
  if (item.metadata.detail_summary?.title?.trim()) {
    return item.metadata.detail_summary.title.trim();
  }

  const zhTitle = item.title_zh?.trim();
  const original = item.title_original?.trim();

  if (zhTitle && original && zhTitle !== original) {
    return `《${zhTitle}》（${original}）`;
  }
  if (zhTitle) {
    return `《${zhTitle}》`;
  }
  return `《${original || "标题待补充"}》`;
}

function deriveTimeText(item: ContentItem): string {
  if (item.metadata.detail_summary?.time_text?.trim()) {
    return ensureSentence(item.metadata.detail_summary.time_text.trim());
  }
  if (item.metadata.analysis?.publication_info?.trim()) {
    return ensureSentence(item.metadata.analysis.publication_info.trim());
  }
  return formatDateText(item.published_at);
}

function deriveAuthorText(item: ContentItem): string {
  if (item.metadata.detail_summary?.author_text?.trim()) {
    return ensureSentence(item.metadata.detail_summary.author_text.trim());
  }

  const authors =
    item.metadata.authors
      ?.split(/[;,]/)
      .map((author) => author.trim())
      .filter(Boolean) ?? [];

  if (authors.length > 1) {
    return `${authors.slice(0, 3).join("、")} 等（${item.source_name}）`;
  }
  if (authors.length === 1) {
    return `${authors[0]}（${item.source_name}）`;
  }
  return `${item.source_name}（机构作者）`;
}

function buildAcademicSections(item: ContentItem): DetailSummarySection[] {
  const analysis = item.metadata.analysis;
  const sectionSummaries = analysis?.content_sections ?? [];
  const abstractSentences = splitSentences(getBaseText(item));
  const tags = item.topics.slice(0, 3).join("、") || "相关主题";

  const sections: Array<{ title: string; body: string }> = [
    {
      title: "研究背景",
      body:
        sectionSummaries[0]?.items?.[0] ||
        `这篇文章围绕 ${tags} 展开，重点回应研究、支持或实践层面的核心问题。`,
    },
    {
      title: "研究对象或问题",
      body:
        sectionSummaries[0]?.items?.[1] ||
        abstractSentences[0] ||
        `文章主要关注 ${tags} 相关人群在教育、支持、评估或生活场景中的实际需求。`,
    },
    {
      title: "研究方法",
      body:
        analysis?.research_method ||
        sectionSummaries.find((section) => /方法|method|design/i.test(section.title))?.items?.[0] ||
        "当前可获取信息主要来自公开摘要和全文结构，研究方法细节仍需结合原文进一步核对。",
    },
    {
      title: "核心发现",
      body:
        analysis?.key_findings ||
        sectionSummaries[1]?.items?.[0] ||
        abstractSentences[1] ||
        item.summary_zh ||
        "现有信息显示，文章给出了与主题相关的核心发现或支持结论。",
    },
    {
      title: "实践启示",
      body:
        analysis?.practical_significance ||
        analysis?.china_insights?.[0] ||
        sectionSummaries.at(-1)?.items?.[0] ||
        "这篇文章更适合继续转化为面向家庭、学校、临床或职场的中文行动建议。",
    },
  ];

  return sections
    .filter((section) => section.body.trim())
    .slice(0, 6)
    .map((section, index) => ({
      index: `4.${index + 1}`,
      title: section.title,
      body: ensureSentence(section.body),
    }));
}

function buildPracticeSections(item: ContentItem): DetailSummarySection[] {
  const analysis = item.metadata.analysis;
  const baseSentences = splitSentences(getBaseText(item));
  const strategyPoints = analysis?.strategy_points ?? [];

  const sections: Array<{ title: string; body: string }> = [
    {
      title: "背景经历",
      body:
        analysis?.content_sections?.[0]?.items?.[0] ||
        baseSentences[0] ||
        `这篇内容围绕 ${item.topics.slice(0, 2).join("、") || "相关主题"} 展开，先交代了问题背景和阅读入口。`,
    },
    {
      title: "关键困难",
      body:
        analysis?.content_sections?.[0]?.items?.[1] ||
        baseSentences[1] ||
        `内容指出，相关人群在支持、理解或资源获取上存在明显困难，需要更具体的说明和路径。`,
    },
    {
      title: "转折变化",
      body:
        analysis?.key_findings ||
        baseSentences[2] ||
        `文章通过案例、解释或经验总结，给出了理解问题的新视角和可能的转机。`,
    },
    {
      title: "应对策略",
      body:
        strategyPoints[0] ||
        analysis?.practical_significance ||
        baseSentences[3] ||
        `内容中包含可转化的应对方向，适合继续整理成中文行动清单。`,
    },
    {
      title: "优势或反思",
      body:
        analysis?.china_insights?.[0] ||
        strategyPoints[1] ||
        baseSentences[4] ||
        `这篇内容提醒我们，除了困难，也要看到个体优势、环境调整和长期支持的重要性。`,
    },
  ];

  return sections
    .filter((section) => section.body.trim())
    .slice(0, 6)
    .map((section, index) => ({
      index: `4.${index + 1}`,
      title: section.title,
      body: ensureSentence(section.body),
    }));
}

function normalizeSections(sections: DetailSummarySection[]): DetailSummarySection[] {
  return sections
    .filter((section) => section.title.trim() && section.body.trim())
    .slice(0, 6)
    .map((section, index) => ({
      index: `4.${index + 1}`,
      title: section.title.trim(),
      body: ensureSentence(section.body.trim()),
    }));
}

function deriveConclusion(item: ContentItem): string {
  if (item.metadata.detail_summary?.conclusion?.trim()) {
    return ensureSentence(item.metadata.detail_summary.conclusion.trim());
  }
  if (item.metadata.analysis?.conclusion?.trim()) {
    return ensureSentence(item.metadata.analysis.conclusion.trim());
  }
  return ensureSentence(item.summary_zh || item.summary_original || item.excerpt || "当前结论信息待补充");
}

export function deriveDetailSummary(item: ContentItem): DetailSummary {
  if (item.metadata.detail_summary) {
    return {
      title: deriveTitle(item),
      time_text: deriveTimeText(item),
      author_text: deriveAuthorText(item),
      sections: normalizeSections(item.metadata.detail_summary.sections),
      conclusion: deriveConclusion(item),
    };
  }

  const sections =
    item.source_type === "academic" || item.content_type === "research" || item.content_type === "review"
      ? buildAcademicSections(item)
      : buildPracticeSections(item);

  return {
    title: deriveTitle(item),
    time_text: deriveTimeText(item),
    author_text: deriveAuthorText(item),
    sections: normalizeSections(sections),
    conclusion: deriveConclusion(item),
  };
}
