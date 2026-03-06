import { classifyItem } from "../shared/content-ops";
import { incomingSeedItems } from "../shared/sample-sources";
import { enrichAcademicItem, harvestAcademicSources } from "./academic-harvester";
import { ingestPubMedContent } from "./pubmed";
import { harvestFeedSources, harvestPageSources } from "./source-harvester";
import { getReviewItems, upsertReviewItems } from "./repository";

export async function ingestAllSources(): Promise<{ added: number }> {
  const before = await getReviewItems();
  const pubmedItems = await ingestPubMedContent();
  const academicItems = await harvestAcademicSources();
  const pageItems = await harvestPageSources();
  const feedItems = await harvestFeedSources();
  const enrichedAcademicItems = await Promise.all(
    [...academicItems, ...pubmedItems].map((item) => enrichAcademicItem(item)),
  );
  const items = [
    ...incomingSeedItems,
    ...pageItems,
    ...feedItems,
    ...enrichedAcademicItems,
  ].map((item) => classifyItem(item));
  const merged = await upsertReviewItems(items);
  return { added: Math.max(0, merged.length - before.length) };
}
