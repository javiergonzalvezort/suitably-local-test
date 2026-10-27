import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { checkApplication, checkCv, checkLetter, numbersIn } from "../scripts/check-cv.ts";
import { pdfNames } from "../scripts/render.ts";
import type { CoverLetter, Cv } from "../scripts/lib/types.ts";
import { readJson, REPO_ROOT } from "../scripts/lib/workspace.ts";

const PERSONA = path.join(REPO_ROOT, "examples", "persona");
const APPLICATION = path.join(PERSONA, "applications", "lumen-parcel-analytics-engineer");
const cv = readJson<Cv>(path.join(APPLICATION, "cv.json"));
const letter = readJson<CoverLetter>(path.join(APPLICATION, "cover-letter.json"));

test("finds numbers, without trailing punctuation", () => {
  assert.deepEqual(numbersIn("From 18% to 11%, about 30,000 records in 2023."), ["18%", "11%", "30,000", "2023"]);
});

test("the persona's tailored CV and letter pass the check", () => {
  const report = checkApplication(APPLICATION, PERSONA);
  assert.deepEqual(report, { errors: [], warnings: [] });
});

const profile = "## Data Analyst | Tallerum Logistics | Valencia | 2019-09 to 2022-02\n- Forecast error fell from 18% to 11%.\nAlba Ferrer Soler";

test("flags an invented employer, title, and number", () => {
  const invented: Cv = {
    ...cv,
    experience: [
      { title: "Lead Data Scientist", company: "Tallerum Logistics", start: "2019-09", end: "2022-02", bullets: ["Cut costs by 40%."] },
      { title: "Data Analyst", company: "Megacorp", start: "2019-09", end: "present", bullets: [] },
    ],
    education: [],
    headline: "",
    summary: "",
  };
  const { errors } = checkCv(invented, profile);
  assert.equal(errors.length, 3);
  assert.match(errors.join("\n"), /job title "Lead Data Scientist" is not in the profile/);
  assert.match(errors.join("\n"), /company "Megacorp" is not in the profile/);
  assert.match(errors.join("\n"), /number "40%" is not in the profile/);
});

test("a cover letter may quote numbers from the offer, and clichés are warned", () => {
  const draft: CoverLetter = { ...letter, paragraphs: ["Your 6 cities and my 18% to 11% forecast. I am passionate about data."] };
  const report = checkLetter(draft, profile, "We deliver in 6 cities.");
  assert.deepEqual(report.errors, []);
  assert.match(report.warnings.join("\n"), /passionate about/);
  assert.equal(checkLetter(draft, profile, "").errors.length, 1);
});

test("PDF names are what a recruiter should see", () => {
  assert.deepEqual(pdfNames("Alba Ferrer Soler", "en"), { cv: "Alba Ferrer Soler - CV.pdf", letter: "Alba Ferrer Soler - Cover letter.pdf" });
  assert.equal(pdfNames('A/B:"C"', "es").letter, "ABC - Carta de presentacion.pdf");
});
