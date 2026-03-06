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

function stripLeadingEnglishLabel(text: string): string {
  return text.replace(/^(background|methods?|results?|discussion|conclusion|implications?|objective|aims?)\s*:\s*/i, "").trim();
}

function isEnglishHeavy(text: string): boolean {
  const stripped = stripLeadingEnglishLabel(text).trim();
  if (!stripped) {
    return false;
  }

  const asciiLetters = (stripped.match(/[A-Za-z]/g) ?? []).length;
  const chineseChars = (stripped.match(/[\u4e00-\u9fff]/g) ?? []).length;

  return asciiLetters >= 12 && asciiLetters > chineseChars * 2;
}

function pickChineseText(candidate: string | undefined, fallback: string): string {
  const trimmed = stripLeadingEnglishLabel(candidate?.trim() ?? "");
  if (!trimmed || isEnglishHeavy(trimmed)) {
    return fallback;
  }
  return trimmed;
}

function getBaseText(item: ContentItem): string {
  return [item.summary_zh, item.summary_original, item.excerpt].filter(Boolean).join(" ");
}

function getChineseSummary(item: ContentItem): string {
  const summary = item.summary_zh?.trim();
  if (summary && !isEnglishHeavy(summary)) {
    return summary;
  }
  return "";
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

function inferAcademicStudyLabel(item: ContentItem): string {
  if (item.content_type === "review") {
    return "综述或系统回顾";
  }

  const text = `${item.title_original} ${item.summary_original} ${item.metadata.analysis?.research_method ?? ""}`.toLowerCase();
  if (/trial|randomized|intervention/.test(text)) {
    return "干预研究";
  }
  if (/cohort|longitudinal/.test(text)) {
    return "队列或纵向研究";
  }
  if (/survey|cross-sectional/.test(text)) {
    return "横断面调查";
  }
  if (/qualitative|interview|focus group/.test(text)) {
    return "质性研究";
  }
  return "学术研究";
}

function buildAcademicSections(item: ContentItem): DetailSummarySection[] {
  const analysis = item.metadata.analysis;
  const sectionSummaries = analysis?.content_sections ?? [];
  const chineseSummary = getChineseSummary(item);
  const tags = item.topics.slice(0, 3).join("、") || "相关主题";
  const audiences = item.audiences.slice(0, 3).join("、") || "相关人群";
  const studyLabel = inferAcademicStudyLabel(item);

  const sections: Array<{ title: string; body: string }> = [
    {
      title: "研究背景",
      body: pickChineseText(
        sectionSummaries[0]?.items?.[0],
        `这篇文章围绕 ${tags} 展开，重点回应研究、支持或实践层面的核心问题。`,
      ),
    },
    {
      title: "研究对象或问题",
      body: pickChineseText(
        sectionSummaries[0]?.items?.[1],
        chineseSummary || `文章主要关注 ${tags} 相关人群在教育、支持、评估或生活场景中的实际需求。`,
      ),
    },
    {
      title: "研究方法",
      body: pickChineseText(
        analysis?.research_method || sectionSummaries.find((section) => /方法|method|design/i.test(section.title))?.items?.[0],
        `从公开摘要与全文结构判断，这是一篇${studyLabel}，当前重点整理研究问题、主要发现和实践含义。`,
      ),
    },
    {
      title: "核心发现",
      body: pickChineseText(
        analysis?.key_findings || sectionSummaries[1]?.items?.[0] || chineseSummary,
        `现有信息显示，文章给出了与 ${tags} 相关的核心发现，重点可用于理解支持需求与实践方向。`,
      ),
    },
    {
      title: "实践启示",
      body: pickChineseText(
        analysis?.practical_significance || analysis?.china_insights?.[0] || sectionSummaries.at(-1)?.items?.[0],
        `这篇文章更适合继续转化为面向 ${audiences} 的中文行动建议，而不是停留在学术结论层。`,
      ),
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
  const chineseSummary = getChineseSummary(item);
  const strategyPoints = analysis?.strategy_points ?? [];
  const topicText = item.topics.slice(0, 2).join("、") || "相关主题";

  const sections: Array<{ title: string; body: string }> = [
    {
      title: "背景经历",
      body: pickChineseText(
        analysis?.content_sections?.[0]?.items?.[0],
        chineseSummary || `这篇内容围绕 ${topicText} 展开，先交代了问题背景和阅读入口。`,
      ),
    },
    {
      title: "关键困难",
      body: pickChineseText(
        analysis?.content_sections?.[0]?.items?.[1],
        `内容指出，相关人群在支持、理解或资源获取上存在明显困难，需要更具体的说明和路径。`,
      ),
    },
    {
      title: "转折变化",
      body: pickChineseText(
        analysis?.key_findings || chineseSummary,
        `文章通过案例、解释或经验总结，给出了理解问题的新视角和可能的转机。`,
      ),
    },
    {
      title: "应对策略",
      body: pickChineseText(
        strategyPoints[0] || analysis?.practical_significance,
        `内容中包含可转化的应对方向，适合继续整理成中文行动清单。`,
      ),
    },
    {
      title: "优势或反思",
      body: pickChineseText(
        analysis?.china_insights?.[0] || strategyPoints[1],
        `这篇内容提醒我们，除了困难，也要看到个体优势、环境调整和长期支持的重要性。`,
      ),
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
    return ensureSentence(pickChineseText(item.metadata.detail_summary.conclusion.trim(), "当前结论信息待补充"));
  }
  if (item.metadata.analysis?.conclusion?.trim()) {
    return ensureSentence(
      pickChineseText(
        item.metadata.analysis.conclusion.trim(),
        `综合现有信息，这篇内容可作为 ${item.topics.slice(0, 2).join("、") || "相关主题"} 的进一步阅读材料。`,
      ),
    );
  }
  const chineseSummary = getChineseSummary(item);
  return ensureSentence(chineseSummary || `当前结论信息待补充，建议结合原文继续核对关键发现和适用边界`);
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
