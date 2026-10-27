// Runs the whole flow on the fictional persona, without network or model calls:
// copies examples/persona to demo-workspace/ (ignored by git), then shortlists,
// scores, checks the tailored CV, and renders the PDFs.
// Usage: npm run demo

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { REPO_ROOT } from "./lib/workspace.ts";

const SOURCE = path.join(REPO_ROOT, "examples", "persona");
const TARGET = path.join(REPO_ROOT, "demo-workspace");
// The persona's offers are dated October 2026; a fixed "today" keeps the demo stable.
const DEMO_TODAY = "2026-10-27";
const APPLICATION = path.join("demo-workspace", "applications", "lumen-parcel-analytics-engineer");

function run(title: string, script: string, args: string[]): boolean {
  console.log(`\n=== ${title} ===`);
  const result = spawnSync(process.execPath, [path.join("scripts", script), ...args], { cwd: REPO_ROOT, stdio: "inherit" });
  return result.status === 0;
}

fs.rmSync(TARGET, { recursive: true, force: true });
fs.cpSync(SOURCE, TARGET, { recursive: true });
console.log("Copied the fictional persona (Alba Ferrer Soler) to demo-workspace/.");

const steps = [
  run("1. Shortlist", "rank.ts", ["shortlist", "--workspace", "demo-workspace", "--now", DEMO_TODAY]),
  run("2. Score (the evaluations were written by the agent beforehand)", "rank.ts", ["score", "--workspace", "demo-workspace", "--now", DEMO_TODAY]),
  run("3. Check the tailored CV and cover letter for invented facts", "check-cv.ts", [APPLICATION, "--workspace", "demo-workspace"]),
  run("4. Render the PDFs", "render.ts", [APPLICATION]),
];

console.log(
  steps.every(Boolean)
    ? `\nDone. Open ${APPLICATION} to see the PDFs, and demo-workspace/offers/ranking.md for the ranking.`
    : "\nSome steps failed: see the messages above, and run npm run doctor.",
);
process.exitCode = steps.every(Boolean) ? 0 : 1;
