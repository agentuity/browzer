import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ActiveTrace } from "./state";

type CommandRow = {
  ts: number;
  argv: string[];
  durationMs: number;
  exitCode: number;
  stdout?: string;
  stderr?: string;
};

export async function writeSummary(trace: ActiveTrace, extras: { title?: string; url?: string }) {
  const commands = await readJsonl<CommandRow>(path.join(trace.dir, "commands.jsonl"));
  const failed = commands.filter((row) => row.exitCode !== 0);
  const errorsRaw = await readOptional(path.join(trace.dir, "errors.json"));
  const consoleRaw = await readOptional(path.join(trace.dir, "console.json"));
  const harIssues = await harFailures(path.join(trace.dir, "network.har"));

  const errorCount = countErrors(errorsRaw);
  const consoleErrors = countConsoleErrors(consoleRaw);
  const endedAt = Date.now();
  const durationSec = ((endedAt - trace.startedAt) / 1000).toFixed(1);

  const lines = [
    `# ${trace.id}`,
    "",
    `- session: \`${trace.session}\``,
    `- duration: ${durationSec}s`,
    extras.url ? `- url: ${extras.url}` : null,
    extras.title ? `- title: ${extras.title}` : null,
    `- commands: ${commands.length} (${failed.length} failed)`,
    `- page errors: ${errorCount}`,
    `- console errors: ${consoleErrors}`,
    `- har failures: ${harIssues.length}`,
    "",
    "## Failed commands",
    failed.length === 0
      ? "_none_"
      : failed
          .map((row) => `- \`${row.argv.join(" ")}\` (exit ${row.exitCode})`)
          .join("\n"),
    "",
    "## Network failures",
    harIssues.length === 0 ? "_none_" : harIssues.map((item) => `- ${item}`).join("\n"),
    "",
    "## Files",
    ...[
      "session.mp4",
      "network.har",
      "commands.jsonl",
      "events.jsonl",
      "console.json",
      "errors.json",
      "snapshot.txt",
      "poster.jpg",
    ]
      .filter((name) => existsSync(path.join(trace.dir, name)))
      .map((name) => `- ${name}`),
    "",
  ].filter((line): line is string => line != null);

  await writeFile(path.join(trace.dir, "summary.md"), `${lines.join("\n")}\n`);
}

async function readJsonl<T>(file: string): Promise<T[]> {
  if (!existsSync(file)) return [];
  const text = await readFile(file, "utf8");
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as T];
      } catch {
        return [];
      }
    });
}

async function readOptional(file: string): Promise<unknown> {
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return null;
  }
}

function countErrors(raw: unknown): number {
  if (!raw || typeof raw !== "object") return 0;
  const data = (raw as { data?: { errors?: unknown[] } }).data ?? raw;
  const errors = (data as { errors?: unknown[] }).errors;
  return Array.isArray(errors) ? errors.length : 0;
}

function countConsoleErrors(raw: unknown): number {
  if (!raw || typeof raw !== "object") return 0;
  const data = (raw as { data?: { messages?: { type?: string }[] } }).data ?? raw;
  const messages = (data as { messages?: { type?: string }[] }).messages;
  if (!Array.isArray(messages)) return 0;
  return messages.filter((msg) => msg.type === "error" || msg.type === "warning").length;
}

async function harFailures(file: string): Promise<string[]> {
  if (!existsSync(file)) return [];
  try {
    const har = JSON.parse(await readFile(file, "utf8")) as {
      log?: { entries?: { request?: { method?: string; url?: string }; response?: { status?: number } }[] };
    };
    const entries = har.log?.entries ?? [];
    return entries
      .filter((entry) => (entry.response?.status ?? 0) >= 400)
      .slice(0, 20)
      .map((entry) => `${entry.response?.status} ${entry.request?.method} ${entry.request?.url}`);
  } catch {
    return [];
  }
}
