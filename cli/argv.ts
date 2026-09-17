const FLAGS_WITH_VALUE = new Set([
  "--session",
  "--cdp",
  "--profile",
  "--idle-timeout",
  "--config",
  "--allowed-domains",
  "--executable-path",
  "--user-agent",
  "--proxy",
  "--proxy-bypass",
  "--headers",
  "--storage-state",
  "--init-script",
  "--tools",
  "--port",
  "--allowed-origins",
  "--output",
  "-o",
  "--provider",
]);

export const BROWZER_COMMANDS = new Set(["traces", "inspect", "replay", "help", "skills"]);

export const PASSTHROUGH_COMMANDS = new Set([
  "dashboard",
  "mcp",
  "doctor",
  "install",
  "upgrade",
  "plugin",
  "help",
  "--help",
  "-h",
  "--version",
  "-V",
  "-v",
]);

export const SESSION_META_COMMANDS = new Set(["session"]);

export const CLOSE_COMMANDS = new Set(["close", "quit", "exit"]);

export type ParsedArgv = {
  session: string;
  command: string | null;
  forwarded: string[];
  json: boolean;
  output?: string;
};

export function parseArgv(argv: string[]): ParsedArgv {
  const forwarded: string[] = [];
  let session = process.env.AGENT_BROWSER_SESSION?.trim() || "default";
  let json = false;
  let command: string | null = null;
  let output = process.env.BROWZER_OUTPUT?.trim() || undefined;

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i] ?? "";
    if ((token === "--output" || token === "-o") && argv[i + 1]) {
      output = argv[i + 1];
      i += 1;
      continue;
    }
    if (token.startsWith("--output=")) {
      output = token.slice("--output=".length);
      continue;
    }
    if (token === "--session" && argv[i + 1]) {
      session = argv[i + 1]!;
      forwarded.push(token, argv[i + 1]!);
      i += 1;
      continue;
    }
    if (token.startsWith("--session=")) {
      session = token.slice("--session=".length);
      forwarded.push(token);
      continue;
    }
    if (token === "--json") {
      json = true;
      forwarded.push(token);
      continue;
    }
    if (token === "--headed" && (argv[i + 1] === "true" || argv[i + 1] === "false")) {
      forwarded.push(token, argv[i + 1]!);
      i += 1;
      continue;
    }
    forwarded.push(token);
    if (token.startsWith("-")) {
      if (FLAGS_WITH_VALUE.has(token) && argv[i + 1] && !argv[i + 1]!.startsWith("-")) {
        forwarded.push(argv[i + 1]!);
        i += 1;
      }
      continue;
    }
    if (!command) command = token;
  }

  return { session, command, forwarded, json, output };
}

export function isPassthrough(command: string | null): boolean {
  if (!command) return true;
  if (PASSTHROUGH_COMMANDS.has(command)) return true;
  if (SESSION_META_COMMANDS.has(command)) return true;
  return false;
}
