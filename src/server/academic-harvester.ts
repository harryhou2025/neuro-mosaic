import { PDFParse } from "pdf-parse";
import { safeExcerpt } from "../shared/content-ops";
import type { AudienceKey, ConditionKey, ContentItem } from "../shared/content";

type AcademicSearchConfig = {
  id: string;
  query: string;
  defaultTopics: string[];
  defaultAudiences: AudienceKey[];
  defaultConditions: ConditionKey[];
  targetCount: number;
};

type MetaRecord = Record<string, string[]>;

type ParsedAcademicDocument = {
  title: string;
  journal: string;
  publicationDate: string;
  doi?: string;
  pmid?: string;
  authors: string[];
  articleUrl: string;
  pdfUrl?: string;
  abstractText: string;
  sectionSummaries: Array<{ title: string; summary: string }>;
  methodsText?: string;
  implicationsText?: string;
  conclusionText?: string;
  parsedFrom: "html" | "pdf";
};

const academicSearchConfigs: AcademicSearchConfig[] = [
  {
    id: "autism-2026",
    query: '((autism[Title/Abstract] OR autistic[Title/Abstract]) AND (support[Title/Abstract] OR education[Title/Abstract] OR school[Title/Abstract] OR intervention[Title/Abstract] OR family[Title/Abstract]))',
    defaultTopics: ["自闭症", "教育", "家庭支持"],
    defaultAudiences: ["family", "educator", "researcher", "clinician"],
    defaultConditions: ["autism"],
    targetCount: 10,
  },
  {
    id: "adhd-2026",
    query: '((ADHD[Title/Abstract] OR "attention-deficit/hyperactivity disorder"[Title/Abstract]) AND (support[Title/Abstract] OR education[Title/Abstract] OR school[Title/Abstract] OR workplace[Title/Abstract] OR intervention[Title/Abstract]))',
    defaultTopics: ["ADHD", "教育", "职场"],
    defaultAudiences: ["self-advocate", "educator", "researcher", "family", "employer"],
    defaultConditions: ["adhd"],
    targetCount: 10,
  },
  {
    id: "learning-difficulties-2026",
    query: '(("learning disability"[Title/Abstract] OR dyslexia[Title/Abstract] OR "specific learning disorder"[Title/Abstract]) AND (support[Title/Abstract] OR education[Title/Abstract] OR school[Title/Abstract] OR intervention[Title/Abstract]))',
    defaultTopics: ["学习困难", "教育", "家庭支持"],
    defaultAudiences: ["family", "educator", "researcher", "clinician"],
    defaultConditions: ["learning-difficulties"],
    targetCount: 10,
  },
  {
    id: "neurodiversity-2026",
    query: '((neurodiversity[Title/Abstract] OR neurodivergent[Title/Abstract]) AND (support[Title/Abstract] OR higher education[Title/Abstract] OR workplace[Title/Abstract] OR inclusion[Title/Abstract]))',
    defaultTopics: ["神经多样性", "教育", "职场"],
    defaultAudiences: ["self-advocate", "educator", "researcher", "employer"],
    defaultConditions: ["neurodiversity", "adhd", "autism"],
    targetCount: 10,
  },
];

const skippedHeadings = new Set([
  "abstract",
  "permalink",
  "actions",
  "resources",
  "acknowledgments",
  "biography",
  "footnotes",
  "references",
  "similar articles",
  "cited by other articles",
  "links to ncbi databases",
]);

function decodeEntities(text: string): string {
  return text
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#8211;/g, "-")
    .replace(/&#8212;/g, "-")
    .replace(/&#x2019;/g, "'");
}

function stripTags(text: string): string {
  return decodeEntities(text)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<sup[\s\S]*?<\/sup>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseMetaTags(html: string): MetaRecord {
  const meta: MetaRecord = {};
  for (const match of html.matchAll(/<meta[^>]+(?:name|property)=["']([^"']+)["'][^>]+content=["']([^"]*?)["'][^>]*>/gi)) {
    const key = match[1].trim().toLowerCase();
    const value = decodeEntities(match[2]).trim();
    if (!value) {
      continue;
    }
    meta[key] = meta[key] ?? [];
    meta[key].push(value);
  }
  return meta;
}

function getMetaValues(meta: MetaRecord, key: string): string[] {
  return meta[key.toLowerCase()] ?? [];
}

function getMetaValue(meta: MetaRecord, ...keys: string[]): string {
  for (const key of keys) {
    const value = getMetaValues(meta, key)[0];
    if (value?.trim()) {
      return value.trim();
    }
  }
  return "";
}

function normalizeDate(input: string): string {
  const date = new Date(input);
  if (!Number.isNaN(date.getTime())) {
    return date.toISOString();
  }
  const fallback = new Date(`${input} UTC`);
  if (!Number.isNaN(fallback.getTime())) {
    return fallback.toISOString();
  }
  return new Date().toISOString();
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function firstMeaningfulSentence(text: string, maxLength = 220): string {
  const sentence = splitSentences(text).find((part) => part.length > 30) ?? text;
  return safeExcerpt(sentence, maxLength);
}

function deriveStudyType(title: string, abstractText: string): string {
  const text = `${title} ${abstractText}`.toLowerCase();
  if (/systematic review|scoping review|meta-analysis|review\b/.test(text)) {
    return "综述/系统回顾";
  }
  if (/trial|randomized|intervention/.test(text)) {
    return "干预研究";
  }
  if (/cohort|longitudinal/.test(text)) {
    return "队列/纵向研究";
  }
  if (/survey|cross-sectional/.test(text)) {
    return "横断面调查";
  }
  if (/qualitative|interview|focus group/.test(text)) {
    return "质性研究";
  }
  return "学术研究";
}

function deriveContentType(title: string, abstractText: string): ContentItem["content_type"] {
  const text = `${title} ${abstractText}`.toLowerCase();
  if (/systematic review|scoping review|meta-analysis|review\b/.test(text)) {
    return "review";
  }
  return "research";
}

function getHubRelevanceScore(title: string, abstractText: string): number {
  const text = `${title} ${abstractText}`.toLowerCase();
  let score = 0;

  for (const pattern of [/support/, /education/, /school/, /teacher/, /family/, /intervention/, /practice/, /assessment/, /workplace/, /review/, /therapy/]) {
    if (pattern.test(text)) {
      score += 2;
    }
  }

  for (const pattern of [/gene/, /molecular/, /receptor/, /mouse/, /rat\b/, /prenatal exposure/, /biomarker/, /neuroimaging/, /protein/, /cellular/]) {
    if (pattern.test(text)) {
      score -= 3;
    }
  }

  return score;
}

function isUsefulForHub(document: ParsedAcademicDocument): boolean {
  return getHubRelevanceScore(document.title, document.abstractText) >= 3;
}

function buildChinaInsights(item: ContentItem): string[] {
  const insights = [
    "把论文结论转成中文内容时，最好补上学校、医院和家庭在国内现实环境中的可执行步骤，而不只停留在概念层。",
    "如果文章讨论的是评估、支持或干预，落地时要同时说明资源门槛、转介路径和家校协作成本。",
  ];
  if (item.conditions.includes("learning-difficulties")) {
    insights.push("对学习困难主题，最值得补充的是国内学校场景中的识别流程、课堂调整和家长期待管理。");
  }
  if (item.conditions.includes("adhd")) {
    insights.push("对 ADHD 主题，中文读者通常更需要任务拆解、作息管理和学校/职场沟通的具体范例。");
  }
  if (item.conditions.includes("autism")) {
    insights.push("对自闭症主题，建议补上发展阶段差异，以及从儿童支持过渡到成人支持的路径说明。");
  }
  return insights;
}

function buildAcademicAnalysis(item: ContentItem, document: ParsedAcademicDocument): NonNullable<ContentItem["metadata"]["analysis"]> {
  const publicationInfoParts = [document.journal, new Date(document.publicationDate).toLocaleDateString("zh-CN")].filter(Boolean);
  const contentSections: NonNullable<ContentItem["metadata"]["analysis"]>["content_sections"] = [
    {
      title: "文章概览",
      items: [
        `原文题目：${document.title}`,
        `研究类型：${deriveStudyType(document.title, document.abstractText)}。`,
        `核心摘要：${firstMeaningfulSentence(document.abstractText, 260)}`,
      ],
    },
  ];

  if (document.sectionSummaries.length > 0) {
    contentSections.push({
      title: "正文结构",
      items: document.sectionSummaries.slice(0, 5).map((section) => `${section.title}：${section.summary}`),
    });
  }

  return {
    template: "academic",
    summary_title: `《${item.title_zh || document.title}》`,
    publication_info: publicationInfoParts.join("，"),
    authors_display: document.authors.slice(0, 6).join("、") || undefined,
    content_sections: contentSections,
    key_findings: firstMeaningfulSentence(document.abstractText, 220),
    research_method:
      document.methodsText ||
      `基于 ${deriveStudyType(document.title, document.abstractText)} 自动识别。当前优先使用 ${document.parsedFrom === "pdf" ? "PDF" : "PMC 全文页"} 中可获取的摘要与章节结构。`,
    practical_significance:
      document.implicationsText ||
      "这篇文章适合继续整理成面向教师、家庭或支持人员的行动清单，而不是只停留在学术结论层。",
    strategy_points: document.sectionSummaries.slice(0, 4).map((section) => `${section.title}：${section.summary}`),
    conclusion: document.conclusionText || firstMeaningfulSentence(document.abstractText, 220),
    china_insights: buildChinaInsights(item),
  };
}

function parseSectionSummaries(html: string): Array<{ title: string; summary: string }> {
  const headings = Array.from(html.matchAll(/<(h2|h3)[^>]*>([\s\S]*?)<\/\1>/gi));
  const summaries: Array<{ title: string; summary: string }> = [];

  for (let index = 0; index < headings.length; index += 1) {
    const match = headings[index];
    const title = stripTags(match[2]);
    const normalized = title.toLowerCase();
    if (!title || skippedHeadings.has(normalized) || /^figure\b/i.test(title)) {
      continue;
    }

    const start = match.index ?? 0;
    const end = headings[index + 1]?.index ?? html.length;
    const chunk = html.slice(start, end);
    const paragraphs = Array.from(chunk.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi))
      .map((paragraph) => stripTags(paragraph[1]))
      .filter((paragraph) => paragraph.length > 60);
    const summary = paragraphs[0] ? firstMeaningfulSentence(paragraphs[0], 220) : "";

    if (summary) {
      summaries.push({ title, summary });
    }
  }

  return summaries;
}

function extractPmcDocument(html: string, articleUrl: string): ParsedAcademicDocument {
  const meta = parseMetaTags(html);
  const abstractText =
    stripTags((html.match(/<section class="abstract"[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i) ?? [])[1] ?? "") ||
    getMetaValue(meta, "description", "og:description");
  const sectionSummaries = parseSectionSummaries(html);
  const implications = sectionSummaries.find((section) => /implications|practice|research/i.test(section.title))?.summary;
  const conclusion = sectionSummaries.at(-1)?.summary || firstMeaningfulSentence(abstractText, 220);

  return {
    title: getMetaValue(meta, "citation_title", "og:title"),
    journal: getMetaValue(meta, "citation_journal_title"),
    publicationDate: normalizeDate(getMetaValue(meta, "citation_publication_date", "article:published_time") || new Date().toISOString()),
    doi: getMetaValue(meta, "citation_doi") || undefined,
    pmid: getMetaValue(meta, "citation_pmid") || undefined,
    authors: getMetaValues(meta, "citation_author"),
    articleUrl,
    pdfUrl: getMetaValue(meta, "citation_pdf_url") || undefined,
    abstractText,
    sectionSummaries,
    methodsText: `从全文结构看，文章按 ${sectionSummaries.slice(0, 4).map((section) => section.title).join("、")} 展开。`,
    implicationsText: implications,
    conclusionText: conclusion,
    parsedFrom: "html",
  };
}

function extractPubMedDocument(html: string, articleUrl: string): ParsedAcademicDocument {
  const meta = parseMetaTags(html);
  const abstractText =
    stripTags((html.match(/<div class="abstract-content[\s\S]*?<p>([\s\S]*?)<\/p>/i) ?? [])[1] ?? "") ||
    getMetaValue(meta, "description", "og:description");
  return {
    title: getMetaValue(meta, "citation_title", "og:title"),
    journal: getMetaValue(meta, "citation_journal_title"),
    publicationDate: normalizeDate(getMetaValue(meta, "citation_publication_date", "citation_date") || new Date().toISOString()),
    doi: getMetaValue(meta, "citation_doi") || undefined,
    pmid: getMetaValue(meta, "citation_pmid") || undefined,
    authors: getMetaValues(meta, "citation_author"),
    articleUrl,
    abstractText,
    sectionSummaries: [],
    conclusionText: firstMeaningfulSentence(abstractText, 220),
    parsedFrom: "html",
  };
}

function extractPmcUrlFromPubMed(html: string): string | null {
  const identifierMatch = html.match(
    /<span class="identifier pmc">[\s\S]*?href="(https:\/\/pmc\.ncbi\.nlm\.nih\.gov\/articles\/PMC\d+\/?)"/i,
  );
  if (identifierMatch?.[1]) {
    return identifierMatch[1];
  }

  const fallback = html.match(/https:\/\/pmc\.ncbi\.nlm\.nih\.gov\/articles\/PMC\d+\/?/i);
  return fallback?.[0] ?? null;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 Codex Neuro Mosaic",
      accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
    },
  });
  if (!response.ok) {
    throw new Error(`Fetch failed: ${response.status} ${url}`);
  }
  return response.text();
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 Codex Neuro Mosaic",
      accept: "application/json,*/*;q=0.8",
    },
  });
  if (!response.ok) {
    throw new Error(`Fetch failed: ${response.status} ${url}`);
  }
  return response.json() as Promise<T>;
}

async function searchPubMedIds(query: string, retmax: number): Promise<string[]> {
  const year = new Date().getFullYear();
  const term = `${query} AND (${year}[pdat]) AND (free full text[sb])`;
  const url =
    "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&sort=pub_date&retmax=" +
    String(retmax) +
    "&term=" +
    encodeURIComponent(term);
  const result = await fetchJson<{ esearchresult?: { idlist?: string[] } }>(url);
  return result.esearchresult?.idlist?.filter(Boolean) ?? [];
}

async function tryExtractPdfText(pdfUrl: string): Promise<string | null> {
  try {
    const response = await fetch(pdfUrl, {
      headers: {
        "user-agent": "Mozilla/5.0 Codex Neuro Mosaic",
        accept: "application/pdf,*/*;q=0.8",
      },
    });
    if (!response.ok) {
      return null;
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("pdf")) {
      return null;
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText({ first: 4 });
    await parser.destroy();
    return result.text.replace(/\s+/g, " ").trim();
  } catch {
    return null;
  }
}

function mergeAcademicData(item: ContentItem, document: ParsedAcademicDocument, pdfText?: string | null): ContentItem {
  const abstractText = document.abstractText || item.summary_original || item.excerpt;
  const titleZh =
    !item.title_zh || /^研究：PubMed \d+$/i.test(item.title_zh) ? `研究：${document.title}` : item.title_zh;
  const summaryZh = `基于学术全文自动解析：${safeExcerpt(document.abstractText || item.summary_original || item.excerpt, 110)}`;
  const merged: ContentItem = {
    ...item,
    source_name: document.journal || item.source_name,
    source_url: document.articleUrl || item.source_url,
    canonical_url: document.articleUrl || item.canonical_url,
    title_original: document.title || item.title_original,
    title_zh: titleZh,
    summary_original: abstractText,
    summary_zh: summaryZh,
    excerpt: pdfText ? safeExcerpt(pdfText, 260) : safeExcerpt(abstractText, 260),
    published_at: document.publicationDate || item.published_at,
    review_status: "approved",
    review_notes: document.parsedFrom === "pdf" ? "自动发布：学术条目，已解析 PDF。" : "自动发布：学术条目，已解析 PMC/PubMed 页面。",
    metadata: {
      ...item.metadata,
      doi: document.doi || item.metadata.doi,
      pmid: document.pmid || item.metadata.pmid,
      authors: document.authors.join("; ") || item.metadata.authors,
      article_url: document.articleUrl || item.metadata.article_url,
      pdf_url: document.pdfUrl || item.metadata.pdf_url,
      credibility: "high",
      tags: Array.from(new Set([...(item.metadata.tags ?? []), "academic-enriched", document.parsedFrom === "pdf" ? "pdf" : "html"])),
    },
  };

  merged.metadata.analysis = buildAcademicAnalysis(merged, {
    ...document,
    parsedFrom: pdfText ? "pdf" : document.parsedFrom,
  });
  return merged;
}

function buildAcademicSeedItem(config: AcademicSearchConfig, pmid: string): ContentItem {
  const articleUrl = `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;
  return {
    id: `academic-${config.id}-${pmid}`,
    source_name: "PubMed",
    source_type: "academic",
    source_region: "国际",
    source_url: articleUrl,
    canonical_url: articleUrl,
    title_original: `PubMed ${pmid}`,
    title_zh: `研究：PubMed ${pmid}`,
    summary_original: "Academic article pending enrichment.",
    summary_zh: "学术条目已抓取，等待自动解析全文。",
    excerpt: "Academic article pending enrichment.",
    language: "en",
    published_at: new Date().toISOString(),
    content_type: "research",
    topics: config.defaultTopics,
    audiences: config.defaultAudiences,
    conditions: config.defaultConditions,
    review_status: "approved",
    review_notes: "自动发布：PubMed 近期全文候选。",
    ingested_at: new Date().toISOString(),
    metadata: {
      pmid,
      article_url: articleUrl,
      credibility: "high",
      tags: ["academic-search", config.id],
    },
  };
}

export async function enrichAcademicItem(item: ContentItem): Promise<ContentItem> {
  if (item.source_type !== "academic") {
    return item;
  }

  try {
    const url = item.metadata.article_url || item.source_url;
    const landingHtml = await fetchText(url);

    let document = /pmc\.ncbi\.nlm\.nih\.gov\/articles\//.test(url)
      ? extractPmcDocument(landingHtml, url)
      : extractPubMedDocument(landingHtml, url);

    if (/pubmed\.ncbi\.nlm\.nih\.gov\//.test(url)) {
      const pmcUrl = extractPmcUrlFromPubMed(landingHtml);
      if (pmcUrl) {
        const pmcHtml = await fetchText(pmcUrl);
        document = extractPmcDocument(pmcHtml, pmcUrl);
      }
    }

    const pdfText = document.pdfUrl ? await tryExtractPdfText(document.pdfUrl) : null;
    return mergeAcademicData(
      {
        ...item,
        content_type: deriveContentType(document.title, document.abstractText),
      },
      document,
      pdfText,
    );
  } catch {
    return item;
  }
}

export async function harvestAcademicSources(): Promise<ContentItem[]> {
  const seededItems: ContentItem[] = [];
  const seenPmids = new Set<string>();

  for (const config of academicSearchConfigs) {
    const pmids = await searchPubMedIds(config.query, config.targetCount * 4);
    for (const pmid of pmids) {
      if (seenPmids.has(pmid)) {
        continue;
      }
      seenPmids.add(pmid);
      seededItems.push(buildAcademicSeedItem(config, pmid));
      if (seededItems.length >= 80) {
        break;
      }
    }
    if (seededItems.length >= 80) {
      break;
    }
  }

const enriched = await Promise.all(seededItems.map((item) => enrichAcademicItem(item)));
  return enriched
    .filter(
      (item) =>
        Boolean(item.metadata.analysis?.content_sections?.length || item.metadata.analysis?.key_findings) &&
        item.source_url.includes("pmc.ncbi.nlm.nih.gov/articles/") &&
        isUsefulForHub({
          title: item.title_original,
          journal: item.source_name,
          publicationDate: item.published_at,
          doi: item.metadata.doi,
          pmid: item.metadata.pmid,
          authors: item.metadata.authors?.split(";").map((author) => author.trim()).filter(Boolean) ?? [],
          articleUrl: item.source_url,
          pdfUrl: item.metadata.pdf_url,
          abstractText: item.summary_original,
          sectionSummaries: [],
          parsedFrom: "html",
        }),
    )
    .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())
    .slice(0, 20);
}

export const academicHarvesterInternals = {
  extractPmcDocument,
  extractPubMedDocument,
  extractPmcUrlFromPubMed,
  parseSectionSummaries,
  parseMetaTags,
};
