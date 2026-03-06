import type { ContentItem } from "../shared/content";
import type { DetailSummary } from "../shared/detail-summary";

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

function isLowValueGeneratedText(text: string): boolean {
  return /自动识别|PMC 全文页|公开摘要与全文结构|研究类型：|当前优先使用/i.test(text);
}

function pickChineseText(candidate: string | undefined, fallback: string): string {
  const trimmed = stripLeadingEnglishLabel(candidate?.trim() ?? "");
  if (!trimmed || isEnglishHeavy(trimmed) || isLowValueGeneratedText(trimmed)) {
    return ensureSentence(fallback);
  }
  return ensureSentence(trimmed);
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
  const summaryTitle = item.metadata.analysis?.summary_title?.trim();
  if (summaryTitle) {
    return summaryTitle;
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

function deriveAuthorText(item: ContentItem): string {
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

function deriveTimeText(item: ContentItem): string {
  const publicationInfo = item.metadata.analysis?.publication_info?.trim();
  if (publicationInfo) {
    const normalized = publicationInfo.replace(
      /(\d{4})[/-](\d{1,2})[/-](\d{1,2})/,
      (_, year, month, day) => `${year}年${month}月${day}日`,
    );
    return ensureSentence(normalized);
  }
  return formatDateText(item.published_at);
}

function inferStudyLabel(item: ContentItem): string {
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

function topicText(item: ContentItem): string {
  return item.topics.slice(0, 3).join("、") || "相关主题";
}

export function buildStoredAcademicDetailSummary(item: ContentItem): DetailSummary {
  const analysis = item.metadata.analysis;
  const sections = [
    {
      index: "4.1",
      title: "研究背景",
      body: pickChineseText(
        analysis?.content_sections?.[0]?.items?.[0],
        `这篇文章围绕 ${topicText(item)} 展开，重点回应研究、支持或实践层面的核心问题。`,
      ),
    },
    {
      index: "4.2",
      title: "研究对象或问题",
      body: pickChineseText(
        analysis?.content_sections?.[0]?.items?.[1],
        `文章主要关注《${item.title_original}》涉及的问题，重点分析 ${topicText(item)} 相关人群在支持、教育、评估或生活场景中的实际需求。`,
      ),
    },
    {
      index: "4.3",
      title: "研究方法",
      body: pickChineseText(
        analysis?.research_method,
        `从公开摘要与全文结构判断，这是一篇${inferStudyLabel(item)}，当前重点整理研究问题、主要发现和实践含义。`,
      ),
    },
    {
      index: "4.4",
      title: "核心发现",
      body: pickChineseText(
        analysis?.key_findings,
        `现有信息显示，文章给出了与 ${topicText(item)} 相关的核心发现，重点可用于理解支持需求与实践方向。`,
      ),
    },
    {
      index: "4.5",
      title: "实践启示",
      body: pickChineseText(
        analysis?.practical_significance || analysis?.china_insights?.[0],
        `这篇文章更适合继续转化为面向家庭、学校、临床或职场的中文行动建议，而不是停留在学术结论层。`,
      ),
    },
  ];

  return {
    title: deriveTitle(item),
    time_text: deriveTimeText(item),
    author_text: deriveAuthorText(item),
    sections,
    conclusion: pickChineseText(
      analysis?.conclusion,
      `综合现有信息，这篇内容可作为 ${topicText(item)} 的进一步阅读材料，适合继续补充更细的中文解读。`,
    ),
  };
}

export function materializeStoredFields(item: ContentItem): ContentItem {
  if (item.source_type !== "academic") {
    return item;
  }

  return {
    ...item,
    metadata: {
      ...item.metadata,
      detail_summary: buildStoredAcademicDetailSummary(item),
    },
  };
}

export function materializeStoredItems(items: ContentItem[]): ContentItem[] {
  return items.map((item) => materializeStoredFields(item));
}
