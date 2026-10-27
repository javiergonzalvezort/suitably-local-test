import assert from "node:assert/strict";
import { test } from "node:test";
import { findProblems } from "../scripts/precommit.ts";

test("blocks files from the personal workspace", () => {
  const problems = findProblems([{ path: "me/profile/about.md", addedLines: [] }]);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /personal workspace/);
});

test("blocks PDFs and images outside docs/assets", () => {
  assert.equal(findProblems([{ path: "cv.pdf", addedLines: [] }]).length, 1);
  assert.equal(findProblems([{ path: "notes/photo.JPG", addedLines: [] }]).length, 1);
  assert.equal(findProblems([{ path: "docs/assets/demo.png", addedLines: [] }]).length, 0);
});

test("blocks .env files", () => {
  assert.equal(findProblems([{ path: ".env.local", addedLines: [] }]).length, 1);
});

test("blocks real-looking emails and phone numbers outside the fake-data folders", () => {
  const problems = findProblems([
    { path: "docs/notes.md", addedLines: ["Write to someone@gmail.com", "Call +34 612 345 678", "or 600 123 456"] },
  ]);
  assert.equal(problems.length, 3);
});

test("allows example domains, no-reply addresses, dates and versions", () => {
  const problems = findProblems([
    {
      path: "README.md",
      addedLines: ["mail ana@example.com", "Co-Authored-By: x <noreply@anthropic.com>", "Updated 2026-10-27, version 0.15.1"],
    },
  ]);
  assert.deepEqual(problems, []);
});

test("allows fake data inside examples/ and tests/", () => {
  const problems = findProblems([{ path: "examples/persona/profile/about.md", addedLines: ["Phone: +34 600 000 000"] }]);
  assert.deepEqual(problems, []);
});
