import express from "express";
import { contentItemSchema, reviewStatuses } from "../shared/content";
import { publishApprovedItems, getReviewItems, updateReviewStatus } from "./repository";
import { ingestAllSources } from "./pipeline";
import { ensureStorage } from "./storage";

const app = express();
const port = Number(process.env.PORT || 8787);

app.use(express.json({ limit: "1mb" }));
app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (_req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

app.get("/api/internal/review", async (_req, res) => {
  const items = await getReviewItems();
  res.json({ items });
});

app.post("/api/internal/ingest", async (_req, res) => {
  const result = await ingestAllSources();
  res.json(result);
});

app.post("/api/internal/review/:id", async (req, res) => {
  const status = req.body.review_status;
  if (!reviewStatuses.includes(status)) {
    res.status(400).json({ error: "Invalid review status." });
    return;
  }

  const item = await updateReviewStatus(req.params.id, {
    review_status: status,
    review_notes: req.body.review_notes ?? "",
    title_zh: req.body.title_zh,
    summary_zh: req.body.summary_zh,
    topics: req.body.topics,
    audiences: req.body.audiences,
    conditions: req.body.conditions,
  });

  if (!item) {
    res.status(404).json({ error: "Item not found." });
    return;
  }

  res.json({ item: contentItemSchema.parse(item) });
});

app.post("/api/internal/publish", async (_req, res) => {
  const result = await publishApprovedItems();
  res.json(result);
});

app.use(express.static("public"));

ensureStorage()
  .then(() => app.listen(port, () => console.log(`Server listening on http://localhost:${port}`)))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
