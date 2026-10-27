import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { dedupe } from "../scripts/find-offers.ts";
import { PoliteClient, SourceError } from "../scripts/lib/http.ts";
import { himalayasSearchUrl, normaliseHimalayas } from "../scripts/sources/himalayas.ts";
import { normaliseRemoteOk } from "../scripts/sources/remoteok.ts";

// Invented answers in the shape of the real APIs (checked 2026-10-27).
const HIMALAYAS_ANSWER = {
  totalCount: 1,
  jobs: [
    {
      title: "Analytics Engineer",
      companyName: "Fictional Co",
      description: "<p>Build dbt models. Write to hiring@fictional.test</p>",
      employmentType: "Full Time",
      seniority: ["Mid-level"],
      minSalary: 50000,
      maxSalary: 60000,
      currency: "EUR",
      salaryPeriod: "annual",
      locationRestrictions: ["Spain", "Portugal"],
      categories: ["Analytics-Engineer"],
      pubDate: 1793116526,
      expiryDate: 1798300525,
      applicationLink: "https://himalayas.app/companies/fictional-co/jobs/analytics-engineer?utm_source=api",
      guid: "https://himalayas.app/companies/fictional-co/jobs/analytics-engineer",
    },
  ],
};

const REMOTEOK_ANSWER = [
  { last_updated: 1793001612, legal: "API Terms of Service: please link back..." },
  {
    id: "123",
    position: "Data Analyst ",
    company: "Invented Ltd",
    description: "<p>SQL and Looker. Call +44 20 7946 0000</p>",
    tags: ["sql", "looker"],
    location: "Europe",
    salary_min: 0,
    salary_max: 0,
    date: "2026-10-26T08:00:12+00:00",
    url: "https://remoteOK.com/remote-jobs/123",
    apply_url: "https://remoteOK.com/remote-jobs/123",
  },
];

test("Himalayas: keeps the application link unchanged and removes contacts", () => {
  const [offer] = normaliseHimalayas(HIMALAYAS_ANSWER, false);
  assert.equal(offer.id, "himalayas:companies/fictional-co/jobs/analytics-engineer");
  assert.equal(offer.applyUrl, HIMALAYAS_ANSWER.jobs[0].applicationLink);
  assert.equal(offer.sourceName, "Himalayas");
  assert.deepEqual(offer.locations, ["Spain", "Portugal"]);
  assert.equal(offer.salary, "50,000 to 60,000 EUR (annual)");
  assert.match(offer.description, /\[email removed\]/);
  assert.ok(offer.expiresAt);
});

test("Himalayas: never keeps text when the site opts out of AI agents", () => {
  const [offer] = normaliseHimalayas(HIMALAYAS_ANSWER, true);
  assert.equal(offer.description, "");
  assert.equal(offer.aiBlocked, true);
});

test("Himalayas: search URL has no page parameter (robots.txt)", () => {
  assert.equal(himalayasSearchUrl("data analyst"), "https://himalayas.app/jobs/api/search?q=data%20analyst&sort=recent");
});

test("Remote OK: skips the legal notice and keeps the attribution link", () => {
  const offers = normaliseRemoteOk(REMOTEOK_ANSWER, false);
  assert.equal(offers.length, 1);
  assert.equal(offers[0].title, "Data Analyst");
  assert.equal(offers[0].url, "https://remoteOK.com/remote-jobs/123");
  assert.equal(offers[0].sourceName, "Remote OK");
  assert.equal(offers[0].salary, undefined);
  assert.match(offers[0].description, /\[phone removed\]/);
});

test("dedupe drops the same company and title from a second source", () => {
  const [a] = normaliseHimalayas(HIMALAYAS_ANSWER, false);
  const b = { ...a, id: "remoteok:9", source: "remoteok" as const, company: "fictional co" };
  assert.equal(dedupe([a, b, a]).length, 1);
});

// A fake network: records the URLs asked for and answers from a table.
function fakeNetwork(answers: Record<string, { status: number; body: string }>) {
  const calls: string[] = [];
  const fetchFn = async (url: string) => {
    calls.push(url);
    const answer = answers[url] ?? { status: 404, body: "" };
    return new Response(answer.status === 429 || answer.status >= 500 ? null : answer.body, { status: answer.status });
  };
  return { calls, fetchFn };
}

function clientWith(fetchFn: (url: string) => Promise<Response>, waits: number[] = []) {
  let clock = 1_000_000;
  const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "http-"));
  return new PoliteClient({
    cacheDir,
    fetchFn,
    now: () => clock,
    sleep: async (ms) => {
      waits.push(ms);
      clock += ms;
    },
  });
}

const LIMITS = { minDelayMs: 2000, dailyRequestCap: 2, cacheHours: 6 };

test("client waits between requests, honours Crawl-delay, and caches answers", async () => {
  const net = fakeNetwork({
    "https://jobs.test/robots.txt": { status: 200, body: "User-agent: *\nCrawl-delay: 3" },
    "https://jobs.test/api?q=a": { status: 200, body: "[1]" },
  });
  const waits: number[] = [];
  const client = clientWith(net.fetchFn, waits);
  const first = await client.getJson("demo", "https://jobs.test/api?q=a", LIMITS);
  assert.deepEqual(first.data, [1]);
  assert.deepEqual(waits, [3000]); // robots.txt first, then the API call after the 3 s Crawl-delay
  const second = await client.getJson("demo", "https://jobs.test/api?q=a", LIMITS);
  assert.equal(second.fromCache, true);
  assert.equal(net.calls.length, 2);
});

test("client refuses paths disallowed by robots.txt", async () => {
  const net = fakeNetwork({ "https://jobs.test/robots.txt": { status: 200, body: "User-agent: *\nDisallow: /api" } });
  await assert.rejects(clientWith(net.fetchFn).getJson("demo", "https://jobs.test/api?q=a", LIMITS), SourceError);
  assert.deepEqual(net.calls, ["https://jobs.test/robots.txt"]);
});

test("client stops at the daily cap and on HTTP 429", async () => {
  const net = fakeNetwork({
    "https://jobs.test/a": { status: 200, body: "{}" },
    "https://jobs.test/b": { status: 200, body: "{}" },
    "https://jobs.test/c": { status: 200, body: "{}" },
    "https://slow.test/a": { status: 429, body: "" },
  });
  const client = clientWith(net.fetchFn);
  await client.getJson("demo", "https://jobs.test/a", LIMITS);
  await client.getJson("demo", "https://jobs.test/b", LIMITS);
  await assert.rejects(client.getJson("demo", "https://jobs.test/c", LIMITS), /daily limit/);
  await assert.rejects(client.getJson("other", "https://slow.test/a", LIMITS), /HTTP 429/);
});

test("a server error on robots.txt means: do not crawl", async () => {
  const net = fakeNetwork({ "https://down.test/robots.txt": { status: 503, body: "" } });
  await assert.rejects(clientWith(net.fetchFn).getJson("demo", "https://down.test/api", LIMITS), /robots\.txt/);
});
