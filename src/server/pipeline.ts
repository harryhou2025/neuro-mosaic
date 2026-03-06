import { classifyItem } from "../shared/content-ops";
import { incomingSeedItems } from "../shared/sample-sources";
import { ingestPubMedContent } from "./pubmed";
import { harvestFeedSources, harvestPageSources } from "./source-harvester";
import { getReviewItems, upsertReviewItems } from "./repository";

export async function ingestAllSources(): Promise<{ added: number }> {
  const before = await getReviewItems();
  const pubmedItems = await ingestPubMedContent();
  const pageItems = await harvestPageSources();
  const feedItems = await harvestFeedSources();
  const items = [
    ...incomingSeedItems,
    ...pageItems,
    ...feedItems,
    ...pubmedItems.map((item) => ({ ...item, review_status: "approved" as const, review_notes: "自动发布：PubMed 学术条目。" })),
  ].map((item) => classifyItem(item));
  const merged = await upsertReviewItems(items);
  return { added: Math.max(0, merged.length - before.length) };
}
