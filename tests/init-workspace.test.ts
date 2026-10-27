import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { initWorkspace } from "../scripts/init-workspace.ts";

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
