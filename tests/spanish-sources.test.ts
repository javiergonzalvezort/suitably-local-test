import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { APP_NAME } from "../scripts/lib/app.ts";
import { PoliteClient, SourceError } from "../scripts/lib/http.ts";
import { jsonFromStringLiteral, jsonObjectAfter } from "../scripts/lib/embedded.ts";
import { isAllowed, parseRobots } from "../scripts/lib/robots.ts";
import { activeSources, DEFAULT_SEARCH } from "../scripts/lib/settings.ts";
import type { SourceConfig } from "../scripts/lib/settings.ts";
import { buildShortlist } from "../scripts/rank.ts";
import { indeedPlace, indeedSearchUrls, normaliseIndeed, parseIndeedPage } from "../scripts/sources/indeed.ts";
import { infojobsProvince, infojobsSearchUrls, normaliseInfojobs, parseInfojobsPage } from "../scripts/sources/infojobs.ts";

// Invented pages in the shape of the real ones (checked 2026-11-15).
const INFOJOBS_PROPS = {
  user: null,
  offers: [
    {
      code: "4ec868ae6d42e584edbd1372e9ad49",
      title: "Fisioterapeuta ",
      description: "Clínica en Madrid busca fisioterapeuta.\nEnvía tu CV a rrhh@clinica.test o llama al 600 123 456.",
      city: "Madrid",
      link: "//www.infojobs.net/madrid/fisioterapeuta/of-i4ec868ae6d42e584edbd1372e9ad49?applicationOrigin=search-new&page=1",
      contractType: "Contrato indefinido",
      workday: "Jornada completa",
      teleworking: "Presencial",
      publishedAt: "2026-11-14T09:00:00Z",
      companyName: "Clínica Ficticia",
    },
    {
      code: "aaaa",
      title: "Administrativo/a",
      description: "Gestión de citas. It's a \"remote\" job.",
      link: "//www.infojobs.net/x/of-iaaaa",
      teleworking: "Solo teletrabajo",
      publishedAt: "2026-11-13T09:00:00Z",
    },
    { title: "No code" },
  ],
};
const INFOJOBS_PAGE = `<html><script>window.__INITIAL_PROPS__ = JSON.parse(${JSON.stringify(JSON.stringify(INFOJOBS_PROPS))});</script></html>`;

const INDEED_DATA = {
  metaData: {
    mosaicProviderJobCardsModel: {
      results: [
        {
          jobkey: "0fd61c5717bd225c",
          displayTitle: "Auxiliar de clínica dental",
          company: "Dental Inventada",
          formattedLocation: "28070 Madrid, Madrid provincia",
          snippet: "<ul><li>Atención al paciente &amp; agenda.</li><li>Contacto: hola@dental.test</li></ul>",
          salarySnippet: { text: "1.400 € - 1.600 € al mes" },
          pubDate: 1794650400000,
          jobTypes: ["Indefinido"],
          remoteLocation: false,
        },
        { jobkey: "old", displayTitle: "Expired", company: "X", expired: true },
        { jobkey: "nocompany", displayTitle: "No company" },
      ],
    },
  },
};
const INDEED_PAGE = `<script>window.mosaic.providerData["mosaic-provider-jobcards"]=${JSON.stringify(INDEED_DATA)};\nwindow.other={};</script>`;

test("embedded JSON: reads a JSON.parse string and an object, and returns null without the marker", () => {
  assert.deepEqual(jsonFromStringLiteral(`x = JSON.parse("{\\"a\\":\\"it\\'s\\"}")`, "x = JSON.parse("), { a: "it's" });
  assert.deepEqual(jsonObjectAfter(`y={"a":"}{","b":{"c":1}};z={}`, "y="), { a: "}{", b: { c: 1 } });
  assert.equal(jsonFromStringLiteral("<html>captcha</html>", "x = JSON.parse("), null);
  assert.equal(jsonObjectAfter("<html>captcha</html>", "y="), null);
});

test("InfoJobs: provinces from places, a country searches all of Spain", () => {
  assert.equal(infojobsProvince("Madrid, Spain"), "33");
  assert.equal(infojobsProvince("Valencia/València"), "49");
  assert.equal(infojobsProvince("A Coruña"), "28");
  assert.equal(infojobsProvince("Spain"), null);

  const search = { ...DEFAULT_SEARCH, queries: ["fisioterapeuta", "osteópata"], searchLocations: ["Madrid, Spain", "Spain"], workplace: "remote", maxAgeDays: 3 };
  const urls = infojobsSearchUrls(search, 1);
  assert.deepEqual(urls, [
    "https://www.infojobs.net/jobsearch/search-results/list.xhtml?keyword=fisioterapeuta&provinceIds=33&sinceDate=_7_DAYS&teleworkingIds=2",
    "https://www.infojobs.net/jobsearch/search-results/list.xhtml?keyword=fisioterapeuta&sinceDate=_7_DAYS&teleworkingIds=2",
  ]);
});

test("InfoJobs: keeps the full text without contacts, a clean link, and the place in Spain", () => {
  const raw = parseInfojobsPage(INFOJOBS_PAGE);
  assert.ok(raw);
  const [physio, admin, ...others] = normaliseInfojobs(raw, false);
  assert.equal(others.length, 0);
  assert.equal(physio.id, "infojobs:4ec868ae6d42e584edbd1372e9ad49");
  assert.equal(physio.title, "Fisioterapeuta");
  assert.equal(physio.sourceName, "InfoJobs");
  assert.equal(physio.url, "https://www.infojobs.net/madrid/fisioterapeuta/of-i4ec868ae6d42e584edbd1372e9ad49");
  assert.deepEqual(physio.locations, ["Madrid, Spain"]);
  assert.equal(physio.employmentType, "Contrato indefinido, Jornada completa");
  assert.match(physio.description, /\[email removed\]/);
  assert.match(physio.description, /\[phone removed\]/);
  assert.equal(admin.company, "Company not named");
  assert.deepEqual(admin.locations, ["Spain"]);
  assert.ok(admin.tags.includes("Remote"));
  assert.match(admin.description, /It's a "remote" job/);
});

test("InfoJobs: a page without search results (captcha) is reported, not read as zero offers", () => {
  assert.equal(parseInfojobsPage("<html><title>captcha</title></html>"), null);
});

test("Indeed: one place per search, a country means no place, within the age filter", () => {
  assert.equal(indeedPlace("Madrid, Spain"), "Madrid");
  assert.equal(indeedPlace("España"), "");
  const search = { ...DEFAULT_SEARCH, queries: ["auxiliar dental"], searchLocations: ["Spain", "Madrid, Spain"], maxAgeDays: 7 };
  assert.deepEqual(indeedSearchUrls(search, 3), [
    "https://es.indeed.com/jobs?q=auxiliar+dental&l=&fromage=7&sort=date",
    "https://es.indeed.com/jobs?q=auxiliar+dental&l=Madrid&fromage=7&sort=date",
  ]);
});

test("Indeed: keeps the card and its extract, marked as snippet only", () => {
  const cards = parseIndeedPage(INDEED_PAGE);
  assert.ok(cards);
  const offers = normaliseIndeed(cards, false);
  assert.equal(offers.length, 1);
  const [offer] = offers;
  assert.equal(offer.id, "indeed:0fd61c5717bd225c");
  assert.equal(offer.url, "https://es.indeed.com/viewjob?jk=0fd61c5717bd225c");
  assert.equal(offer.sourceName, "Indeed");
  assert.equal(offer.salary, "1.400 € - 1.600 € al mes");
  assert.deepEqual(offer.locations, ["28070 Madrid, Madrid provincia, Spain"]);
  assert.equal(offer.snippetOnly, true);
  assert.match(offer.description, /Atención al paciente & agenda\./);
  assert.match(offer.description, /\[email removed\]/);
  assert.equal(parseIndeedPage("<html>blocked</html>"), null);
});

test("Indeed and InfoJobs offers pass a Spain location filter, and the shortlist flags extracts", () => {
  const offers = [...normaliseInfojobs(parseInfojobsPage(INFOJOBS_PAGE)!, false), ...normaliseIndeed(parseIndeedPage(INDEED_PAGE)!, false)];
  const search = { ...DEFAULT_SEARCH, allowedLocations: ["Spain"], maxAgeDays: 14 };
  const { entries } = buildShortlist(offers, search, new Set(), new Date("2026-11-15T12:00:00Z"));
  assert.equal(entries.length, 3);
  const indeed = entries.find((e) => e.source === "indeed");
  assert.match(indeed!.description, /^\(only the short extract/);
});

test("the planned URLs are allowed by the sites' robots.txt (excerpts read 2026-11-15)", () => {
  const indeedRobots = parseRobots("User-agent: *\nAllow: /\nDisallow: /*&serpstart=\nDisallow: /viewjob\nDisallow: /m/viewjob\nDisallow: /rc/\n");
  const infojobsRobots = parseRobots(
    "User-agent: *\nDisallow: /ver-oferta.xhtml\nDisallow: /*applicationOrigin=*\nDisallow: /*-i.xhtml$\n\nUser-Agent: LinkedInBot\nDisallow: /jobsearch/search-results/list.xhtml\n",
  );
  const search = { ...DEFAULT_SEARCH, queries: ["data"], searchLocations: ["Madrid, Spain"] };
  for (const url of indeedSearchUrls(search, 1)) {
    const target = new URL(url);
    assert.ok(isAllowed(indeedRobots, APP_NAME, target.pathname + target.search), url);
  }
  for (const url of infojobsSearchUrls(search, 1)) {
    const target = new URL(url);
    assert.ok(isAllowed(infojobsRobots, APP_NAME, target.pathname + target.search), url);
  }
  // Job pages stay out of reach: the Indeed source never opens them.
  assert.equal(isAllowed(indeedRobots, APP_NAME, "/viewjob?jk=0fd61c5717bd225c"), false);
});

test("client reports a bot check (captcha) and does not try to get past it", async () => {
  const calls: string[] = [];
  const client = new PoliteClient({
    cacheDir: fs.mkdtempSync(path.join(os.tmpdir(), "http-")),
    fetchFn: async (url) => {
      calls.push(url);
      if (url.endsWith("/robots.txt")) return new Response("User-agent: *\nAllow: /\n", { status: 200 });
      return new Response("<html>challenge</html>", { status: 403, headers: { "cf-mitigated": "challenge" } });
    },
    sleep: async () => {},
  });
  const limits = { minDelayMs: 0, dailyRequestCap: 5, cacheHours: 1 };
  await assert.rejects(client.getText("indeed", "https://es.indeed.com/jobs?q=x", limits), (error: Error) => {
    assert.ok(error instanceof SourceError);
    assert.match(error.message, /bot check/);
    return true;
  });
  assert.equal(calls.length, 2); // robots.txt and the page, no retry
});

test("sources: defaults always, complementary ones only when chosen, switched-off ones never", () => {
  const limits = { minDelayMs: 1, dailyRequestCap: 1, cacheHours: 1, maxQueries: 1 };
  const sources: Record<string, SourceConfig> = {
    linkedin: { ...limits, name: "LinkedIn", enabled: true, default: true },
    indeed: { ...limits, name: "Indeed", enabled: false, default: true },
    himalayas: { ...limits, name: "Himalayas", enabled: true, default: false },
    arbeitnow: { ...limits, name: "Arbeitnow", enabled: true, default: false },
  };
  const ids = (list: [string, SourceConfig][]) => list.map(([id]) => id);
  assert.deepEqual(ids(activeSources(sources, DEFAULT_SEARCH)), ["linkedin"]);
  assert.deepEqual(ids(activeSources(sources, { ...DEFAULT_SEARCH, extraSources: ["himalayas", "indeed"] })), ["linkedin", "himalayas"]);
  assert.deepEqual(ids(activeSources(sources, DEFAULT_SEARCH, "arbeitnow")), ["arbeitnow"]);
  assert.deepEqual(ids(activeSources(sources, DEFAULT_SEARCH, "indeed")), []);
});
