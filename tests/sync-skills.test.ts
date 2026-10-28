import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { skillDifferences, syncSkills } from "../scripts/sync-skills.ts";

test("the committed copy in .claude/skills matches .agents/skills", () => {
  assert.deepEqual(skillDifferences(), [], "Run: npm run sync-skills");
});

test("every skill has a name and a description that match its folder", () => {
  const root = path.join(import.meta.dirname, "..", ".agents", "skills");
  const names = fs.readdirSync(root);
  assert.ok(names.length >= 4);
  for (const name of names) {
    const text = fs.readFileSync(path.join(root, name, "SKILL.md"), "utf8");
    assert.match(text, new RegExp(`^---\\nname: ${name}\\ndescription: .{20,}\\n---\\n`), name);
  }
});

test("sync copies new files, updates changed ones, and removes extra ones", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "skills-"));
  const source = path.join(dir, "source");
  const copy = path.join(dir, "copy");
  fs.mkdirSync(path.join(source, "rank"), { recursive: true });
  fs.writeFileSync(path.join(source, "rank", "SKILL.md"), "new");
  fs.mkdirSync(path.join(copy, "old"), { recursive: true });
  fs.writeFileSync(path.join(copy, "old", "SKILL.md"), "stale");

  assert.deepEqual(skillDifferences(source, copy), ["rank/SKILL.md: missing in the copy", "old/SKILL.md: only in the copy"]);
  syncSkills(source, copy);
  assert.deepEqual(skillDifferences(source, copy), []);
  assert.equal(fs.existsSync(path.join(copy, "old")), false);
});
