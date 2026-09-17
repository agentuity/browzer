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
  const raw = output?.trim() || process.env.BROWZER_OUTPUT?.trim() || process.cwd();
  return path.resolve(raw);
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
