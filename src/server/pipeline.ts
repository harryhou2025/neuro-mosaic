import { classifyItem } from "../shared/content-ops";
import { incomingSeedItems } from "../shared/sample-sources";
import { harvestAcademicSources } from "./academic-harvester";
import { harvestFeedSources, harvestPageSources } from "./source-harvester";
import { getReviewItems, upsertReviewItems } from "./repository";

export async function ingestAllSources(): Promise<{ added: number }> {
  const before = await getReviewItems();
  const academicItems = await harvestAcademicSources();
  const pageItems = await harvestPageSources();
  const feedItems = await harvestFeedSources();
  const items = [
    ...incomingSeedItems,
    ...pageItems,
    ...feedItems,
    ...academicItems,
  ].map((item) => classifyItem(item));
  const merged = await upsertReviewItems(items);
  return { added: Math.max(0, merged.length - before.length) };
}
