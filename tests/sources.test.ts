import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { dedupe } from "../scripts/find-offers.ts";
import { PoliteClient, SourceError } from "../scripts/lib/http.ts";
import { cardsWorthOpening, linkedinOffer, linkedinSearchUrls, parseJobCards, parseJobDetail } from "../scripts/sources/linkedin.ts";
import { DEFAULT_SEARCH } from "../scripts/lib/settings.ts";
import type { Offer } from "../scripts/lib/types.ts";

const OFFER: Offer = {
  id: "infojobs:abc",
  source: "infojobs",
  sourceName: "InfoJobs",
  title: "Analytics Engineer",
  company: "Fictional Co",
  url: "https://www.infojobs.net/madrid/analytics-engineer/of-iabc",
  applyUrl: "https://www.infojobs.net/madrid/analytics-engineer/of-iabc",
  locations: ["Madrid, Spain"],
  tags: [],
  postedAt: "2026-11-14T09:00:00.000Z",
  description: "Build dbt models.",
  aiBlocked: false,
};

test("dedupe drops the same company and title from a second source", () => {
  const b = { ...OFFER, id: "indeed:9", source: "indeed" as const, company: "fictional co" };
  assert.equal(dedupe([OFFER, b, OFFER]).length, 1);
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

test("a source configured with honourRobots: false is fetched without reading robots.txt", async () => {
  const net = fakeNetwork({ "https://jobs.test/page": { status: 200, body: "<li>job</li>" } });
  const result = await clientWith(net.fetchFn).getText("demo", "https://jobs.test/page", { ...LIMITS, honourRobots: false });
  assert.equal(result.data, "<li>job</li>");
  assert.equal(result.aiBlocked, false);
  assert.deepEqual(net.calls, ["https://jobs.test/page"]);
});

// Invented markup in the shape of LinkedIn's public job pages (checked 2026-10-28).
const LINKEDIN_SEARCH = `
<li><div class="base-card" data-entity-urn="urn:li:jobPosting:4000000001">
  <a class="base-card__full-link" href="https://es.linkedin.com/jobs/view/data-analyst-at-fictional-co-4000000001?trk=x"></a>
  <h3 class="base-search-card__title">
    Data Analyst
  </h3>
  <h4 class="base-search-card__subtitle"><a href="https://es.linkedin.com/company/fictional-co">Fictional Co</a></h4>
  <span class="job-search-card__location">
    Barcelona, Catalonia, Spain
  </span>
  <time class="job-search-card__listdate" datetime="2026-10-25">3 days ago</time>
</div></li>
<li><div class="base-card" data-entity-urn="urn:li:jobPosting:4000000002">
  <h3 class="base-search-card__title">Sales Intern</h3>
  <h4 class="base-search-card__subtitle">Invented SL</h4>
</div></li>`;

const LINKEDIN_DETAIL = `
<h2 class="top-card-layout__title topcard__title">Data Analyst</h2>
<div class="description__text description__text--rich">
  <div class="show-more-less-html__markup">
    <p>SQL &amp; Looker every day.</p><ul><li>Write to jobs@fictional.test</li></ul>
  </div>
</div>
<ul class="description__job-criteria-list">
  <li><h3 class="description__job-criteria-subheader">Seniority level</h3>
      <span class="description__job-criteria-text description__job-criteria-text--criteria">Mid-Senior level</span></li>
  <li><h3 class="description__job-criteria-subheader">Employment type</h3>
      <span class="description__job-criteria-text description__job-criteria-text--criteria">Full-time</span></li>
</ul>`;

test("LinkedIn: search URLs per query and place, within the age limit", () => {
  const search = { ...DEFAULT_SEARCH, queries: ["data analyst", "bi"], searchLocations: ["Spain"], workplace: "remote", maxAgeDays: 7 };
  const urls = linkedinSearchUrls(search, 1);
  assert.equal(urls.length, 1);
  assert.equal(
    urls[0],
    "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=data+analyst&location=Spain&f_TPR=r604800&f_WT=2&start=0",
  );
});

test("LinkedIn: parses cards, opens only titles that match, and removes contacts", () => {
  const cards = parseJobCards(LINKEDIN_SEARCH);
  assert.equal(cards.length, 2);
  assert.deepEqual(cards[0], {
    id: "4000000001",
    title: "Data Analyst",
    company: "Fictional Co",
    location: "Barcelona, Catalonia, Spain",
    date: "2026-10-25",
    url: "https://www.linkedin.com/jobs/view/4000000001",
  });
  const search = { ...DEFAULT_SEARCH, titleKeywords: ["data"], excludeKeywords: ["intern"] };
  assert.deepEqual(cardsWorthOpening([...cards, cards[0]], search, 15).map((c) => c.id), ["4000000001"]);

  const offer = linkedinOffer(cards[0], parseJobDetail(LINKEDIN_DETAIL));
  assert.equal(offer.id, "linkedin:4000000001");
  assert.equal(offer.sourceName, "LinkedIn");
  assert.equal(offer.seniority, "Mid-Senior level");
  assert.equal(offer.employmentType, "Full-time");
  assert.match(offer.description, /SQL & Looker every day\./);
  assert.match(offer.description, /\[email removed\]/);
  assert.deepEqual(offer.locations, ["Barcelona, Catalonia, Spain"]);
});
