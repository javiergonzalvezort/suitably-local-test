import assert from "node:assert/strict";
import { test } from "node:test";
import { blocksAiAgents, crawlDelayMs, isAllowed, parseRobots } from "../scripts/lib/robots.ts";

// Shaped like the real Himalayas robots.txt seen on 2026-10-27 (shortened).
const HIMALAYAS_LIKE = `
User-Agent: *
Allow: /
Disallow: /apply
Disallow: /jobs*&page=
Disallow: /jobs/*?page=
Sitemap: https://example.com/sitemap.xml
`;

test("follows the most specific rule, including wildcards", () => {
  const robots = parseRobots(HIMALAYAS_LIKE);
  assert.equal(isAllowed(robots, "my-tool", "/jobs/api/search?q=data&sort=recent"), true);
  assert.equal(isAllowed(robots, "my-tool", "/jobs/api/search?q=data&sort=recent&page=2"), false);
  assert.equal(isAllowed(robots, "my-tool", "/jobs/api/search?page=2"), false);
  assert.equal(isAllowed(robots, "my-tool", "/apply/123"), false);
});

test("allow wins a tie, and $ anchors the end", () => {
  const robots = parseRobots("User-agent: *\nDisallow: /a\nAllow: /a\nDisallow: /*.pdf$");
  assert.equal(isAllowed(robots, "x", "/a"), true);
  assert.equal(isAllowed(robots, "x", "/file.pdf"), false);
  assert.equal(isAllowed(robots, "x", "/file.pdf?v=1"), true);
});

test("a group for a specific agent replaces the * group", () => {
  const robots = parseRobots("User-agent: *\nAllow: /\n\nUser-agent: my-tool\nDisallow: /");
  assert.equal(isAllowed(robots, "my-tool", "/jobs"), false);
  assert.equal(isAllowed(robots, "other", "/jobs"), true);
});

test("comments and blank lines do not end a group", () => {
  const robots = parseRobots("User-agent: BadBot\nDisallow: /\n\n# note\nDisallow: /x\nUser-agent: *\nCrawl-delay: 1");
  assert.equal(isAllowed(robots, "BadBot", "/anything"), false);
  assert.equal(crawlDelayMs(robots, "my-tool"), 1000);
});

test("detects sites that opt out of AI agents", () => {
  assert.equal(blocksAiAgents(parseRobots("User-agent: *\nAllow: /"), "/jobs"), false);
  assert.equal(blocksAiAgents(parseRobots("User-agent: GPTBot\nUser-agent: ClaudeBot\nDisallow: /"), "/jobs"), true);
  assert.equal(blocksAiAgents(parseRobots("User-agent: Claude-User\nDisallow: /private"), "/jobs"), false);
});
