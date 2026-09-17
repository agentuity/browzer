import { appendFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseWrappedJson, runAgentBrowser } from "./agent";
import { newTraceId, tracesDir } from "./paths";
import { writeSummary } from "./summary";
import { collectDuring } from "./stream";
import { clearActive, loadActive, saveActive, type ActiveTrace } from "./state";

const MAX_CAPTURE = 24_000;

type AbJson<T> = { success?: boolean; data?: T; error?: string | null };

export async function ensureTrace(
  session: string,
  startUrl?: string,
  output?: string,
): Promise<ActiveTrace> {
  const existing = await loadActive(session);
  if (existing) return existing;
  const id = newTraceId(session);
  const dir = path.join(tracesDir(output), id);
  await mkdir(dir, { recursive: true });
  const trace: ActiveTrace = {
    id,
    dir,
    session,
    startedAt: Date.now(),
    recording: false,
    har: false,
    streamPort: null,
    startUrl,
  };
  await saveActive(trace);
  await writeFile(
    path.join(dir, "meta.json"),
    JSON.stringify({ id, session, startedAt: trace.startedAt, startUrl, status: "active" }, null, 2),
  );
  return trace;
}

export async function logCommand(
  trace: ActiveTrace,
  row: {
    argv: string[];
    durationMs: number;
    exitCode: number;
    stdout: string;
    stderr: string;
  },
) {
  const line = {
    ts: Date.now(),
    session: trace.session,
    argv: row.argv,
    durationMs: row.durationMs,
    exitCode: row.exitCode,
    stdout: clip(row.stdout),
    stderr: clip(row.stderr),
  };
  await appendFile(path.join(trace.dir, "commands.jsonl"), `${JSON.stringify(line)}\n`);
}

export async function startCapture(trace: ActiveTrace): Promise<ActiveTrace> {
  const status = await abJson<{ port?: number; connected?: boolean }>(trace.session, [
    "stream",
    "status",
  ]);
  if (status?.port) {
    trace.streamPort = status.port;
  }

  if (!trace.recording && !trace.recordAttempted) {
    const video = path.join(trace.dir, "session.mp4");
    const started = await abJson(trace.session, ["record", "start", video, "--fps", "12"]);
    trace.recording = Boolean(started);
    trace.recordAttempted = true;
  }

  if (!trace.har && !trace.harAttempted) {
    const started = await runSilent(trace.session, ["network", "har", "start", "--content", "text"]);
    trace.har = started.code === 0;
    trace.harAttempted = true;
  }

  await saveActive(trace);
  return trace;
}

export async function wrapCommand(trace: ActiveTrace, forwarded: string[]) {
  const writes: Promise<void>[] = [];
  const run = () => runAgentBrowser(forwarded, { tee: true });
  const result = await collectDuring(trace.streamPort, run, (event) => {
    writes.push(appendFile(path.join(trace.dir, "events.jsonl"), `${JSON.stringify(event)}\n`));
    if (event.type === "url" && typeof event.url === "string") {
      trace.lastUrl = event.url;
    }
    if (event.type === "console" || event.type === "page_error") {
      writes.push(appendFile(path.join(trace.dir, "console.jsonl"), `${JSON.stringify(event)}\n`));
    }
  });
  await Promise.all(writes);
  await logCommand(trace, {
    argv: forwarded,
    durationMs: result.durationMs,
    exitCode: result.code,
    stdout: result.stdout,
    stderr: result.stderr,
  });
  await saveActive(trace);
  return result;
}

export async function finalize(trace: ActiveTrace) {
  const url = await textOut(trace.session, ["get", "url"]);
  const title = await textOut(trace.session, ["get", "title"]);
  if (url) trace.lastUrl = url;

  await dumpJson(trace.session, ["--json", "console"], path.join(trace.dir, "console.json"));
  await dumpJson(trace.session, ["--json", "errors"], path.join(trace.dir, "errors.json"));
  await dumpText(trace.session, ["snapshot", "-i"], path.join(trace.dir, "snapshot.txt"));
  await runSilent(trace.session, [
    "screenshot",
    "--screenshot-format",
    "jpeg",
    "--screenshot-quality",
    "70",
    path.join(trace.dir, "poster.jpg"),
  ]);

  if (trace.recording) {
    await runSilent(trace.session, ["record", "stop"]);
    trace.recording = false;
  }
  if (trace.har) {
    await runSilent(trace.session, ["network", "har", "stop", path.join(trace.dir, "network.har")]);
    trace.har = false;
  }

  await writeSummary(trace, { title, url: trace.lastUrl || trace.startUrl });
  await writeFile(
    path.join(trace.dir, "meta.json"),
    JSON.stringify(
      {
        id: trace.id,
        session: trace.session,
        startedAt: trace.startedAt,
        endedAt: Date.now(),
        startUrl: trace.startUrl,
        lastUrl: trace.lastUrl || url,
        title,
        status: "complete",
        dir: trace.dir,
      },
      null,
      2,
    ),
  );
  await clearActive(trace.session);
}

async function abJson<T>(session: string, args: string[]): Promise<T | null> {
  const result = await runSilent(session, ["--json", ...args]);
  const parsed = parseWrappedJson<AbJson<T>>(result.stdout || result.stderr);
  if (!parsed?.success) return null;
  return parsed.data ?? null;
}

async function dumpJson(session: string, args: string[], file: string) {
  const result = await runSilent(session, args);
  const text = result.stdout.trim() || result.stderr.trim();
  if (text) await writeFile(file, text);
}

async function dumpText(session: string, args: string[], file: string) {
  const result = await runSilent(session, args);
  const text = result.stdout.trim() || result.stderr.trim();
  if (text) await writeFile(file, `${text}\n`);
}

async function textOut(session: string, args: string[]): Promise<string | undefined> {
  const result = await runSilent(session, args);
  const text = result.stdout.trim();
  return text || undefined;
}

async function runSilent(session: string, args: string[]) {
  return runAgentBrowser(["--session", session, ...args], { tee: false, timeoutMs: 30_000 });
}

function clip(text: string) {
  if (text.length <= MAX_CAPTURE) return text;
  return `${text.slice(0, MAX_CAPTURE)}\n…truncated`;
}
