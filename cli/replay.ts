import { existsSync, statSync } from "node:fs";
import { stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { latestTraceId, listTraceIds, tracesDir } from "./paths";
import { getTraceFromDir } from "../lib/trace-store";
import { renderReplayHtml } from "./replay-html";

export async function replayCommand(arg?: string, output?: string) {
  const dir = await resolveTraceDir(arg, output);
  const trace = await getTraceFromDir(dir);
  if (!trace) {
    process.stderr.write(`No trace found at ${dir}\n`);
    process.exitCode = 1;
    return;
  }
  const htmlPath = path.join(dir, "replay.html");
  await writeFile(htmlPath, renderReplayHtml(trace));
  openPath(htmlPath);
  process.stdout.write(`opened ${htmlPath}\n`);
}

async function resolveTraceDir(arg?: string, output?: string): Promise<string> {
  const root = tracesDir(output);
  if (arg) {
    const resolved = path.resolve(arg);
    if (existsSync(resolved)) {
      const dir = statSync(resolved).isDirectory() ? resolved : path.dirname(resolved);
      if (existsSync(path.join(dir, "meta.json"))) return dir;
    }
    const id = await matchId(arg, root);
    if (id) return path.join(root, id);
    throw new Error(`Trace not found: ${arg}`);
  }
  const latest = await latestTraceId(root);
  if (!latest) throw new Error("No traces yet. Record one with browzer <agent-browser command>.");
  return path.join(root, latest);
}

async function matchId(prefix: string, dir: string): Promise<string | null> {
  const ids = (await listTraceIds(dir)).filter(
    (id) => id === prefix || id.startsWith(prefix) || id.endsWith(`-${prefix}`),
  );
  if (ids.length === 0) return null;
  if (ids.length === 1) return ids[0]!;
  let best: { id: string; mtime: number } | null = null;
  for (const id of ids) {
    const info = await stat(path.join(dir, id));
    if (!best || info.mtimeMs > best.mtime) best = { id, mtime: info.mtimeMs };
  }
  return best?.id ?? null;
}

function openPath(file: string) {
  const platform = process.platform;
  if (platform === "darwin") {
    spawn("open", [file], { detached: true, stdio: "ignore" }).unref();
    return;
  }
  if (platform === "win32") {
    spawn("cmd", ["/c", "start", "", file], { detached: true, stdio: "ignore" }).unref();
    return;
  }
  spawn("xdg-open", [file], { detached: true, stdio: "ignore" }).unref();
}
