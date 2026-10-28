// Ranking in two deterministic steps around the agent's judgment:
//
//   npm run shortlist  -> offers/shortlist.json and shortlist.md (filters offers before the agent reads them)
//   (the agent writes offers/evaluations.json, following .agents/skills/rank/SKILL.md)
//   npm run score      -> offers/ranking.md       (turns the evaluations into a score)
//
// Options: --workspace <folder>, --now <ISO date> (fixed "today", for demos and tests)

import fs from "node:fs";
import path from "node:path";
import { parseArgs, stringOption } from "./lib/args.ts";
import { isMain } from "./lib/main.ts";
import { loadSearchSettings } from "./lib/settings.ts";
import type { SearchSettings } from "./lib/settings.ts";
import { containsWords, normalise, truncate } from "./lib/text.ts";
import type { Evaluation, Match, Offer, ScoredOffer, Verdict } from "./lib/types.ts";
import { readJson, REPO_ROOT, workspacePaths, writeJson } from "./lib/workspace.ts";

const DAY_MS = 86_400_000;
const MAX_DESCRIPTION_CHARS = 6000;

// ---------- Step 1: shortlist ----------

export type ShortlistEntry = Omit<Offer, "description" | "applyUrl"> & {
  description: string;
  keywordHits: number;
  alreadyEvaluated: boolean;
};

export type ShortlistResult = {
  entries: ShortlistEntry[];
  dropped: Record<string, number>; // reason -> how many offers
};

function locationAllowed(offer: Offer, allowed: string[]): boolean {
  if (allowed.length === 0 || offer.locations.length === 0) return true;
  return offer.locations.some((place) =>
    allowed.some((ok) => normalise(place).includes(normalise(ok)) || normalise(ok).includes(normalise(place))),
  );
}

export function buildShortlist(
  offers: Offer[],
  search: SearchSettings,
  evaluatedIds: Set<string>,
  now: Date,
): ShortlistResult {
  const dropped: Record<string, number> = {};
  const drop = (reason: string) => {
    dropped[reason] = (dropped[reason] ?? 0) + 1;
  };
  const kept: ShortlistEntry[] = [];
  for (const offer of offers) {
    if (offer.expiresAt && new Date(offer.expiresAt) < now) {
      drop("expired");
      continue;
    }
    if (now.getTime() - new Date(offer.postedAt).getTime() > search.maxAgeDays * DAY_MS) {
      drop(`older than ${search.maxAgeDays} days`);
      continue;
    }
    if (search.excludeKeywords.some((word) => containsWords(offer.title, word))) {
      drop("excluded word in the title");
      continue;
    }
    const searchable = [offer.title, ...offer.tags].join(" | ");
    const keywordHits = search.titleKeywords.filter((word) => containsWords(searchable, word)).length;
    if (search.titleKeywords.length > 0 && keywordHits === 0) {
      drop("no title keyword");
      continue;
    }
    if (!locationAllowed(offer, search.allowedLocations)) {
      drop("location not allowed");
      continue;
    }
    const { applyUrl: _applyUrl, ...rest } = offer;
    kept.push({
      ...rest,
      description: offer.aiBlocked
        ? "(text withheld: this site opts out of AI agents; open the link to read it)"
        : truncate(offer.description, MAX_DESCRIPTION_CHARS),
      keywordHits,
      alreadyEvaluated: evaluatedIds.has(offer.id),
    });
  }
  // Most keyword hits first, then newest first.
  kept.sort((a, b) => b.keywordHits - a.keywordHits || b.postedAt.localeCompare(a.postedAt));
  const entries = kept.slice(0, search.shortlistSize);
  if (kept.length > entries.length) dropped[`beyond the shortlist size (${search.shortlistSize})`] = kept.length - entries.length;
  return { entries, dropped };
}

// ---------- Step 2: validate the agent's evaluations ----------

const MATCHES: Match[] = ["yes", "partial", "no", "unknown"];

function oneOf(errors: string[], where: string, field: string, value: unknown, allowed: readonly string[]) {
  if (!allowed.includes(value as string)) errors.push(`${where}: "${field}" must be one of ${allowed.join(", ")} (found ${JSON.stringify(value)})`);
}

// Checks the file the agent wrote, with messages the agent can act on.
export function validateEvaluations(raw: unknown): { evaluations: Evaluation[]; errors: string[] } {
  const errors: string[] = [];
  if (!Array.isArray(raw)) return { evaluations: [], errors: ["evaluations.json must be a JSON array"] };
  raw.forEach((item: Record<string, unknown>, index) => {
    const where = `item ${index + 1} (${String(item?.offerId ?? "no offerId")})`;
    if (typeof item?.offerId !== "string") errors.push(`${where}: "offerId" is missing`);
    oneOf(errors, where, "eligibility", item?.eligibility, ["pass", "fail", "unverified"]);
    oneOf(errors, where, "language", item?.language, ["pass", "flag", "fail"]);
    oneOf(errors, where, "location", item?.location, ["pass", "fail", "unknown"]);
    oneOf(errors, where, "seniority", item?.seniority, ["below", "fit", "above", "unknown"]);
    for (const list of ["dealBreakers", "strengths", "gaps"]) {
      if (!Array.isArray(item?.[list])) errors.push(`${where}: "${list}" must be a list (use [] if empty)`);
    }
    const requirements = item?.requirements;
    if (!Array.isArray(requirements) || requirements.length === 0) {
      errors.push(`${where}: "requirements" must list the offer's requirements`);
    } else {
      requirements.forEach((req: Record<string, unknown>, r) => {
        oneOf(errors, `${where} requirement ${r + 1}`, "kind", req?.kind, ["must", "nice"]);
        oneOf(errors, `${where} requirement ${r + 1}`, "match", req?.match, MATCHES);
      });
    }
  });
  return { evaluations: errors.length === 0 ? (raw as Evaluation[]) : [], errors };
}

// ---------- Step 3: score ----------
//
// The formula, in plain words (also in docs/ranking.md):
//   requirement value: yes = 1, partial = 0.5, unknown = 0.25, no = 0
//   must  = average value of the must-have requirements (0.5 if there are none)
//   nice  = average value of the nice-to-have requirements (0.5 if there are none)
//   level = seniority fit 1, unknown 0.6, below 0.5, above 0.3
//   score = 65 x must + 20 x nice + 15 x level            (0 to 100)
// Then caps: one missing must-have caps the score at 65, two or more at 45.
// Hard stops cap it at 10 and the verdict is "skip": failed eligibility,
// failed language gate, location not possible, or any deal-breaker.
// Verdict: 70 or more "apply", 50 to 69 "maybe", below 50 "skip".

const MATCH_VALUE: Record<Match, number> = { yes: 1, partial: 0.5, unknown: 0.25, no: 0 };
const LEVEL_VALUE = { fit: 1, unknown: 0.6, below: 0.5, above: 0.3 };

function average(values: number[], fallback: number): number {
  return values.length === 0 ? fallback : values.reduce((a, b) => a + b, 0) / values.length;
}

export function scoreEvaluation(evaluation: Evaluation): { score: number; verdict: Verdict; reasons: string[] } {
  const reasons: string[] = [];
  const musts = evaluation.requirements.filter((r) => r.kind === "must");
  const nices = evaluation.requirements.filter((r) => r.kind === "nice");
  const must = average(musts.map((r) => MATCH_VALUE[r.match]), 0.5);
  const nice = average(nices.map((r) => MATCH_VALUE[r.match]), 0.5);
  let score = 65 * must + 20 * nice + 15 * LEVEL_VALUE[evaluation.seniority];

  const missing = musts.filter((r) => r.match === "no");
  if (missing.length >= 2) {
    score = Math.min(score, 45);
    reasons.push(`${missing.length} must-haves missing`);
  } else if (missing.length === 1) {
    score = Math.min(score, 65);
    reasons.push(`must-have missing: ${missing[0].text}`);
  }
  if (evaluation.seniority === "above") reasons.push("the role is more senior than your experience");
  if (evaluation.language === "flag") reasons.push("the language level asked may be above yours");
  if (evaluation.eligibility === "unverified") reasons.push("work eligibility not stated: check before applying");

  const hardStops: string[] = [];
  if (evaluation.eligibility === "fail") hardStops.push("not eligible to work there");
  if (evaluation.language === "fail") hardStops.push("required language not in your profile at that level");
  if (evaluation.location === "fail") hardStops.push("location not possible for you");
  for (const item of evaluation.dealBreakers) hardStops.push(`deal-breaker: ${item}`);
  if (hardStops.length > 0) {
    score = Math.min(score, 10);
    reasons.unshift(...hardStops);
  }

  const rounded = Math.round(score);
  const verdict: Verdict = hardStops.length > 0 ? "skip" : rounded >= 70 ? "apply" : rounded >= 50 ? "maybe" : "skip";
  return { score: rounded, verdict, reasons };
}

export function rankOffers(offers: Offer[], evaluations: Evaluation[]): { ranked: ScoredOffer[]; unknownIds: string[] } {
  const byId = new Map(offers.map((o) => [o.id, o]));
  const ranked: ScoredOffer[] = [];
  const unknownIds: string[] = [];
  for (const evaluation of evaluations) {
    const offer = byId.get(evaluation.offerId);
    if (!offer) {
      unknownIds.push(evaluation.offerId);
      continue;
    }
    ranked.push({ offer, evaluation, ...scoreEvaluation(evaluation) });
  }
  ranked.sort((a, b) => b.score - a.score);
  return { ranked, unknownIds };
}

const VERDICT_LABEL: Record<Verdict, string> = { apply: "Apply", maybe: "Maybe", skip: "Skip" };

function cell(text: string): string {
  return text.replace(/\|/g, "/").replace(/\n/g, " ");
}

const BEST_MATCHES = 10;
const CLOSING_SOON_DAYS = 7;

function sourceLink(offer: Pick<Offer, "sourceName" | "url">): string {
  return `[via ${offer.sourceName}](${offer.url})`;
}

function dateOnly(iso: string | undefined): string {
  return iso ? iso.slice(0, 10) : "";
}

// The one-line reason an offer is not among the best matches.
function whyLower(item: ScoredOffer): string {
  return item.reasons[0] ?? item.evaluation.gaps[0] ?? item.evaluation.notes;
}

// Three views of the same list: the best matches, the ones closing soon, and the
// rest with the reason each scored lower. Then the details of every offer.
export function rankingMarkdown(ranked: ScoredOffer[], generatedAt: Date): string {
  const position = new Map(ranked.map((item, i) => [item.offer.id, i + 1]));
  const best = ranked.filter((item) => item.verdict !== "skip").slice(0, BEST_MATCHES);
  const bestIds = new Set(best.map((item) => item.offer.id));
  const soonLimit = generatedAt.getTime() + CLOSING_SOON_DAYS * DAY_MS;
  // Offers outside the best matches that close soon: a last chance to look at them.
  const closingSoon = ranked
    .filter((item) => !bestIds.has(item.offer.id) && item.offer.expiresAt)
    .filter((item) => {
      const closes = new Date(item.offer.expiresAt as string).getTime();
      return closes >= generatedAt.getTime() && closes <= soonLimit;
    })
    .sort((a, b) => (a.offer.expiresAt as string).localeCompare(b.offer.expiresAt as string));
  const rest = ranked.filter((item) => !bestIds.has(item.offer.id));

  const lines = [
    "# Ranking",
    "",
    `Generated ${dateOnly(generatedAt.toISOString())} by \`npm run score\`. Scores come from the evaluations; see docs/ranking.md for the formula. The numbers (#) are the same in every section.`,
    "",
    "## Best matches",
    "",
  ];
  if (best.length === 0) {
    lines.push("No offer passed the gates this time. The section below says why each one scored low.", "");
  } else {
    lines.push("| # | Score | Verdict | Role | Company | Closes | Source | Offer id |", "|---|---|---|---|---|---|---|---|");
    for (const item of best) {
      const { offer } = item;
      lines.push(
        `| ${position.get(offer.id)} | ${item.score} | ${VERDICT_LABEL[item.verdict]} | ${cell(offer.title)} | ${cell(offer.company)} | ${dateOnly(offer.expiresAt)} | ${sourceLink(offer)} | \`${offer.id}\` |`,
      );
    }
    lines.push("");
  }

  lines.push(
    "## Closing soon",
    "",
    `Offers outside the best matches that close in the next ${CLOSING_SOON_DAYS} days. Only some sources give a closing date.`,
    "",
  );
  if (closingSoon.length === 0) lines.push("None.", "");
  for (const item of closingSoon) {
    // Whole calendar days, so "today" counts as 0 whatever the hour.
    const days = Math.round((Date.parse(dateOnly(item.offer.expiresAt)) - Date.parse(dateOnly(generatedAt.toISOString()))) / DAY_MS);
    lines.push(
      `- #${position.get(item.offer.id)} ${item.offer.title}, ${item.offer.company}: closes ${dateOnly(item.offer.expiresAt)} (${days} days), score ${item.score} (${VERDICT_LABEL[item.verdict]}): ${whyLower(item)}. ${sourceLink(item.offer)}`,
    );
  }
  if (closingSoon.length > 0) lines.push("");

  lines.push("## The rest, and why they scored lower", "");
  if (rest.length === 0) lines.push("Nothing else was evaluated.", "");
  for (const item of rest) {
    lines.push(`- #${position.get(item.offer.id)} ${item.offer.title}, ${item.offer.company} (${item.score}, ${VERDICT_LABEL[item.verdict]}): ${whyLower(item)}. ${sourceLink(item.offer)}`);
  }
  if (rest.length > 0) lines.push("");

  lines.push("## Details", "");
  ranked.forEach((item, i) => {
    const { offer, evaluation } = item;
    lines.push(`### ${i + 1}. ${offer.title}, ${offer.company} (${item.score}, ${VERDICT_LABEL[item.verdict]})`, "");
    lines.push(`- Offer: [${offer.url}](${offer.url}) (via ${offer.sourceName})`);
    lines.push(`- Apply at: ${offer.applyUrl}`);
    if (offer.salary) lines.push(`- Salary: ${offer.salary}`);
    if (offer.expiresAt) lines.push(`- Closes: ${dateOnly(offer.expiresAt)}`);
    if (item.reasons.length > 0) lines.push(`- Watch out: ${item.reasons.join("; ")}`);
    if (evaluation.strengths.length > 0) lines.push(`- Strengths: ${evaluation.strengths.join("; ")}`);
    if (evaluation.gaps.length > 0) lines.push(`- Gaps: ${evaluation.gaps.join("; ")}`);
    if (evaluation.notes) lines.push(`- Notes: ${evaluation.notes}`);
    lines.push("");
  });
  return lines.join("\n");
}

// A readable copy of the shortlist, for the user. The agent adds a one-line
// summary of each offer when it shows the list.
export function shortlistMarkdown(entries: ShortlistEntry[], generatedAt: Date): string {
  const lines = [
    "# Shortlist",
    "",
    `Generated ${dateOnly(generatedAt.toISOString())} by \`npm run shortlist\`: offers that passed your search filters, before ranking.`,
    "",
    "| # | Role | Company | Location | Salary | Posted | Closes | Source |",
    "|---|---|---|---|---|---|---|---|",
  ];
  entries.forEach((entry, i) => {
    const where = entry.locations.length > 0 ? entry.locations.join(", ") : "not stated";
    lines.push(
      `| ${i + 1} | ${cell(entry.title)} | ${cell(entry.company)} | ${cell(where)} | ${cell(entry.salary ?? "")} | ${dateOnly(entry.postedAt)} | ${dateOnly(entry.expiresAt)} | ${sourceLink(entry)} |`,
    );
  });
  return lines.join("\n") + "\n";
}

// ---------- Command line ----------

function loadOffers(fetched: string, pasted: string): Offer[] {
  const offers: Offer[] = fs.existsSync(fetched) ? readJson<Offer[]>(fetched) : [];
  if (fs.existsSync(pasted)) {
    const known = new Set(offers.map((o) => o.id));
    for (const offer of readJson<Offer[]>(pasted)) if (!known.has(offer.id)) offers.push(offer);
  }
  return offers;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args.positional[0];
  const paths = workspacePaths(stringOption(args, "workspace"));
  const nowOption = stringOption(args, "now");
  const now = nowOption ? new Date(nowOption) : new Date();
  const rel = (file: string) => path.relative(REPO_ROOT, file);
  const offers = loadOffers(paths.fetched, paths.pasted);

  if (command === "shortlist") {
    if (offers.length === 0) {
      console.error(`No offers yet. Run "npm run find-offers" first.`);
      process.exit(1);
    }
    const evaluated = fs.existsSync(paths.evaluations)
      ? new Set(readJson<Evaluation[]>(paths.evaluations).map((e) => e.offerId))
      : new Set<string>();
    const { entries, dropped } = buildShortlist(offers, loadSearchSettings(paths.search), evaluated, now);
    writeJson(paths.shortlist, entries);
    fs.writeFileSync(paths.shortlistMarkdown, shortlistMarkdown(entries, now), "utf8");
    const toDo = entries.filter((e) => !e.alreadyEvaluated).length;
    console.log(`${offers.length} offers, ${entries.length} shortlisted (${toDo} not evaluated yet).`);
    for (const [reason, count] of Object.entries(dropped)) console.log(`  dropped ${count}: ${reason}`);
    console.log(`Saved ${rel(paths.shortlist)} (readable copy: ${rel(paths.shortlistMarkdown)}). The agent now evaluates the new ones into ${rel(paths.evaluations)}.`);
    return;
  }

  if (command === "score") {
    if (!fs.existsSync(paths.evaluations)) {
      console.error(`No evaluations yet (${rel(paths.evaluations)}). Ask your agent to rank the offers.`);
      process.exit(1);
    }
    const { evaluations, errors } = validateEvaluations(readJson<unknown>(paths.evaluations));
    if (errors.length > 0) {
      console.error(`${rel(paths.evaluations)} has problems:\n  - ${errors.join("\n  - ")}`);
      process.exit(1);
    }
    const { ranked, unknownIds } = rankOffers(offers, evaluations);
    fs.writeFileSync(paths.ranking, rankingMarkdown(ranked, now), "utf8");
    if (unknownIds.length > 0) console.warn(`Ignored evaluations for offers no longer in the list: ${unknownIds.join(", ")}`);
    for (const [i, item] of ranked.slice(0, 10).entries()) {
      console.log(`${String(i + 1).padStart(2)}. ${String(item.score).padStart(3)}  ${VERDICT_LABEL[item.verdict].padEnd(5)}  ${item.offer.title}, ${item.offer.company}  [${item.offer.id}]`);
    }
    console.log(`\nFull ranking with reasons: ${rel(paths.ranking)}`);
    return;
  }

  console.error("Usage: node scripts/rank.ts shortlist|score [--workspace <folder>] [--now <date>]");
  process.exit(1);
}

if (isMain(import.meta.url)) {
  main();
}
