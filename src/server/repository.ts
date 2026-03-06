import path from "node:path";
import type { ContentItem, ReviewStatus } from "../shared/content";
import { buildPublicIndex, classifyItem, dedupeItems, splitByTopic } from "../shared/content-ops";
import { curatedSeedItems, retiredSeedItemIds } from "../shared/sample-sources";
import { materializeStoredItems } from "./detail-summary-materializer";
import { readJsonFile, storagePaths, writeJsonFile } from "./storage";

export async function getReviewItems(): Promise<ContentItem[]> {
  const saved = await readJsonFile<ContentItem[]>(storagePaths.review, []);
  if (saved.length > 0) {
    return saved;
  }
  const normalizedSeedItems = curatedSeedItems.map((item) => classifyItem(item));
  await saveReviewItems(normalizedSeedItems);
  return normalizedSeedItems;
}

export async function saveReviewItems(items: ContentItem[]): Promise<void> {
  const filtered = items.filter((item) => !retiredSeedItemIds.includes(item.id as (typeof retiredSeedItemIds)[number]));
  await writeJsonFile(storagePaths.review, dedupeItems(materializeStoredItems(filtered)));
}

export async function upsertReviewItems(nextItems: ContentItem[]): Promise<ContentItem[]> {
  const current = await getReviewItems();
  const hasGeneratedAcademicItems = nextItems.some((item) => item.source_type === "academic" && item.id.startsWith("academic-"));
  const preservedCurrent = current.filter(
    (item) => !(hasGeneratedAcademicItems && item.source_type === "academic" && item.id.startsWith("academic-")),
  );
  const merged = dedupeItems([...preservedCurrent, ...nextItems]);
  await saveReviewItems(merged);
  return merged;
}

export async function updateReviewStatus(
  id: string,
  payload: Partial<Pick<ContentItem, "review_notes" | "title_zh" | "summary_zh" | "topics" | "audiences" | "conditions">> & {
    review_status: ReviewStatus;
  },
): Promise<ContentItem | null> {
  const current = await getReviewItems();
  const updated = current.map((item) => (item.id === id ? { ...item, ...payload } : item));
  const match = updated.find((item) => item.id === id) ?? null;
  await saveReviewItems(updated);
  return match;
}

export async function publishApprovedItems(): Promise<{ version: string; count: number }> {
  const items = materializeStoredItems(await getReviewItems());
  const index = buildPublicIndex(items);
  const byTopic = splitByTopic(items);

  await saveReviewItems(items);
  await writeJsonFile(path.join(storagePaths.generated, "content-index.json"), index);
  for (const [slug, topicItems] of Object.entries(byTopic)) {
    await writeJsonFile(path.join(storagePaths.topics, `${slug}.json`), topicItems);
  }

  return { version: index.version, count: index.items.length };
}
