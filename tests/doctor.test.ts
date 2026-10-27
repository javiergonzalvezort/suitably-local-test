import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { checkAgent, checkHooks, checkNode, checkTool, checkWorkspace, formatReport, isAtLeast, parseVersion } from "../scripts/doctor.ts";
import type { CommandRunner } from "../scripts/doctor.ts";

// A fake command runner: answers from a table instead of running programs.
function fakeRunner(answers: Record<string, string>): CommandRunner {
  return (command) => answers[command] ?? null;
}

test("parses and compares versions", () => {
  assert.deepEqual(parseVersion("v24.15.0"), [24, 15, 0]);
  assert.deepEqual(parseVersion("typst 0.15.1 (abc)"), [0, 15, 1]);
  assert.equal(isAtLeast([22, 18, 0], [22, 18, 0]), true);
  assert.equal(isAtLeast([22, 17, 9], [22, 18, 0]), false);
  assert.equal(isAtLeast([24, 0, 0], [22, 18, 0]), true);
});

test("flags an old Node.js with a fix for the platform", () => {
  assert.equal(checkNode("24.15.0", "win32").status, "ok");
  const old = checkNode("20.11.1", "win32");
  assert.equal(old.status, "fail");
  assert.match(old.fix ?? "", /winget install --id OpenJS\.NodeJS\.LTS/);
  assert.match(checkNode("18.0.0", "darwin").fix ?? "", /brew install node/);
});

test("reports a missing Typst as a failure with an install hint", () => {
  const missing = checkTool(fakeRunner({}), "darwin", "typst", "for PDFs");
  assert.equal(missing.status, "fail");
  assert.match(missing.fix ?? "", /brew install typst/);
  const present = checkTool(fakeRunner({ "typst --version": "typst 0.15.1" }), "darwin", "typst", "for PDFs");
  assert.equal(present.status, "ok");
});

test("accepts any supported coding agent", () => {
  assert.equal(checkAgent(fakeRunner({ "codex --version": "codex 1.0" }), "win32").status, "ok");
  const none = checkAgent(fakeRunner({}), "win32");
  assert.equal(none.status, "fail");
  assert.match(none.fix ?? "", /install\.ps1/);
});

test("warns when the privacy hook is off", () => {
  const off = checkHooks(fakeRunner({ "git rev-parse --is-inside-work-tree": "true" }));
  assert.equal(off.status, "warn");
  const on = checkHooks(fakeRunner({ "git rev-parse --is-inside-work-tree": "true", "git config core.hooksPath": ".githooks" }));
  assert.equal(on.status, "ok");
});

test("tells the user to set up the profile while it still has TODO", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "doctor-"));
  assert.equal(checkWorkspace(path.join(dir, "missing")).status, "warn");
  fs.mkdirSync(path.join(dir, "profile"));
  fs.writeFileSync(path.join(dir, "profile", "about.md"), "<!-- TODO -->");
  assert.match(checkWorkspace(dir).fix ?? "", /Set up my profile/);
  fs.writeFileSync(path.join(dir, "profile", "about.md"), "# About me\nDone.");
  assert.equal(checkWorkspace(dir).status, "ok");
});

test("summary says how many problems block the start", () => {
  const report = formatReport([
    { name: "A", status: "ok", detail: "fine" },
    { name: "B", status: "fail", detail: "missing", fix: "install it" },
  ]);
  assert.match(report, /\[FAIL\] B: missing\n {7}How to fix: install it/);
  assert.match(report, /1 problem\(s\) must be fixed/);
});
