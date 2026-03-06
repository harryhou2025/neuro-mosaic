import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();

export const storagePaths = {
  data: path.join(rootDir, "data"),
  review: path.join(rootDir, "data", "review-items.json"),
  publicDir: path.join(rootDir, "public"),
  generated: path.join(rootDir, "public", "generated"),
  topics: path.join(rootDir, "public", "generated", "topics"),
  temp: path.join(rootDir, ".tmp"),
};

export async function ensureStorage(): Promise<void> {
  await Promise.all([
    mkdir(storagePaths.data, { recursive: true }),
    mkdir(storagePaths.publicDir, { recursive: true }),
    mkdir(storagePaths.generated, { recursive: true }),
    mkdir(storagePaths.topics, { recursive: true }),
    mkdir(storagePaths.temp, { recursive: true }),
  ]);
}

export async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}
