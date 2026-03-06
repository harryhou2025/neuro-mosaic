import type { AudienceKey, ConditionKey, ContentType, SourceType } from "./content";

export const topicCatalog = [
  "神经多样性",
  "自闭症",
  "ADHD",
  "学习困难",
  "共病与支持需求",
  "教育",
  "职场",
  "家庭支持",
  "政策与服务",
] as const;

export const labels = {
  sourceType: {
    official: "官方机构",
    academic: "学术论文/数据库",
    media: "媒体报道",
  } satisfies Record<SourceType, string>,
  contentType: {
    guide: "指南/机构资源",
    research: "研究论文",
    review: "综述/系统综述",
    news: "新闻/报道",
    directory: "工具/服务目录",
  } satisfies Record<ContentType, string>,
  audience: {
    family: "家长与家庭",
    "self-advocate": "当事人",
    educator: "教育工作者",
    clinician: "临床与支持人员",
    researcher: "研究者",
    employer: "雇主与职场管理者",
  } satisfies Record<AudienceKey, string>,
  condition: {
    neurodiversity: "神经多样性",
    autism: "自闭症",
    adhd: "ADHD",
    "learning-difficulties": "学习困难",
  } satisfies Record<ConditionKey, string>,
};

export function slugifyTopic(topic: string): string {
  return topic
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
