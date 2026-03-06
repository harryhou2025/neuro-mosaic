import { useEffect, useMemo, useState } from "react";
import type { ContentItem, PublicIndex } from "../shared/content";
import { classifyItem } from "../shared/content-ops";
import { curatedSeedItems } from "../shared/sample-sources";
import { listRegions, sourceDirectory } from "../shared/source-directory";
import { labels, topicCatalog } from "../shared/taxonomy";

type Filters = {
  query: string;
  topic: string;
  audience: string;
  sourceType: string;
  region: string;
};

type BrowseMode = "list" | "topics" | "regions" | "source-types";
const DEFAULT_SECTION_LIMIT = 6;
const DETAIL_ROUTE_EVENT = "detail-route-change";

function readDetailId(): string | null {
  return new URLSearchParams(window.location.search).get("item");
}

function openDetail(itemId: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set("item", itemId);
  window.history.pushState({}, "", url);
  window.dispatchEvent(new Event(DETAIL_ROUTE_EVENT));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function clearDetail(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete("item");
  window.history.pushState({}, "", url);
  window.dispatchEvent(new Event(DETAIL_ROUTE_EVENT));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function fetchIndex(): Promise<PublicIndex> {
  const response = await fetch("/generated/content-index.json");
  if (!response.ok) {
    throw new Error("content-index.json not found");
  }
  return response.json();
}

function filterItems(items: ContentItem[], filters: Filters): ContentItem[] {
  return items.filter((item) => {
    const query = filters.query.trim().toLowerCase();
    const text = `${item.title_zh} ${item.title_original} ${item.summary_zh} ${item.summary_original}`.toLowerCase();
    const matchesQuery = !query || text.includes(query);
    const matchesTopic = !filters.topic || item.topics.includes(filters.topic);
    const matchesAudience = !filters.audience || item.audiences.includes(filters.audience as ContentItem["audiences"][number]);
    const matchesSource = !filters.sourceType || item.source_type === filters.sourceType;
    const matchesRegion = !filters.region || item.source_region === filters.region;
    return matchesQuery && matchesTopic && matchesAudience && matchesSource && matchesRegion;
  });
}

function isBrowsableContent(item: ContentItem): boolean {
  return item.content_type !== "directory";
}

function formatDate(input: string): string {
  return new Date(input).toLocaleDateString("zh-CN", { year: "numeric", month: "short", day: "numeric" });
}

function formatDateTime(input: string): string {
  return new Date(input).toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function deriveAuthor(item: ContentItem): string {
  if (item.metadata.authors?.trim()) {
    return item.metadata.authors.trim();
  }
  if (item.source_type === "academic") {
    return `${item.source_name} / 作者信息待补充`;
  }
  return `${item.source_name}（机构/来源）`;
}

function deriveMainConclusion(item: ContentItem): string {
  return item.summary_zh || item.summary_original || item.excerpt;
}

function splitIntoSentences(text: string): string[] {
  return text
    .split(/[。！？.!?]\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function ensureSentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return "";
  }
  return /[。！？.!?]$/.test(trimmed) ? trimmed : `${trimmed}。`;
}

function deriveDetailTitle(item: ContentItem): string {
  return `《${item.title_zh}》`;
}

function deriveContentPoints(item: ContentItem): string[] {
  const baseText = [item.summary_zh, item.summary_original, item.excerpt].filter(Boolean).join(" ");
  const sentences = splitIntoSentences(baseText);
  const points = sentences.slice(0, 4).map((sentence, index) => {
    if (index === 0) {
      return `核心内容：${ensureSentence(sentence)}`;
    }
    if (/support|支持|策略|school|教育|work|职场/i.test(sentence)) {
      return `实践场景：${ensureSentence(sentence)}`;
    }
    if (/study|review|research|研究|evidence|eviden/i.test(sentence)) {
      return `研究观察：${ensureSentence(sentence)}`;
    }
    return ensureSentence(sentence);
  });

  if (points.length > 0) {
    return points;
  }

  return [`围绕 ${item.topics.slice(0, 2).join("、")} 主题展开，适合 ${item.audiences.map((audience) => labels.audience[audience]).join("、")} 阅读。`];
}

function deriveImplications(item: ContentItem): string {
  const topicHint = item.topics.slice(0, 2).join("、") || "相关主题";
  const audienceHint = item.audiences.slice(0, 2).map((audience) => labels.audience[audience]).join("、") || "读者";

  if (item.source_type === "academic") {
    return `这条内容对我们最直接的启发是：可以把 ${topicHint} 作为后续专题重点，并优先转化为面向 ${audienceHint} 的可执行建议。`;
  }

  if (item.source_type === "official") {
    return `这条内容的启发在于：它能作为 ${topicHint} 主题下的权威依据，帮助 ${audienceHint} 快速建立对支持路径和资源边界的理解。`;
  }

  return `这条内容更偏实践参考，启发是把 ${topicHint} 相关经验整理成更易懂的行动清单，方便 ${audienceHint} 直接使用。`;
}

function deriveInsightPoints(item: ContentItem): string[] {
  const topicHint = item.topics.slice(0, 2).join("、") || "相关主题";
  const audienceHint = item.audiences.slice(0, 2).map((audience) => labels.audience[audience]).join("、") || "相关人群";
  const points = [
    `可以把这条内容转化为面向 ${audienceHint} 的行动建议，而不只是停留在概念介绍。`,
    `后续整理 ${topicHint} 专题时，可把这条内容作为证据或实践案例的支撑材料。`,
  ];

  if (item.source_type === "academic") {
    points.push("如果继续扩展专题，适合进一步追踪原始论文、系统综述和引用链，形成更扎实的证据地图。");
  } else if (item.source_type === "official") {
    points.push("这类官方来源适合作为基础定义、政策边界和支持路径说明，能提升内容可信度。");
  } else {
    points.push("这类实践型内容适合继续提炼成更具体的清单、案例和经验条目，方便读者立即使用。");
  }

  return points;
}

function getShanghaiDateKey(input: string | Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(input));
}

function getStartOfShanghaiWeek(reference: Date): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  })
    .formatToParts(reference)
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== "literal") {
        acc[part.type] = part.value;
      }
      return acc;
    }, {});

  const weekdayMap: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };

  const current = new Date(`${parts.year}-${parts.month}-${parts.day}T12:00:00+08:00`);
  const weekday = weekdayMap[parts.weekday] ?? 1;
  current.setDate(current.getDate() - (weekday - 1));
  current.setHours(0, 0, 0, 0);
  return current;
}

function groupLatestItems(items: ContentItem[]): Array<{ id: string; label: string; items: ContentItem[] }> {
  const now = new Date();
  const todayKey = getShanghaiDateKey(now);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = getShanghaiDateKey(yesterday);
  const weekStart = getStartOfShanghaiWeek(now);

  const todayItems = items.filter((item) => getShanghaiDateKey(item.ingested_at) === todayKey);
  const yesterdayItems = items.filter((item) => getShanghaiDateKey(item.ingested_at) === yesterdayKey);
  const weekItems = items.filter((item) => {
    const ingested = new Date(item.ingested_at);
    const key = getShanghaiDateKey(item.ingested_at);
    return ingested >= weekStart && key !== todayKey && key !== yesterdayKey;
  });

  return [
    { id: "today", label: "今日抓取", items: todayItems },
    { id: "yesterday", label: "昨日抓取", items: yesterdayItems },
    { id: "week", label: "本周抓取", items: weekItems },
  ];
}

function Header() {
  return (
    <header className="hero">
      <div className="hero__content">
        <p className="eyebrow">Neuro Mosaic</p>
        <h1>神经多样性信息聚合站</h1>
        <p className="hero__lead">
          面向家长、当事人与研究/从业者的双语导航站。聚合官方资源、学术证据与优质媒体内容，按主题、人群与来源快速定位。
        </p>
        <div className="hero__chips">
          <span>主题浏览</span>
          <span>人群筛选</span>
          <span>来源分层</span>
        </div>
      </div>
    </header>
  );
}

function FiltersPanel(props: { filters: Filters; setFilters: (value: Filters) => void }) {
  const { filters, setFilters } = props;
  const regions = listRegions();
  return (
    <section className="panel filters">
      <input
        value={filters.query}
        onChange={(event) => setFilters({ ...filters, query: event.target.value })}
        placeholder="搜索主题、来源、摘要"
      />
      <select value={filters.topic} onChange={(event) => setFilters({ ...filters, topic: event.target.value })}>
        <option value="">全部主题</option>
        {topicCatalog.map((topic) => (
          <option key={topic} value={topic}>
            {topic}
          </option>
        ))}
      </select>
      <select value={filters.audience} onChange={(event) => setFilters({ ...filters, audience: event.target.value })}>
        <option value="">全部人群</option>
        {Object.entries(labels.audience).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <select value={filters.sourceType} onChange={(event) => setFilters({ ...filters, sourceType: event.target.value })}>
        <option value="">全部来源</option>
        {Object.entries(labels.sourceType).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <select value={filters.region} onChange={(event) => setFilters({ ...filters, region: event.target.value })}>
        <option value="">全部国家/地区</option>
        {regions.map((region) => (
          <option key={region} value={region}>
            {region}
          </option>
        ))}
      </select>
    </section>
  );
}

function ContentCard({ item }: { item: ContentItem }) {
  return (
    <article className="card">
      <div className="card__meta">
        <span>{labels.sourceType[item.source_type]}</span>
        <span>{item.source_region}</span>
        <span>{labels.contentType[item.content_type]}</span>
        <span>{formatDate(item.published_at)}</span>
      </div>
      <h3>{item.title_zh}</h3>
      <p className="card__original">{item.title_original}</p>
      <p>{item.summary_zh}</p>
      <p className="card__excerpt">{item.excerpt}</p>
      <div className="tag-row">
        {item.topics.map((topic) => (
          <span key={topic} className="tag">
            {topic}
          </span>
        ))}
      </div>
      <div className="tag-row muted">
        {item.audiences.map((audience) => (
          <span key={audience}>{labels.audience[audience]}</span>
        ))}
      </div>
      <div className="card__actions">
        <button className="detail-button" onClick={() => openDetail(item.id)}>
          详情
        </button>
        <a href={item.source_url} target="_blank" rel="noreferrer">
          查看原始来源
        </a>
      </div>
    </article>
  );
}

function LatestSection(props: { items: ContentItem[]; lastUpdated: string }) {
  const { items, lastUpdated } = props;
  const groups = groupLatestItems(items);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  return (
    <section className="latest-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Latest Updates</p>
          <h2>每日最新数据</h2>
        </div>
        <p>按网站抓取时间分成今日、昨日和本周；卡片里仍保留原始发布日期。最后同步时间：{lastUpdated}</p>
      </div>
      {groups.map((group) => (
        <section key={group.id} className="latest-bucket">
          <div className="group-panel__header">
            <h3>{group.label}</h3>
            <span>{group.items.length} 条</span>
          </div>
          {group.items.length === 0 ? <div className="panel empty">当前没有 {group.label} 新内容。</div> : null}
          <div className="latest-grid">
            {(expandedGroups[group.id] ? group.items : group.items.slice(0, DEFAULT_SECTION_LIMIT)).map((item, index) => (
              <article
                key={item.id}
                className={index === 0 && group.id === "today" ? "card card--latest card--latest-lead" : "card card--latest"}
              >
                <div className="card__meta">
                  <span>{labels.sourceType[item.source_type]}</span>
                  <span>{item.source_region}</span>
                  <span>{formatDate(item.published_at)}</span>
                </div>
                <h3>{item.title_zh}</h3>
                <p className="card__original">{item.title_original}</p>
                <p>{item.summary_zh}</p>
                <div className="tag-row">
                  {item.topics.slice(0, 4).map((topic) => (
                    <span key={topic} className="tag">
                      {topic}
                    </span>
                  ))}
                </div>
                <div className="card__actions">
                  <button className="detail-button" onClick={() => openDetail(item.id)}>
                    详情
                  </button>
                  <a href={item.source_url} target="_blank" rel="noreferrer">
                    查看原始来源
                  </a>
                </div>
              </article>
            ))}
          </div>
          {group.items.length > DEFAULT_SECTION_LIMIT ? (
            <div className="section-actions">
              <button
                className="browse-nav__button"
                onClick={() =>
                  setExpandedGroups((current) => ({
                    ...current,
                    [group.id]: !current[group.id],
                  }))
                }
              >
                {expandedGroups[group.id] ? "收起" : "查看更多"}
              </button>
            </div>
          ) : null}
        </section>
      ))}
    </section>
  );
}

function DetailPage(props: { item: ContentItem }) {
  const { item } = props;
  const contentPoints = deriveContentPoints(item);
  const author = deriveAuthor(item);
  const conclusion = deriveMainConclusion(item);
  const implications = deriveImplications(item);
  const insightPoints = deriveInsightPoints(item);
  const detailTitle = deriveDetailTitle(item);

  return (
    <main className="page-shell detail-shell">
      <button className="back-link" onClick={clearDetail}>
        返回首页
      </button>
      <article className="detail-page">
        <div className="detail-hero">
          <div className="card__meta">
            <span>{labels.sourceType[item.source_type]}</span>
            <span>{item.source_region}</span>
            <span>{labels.contentType[item.content_type]}</span>
          </div>
          <h1>{detailTitle}</h1>
          <p className="detail-subtitle">{item.title_original}</p>
        </div>

        <section className="detail-section">
          <p className="detail-line">
            <strong>总结标题：</strong>
            <span>{detailTitle}（{item.title_original}）</span>
          </p>
          <p className="detail-line">
            <strong>时间：</strong>
            <span>原始发布时间为 {formatDateTime(item.published_at)}，本次抓取时间为 {formatDateTime(item.ingested_at)}。</span>
          </p>
          <p className="detail-line">
            <strong>作者：</strong>
            <span>{author}</span>
          </p>
        </section>

        <section className="detail-section">
          <h2>具体内容</h2>
          <ul className="detail-list">
            {contentPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </section>

        <section className="detail-section">
          <h2>主要结论</h2>
          <div className="detail-highlight">
            <p>{ensureSentence(conclusion)}</p>
          </div>
        </section>

        <section className="detail-section">
          <h2>对我们有哪些启发</h2>
          <p className="detail-lead">{implications}</p>
          <ul className="detail-list">
            {insightPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </section>

        <p className="detail-source-note">
          来源：{item.source_name} · <a href={item.source_url} target="_blank" rel="noreferrer">{item.source_url}</a>
        </p>
      </article>
    </main>
  );
}

function BrowseNav(props: { mode: BrowseMode; setMode: (mode: BrowseMode) => void }) {
  const { mode, setMode } = props;
  const entries: Array<{ id: BrowseMode; label: string }> = [
    { id: "list", label: "全部结果" },
    { id: "topics", label: "按主题分组" },
    { id: "regions", label: "按国家分组" },
    { id: "source-types", label: "按来源类型分组" },
  ];
  return (
    <section className="browse-nav">
      {entries.map((entry) => (
        <button
          key={entry.id}
          className={mode === entry.id ? "browse-nav__button browse-nav__button--active" : "browse-nav__button"}
          onClick={() => setMode(entry.id)}
        >
          {entry.label}
        </button>
      ))}
    </section>
  );
}

function groupItems<T extends string>(items: ContentItem[], getKeys: (item: ContentItem) => T[]): Array<{ label: string; items: ContentItem[] }> {
  const map = new Map<string, ContentItem[]>();
  for (const item of items) {
    for (const key of getKeys(item)) {
      map.set(key, [...(map.get(key) ?? []), item]);
    }
  }
  return Array.from(map.entries())
    .map(([label, groupedItems]) => ({ label, items: groupedItems }))
    .sort((a, b) => b.items.length - a.items.length || a.label.localeCompare(b.label, "zh-CN"));
}
function GroupedSection(props: { title: string; groups: Array<{ label: string; items: ContentItem[] }> }) {
  const { title, groups } = props;
  return (
    <section className="grouped-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Browse</p>
          <h2>{title}</h2>
        </div>
        <p>点击筛选后可继续缩小范围，每组显示最相关的最新内容。</p>
      </div>
      <div className="group-grid">
        {groups.map((group) => (
          <article key={group.label} className="panel group-panel">
            <div className="group-panel__header">
              <h3>{group.label}</h3>
              <span>{group.items.length} 条</span>
            </div>
            <div className="group-panel__items">
              {group.items.slice(0, 4).map((item) => (
                <a key={`${group.label}-${item.id}`} href={item.source_url} target="_blank" rel="noreferrer" className="group-link">
                  <strong>{item.title_zh}</strong>
                  <span>
                    {item.source_name} · {item.source_region}
                  </span>
                </a>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function SourceDirectorySection() {
  const [expanded, setExpanded] = useState(false);
  const visibleSources = expanded ? sourceDirectory : sourceDirectory.slice(0, DEFAULT_SECTION_LIMIT);
  return (
    <section className="source-directory">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Trusted Sources</p>
          <h2>资源入口与权威来源库</h2>
        </div>
        <p>第一阶段优先纳入官方机构、指南入口、学术检索与高质量公益组织。</p>
      </div>
      <div className="grid">
        {visibleSources.map((source) => (
          <article key={source.id} className="card">
            <div className="card__meta">
              <span>{labels.sourceType[source.sourceType]}</span>
              <span>{source.region}</span>
            </div>
            <h3>{source.name}</h3>
            <p>{source.focus}</p>
            <div className="tag-row">
              {source.conditions.map((condition) => (
                <span key={condition} className="tag">
                  {labels.condition[condition]}
                </span>
              ))}
            </div>
            <div className="tag-row muted">
              {source.audiences.map((audience) => (
                <span key={audience}>{labels.audience[audience]}</span>
              ))}
            </div>
            <a href={source.url} target="_blank" rel="noreferrer">
              访问来源
            </a>
          </article>
        ))}
      </div>
      {sourceDirectory.length > DEFAULT_SECTION_LIMIT ? (
        <div className="section-actions">
          <button className="browse-nav__button" onClick={() => setExpanded((current) => !current)}>
            {expanded ? "收起" : "查看更多"}
          </button>
        </div>
      ) : null}
    </section>
  );
}

function HomePage() {
  const [index, setIndex] = useState<PublicIndex | null>(null);
  const [filters, setFilters] = useState<Filters>({ query: "", topic: "", audience: "", sourceType: "", region: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [browseMode, setBrowseMode] = useState<BrowseMode>("list");
  const [detailId, setDetailId] = useState<string | null>(() => readDetailId());

  useEffect(() => {
    fetchIndex()
      .then(setIndex)
      .catch(() => setError("当前未读取到发布索引，先显示内置示例内容。可运行 `npm run publish` 或在审核台点击发布。"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const syncRoute = () => setDetailId(readDetailId());
    window.addEventListener("popstate", syncRoute);
    window.addEventListener(DETAIL_ROUTE_EVENT, syncRoute);
    return () => {
      window.removeEventListener("popstate", syncRoute);
      window.removeEventListener(DETAIL_ROUTE_EVENT, syncRoute);
    };
  }, []);

  const visibleItems = index?.items?.length ? index.items : curatedSeedItems.map((item) => classifyItem(item));
  const browseItems = useMemo(() => visibleItems.filter(isBrowsableContent), [visibleItems]);
  const filtered = useMemo(() => filterItems(browseItems, filters), [filters, browseItems]);
  const lastUpdated = index?.generated_at ? formatDateTime(index.generated_at) : "未生成";
  const latestItems = useMemo(
    () =>
      browseItems
        .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime()),
    [browseItems],
  );
  const topicGroups = useMemo(() => groupItems(filtered, (item) => item.topics), [filtered]);
  const regionGroups = useMemo(() => groupItems(filtered, (item) => [item.source_region]), [filtered]);
  const sourceTypeGroups = useMemo(
    () => groupItems(filtered, (item) => [labels.sourceType[item.source_type]]),
    [filtered],
  );
  const detailItem = useMemo(() => visibleItems.find((item) => item.id === detailId) ?? null, [detailId, visibleItems]);

  if (detailItem) {
    return <DetailPage item={detailItem} />;
  }

  return (
    <main className="page-shell">
      <Header />
      <section className="stats">
        <div className="panel">
          <strong>{index?.counts.total ?? visibleItems.length}</strong>
          <span>已发布条目</span>
        </div>
        <div className="panel">
          <strong>{topicCatalog.length}</strong>
          <span>一级专题</span>
        </div>
        <div className="panel">
          <strong>{sourceDirectory.length}</strong>
          <span>权威来源</span>
        </div>
        <div className="panel">
          <strong>{Object.keys(index?.counts.by_region ?? {}).length || listRegions().length}</strong>
          <span>国家/地区</span>
        </div>
        <div className="panel">
          <strong>中英双语</strong>
          <span>保留原文 + 中文摘要</span>
        </div>
      </section>
      <section className="panel empty">
        当前为“自动聚合直发”模式：优先扩充权威来源与主题覆盖，暂不启用内部审核后台。
      </section>
      <section className="panel empty">
        最后更新时间（北京时间）：{lastUpdated}
      </section>
      <LatestSection items={latestItems} lastUpdated={lastUpdated} />
      <BrowseNav mode={browseMode} setMode={setBrowseMode} />
      <FiltersPanel filters={filters} setFilters={setFilters} />
      {loading ? <section className="panel empty">内容索引加载中…</section> : null}
      {error ? <section className="panel empty">{error}</section> : null}
      {!loading && filtered.length === 0 ? <section className="panel empty">当前筛选条件下没有结果，请放宽筛选条件。</section> : null}
      {browseMode === "list" ? (
        <section className="grid">
          {filtered.map((item) => (
            <ContentCard key={item.id} item={item} />
          ))}
        </section>
      ) : null}
      {browseMode === "topics" ? <GroupedSection title="按主题分组" groups={topicGroups} /> : null}
      {browseMode === "regions" ? <GroupedSection title="按国家/地区分组" groups={regionGroups} /> : null}
      {browseMode === "source-types" ? <GroupedSection title="按来源类型分组" groups={sourceTypeGroups} /> : null}
      <SourceDirectorySection />
      <footer className="site-footer">最后更新时间（北京时间）：{lastUpdated} | 靛蓝之家制作</footer>
    </main>
  );
}

export function App() {
  return <HomePage />;
}
