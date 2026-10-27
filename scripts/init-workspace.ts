// Creates your private workspace (me/ by default) from templates/workspace.
// Never overwrites a file that already exists, so it is safe to run again.
// Usage: npm run init-workspace  [-- --workspace <folder>]

import fs from "node:fs";
import path from "node:path";
import { parseArgs, stringOption } from "./lib/args.ts";
import { isMain } from "./lib/main.ts";
import { REPO_ROOT, workspacePaths } from "./lib/workspace.ts";

const TEMPLATE_DIR = path.join(REPO_ROOT, "templates", "workspace");

// Copies the template tree into target and returns the files it created.
export function initWorkspace(target: string, templateDir = TEMPLATE_DIR): string[] {
  const created: string[] = [];
  const copyTree = (from: string, to: string) => {
    fs.mkdirSync(to, { recursive: true });
    for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
      const source = path.join(from, entry.name);
      const destination = path.join(to, entry.name);
      if (entry.isDirectory()) {
        copyTree(source, destination);
      } else if (!fs.existsSync(destination)) {
        fs.copyFileSync(source, destination);
        created.push(destination);
      }
    }
  };
  copyTree(templateDir, target);
  for (const folder of ["offers", "applications"]) fs.mkdirSync(path.join(target, folder), { recursive: true });
  return created;
}

if (isMain(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const paths = workspacePaths(stringOption(args, "workspace"));
  const created = initWorkspace(paths.root);
  const where = path.relative(REPO_ROOT, paths.root) || ".";
  if (created.length === 0) {
    console.log(`Your workspace ${where}/ already exists. Nothing was changed.`);
  } else {
    console.log(`Created your private workspace ${where}/ (${created.length} files). Git ignores it.`);
  }
}
