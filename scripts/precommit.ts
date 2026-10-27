// Called by .githooks/pre-commit. Refuses a commit that would publish personal data:
// files from the personal workspace, documents (PDF, Word), images, secrets, and
// email addresses or phone numbers added outside the folders meant for fake data.
// Bypassing it (git commit --no-verify) is possible but strongly discouraged.

import { execFileSync } from "node:child_process";
import { isMain } from "./lib/main.ts";
import { EMAIL_PATTERN, PHONE_PATTERN } from "./lib/text.ts";

export type StagedFile = { path: string; addedLines: string[] };

// Folders where invented sample data (fake emails and phones) is allowed.
const FAKE_DATA_FOLDERS = ["examples/", "tests/", "templates/"];

const BLOCKED_FOLDERS = ["me/", "demo-workspace/"];
const BLOCKED_EXTENSIONS = /\.(pdf|docx?|odt|rtf|pages|png|jpe?g|heic|webp|key|pem)$/i;
const ALLOWED_DOC_FOLDER = "docs/assets/";
const SECRET_FILE = /(^|\/)\.env(\..*)?$/;

const EMAIL = EMAIL_PATTERN;
// Domains that are fine to mention: reserved example domains and no-reply addresses.
const ALLOWED_EMAIL = /@(example\.(com|org|net)|users\.noreply\.github\.com|anthropic\.com)$/i;
// The shared pattern is global (flag g); .test() needs a non-global copy.
const PHONE = new RegExp(PHONE_PATTERN.source);

export function findProblems(files: StagedFile[]): string[] {
  const problems: string[] = [];
  for (const file of files) {
    const p = file.path.replace(/\\/g, "/");
    if (BLOCKED_FOLDERS.some((folder) => p.startsWith(folder))) {
      problems.push(`${p}: files from your personal workspace must never be committed`);
      continue;
    }
    if (BLOCKED_EXTENSIONS.test(p) && !p.startsWith(ALLOWED_DOC_FOLDER)) {
      problems.push(`${p}: documents and images may contain personal data and are not committed`);
      continue;
    }
    if (SECRET_FILE.test(p)) {
      problems.push(`${p}: environment files may contain secrets`);
      continue;
    }
    if (FAKE_DATA_FOLDERS.some((folder) => p.startsWith(folder))) continue;
    file.addedLines.forEach((line) => {
      const emails = (line.match(EMAIL) ?? []).filter((email) => !ALLOWED_EMAIL.test(email));
      if (emails.length > 0) problems.push(`${p}: contains an email address (${emails[0]})`);
      if (PHONE.test(line)) problems.push(`${p}: looks like it contains a phone number: "${line.trim().slice(0, 80)}"`);
    });
  }
  return problems;
}

function git(args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8" });
}

function stagedFiles(): StagedFile[] {
  const names = git(["diff", "--cached", "--name-only", "--diff-filter=ACMR"]).split("\n").filter(Boolean);
  return names.map((name) => {
    const diff = git(["diff", "--cached", "-U0", "--", name]);
    const addedLines = diff
      .split("\n")
      .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
      .map((line) => line.slice(1));
    return { path: name, addedLines };
  });
}

if (isMain(import.meta.url)) {
  const problems = findProblems(stagedFiles());
  if (problems.length > 0) {
    console.error("Commit blocked to protect personal data:\n");
    for (const problem of problems) console.error(`  - ${problem}`);
    console.error("\nUnstage these files (git restore --staged <file>) or remove the data, then commit again.");
    process.exit(1);
  }
}
