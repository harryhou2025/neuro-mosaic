# 检索语法速查

目标：把同一问题翻译成不同数据库的“等价检索式”。不同平台的字段名与通配符规则不一致，先看你使用的平台帮助页，再做微调。

## 通用建议

- 先用较窄的字段（标题/摘要/关键词）减少噪音，再逐步放宽
- 谨慎使用 `NOT`，避免误删关键论文
- 把检索式、日期、筛选条件写进方法部分，保证可复现

## PubMed

- 关键词字段：`term[Title/Abstract]`
- MeSH 主题词：`"Autism Spectrum Disorder"[MeSH]`
- 逻辑：`AND` / `OR` / `NOT`，用括号分组
- 短语：用双引号 `"late diagnosis"`
- 日期过滤：推荐用网页筛选或 E-utilities 的 `datetype=pdat&mindate=YYYY&maxdate=YYYY`

示例：

`("autism spectrum disorder"[Title/Abstract] OR ASD[Title/Abstract]) AND (adult*[Title/Abstract])`

## Web of Science (WoS)

- 主题字段：`TS=(...)`（通常覆盖标题/摘要/关键词）
- 短语：双引号 `"executive function"`
- 通配符常见：`*`（多字符），`?`（单字符）

示例：

`TS=("autism" OR "autism spectrum disorder" OR ASD) AND TS=("adult*" OR "late diagnos*")`

## Scopus

- 字段：`TITLE-ABS-KEY(...)`
- 通配符常见：`*`（多字符）

示例：

`TITLE-ABS-KEY("ADHD" OR "attention deficit hyperactivity disorder") AND TITLE-ABS-KEY(workplace OR employment)`

## Google Scholar

- 更接近“关键词检索”，对结构化字段支持弱
- 常用技巧：用引号固定短语；用 `site:` 限制站点（例如 `site:nih.gov`）；用 `author:` 辅助追踪作者

示例关键词串：

`"neurodiversity" autism ADHD masking workplace`

