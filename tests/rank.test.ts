import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { buildShortlist, rankingMarkdown, rankOffers, scoreEvaluation, validateEvaluations } from "../scripts/rank.ts";
import { loadSearchSettings } from "../scripts/lib/settings.ts";
import type { Evaluation, Offer } from "../scripts/lib/types.ts";
import { readJson, REPO_ROOT } from "../scripts/lib/workspace.ts";

const PERSONA = path.join(REPO_ROOT, "examples", "persona");
const offers = readJson<Offer[]>(path.join(PERSONA, "offers", "fetched.json"));
const evaluations = readJson<Evaluation[]>(path.join(PERSONA, "offers", "evaluations.json"));
const search = loadSearchSettings(path.join(PERSONA, "search.json"));
const NOW = new Date("2026-10-27T12:00:00Z");

test("persona shortlist drops the US-only offer and the internship", () => {
  const { entries, dropped } = buildShortlist(offers, search, new Set(), NOW);
  const ids = entries.map((e) => e.id);
  assert.equal(ids.includes("example:5"), false);
  assert.equal(ids.includes("example:8"), false);
  assert.equal(entries.length, 6);
  assert.deepEqual(dropped, { "location not allowed": 1, "excluded word in the title": 1 });
  assert.equal("applyUrl" in entries[0], false);
});

test("shortlist drops expired and old offers, and marks evaluated ones", () => {
  const fresh = { ...offers[0], id: "x:1" };
  const expired = { ...offers[0], id: "x:2", title: "Analytics Engineer II", expiresAt: "2026-10-01T00:00:00Z" };
  const old = { ...offers[0], id: "x:3", title: "Analytics Engineer III", postedAt: "2026-08-01T00:00:00Z" };
  const { entries } = buildShortlist([fresh, expired, old], search, new Set(["x:1"]), NOW);
  assert.deepEqual(entries.map((e) => e.id), ["x:1"]);
  assert.equal(entries[0].alreadyEvaluated, true);
});

test("persona evaluations are valid and rank as intended", () => {
  const checked = validateEvaluations(evaluations);
  assert.deepEqual(checked.errors, []);
  const { ranked } = rankOffers(offers, checked.evaluations);
  const summary = ranked.map((r) => `${r.offer.id}:${r.verdict}`);
  assert.deepEqual(summary.slice(0, 2), ["example:1:apply", "example:2:apply"]);
  for (const id of ["example:3", "example:4", "example:6", "example:7"]) assert.ok(summary.includes(`${id}:skip`));
});

const base: Evaluation = {
  offerId: "t:1",
  eligibility: "pass",
  language: "pass",
  location: "pass",
  seniority: "fit",
  dealBreakers: [],
  requirements: [
    { text: "SQL", kind: "must", match: "yes", evidence: "" },
    { text: "dbt", kind: "must", match: "yes", evidence: "" },
  ],
  strengths: [],
  gaps: [],
  notes: "",
};

test("a perfect match without nice-to-haves scores 90", () => {
  assert.deepEqual(scoreEvaluation(base), { score: 90, verdict: "apply", reasons: [] });
});

test("missing must-haves cap the score", () => {
  const one = scoreEvaluation({ ...base, requirements: [...base.requirements, { text: "Spark", kind: "must", match: "no", evidence: "" }] });
  assert.equal(one.score, 65);
  assert.equal(one.verdict, "maybe");
  const two = scoreEvaluation({
    ...base,
    requirements: [{ text: "Spark", kind: "must", match: "no", evidence: "" }, { text: "Kafka", kind: "must", match: "no", evidence: "" }],
  });
  assert.equal(two.verdict, "skip");
});

test("hard stops always mean skip", () => {
  for (const change of [{ eligibility: "fail" }, { language: "fail" }, { location: "fail" }, { dealBreakers: ["crypto"] }]) {
    const result = scoreEvaluation({ ...base, ...change } as Evaluation);
    assert.equal(result.verdict, "skip");
    assert.ok(result.score <= 10);
  }
});

test("validation explains what is wrong", () => {
  const { errors } = validateEvaluations([{ ...base, language: "maybe", requirements: [{ text: "x", kind: "must", match: "kind of" }] }]);
  assert.equal(errors.length, 2);
  assert.match(errors[0], /"language" must be one of pass, flag, fail/);
  assert.match(errors[1], /requirement 1: "match" must be one of yes, partial, no, unknown/);
});

test("the ranking credits the source with a link", () => {
  const { ranked } = rankOffers(offers, evaluations);
  const markdown = rankingMarkdown(ranked, NOW);
  assert.match(markdown, /\[via Example data \(invented\)\]\(https:\/\/example\.com\/jobs\/1\)/);
});
