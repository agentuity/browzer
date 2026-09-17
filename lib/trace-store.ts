import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { tracesDir } from "../cli/paths";

const ID_RE = /^[a-zA-Z0-9._-]+$/;

export type TraceMeta = {
  id: string;
  session: string;
  startedAt: number;
  endedAt?: number;
  startUrl?: string;
  lastUrl?: string;
  title?: string;
  status: string;
  dir: string;
  hasVideo: boolean;
  hasPoster: boolean;
  hasHar: boolean;
};

export type TraceCommand = {
  id: string;
  ts: number;
  argv: string[];
  label: string;
  durationMs: number;
  exitCode: number;
  stdout: string;
  stderr: string;
};

export type ConsoleMessage = {
  type: string;
  text: string;
  timestamp?: number;
};

export type NetworkRow = {
  method: string;
  url: string;
  status: number;
  time?: number;
};

export type UrlCue = {
  ts: number;
  url: string;
};

export type TraceDetail = TraceMeta & {
  commands: TraceCommand[];
  console: ConsoleMessage[];
  errors: { text: string }[];
  network: NetworkRow[];
  snapshot: string | null;
  urls: UrlCue[];
};

export function assertTraceId(id: string) {
  if (!ID_RE.test(id)) throw new Error("Invalid trace id");
}

export function commandLabel(argv: string[]) {
  const out: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i] ?? "";
    if (token === "--session" || token === "--headed" || token === "--idle-timeout") {
      i += 1;
      continue;
    }
    if (token.startsWith("--session=") || token === "--json") continue;
    out.push(token);
  }
  return out.join(" ") || argv.join(" ");
}

export async function listTraces(): Promise<TraceMeta[]> {
  const root = tracesDir();
  if (!existsSync(root)) return [];
  const names = await readdir(root);
  const traces: TraceMeta[] = [];
  for (const id of names) {
    if (!ID_RE.test(id)) continue;
    const meta = await readMeta(id);
    if (meta) traces.push(meta);
  }
  traces.sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));
  return traces;
}

export async function getTrace(id: string): Promise<TraceDetail | null> {
  assertTraceId(id);
  return getTraceFromDir(path.join(tracesDir(), id));
}

export async function getTraceFromDir(dir: string): Promise<TraceDetail | null> {
  const resolved = path.resolve(dir);
  const id = path.basename(resolved);
  const meta = await readMetaAt(resolved, id);
  if (!meta) return null;
  const commands = await readCommands(resolved);
  return {
    ...meta,
    commands,
    console: await readConsole(resolved),
    errors: await readErrors(resolved),
    network: await readNetwork(resolved),
    snapshot: await readText(path.join(resolved, "snapshot.txt")),
    urls: await readUrls(resolved, commands, meta),
  };
}

export function traceFile(id: string, name: "session.mp4" | "poster.jpg" | "network.har") {
  assertTraceId(id);
  return path.join(tracesDir(), id, name);
}

async function readMeta(id: string): Promise<TraceMeta | null> {
  return readMetaAt(path.join(tracesDir(), id), id);
}

async function readMetaAt(dir: string, id: string): Promise<TraceMeta | null> {
  const file = path.join(dir, "meta.json");
  if (!existsSync(file)) return null;
  try {
    const raw = JSON.parse(await readFile(file, "utf8")) as Partial<TraceMeta>;
    const info = await stat(dir);
    return {
      id,
      session: raw.session || id,
      startedAt: raw.startedAt || info.mtimeMs,
      endedAt: raw.endedAt,
      startUrl: raw.startUrl,
      lastUrl: raw.lastUrl,
      title: raw.title,
      status: raw.status || "unknown",
      dir,
      hasVideo: existsSync(path.join(dir, "session.mp4")),
      hasPoster: existsSync(path.join(dir, "poster.jpg")),
      hasHar: existsSync(path.join(dir, "network.har")),
    };
  } catch {
    return null;
  }
}

async function readCommands(dir: string): Promise<TraceCommand[]> {
  const file = path.join(dir, "commands.jsonl");
  if (!existsSync(file)) return [];
  const lines = (await readFile(file, "utf8")).split("\n").filter(Boolean);
  return lines.flatMap((line, index) => {
    try {
      const row = JSON.parse(line) as {
        ts: number;
        argv: string[];
        durationMs: number;
        exitCode: number;
        stdout?: string;
        stderr?: string;
      };
      return [
        {
          id: `c${index + 1}`,
          ts: row.ts,
          argv: row.argv,
          label: commandLabel(row.argv),
          durationMs: row.durationMs,
          exitCode: row.exitCode,
          stdout: row.stdout || "",
          stderr: row.stderr || "",
        },
      ];
    } catch {
      return [];
    }
  });
}

async function readConsole(dir: string): Promise<ConsoleMessage[]> {
  const file = path.join(dir, "console.json");
  if (!existsSync(file)) return [];
  try {
    const raw = JSON.parse(await readFile(file, "utf8")) as {
      data?: { messages?: { type?: string; text?: string; timestamp?: number }[] };
    };
    return (raw.data?.messages ?? []).map((msg) => ({
      type: msg.type || "log",
      text: msg.text || "",
      timestamp: msg.timestamp,
    }));
  } catch {
    return [];
  }
}

async function readErrors(dir: string): Promise<{ text: string }[]> {
  const file = path.join(dir, "errors.json");
  if (!existsSync(file)) return [];
  try {
    const raw = JSON.parse(await readFile(file, "utf8")) as {
      data?: { errors?: { text?: string; message?: string }[] };
    };
    return (raw.data?.errors ?? []).map((err) => ({
      text: err.text || err.message || JSON.stringify(err),
    }));
  } catch {
    return [];
  }
}

async function readNetwork(dir: string): Promise<NetworkRow[]> {
  const file = path.join(dir, "network.har");
  if (!existsSync(file)) return [];
  try {
    const har = JSON.parse(await readFile(file, "utf8")) as {
      log?: {
        entries?: {
          time?: number;
          request?: { method?: string; url?: string };
          response?: { status?: number };
        }[];
      };
    };
    return (har.log?.entries ?? []).slice(0, 400).map((entry) => ({
      method: entry.request?.method || "GET",
      url: entry.request?.url || "",
      status: entry.response?.status || 0,
      time: entry.time,
    }));
  } catch {
    return [];
  }
}

async function readText(file: string): Promise<string | null> {
  if (!existsSync(file)) return null;
  return readFile(file, "utf8");
}

async function readUrls(dir: string, commands: TraceCommand[], meta: TraceMeta): Promise<UrlCue[]> {
  const points: UrlCue[] = [];
  if (meta.startUrl) points.push({ ts: meta.startedAt, url: meta.startUrl });
  for (const cmd of commands) {
    const url = openUrlFromArgv(cmd.argv);
    if (url) points.push({ ts: cmd.ts, url });
  }
  const eventsFile = path.join(dir, "events.jsonl");
  if (existsSync(eventsFile)) {
    const lines = (await readFile(eventsFile, "utf8")).split("\n").filter(Boolean);
    for (const line of lines) {
      try {
        const event = JSON.parse(line) as {
          type?: string;
          timestamp?: number;
          url?: string;
          tabs?: { active?: boolean; url?: string }[];
        };
        const ts = event.timestamp ?? 0;
        if (event.type === "url" && event.url) points.push({ ts, url: event.url });
        if (event.type === "tabs") {
          const active = event.tabs?.find((tab) => tab.active) ?? event.tabs?.[0];
          if (active?.url) points.push({ ts, url: active.url });
        }
      } catch {
        /* skip */
      }
    }
  }
  points.sort((a, b) => a.ts - b.ts);
  const deduped: UrlCue[] = [];
  for (const point of points) {
    const prev = deduped[deduped.length - 1];
    if (!prev || prev.url !== point.url) deduped.push(point);
  }
  return deduped;
}

function openUrlFromArgv(argv: string[]) {
  const index = argv.findIndex((token) => token === "open" || token === "goto" || token === "navigate");
  if (index < 0) return null;
  const url = argv.slice(index + 1).find((token) => !token.startsWith("-"));
  return url || null;
}
