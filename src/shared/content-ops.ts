import { contentItemSchema, publicIndexSchema, type ContentItem, type PublicIndex } from "./content";
import { findSourceDirectoryEntry } from "./source-directory";
import { slugifyTopic } from "./taxonomy";

type PartialItem = Omit<ContentItem, "topics" | "audiences" | "conditions" | "source_region"> & {
  source_region?: string;
  topics?: string[];
  audiences?: ContentItem["audiences"];
  conditions?: ContentItem["conditions"];
};

const topicRules: Array<{ pattern: RegExp; topic: string }> = [
  { pattern: /(autism|自闭)/i, topic: "自闭症" },
  { pattern: /(adhd|attention deficit|多动)/i, topic: "ADHD" },
  { pattern: /(learning|dyslexia|读写|学习困难)/i, topic: "学习困难" },
  { pattern: /(school|classroom|education|教育)/i, topic: "教育" },
  { pattern: /(work|employment|workplace|职场)/i, topic: "职场" },
  { pattern: /(family|parent|caregiver|家庭|家长)/i, topic: "家庭支持" },
  { pattern: /(policy|service|guideline|resource|政策|服务)/i, topic: "政策与服务" },
  { pattern: /(anxiety|sleep|support needs|共病|支持)/i, topic: "共病与支持需求" },
];

const audienceRules: Array<{ pattern: RegExp; audience: ContentItem["audiences"][number] }> = [
  { pattern: /(family|parent|caregiver|家庭|家长)/i, audience: "family" },
  { pattern: /(adult|self|lived experience|当事人)/i, audience: "self-advocate" },
  { pattern: /(teacher|school|classroom|教育)/i, audience: "educator" },
  { pattern: /(clinical|clinician|health|support|诊疗)/i, audience: "clinician" },
  { pattern: /(study|systematic review|journal|研究)/i, audience: "researcher" },
  { pattern: /(employer|workplace|hr|职场)/i, audience: "employer" },
];

const conditionRules: Array<{ pattern: RegExp; condition: ContentItem["conditions"][number] }> = [
  { pattern: /(autism|asd|自闭)/i, condition: "autism" },
  { pattern: /(adhd|attention deficit|多动)/i, condition: "adhd" },
  { pattern: /(learning|dyslexia|学习困难)/i, condition: "learning-difficulties" },
  { pattern: /(neurodivers|神经多样)/i, condition: "neurodiversity" },
];

export function safeExcerpt(input: string, maxLength = 280): string {
  const collapsed = input.replace(/\s+/g, " ").trim();
  if (collapsed.length <= maxLength) {
    return collapsed;
  }
  return `${collapsed.slice(0, maxLength - 1).trim()}…`;
}

function pickUnique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

export function classifyItem(item: PartialItem): ContentItem {
  const text = [
    item.title_original,
    item.title_zh,
    item.summary_original,
    item.summary_zh,
    item.excerpt,
    item.review_notes,
  ]
    .filter(Boolean)
    .join(" ");

  const topics = pickUnique([
    ...(item.topics ?? []),
    "神经多样性",
    ...topicRules.filter((rule) => rule.pattern.test(text)).map((rule) => rule.topic),
  ]);

  const audiences = pickUnique([
    ...(item.audiences ?? []),
    ...audienceRules.filter((rule) => rule.pattern.test(text)).map((rule) => rule.audience),
  ]);

  const conditions = pickUnique([
    ...(item.conditions ?? []),
    ...conditionRules.filter((rule) => rule.pattern.test(text)).map((rule) => rule.condition),
  ]);

  const sourceEntry = findSourceDirectoryEntry({ sourceName: item.source_name, url: item.source_url });

  return contentItemSchema.parse({
    ...item,
    source_region: item.source_region || sourceEntry?.region || "国际",
    excerpt: safeExcerpt(item.excerpt),
    topics: topics.length ? topics : ["神经多样性"],
    audiences: audiences.length ? audiences : ["family", "researcher"],
    conditions: conditions.length ? conditions : ["neurodiversity"],
  });
}

function dedupeKey(item: ContentItem): string {
  return item.metadata.doi ?? item.metadata.pmid ?? item.canonical_url;
}

export function dedupeItems(items: ContentItem[]): ContentItem[] {
  const map = new Map<string, ContentItem>();
  for (const item of items) {
    const existing = map.get(dedupeKey(item));
    if (!existing) {
      map.set(dedupeKey(item), item);
      continue;
    }
    const next = new Date(item.ingested_at).getTime() >= new Date(existing.ingested_at).getTime() ? item : existing;
    map.set(dedupeKey(item), next);
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime(),
  );
}

export function buildPublicIndex(items: ContentItem[]): PublicIndex {
  const approved = items.filter((item) => item.review_status === "approved");
  const countsByTopic: Record<string, number> = {};
  const countsBySourceType: Record<string, number> = {};
  const countsByRegion: Record<string, number> = {};

  for (const item of approved) {
    countsBySourceType[item.source_type] = (countsBySourceType[item.source_type] ?? 0) + 1;
    countsByRegion[item.source_region] = (countsByRegion[item.source_region] ?? 0) + 1;
    for (const topic of item.topics) {
      const slug = slugifyTopic(topic);
      countsByTopic[slug] = (countsByTopic[slug] ?? 0) + 1;
    }
  }

  return publicIndexSchema.parse({
    version: `v${Date.now()}`,
    generated_at: new Date().toISOString(),
    counts: {
      total: approved.length,
      by_topic: countsByTopic,
      by_source_type: countsBySourceType,
      by_region: countsByRegion,
    },
    items: approved,
  });
}

export function splitByTopic(items: ContentItem[]): Record<string, ContentItem[]> {
  const result: Record<string, ContentItem[]> = {};
  for (const item of items.filter((entry) => entry.review_status === "approved")) {
    for (const topic of item.topics) {
      const slug = slugifyTopic(topic);
      result[slug] = result[slug] ?? [];
      result[slug].push(item);
    }
  }
  return result;
}
