import { existsSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

/** Repo or npm package root (parent of `cli/` or `dist/cli/`). */
export function packageRoot() {
  const parent = path.basename(path.dirname(__dirname));
  if (parent === "dist") return path.resolve(__dirname, "..", "..");
  return path.resolve(__dirname, "..");
}

export function browzerHome() {
  return process.env.BROWZER_HOME?.trim() || path.join(homedir(), ".browzer");
}

export function tracesDir(output?: string | null) {
  const raw = output?.trim() || process.env.BROWZER_OUTPUT?.trim();
  if (raw) return path.resolve(raw);
  return path.join(browzerHome(), "traces");
}

export function activeDir() {
  return path.join(browzerHome(), "active");
}

export function activePath(session: string) {
  return path.join(activeDir(), `${sanitize(session)}.json`);
}

export function traceDir(id: string, output?: string | null) {
  return path.join(tracesDir(output), id);
}

export function sanitize(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "default";
}

export function newTraceId(session: string) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
  return `${stamp}-${sanitize(session)}`;
}

export function isTraceDir(root: string, id: string) {
  if (!id || id.startsWith(".")) return false;
  return existsSync(path.join(root, id, "meta.json"));
}

export async function listTraceIds(root: string): Promise<string[]> {
  if (!existsSync(root)) return [];
  return (await readdir(root)).filter((id) => isTraceDir(root, id));
}

export async function latestTraceId(root: string): Promise<string | null> {
  const ids = await listTraceIds(root);
  let best: { id: string; mtime: number } | null = null;
  for (const id of ids) {
    try {
      const info = await stat(path.join(root, id));
      if (!best || info.mtimeMs > best.mtime) best = { id, mtime: info.mtimeMs };
    } catch {
      /* skip */
    }
  }
  return best?.id ?? null;
}
