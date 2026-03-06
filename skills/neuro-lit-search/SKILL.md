---
name: neuro-lit-search
description: 检索与整理国外高质量学术文献（优先顶级/高影响力期刊与会议论文集），主题聚焦 neurodiversity（神经多样性）、autism/ASD（自闭谱系）、ADHD（注意缺陷多动障碍）等神经发育与精神健康相关方向。用于需要把研究问题拆解为可复现检索式、在 PubMed 等数据库检索、导出题录/摘要、初筛与汇总阅读清单、生成证据表格（CSV/Markdown）或写作型综述提纲的场景。
---

# Neuro Lit Search

## Overview

把一个研究问题转成“可复现的检索 + 可复用的导出结果”：生成数据库特定的检索式（PubMed/WoS/Scopus/Google Scholar 等），用脚本抓取 PubMed 元数据与摘要，最后输出可筛选的证据表格与阅读清单。

## Quick Start

- 先明确你的问题与边界：人群/年龄段、主题（诊断、共病、执行功能、感觉、masking、干预、教育/职场等）、研究类型（综述/队列/RCT/质性等）、年份范围、目标期刊/学科。
- 用 `scripts/build_queries.py` 生成多数据库检索式草案（再按需要微调）。
- 用 `scripts/pubmed_search.py` 从 PubMed 导出题录（可选抓摘要）到 `csv/jsonl`。
- 用 `references/screening.md` 做快速初筛，并把入选结果整理成“阅读清单 + 证据表格”。

## Workflow

### Step 1: 把问题写成可检索的结构

- 用一个 1 句话的问题描述目标，然后补齐约束：
- 人群：儿童/青少年/成人，是否包含 late-diagnosed、女性/性别多样、不同文化/语言群体。
- 暴露/主题：neurodiversity 叙事、诊断/评估、感觉与运动、执行功能、共病（anxiety、sleep、learning disorders 等）、支持/干预、教育与职场、政策与服务。
- 研究类型：systematic review / meta-analysis / RCT / cohort / qualitative / mixed-methods。
- 时间：例如近 5 年（或按里程碑年份）。

### Step 2: 选“顶级/高质量”来源的策略（可解释、可复现）

- 不要只靠“印象中的顶刊”。建议把“顶级”定义成可验证规则，例如：
- 学科分区：JCR（Web of Science）/ Scopus (CiteScore) / SCImago (SJR) 的 Q1/Q2。
- 领域权威：学会官方期刊、常被领域综述引用的核心刊物。
- 通用高影响：综合医学/精神医学/神经科学的头部期刊（见 `references/journals.md`，是起点不是结论）。

### Step 3: 生成与微调检索式（多数据库）

- 先跑脚本生成草案，再人工检查：
- 同义词覆盖：autism/ASD, ADHD, neurodiversity, neurodevelopmental disorders。
- 控制词表：PubMed 的 MeSH（例如 Autism Spectrum Disorder[MeSH]）。
- 字段限制：标题/摘要优先（降低噪音），必要时加关键词字段。
- 排除词：如果噪音来自动物实验/基因/成像等方向，可加 NOT 条件（谨慎使用，避免误删）。

运行示例：

```bash
python3 skills/neuro-lit-search/scripts/build_queries.py \
  --topic "neurodiversity" \
  --conditions autism adhd \
  --years 2019:2026
```

### Step 4: PubMed 导出题录/摘要（可复现）

- 用 `scripts/pubmed_search.py` 把检索结果导出为表格，用于去重、初筛、做证据表。

运行示例（只抓元数据）：

```bash
python3 skills/neuro-lit-search/scripts/pubmed_search.py \
  --query '(autism[Title/Abstract] OR "autism spectrum disorder"[Title/Abstract] OR ASD[Title/Abstract]) AND (adult*[Title/Abstract] OR adolescen*[Title/Abstract])' \
  --years 2019:2026 \
  --retmax 200 \
  --out out/pubmed_autism.csv
```

运行示例（额外抓摘要，限前 50 条）：

```bash
python3 skills/neuro-lit-search/scripts/pubmed_search.py \
  --query '(ADHD[Title/Abstract] OR "attention deficit hyperactivity disorder"[Title/Abstract]) AND (workplace[Title/Abstract] OR employment[Title/Abstract])' \
  --years 2019:2026 \
  --retmax 200 \
  --fetch-abstracts 50 \
  --out out/pubmed_adhd_work.csv
```

如果处于企业代理/自签证书环境，可使用 `--cafile /path/to/ca.pem`；仅测试时可临时用 `--insecure`。

### Step 5: 初筛、汇总、输出阅读清单

- 按 `references/screening.md` 定义的纳排标准做 title/abstract screening。
- 输出两份结果：
- 阅读清单：按“近期 + 领域权威期刊 + 研究类型”分组。
- 证据表：一行一篇论文（问题、方法、人群、结论、局限、可引用句子/数据）。

## Resources

- `scripts/build_queries.py`：生成多数据库检索式草案（可复现、可复制到各平台）。
- `scripts/pubmed_search.py`：调用 NCBI E-utilities 检索 PubMed 并导出元数据/摘要。
- `references/journals.md`：按学科列出常见的高质量期刊/会议论文集起点清单。
- `references/search-operators.md`：不同数据库的检索语法速查表。
- `references/screening.md`：标题/摘要初筛与证据表字段建议。

## Typical Requests

- “帮我找近 5 年关于成人自闭症 late diagnosis 的顶刊论文，并做一份阅读清单。”
- “我要写一篇 neurodiversity 与职场支持的综述，先给我一个可复现检索式和证据表模板。”
- “以系统综述为目标，帮我把 PubMed/WoS/Scopus 的检索式都准备好，并导出 PubMed 题录。”
