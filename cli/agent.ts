import { spawn } from "node:child_process";

export const AGENT_BROWSER_BIN = process.env.AGENT_BROWSER_BIN ?? "agent-browser";

export type RunResult = {
  code: number;
  stdout: string;
  stderr: string;
  durationMs: number;
};

export function runAgentBrowser(
  args: string[],
  opts?: { tee?: boolean; timeoutMs?: number },
): Promise<RunResult> {
  const tee = opts?.tee ?? false;
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const child = spawn(AGENT_BROWSER_BIN, args, {
      env: process.env,
      stdio: ["inherit", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const finish = (code: number) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve({ code, stdout, stderr, durationMs: Date.now() - started });
    };

    const timer =
      opts?.timeoutMs != null
        ? setTimeout(() => {
            child.kill("SIGTERM");
            reject(new Error(`agent-browser timed out: ${args.join(" ")}`));
          }, opts.timeoutMs)
        : null;

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
      if (tee) process.stdout.write(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
      if (tee) process.stderr.write(chunk);
    });
    child.on("error", (err) => {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        reject(
          new Error(
            "agent-browser not found on PATH. Install it globally (npm i -g agent-browser) or set AGENT_BROWSER_BIN.",
          ),
        );
        return;
      }
      reject(err);
    });
    child.on("close", (code) => finish(code ?? 1));
  });
}

export function parseWrappedJson<T>(text: string): T | null {
  const start = text.indexOf("{");
  if (start < 0) return null;
  try {
    return JSON.parse(text.slice(start)) as T;
  } catch {
    return null;
  }
}
