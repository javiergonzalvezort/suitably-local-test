// Checks a tailored CV and cover letter against the profile before anything is sent.
//
// Errors (must be fixed): a company, job title, date, school, or degree that is not
// in the profile; a number that appears neither in the profile nor in the offer.
// Warnings (worth a look): clichés, long dashes, too many bullets, a letter that is too long.
//
// Usage: npm run check-cv -- <application folder> [--workspace <folder>]

import fs from "node:fs";
import path from "node:path";
import { parseArgs, stringOption } from "./lib/args.ts";
import { isMain } from "./lib/main.ts";
import { normalise } from "./lib/text.ts";
import type { CoverLetter, Cv, Offer } from "./lib/types.ts";
import { readJson, readProfileText, workspacePaths } from "./lib/workspace.ts";

export type CheckReport = { errors: string[]; warnings: string[] };

// Phrases that say nothing; adapted from the writing rules (see THIRD_PARTY_NOTICES.md).
const CLICHES = [
  "passionate about",
  "team player",
  "hit the ground running",
  "leverage my",
  "synergy",
  "synergies",
  "results-driven",
  "go-getter",
  "think outside the box",
  "detail-oriented",
  "dynamic environment",
  "apasionado por",
  "apasionada por",
  "trabajo en equipo",
  "sinergias",
  "orientado a resultados",
  "orientada a resultados",
];

const MAX_BULLETS_PER_JOB = 6;
const MAX_LETTER_WORDS = 400;

// Numbers such as 3, 18%, 30,000 or 2.5. Trailing punctuation is not part of the number.
export function numbersIn(text: string): string[] {
  return (text.match(/\d[\d.,]*%?/g) ?? []).map((n) => n.replace(/[.,]+$/, ""));
}

function has(haystack: string, needle: string): boolean {
  return normalise(haystack).includes(normalise(needle));
}

export function checkCv(cv: Cv, profile: string): CheckReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const need = (value: string | undefined, what: string) => {
    if (!value) errors.push(`${what} is empty`);
    else if (!has(profile, value)) errors.push(`${what} "${value}" is not in the profile`);
  };

  need(cv.name, "Name");
  for (const job of cv.experience ?? []) {
    const where = `Experience "${job.title}, ${job.company}"`;
    need(job.title, `${where}: job title`);
    need(job.company, `${where}: company`);
    need(job.start, `${where}: start date`);
    if (job.end !== "present") need(job.end, `${where}: end date`);
    if ((job.bullets ?? []).length > MAX_BULLETS_PER_JOB) warnings.push(`${where} has more than ${MAX_BULLETS_PER_JOB} bullets`);
  }
  for (const item of cv.education ?? []) {
    need(item.degree, "Education: degree");
    need(item.institution, "Education: institution");
    need(item.year, `Education "${item.degree}": year`);
  }
  const prose = [cv.headline, cv.summary, ...(cv.experience ?? []).flatMap((j) => j.bullets ?? [])];
  for (const text of prose) {
    for (const number of numbersIn(text ?? "")) {
      if (!profile.includes(number)) errors.push(`CV: the number "${number}" is not in the profile ("${text.slice(0, 70)}...")`);
    }
  }
  warnings.push(...styleWarnings("CV", prose.join("\n")));
  return { errors, warnings };
}

export function checkLetter(letter: CoverLetter, profile: string, offerText: string): CheckReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const body = [letter.subject, letter.greeting, ...(letter.paragraphs ?? []), letter.closing].join("\n");
  for (const number of numbersIn(body)) {
    if (!profile.includes(number) && !offerText.includes(number)) {
      errors.push(`Cover letter: the number "${number}" is in neither the profile nor the offer`);
    }
  }
  const words = (letter.paragraphs ?? []).join(" ").split(/\s+/).filter(Boolean).length;
  if (words > MAX_LETTER_WORDS) warnings.push(`Cover letter has ${words} words; keep it under ${MAX_LETTER_WORDS} (one page)`);
  warnings.push(...styleWarnings("Cover letter", body));
  return { errors, warnings };
}

function styleWarnings(where: string, text: string): string[] {
  const warnings: string[] = [];
  for (const phrase of CLICHES) if (has(text, phrase)) warnings.push(`${where}: cliché "${phrase}": show it with a fact instead`);
  if (text.includes(String.fromCharCode(0x2014))) warnings.push(`${where}: long dash found; use a comma or a full stop`);
  return warnings;
}

function findOffer(offerId: string, files: string[]): Offer | undefined {
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const found = readJson<Offer[]>(file).find((o) => o.id === offerId);
    if (found) return found;
  }
  return undefined;
}

export function checkApplication(folder: string, workspace: string | undefined): CheckReport {
  const paths = workspacePaths(workspace);
  const profile = readProfileText(paths);
  if (!profile) return { errors: [`No profile found in ${paths.profileDir}`], warnings: [] };
  const report: CheckReport = { errors: [], warnings: [] };
  const cvFile = path.join(folder, "cv.json");
  const letterFile = path.join(folder, "cover-letter.json");
  if (fs.existsSync(cvFile)) {
    const result = checkCv(readJson<Cv>(cvFile), profile);
    report.errors.push(...result.errors);
    report.warnings.push(...result.warnings);
  }
  if (fs.existsSync(letterFile)) {
    const letter = readJson<CoverLetter>(letterFile);
    const offer = findOffer(letter.offerId, [paths.fetched, paths.pasted]);
    if (!offer) report.warnings.push(`Offer ${letter.offerId} not found, so numbers are checked against the profile only`);
    const offerText = offer ? [offer.title, offer.company, offer.description, offer.salary ?? ""].join("\n") : "";
    const result = checkLetter(letter, profile, offerText);
    report.errors.push(...result.errors);
    report.warnings.push(...result.warnings);
  }
  return report;
}

if (isMain(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const target = args.positional[0];
  if (!target) {
    console.error("Usage: npm run check-cv -- <application folder> [--workspace <folder>]");
    process.exit(1);
  }
  const { errors, warnings } = checkApplication(path.resolve(target), stringOption(args, "workspace"));
  for (const e of errors) console.log(`ERROR    ${e}`);
  for (const w of warnings) console.log(`WARNING  ${w}`);
  if (errors.length === 0) console.log(`No invented facts found${warnings.length ? `, ${warnings.length} warning(s)` : ""}.`);
  process.exitCode = errors.length > 0 ? 1 : 0;
}
