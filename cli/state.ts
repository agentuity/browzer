import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { activeDir, activePath } from "./paths";

export type ActiveTrace = {
  id: string;
  dir: string;
  session: string;
  startedAt: number;
  recording: boolean;
  har: boolean;
  streamPort: number | null;
  startUrl?: string;
  lastUrl?: string;
  recordAttempted?: boolean;
  harAttempted?: boolean;
};

export async function loadActive(session: string): Promise<ActiveTrace | null> {
  const file = activePath(session);
  if (!existsSync(file)) return null;
  try {
    const data = JSON.parse(await readFile(file, "utf8")) as ActiveTrace;
    if (!data.dir || !existsSync(data.dir)) {
      await clearActive(session);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export async function saveActive(state: ActiveTrace) {
  await mkdir(activeDir(), { recursive: true });
  await writeFile(activePath(state.session), JSON.stringify(state, null, 2));
}

export async function clearActive(session: string) {
  await rm(activePath(session), { force: true });
}

export async function listActive(): Promise<ActiveTrace[]> {
  if (!existsSync(activeDir())) return [];
  const names = await readdir(activeDir());
  const out: ActiveTrace[] = [];
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    const session = name.slice(0, -".json".length);
    const active = await loadActive(session);
    if (active) out.push(active);
  }
  return out;
}
