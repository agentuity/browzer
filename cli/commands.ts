import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { tracesDir } from "./paths";

export async function tracesCommand(json: boolean, output?: string) {
  const dir = tracesDir(output);
  if (!existsSync(dir)) {
    if (json) {
      process.stdout.write(`${JSON.stringify({ traces: [] })}\n`);
      return;
    }
    process.stdout.write("No traces yet. Run a session with browzer <agent-browser command>.\n");
    return;
  }
  const ids = (await readdir(dir)).filter((name) => existsSync(path.join(dir, name, "meta.json")));
  const traces = await Promise.all(
    ids.map(async (id) => {
      const meta = JSON.parse(await readFile(path.join(dir, id, "meta.json"), "utf8")) as {
        id: string;
        session?: string;
        startedAt?: number;
        endedAt?: number;
        lastUrl?: string;
        status?: string;
      };
      const info = await stat(path.join(dir, id));
      return { ...meta, id, mtime: info.mtimeMs, dir: path.join(dir, id) };
    }),
  );
  traces.sort((a, b) => (b.startedAt ?? b.mtime) - (a.startedAt ?? a.mtime));

  if (json) {
    process.stdout.write(`${JSON.stringify({ traces }, null, 2)}\n`);
    return;
  }
  if (traces.length === 0) {
    process.stdout.write("No traces yet.\n");
    return;
  }
  for (const trace of traces) {
    const when = trace.startedAt ? new Date(trace.startedAt).toISOString() : "";
    process.stdout.write(
      `${trace.id}  ${trace.status ?? "?"}  ${trace.session ?? ""}  ${trace.lastUrl ?? ""}  ${when}\n`,
    );
  }
}

export async function inspectCommand(idArg: string | undefined, output?: string) {
  const root = tracesDir(output);
  const id = idArg || (await latestId(root));
  if (!id) {
    process.stderr.write("No traces found.\n");
    process.exitCode = 1;
    return;
  }
  const dir = path.join(root, id);
  const matches = existsSync(dir) ? [id] : await matchPrefix(id, root);
  const resolved = matches.length <= 1 ? matches[0] : await newest(matches, root);
  if (!resolved) {
    process.stderr.write(`Trace not found: ${id}\n`);
    process.exitCode = 1;
    return;
  }
  const resolvedDir = path.join(root, resolved);
  const summaryPath = path.join(resolvedDir, "summary.md");
  const metaPath = path.join(resolvedDir, "meta.json");
  process.stdout.write(`trace: ${resolved}\n`);
  process.stdout.write(`dir: ${resolvedDir}\n\n`);
  if (existsSync(summaryPath)) {
    process.stdout.write(await readFile(summaryPath, "utf8"));
    return;
  }
  if (existsSync(metaPath)) {
    process.stdout.write(`${await readFile(metaPath, "utf8")}\n`);
  }
}

async function latestId(dir: string): Promise<string | null> {
  if (!existsSync(dir)) return null;
  const ids = await readdir(dir);
  let best: { id: string; mtime: number } | null = null;
  for (const id of ids) {
    try {
      const info = await stat(path.join(dir, id));
      if (!best || info.mtimeMs > best.mtime) best = { id, mtime: info.mtimeMs };
    } catch {
      /* skip */
    }
  }
  return best?.id ?? null;
}

async function matchPrefix(prefix: string, dir: string): Promise<string[]> {
  if (!existsSync(dir)) return [];
  const ids = await readdir(dir);
  return ids.filter((id) => id === prefix || id.startsWith(prefix) || id.endsWith(`-${prefix}`));
}

async function newest(ids: string[], dir: string): Promise<string | undefined> {
  let best: { id: string; mtime: number } | undefined;
  for (const id of ids) {
    try {
      const info = await stat(path.join(dir, id));
      if (!best || info.mtimeMs > best.mtime) best = { id, mtime: info.mtimeMs };
    } catch {
      /* skip */
    }
  }
  return best?.id;
}

export function helpText() {
  return `browzer — agent-browser wrapper that records a debug trace

Usage:
  browzer [--output <dir>] <agent-browser args...>
  browzer traces [--output <dir>]
  browzer inspect [id] [--output <dir>]
  browzer replay [id|path] [--output <dir>]
  browzer skills [list|get|path|install] [--project]
  browzer help

--output / -o   Directory for traces. Default: current working directory.
                Also BROWZER_OUTPUT.

On first successful command, browzer starts video recording and HAR capture.
On close, it dumps console, errors, a snapshot, and a poster.

Use agent-browser dashboard for live observation. Browzer is the saved bundle.
`;
}
