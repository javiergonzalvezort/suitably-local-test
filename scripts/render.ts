// Turns cv.json and cover-letter.json in an application folder into PDFs with Typst.
// Usage: npm run render -- <application folder>
//   e.g. npm run render -- me/applications/lumen-parcel-analytics-engineer

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "./lib/args.ts";
import { isMain } from "./lib/main.ts";
import { readJson, REPO_ROOT } from "./lib/workspace.ts";

const TEMPLATES = path.join(REPO_ROOT, "templates");

// File names a recruiter will see, for example "Alba Ferrer Soler - CV.pdf".
export function pdfNames(name: string, language: string): { cv: string; letter: string } {
  const safe = name.replace(/[\\/:*?"<>|]/g, "").trim() || "Candidate";
  return language === "es"
    ? { cv: `${safe} - CV.pdf`, letter: `${safe} - Carta de presentacion.pdf` }
    : { cv: `${safe} - CV.pdf`, letter: `${safe} - Cover letter.pdf` };
}

function compile(template: string, dataFile: string, output: string): boolean {
  // The JSON goes in as an input string, so Typst never needs to read files outside templates/.
  // No shell: arguments are passed as a list, so names with spaces are safe.
  const data = JSON.stringify(readJson<unknown>(dataFile));
  const result = spawnSync("typst", ["compile", path.join(TEMPLATES, template), output, "--input", `data=${data}`], {
    encoding: "utf8",
  });
  if (result.error) {
    console.error('Typst is not installed or not on PATH. Run "npm run doctor" for how to install it.');
    return false;
  }
  if (result.status !== 0) {
    console.error(`Typst could not render ${path.basename(dataFile)}:\n${result.stderr}`);
    return false;
  }
  return true;
}

export function renderApplication(folder: string): string[] {
  const written: string[] = [];
  const cvFile = path.join(folder, "cv.json");
  const letterFile = path.join(folder, "cover-letter.json");
  if (!fs.existsSync(cvFile) && !fs.existsSync(letterFile)) {
    throw new Error(`No cv.json or cover-letter.json in ${folder}`);
  }
  for (const [file, template, kind] of [
    [cvFile, "cv.typ", "cv"],
    [letterFile, "cover-letter.typ", "letter"],
  ] as const) {
    if (!fs.existsSync(file)) continue;
    const { name, language } = readJson<{ name: string; language: string }>(file);
    const output = path.join(folder, pdfNames(name, language)[kind]);
    if (compile(template, file, output)) written.push(output);
  }
  return written;
}

if (isMain(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const target = args.positional[0];
  if (!target) {
    console.error("Usage: npm run render -- <application folder>");
    process.exit(1);
  }
  const folder = path.resolve(target);
  const written = renderApplication(folder);
  for (const file of written) console.log(`Wrote ${path.relative(process.cwd(), file)}`);
  if (written.length === 0) process.exit(1);
}
