import { createHash } from "node:crypto";
import { classifyItem, safeExcerpt } from "../shared/content-ops";
import type { AudienceKey, ConditionKey, ContentItem, SourceType } from "../shared/content";
import { labels } from "../shared/taxonomy";
import { sourceDirectory, type SourceDirectoryEntry } from "../shared/source-directory";

type FeedConfig = {
  id: string;
  sourceName: string;
  sourceType: SourceType;
  sourceUrl: string;
  feedUrl: string;
  defaultAudiences: AudienceKey[];
  defaultConditions: ConditionKey[];
  defaultTopics: string[];
  contentType: ContentItem["content_type"];
  maxItems: number;
};

type ParsedFeedItem = {
  title: string;
  link: string;
  description: string;
  pubDate: string;
};

const feedConfigs: FeedConfig[] = [
  {
    id: "chadd-feed",
    sourceName: "CHADD",
    sourceType: "official",
    sourceUrl: "https://chadd.org/",
    feedUrl: "https://chadd.org/feed/",
    defaultAudiences: ["family", "educator", "self-advocate"],
    defaultConditions: ["adhd"],
    defaultTopics: ["ADHD", "教育", "家庭支持"],
    contentType: "news",
    maxItems: 4,
  },
  {
    id: "ncld-feed",
    sourceName: "NCLD",
    sourceType: "official",
    sourceUrl: "https://www.ncld.org/",
    feedUrl: "https://www.ncld.org/feed/",
    defaultAudiences: ["family", "educator"],
    defaultConditions: ["learning-difficulties"],
    defaultTopics: ["学习困难", "教育", "家庭支持"],
    contentType: "news",
    maxItems: 4,
  },
  {
    id: "childmind-feed",
    sourceName: "Child Mind Institute",
    sourceType: "official",
    sourceUrl: "https://childmind.org/",
    feedUrl: "https://childmind.org/feed/",
    defaultAudiences: ["family", "clinician"],
    defaultConditions: ["adhd", "autism", "learning-difficulties"],
    defaultTopics: ["神经多样性", "家庭支持", "共病与支持需求"],
    contentType: "news",
    maxItems: 4,
  },
  {
    id: "additude-feed",
    sourceName: "ADDitude",
    sourceType: "media",
    sourceUrl: "https://www.additudemag.com/",
    feedUrl: "https://www.additudemag.com/feed/",
    defaultAudiences: ["family", "self-advocate", "educator"],
    defaultConditions: ["adhd", "learning-difficulties"],
    defaultTopics: ["ADHD", "教育", "家庭支持"],
    contentType: "news",
    maxItems: 4,
  },
  {
    id: "caddac-feed",
    sourceName: "CADDAC",
    sourceType: "official",
    sourceUrl: "https://caddac.ca/",
    feedUrl: "https://www.caddac.ca/feed/",
    defaultAudiences: ["family", "educator", "employer", "self-advocate"],
    defaultConditions: ["adhd"],
    defaultTopics: ["ADHD", "教育", "职场", "家庭支持"],
    contentType: "news",
    maxItems: 4,
  },
];

function hashId(input: string): string {
  return createHash("sha1").update(input).digest("hex").slice(0, 12);
}

function decodeEntities(text: string): string {
  return text
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripTags(text: string): string {
  return decodeEntities(text).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function firstMatch(source: string, pattern: RegExp): string {
  const match = source.match(pattern);
  return match?.[1]?.trim() ?? "";
}

function extractHtmlMeta(html: string): { title: string; description: string; publishedAt: string } {
  const title =
    stripTags(firstMatch(html, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)) ||
    stripTags(firstMatch(html, /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i)) ||
    stripTags(firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i));

  const description =
    stripTags(firstMatch(html, /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)) ||
    stripTags(firstMatch(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)) ||
    stripTags(firstMatch(html, /<meta[^>]+name=["']twitter:description["'][^>]+content=["']([^"']+)["']/i));

  const publishedAt =
    firstMatch(html, /<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i) ||
    firstMatch(html, /<meta[^>]+name=["']article:published_time["'][^>]+content=["']([^"']+)["']/i) ||
    new Date().toISOString();

  return { title, description, publishedAt };
}

function parseRssXml(xml: string): ParsedFeedItem[] {
  const matches = Array.from(xml.matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/gi));
  return matches
    .map((match) => {
      const block = match[0];
      const title = stripTags(firstMatch(block, /<title[^>]*>([\s\S]*?)<\/title>/i));
      const link =
        stripTags(firstMatch(block, /<link[^>]*>([\s\S]*?)<\/link>/i)) ||
        firstMatch(block, /<link[^>]+href=["']([^"']+)["']/i);
      const description =
        stripTags(firstMatch(block, /<description[^>]*>([\s\S]*?)<\/description>/i)) ||
        stripTags(firstMatch(block, /<content:encoded[^>]*>([\s\S]*?)<\/content:encoded>/i)) ||
        stripTags(firstMatch(block, /<summary[^>]*>([\s\S]*?)<\/summary>/i));
      const pubDate =
        stripTags(firstMatch(block, /<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)) ||
        stripTags(firstMatch(block, /<published[^>]*>([\s\S]*?)<\/published>/i)) ||
        new Date().toISOString();
      return { title, link, description, pubDate };
    })
    .filter((item) => item.title && item.link);
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 Codex Neuro Mosaic",
      accept: "text/html,application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.8",
    },
  });
  if (!response.ok) {
    throw new Error(`Fetch failed: ${response.status} ${url}`);
  }
  return response.text();
}

function entryToContentItem(entry: SourceDirectoryEntry, html: string): ContentItem {
  const meta = extractHtmlMeta(html);
  const titleOriginal = meta.title || entry.name;
  const summaryOriginal = meta.description || entry.focus;
  const summaryZh = `${entry.focus}。适合通过 ${entry.name} 进一步进入该主题的权威信息。`;
  return classifyItem({
    id: `page-${entry.id}`,
    source_name: entry.name,
    source_type: entry.sourceType,
    source_url: entry.url,
    canonical_url: entry.url,
    title_original: titleOriginal,
    title_zh: `${entry.name} 资源入口`,
    summary_original: summaryOriginal,
    summary_zh: summaryZh,
    excerpt: summaryOriginal || entry.focus,
    language: "bilingual",
    published_at: meta.publishedAt,
    content_type: "directory",
    topics: entry.conditions.map((condition) => labels.condition[condition]),
    audiences: entry.audiences,
    conditions: entry.conditions,
    review_status: "approved",
    review_notes: "自动抓取：白名单页面来源。",
    ingested_at: new Date().toISOString(),
    metadata: {
      credibility: entry.sourceType === "media" ? "medium" : "high",
      tags: ["page-harvest", entry.region],
    },
  });
}

function feedItemToContentItem(config: FeedConfig, item: ParsedFeedItem): ContentItem {
  const publishedAt = new Date(item.pubDate);
  return classifyItem({
    id: `feed-${config.id}-${hashId(item.link)}`,
    source_name: config.sourceName,
    source_type: config.sourceType,
    source_url: item.link,
    canonical_url: item.link,
    title_original: item.title,
    title_zh: `${config.sourceName}：${item.title}`,
    summary_original: item.description || item.title,
    summary_zh: `${config.sourceName} 最新条目：${safeExcerpt(item.description || item.title, 90)}`,
    excerpt: item.description || item.title,
    language: "en",
    published_at: Number.isNaN(publishedAt.getTime()) ? new Date().toISOString() : publishedAt.toISOString(),
    content_type: config.contentType,
    topics: config.defaultTopics,
    audiences: config.defaultAudiences,
    conditions: config.defaultConditions,
    review_status: "approved",
    review_notes: "自动抓取：RSS 来源。",
    ingested_at: new Date().toISOString(),
    metadata: {
      credibility: config.sourceType === "media" ? "medium" : "high",
      tags: ["rss-harvest", config.id],
    },
  });
}

export async function harvestPageSources(): Promise<ContentItem[]> {
  const results = await Promise.allSettled(
    sourceDirectory.map(async (entry) => {
      const html = await fetchText(entry.url);
      return entryToContentItem(entry, html);
    }),
  );

  return results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
}

export async function harvestFeedSources(): Promise<ContentItem[]> {
  const results = await Promise.allSettled(
    feedConfigs.map(async (config) => {
      const xml = await fetchText(config.feedUrl);
      return parseRssXml(xml)
        .slice(0, config.maxItems)
        .map((item) => feedItemToContentItem(config, item));
    }),
  );

  return results.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
}

export const harvestInternals = {
  extractHtmlMeta,
  parseRssXml,
};
