// Copies the workflow skills from .agents/skills (the source) to .claude/skills,
// where Claude Code looks for them. Edit the skills in .agents/skills only, then run this.
// Usage: npm run sync-skills [-- --check]   (--check: only report differences, exit 1 if any)

import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "./lib/args.ts";
import { isMain } from "./lib/main.ts";
import { REPO_ROOT } from "./lib/workspace.ts";

export const SKILLS_SOURCE = path.join(REPO_ROOT, ".agents", "skills");
export const SKILLS_COPY = path.join(REPO_ROOT, ".claude", "skills");

// Every file under root, as paths relative to root with forward slashes, sorted.
function listFiles(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else files.push(path.relative(root, full).replace(/\\/g, "/"));
    }
  };
  walk(root);
  return files.sort();
}

// Files that are missing, different, or extra in the copy.
export function skillDifferences(source = SKILLS_SOURCE, copy = SKILLS_COPY): string[] {
  const differences: string[] = [];
  const sourceFiles = listFiles(source);
  for (const file of sourceFiles) {
    const target = path.join(copy, file);
    if (!fs.existsSync(target)) differences.push(`${file}: missing in the copy`);
    else if (!fs.readFileSync(target).equals(fs.readFileSync(path.join(source, file)))) differences.push(`${file}: different`);
  }
  for (const file of listFiles(copy)) {
    if (!sourceFiles.includes(file)) differences.push(`${file}: only in the copy`);
  }
  return differences;
}

// Replaces the copy with the source, so files removed from the source disappear too.
export function syncSkills(source = SKILLS_SOURCE, copy = SKILLS_COPY): void {
  fs.rmSync(copy, { recursive: true, force: true });
  fs.cpSync(source, copy, { recursive: true });
}

if (isMain(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const differences = skillDifferences();
  if (args.options.check === true) {
    for (const d of differences) console.log(d);
    console.log(differences.length === 0 ? "Skills are in sync." : "Run: npm run sync-skills");
    process.exitCode = differences.length === 0 ? 0 : 1;
  } else {
    syncSkills();
    console.log(`Copied the skills to .claude/skills (${differences.length} file(s) changed).`);
  }
}
