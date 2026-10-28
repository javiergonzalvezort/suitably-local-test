import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { initWorkspace } from "../scripts/init-workspace.ts";
import { answersOnly } from "../scripts/lib/workspace.ts";

test("creates the workspace and never overwrites existing files", () => {
  const target = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "ws-")), "me");
  const created = initWorkspace(target);
  assert.ok(created.length >= 5);
  assert.ok(fs.existsSync(path.join(target, "profile", "about.md")));
  assert.ok(fs.existsSync(path.join(target, "offers")));

  fs.writeFileSync(path.join(target, "profile", "about.md"), "my own text");
  assert.deepEqual(initWorkspace(target), []);
  assert.equal(fs.readFileSync(path.join(target, "profile", "about.md"), "utf8"), "my own text");
});

test("the workspace has a documents folder and the questions file", () => {
  const target = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "ws-")), "me");
  initWorkspace(target);
  assert.ok(fs.existsSync(path.join(target, "documents", "README.md")));
  assert.match(fs.readFileSync(path.join(target, "profile", "questions.md"), "utf8"), /Answer:/);
});

test("the profile text keeps answers to the questions but not the question numbers", () => {
  const text = "<!-- 15 questions -->\n## Evidence\n\n12. How much travel is fine?\n    Answer: one week in 4, at most.\n";
  const kept = answersOnly(text);
  assert.doesNotMatch(kept, /12|15/);
  assert.match(kept, /one week in 4/);
});
