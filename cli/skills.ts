import { copyFile, lstat, mkdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { packageRoot } from "./paths";

const SKILL_NAME = "browzer";

type Target = {
  name: string;
  global: string;
  project: string;
  always?: boolean;
};

const TARGETS: Target[] = [
  { name: "agents", global: path.join(homedir(), ".agents", "skills"), project: ".agents/skills", always: true },
  { name: "claude", global: path.join(homedir(), ".claude", "skills"), project: ".claude/skills" },
  { name: "cursor", global: path.join(homedir(), ".cursor", "skills"), project: ".cursor/skills" },
  { name: "codex", global: path.join(homedir(), ".codex", "skills"), project: ".codex/skills" },
  { name: "grok", global: path.join(homedir(), ".grok", "skills"), project: ".grok/skills" },
];

export function skillSourceDir() {
  return path.join(packageRoot(), "skills", SKILL_NAME);
}

export async function skillsCommand(argv: string[], json: boolean) {
  const rest = argv.slice(argv.indexOf("skills") + 1).filter((token) => !token.startsWith("-"));
  const sub = rest[0] ?? "list";
  if (sub === "list") {
    await listSkills(json);
    return;
  }
  if (sub === "get") {
    await getSkill();
    return;
  }
  if (sub === "path") {
    process.stdout.write(`${skillSourceDir()}\n`);
    return;
  }
  if (sub === "install") {
    const project = argv.includes("--project");
    await installSkill(project);
    return;
  }
  process.stderr.write("Usage: browzer skills [list|get|path|install] [--project]\n");
  process.exitCode = 1;
}

async function listSkills(json: boolean) {
  const source = skillSourceDir();
  const skill = {
    name: SKILL_NAME,
    path: source,
    description: "agent-browser wrapper that records a replayable trace",
  };
  if (json) {
    process.stdout.write(`${JSON.stringify({ skills: [skill] }, null, 2)}\n`);
    return;
  }
  process.stdout.write(`${skill.name}  ${skill.path}\n`);
}

async function getSkill() {
  const file = path.join(skillSourceDir(), "SKILL.md");
  if (!existsSync(file)) {
    process.stderr.write(`Skill not found at ${file}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(await readFile(file, "utf8"));
}

async function installSkill(project: boolean) {
  const source = path.join(skillSourceDir(), "SKILL.md");
  if (!existsSync(source)) {
    process.stderr.write(`Skill not found at ${source}\n`);
    process.exitCode = 1;
    return;
  }
  const cwd = process.cwd();
  const written: string[] = [];
  for (const target of TARGETS) {
    const root = project ? path.resolve(cwd, target.project) : target.global;
    const marker = project
      ? path.dirname(path.resolve(cwd, target.project))
      : path.dirname(target.global);
    if (!target.always && !existsSync(marker) && !existsSync(root)) continue;
    const destDir = path.join(root, SKILL_NAME);
    try {
      const st = await lstat(destDir);
      if (!st.isDirectory() && !st.isSymbolicLink()) await mkdir(destDir, { recursive: true });
    } catch {
      await mkdir(destDir, { recursive: true });
    }
    const dest = path.join(destDir, "SKILL.md");
    await copyFile(source, dest);
    written.push(dest);
  }
  if (written.length === 0) {
    process.stderr.write("No agent skill directories found. Pass --project from a repo, or create ~/.agents/skills.\n");
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`Installed ${SKILL_NAME} to:\n`);
  for (const dest of written) process.stdout.write(`  ${dest}\n`);
}
