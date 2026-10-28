import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { dedupe } from "../scripts/find-offers.ts";
import { PoliteClient, SourceError } from "../scripts/lib/http.ts";
import { himalayasSearchUrl, normaliseHimalayas } from "../scripts/sources/himalayas.ts";
import { normaliseRemoteOk } from "../scripts/sources/remoteok.ts";
import { normaliseArbeitnow } from "../scripts/sources/arbeitnow.ts";
import { cardsWorthOpening, linkedinOffer, linkedinSearchUrls, parseJobCards, parseJobDetail } from "../scripts/sources/linkedin.ts";
import { DEFAULT_SEARCH } from "../scripts/lib/settings.ts";

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

test("Arbeitnow: remote jobs have no location limit, on-site jobs keep their city", () => {
  const answer = {
    data: [
      { slug: "data-analyst-1", company_name: "Fictional GmbH", title: "Data Analyst", description: "<p>SQL</p>", remote: true, url: "https://www.arbeitnow.com/jobs/companies/fictional/data-analyst-1", tags: ["Data"], job_types: ["Full-time"], location: "Berlin", created_at: 1793175612 },
      { slug: "bi-dev-2", company_name: "Invented AG", title: "BI Developer", description: "", remote: false, url: "https://www.arbeitnow.com/jobs/companies/invented/bi-dev-2", tags: [], job_types: [], location: "Munich", created_at: 1793175612 },
      { title: "No slug" },
    ],
  };
  const [remote, onsite, ...others] = normaliseArbeitnow(answer, false);
  assert.equal(others.length, 0);
  assert.equal(remote.id, "arbeitnow:data-analyst-1");
  assert.deepEqual(remote.locations, []);
  assert.ok(remote.tags.includes("Remote"));
  assert.deepEqual(onsite.locations, ["Munich"]);
  assert.equal(onsite.sourceName, "Arbeitnow");
});
