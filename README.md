# Neuro Mosaic

神经多样性、自闭症、ADHD 与学习困难的双语信息聚合站 MVP。

## 本地启动

```bash
npm install --cache .npm-cache
npm run sync:content
npm run dev:web
```

- 前台首页：`http://localhost:5173`

## 内容流转

```bash
npm run sync:content
```

- `ingest`：导入白名单种子内容，并尝试调用 `skills/neuro-lit-search/scripts/pubmed_search.py` 抓取 PubMed 条目
- `publish`：将内容生成到 `public/generated/` 静态索引
- `sync:content`：执行抓取并发布

## 静态构建

```bash
npm run build
```

- 会先同步内容，再输出可直接部署的 `dist/`

## 免费部署

- 已提供 GitHub Pages 工作流：[deploy-pages.yml](/Users/hou/我的/dev/projects/神经多样性内容/.github/workflows/deploy-pages.yml)
- 推到 GitHub 后，在仓库设置里启用 Pages，并选择 `GitHub Actions`
- 之后每次推送到 `main` 都会自动构建并发布
- 工作流还会在每天 `22:00 UTC` 自动运行一次，也就是北京时间次日 `06:00`

## GitHub 初始化与发布命令

把下面命令按顺序执行即可：

```bash
git init
git branch -M main
git add .
git commit -m "Initial neurodiversity content hub"
git remote add origin <你的 GitHub 仓库地址>
git push -u origin main
```

推送完成后：

1. 打开 GitHub 仓库 `Settings`
2. 进入 `Pages`
3. 在 `Build and deployment` 里选择 `GitHub Actions`
4. 等待 `Actions` 里的 `Deploy to GitHub Pages` 工作流完成
5. 完成后 GitHub 会给出公开网址

## 当前结构

- `src/shared/`：内容 schema、标签体系、去重/分类/发布逻辑
- `src/server/`：抓取、发布 API 与 CLI
- `src/web/`：前台目录站
- `data/review-items.json`：审核池
- `public/generated/`：前台静态索引
