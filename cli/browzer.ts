#!/usr/bin/env node
import { BROWZER_COMMANDS, CLOSE_COMMANDS, isPassthrough, parseArgv } from "./argv";
import { runAgentBrowser } from "./agent";
import { inspectCommand, tracesCommand, helpText } from "./commands";
import { replayCommand } from "./replay";
import { skillsCommand } from "./skills";
import { ensureTrace, finalize, startCapture, wrapCommand } from "./collect";
import { listActive, loadActive } from "./state";

async function main() {
  const argv = process.argv.slice(2);
  const parsed = parseArgv(argv);

  if (parsed.command && BROWZER_COMMANDS.has(parsed.command)) {
    if (parsed.command === "help") {
      process.stdout.write(helpText());
      return;
    }
    if (parsed.command === "traces") {
      await tracesCommand(parsed.json, parsed.output);
      return;
    }
    if (parsed.command === "inspect") {
      const index = argv.indexOf("inspect");
      const id = argv.slice(index + 1).find((token) => !token.startsWith("-"));
      await inspectCommand(id, parsed.output);
      return;
    }
    if (parsed.command === "replay") {
      const index = argv.indexOf("replay");
      const target = argv.slice(index + 1).find((token) => !token.startsWith("-"));
      await replayCommand(target, parsed.output);
      return;
    }
    if (parsed.command === "skills") {
      await skillsCommand(argv, parsed.json);
      return;
    }
  }

  if (isPassthrough(parsed.command)) {
    const result = await runAgentBrowser(parsed.forwarded, { tee: true });
    process.exit(result.code);
  }

  const startUrl = commandUrl(parsed.forwarded, parsed.command);
  const closing = CLOSE_COMMANDS.has(parsed.command ?? "");

  if (closing && parsed.forwarded.includes("--all")) {
    for (const active of await listActive()) {
      try {
        await finalize(active);
      } catch (err) {
        process.stderr.write(`browzer: failed to finalize ${active.id}: ${String(err)}\n`);
      }
    }
    const result = await runAgentBrowser(parsed.forwarded, { tee: true });
    process.exit(result.code);
  }

  if (closing) {
    const active = await loadActive(parsed.session);
    if (active) {
      try {
        await finalize(active);
      } catch (err) {
        process.stderr.write(`browzer: finalize failed: ${String(err)}\n`);
      }
    }
    const result = await runAgentBrowser(parsed.forwarded, { tee: true });
    process.exit(result.code);
  }

  const trace = await ensureTrace(parsed.session, startUrl, parsed.output);
  const result = await wrapCommand(trace, parsed.forwarded);
  if (result.code === 0) {
    const current = (await loadActive(parsed.session)) ?? trace;
    try {
      await startCapture(current);
    } catch (err) {
      process.stderr.write(`browzer: capture not started: ${String(err)}\n`);
    }
  }
  process.exit(result.code);
}

function commandUrl(argv: string[], command: string | null): string | undefined {
  if (command !== "open" && command !== "goto" && command !== "navigate") return undefined;
  const index = argv.findIndex((token) => token === command);
  if (index < 0) return undefined;
  return argv.slice(index + 1).find((token) => !token.startsWith("-"));
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
