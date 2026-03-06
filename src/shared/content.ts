import { z } from "zod";

export const sourceTypes = ["official", "academic", "media"] as const;
export const contentTypes = ["guide", "research", "review", "news", "directory"] as const;
export const reviewStatuses = ["pending", "approved", "rejected", "needs_revision"] as const;
export const conditions = ["neurodiversity", "autism", "adhd", "learning-difficulties"] as const;
export const audiences = ["family", "self-advocate", "educator", "clinician", "researcher", "employer"] as const;

export type SourceType = (typeof sourceTypes)[number];
export type ContentType = (typeof contentTypes)[number];
export type ReviewStatus = (typeof reviewStatuses)[number];
export type ConditionKey = (typeof conditions)[number];
export type AudienceKey = (typeof audiences)[number];

export const contentItemSchema = z.object({
  id: z.string().min(1),
  source_name: z.string().min(1),
  source_type: z.enum(sourceTypes),
  source_region: z.string().min(1),
  source_url: z.string().url(),
  canonical_url: z.string().url(),
  title_original: z.string().min(1),
  title_zh: z.string().min(1),
  summary_original: z.string().min(1),
  summary_zh: z.string().min(1),
  excerpt: z.string().min(1),
  language: z.enum(["en", "zh", "bilingual"]),
  published_at: z.string().min(1),
  content_type: z.enum(contentTypes),
  topics: z.array(z.string().min(1)).min(1),
  audiences: z.array(z.enum(audiences)).min(1),
  conditions: z.array(z.enum(conditions)).min(1),
  review_status: z.enum(reviewStatuses),
  review_notes: z.string(),
  ingested_at: z.string().min(1),
  metadata: z
    .object({
      doi: z.string().optional(),
      pmid: z.string().optional(),
      authors: z.string().optional(),
      article_url: z.string().url().optional(),
      pdf_url: z.string().url().optional(),
      credibility: z.enum(["high", "medium", "reference"]),
      tags: z.array(z.string()).default([]),
      analysis: z
        .object({
          template: z.enum(["academic", "practice"]).optional(),
          summary_title: z.string().optional(),
          publication_info: z.string().optional(),
          authors_display: z.string().optional(),
          content_sections: z
            .array(
              z.object({
                title: z.string(),
                items: z.array(z.string()),
              }),
            )
            .optional(),
          key_findings: z.string().optional(),
          research_method: z.string().optional(),
          practical_significance: z.string().optional(),
          strategy_points: z.array(z.string()).optional(),
          conclusion: z.string().optional(),
          china_insights: z.array(z.string()).optional(),
        })
        .optional(),
    })
    .default({ credibility: "reference", tags: [] }),
});

export type ContentItem = z.infer<typeof contentItemSchema>;

export const sourceConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(sourceTypes),
  defaultTopics: z.array(z.string()).min(1),
  defaultAudiences: z.array(z.enum(audiences)).min(1),
  defaultConditions: z.array(z.enum(conditions)).min(1),
  active: z.boolean().default(true),
});

export type SourceConfig = z.infer<typeof sourceConfigSchema>;

export const publicIndexSchema = z.object({
  version: z.string().min(1),
  generated_at: z.string().min(1),
  counts: z.object({
    total: z.number().int().nonnegative(),
    by_topic: z.record(z.string(), z.number().int().nonnegative()),
    by_source_type: z.record(z.string(), z.number().int().nonnegative()),
    by_region: z.record(z.string(), z.number().int().nonnegative()),
  }),
  items: z.array(contentItemSchema),
});

export type PublicIndex = z.infer<typeof publicIndexSchema>;
