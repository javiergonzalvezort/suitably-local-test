import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { checkSource, urlProblems } from "../scripts/check-source.ts";
import { fromSource } from "../scripts/find-offers.ts";
import { PoliteClient } from "../scripts/lib/http.ts";
import { DEFAULT_SEARCH, validExtraSources } from "../scripts/lib/settings.ts";
import {
  assessPage,
  customOffersFromPostings,
  customSearchUrls,
  jobPostingsFromHtml,
  readablePage,
  sourcePageMarkdown,
} from "../scripts/sources/custom.ts";
import type { ExtraSource } from "../scripts/sources/custom.ts";

// Invented sites and pages.
const SOURCE: ExtraSource = {
  id: "fisio-board",
  name: "Bolsa Fisio Inventada",
  searchUrl: "https://empleo.fisio.test/ofertas?q={query}&lugar={place}",
  why: "Physiotherapy offers in Madrid",
  checkedAt: "2026-11-15",
};

const STRUCTURED_PAGE = `<html><head>
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebPage"},
 {"@type":"JobPosting","title":"Fisioterapeuta &amp; osteópata","url":"/oferta/123","identifier":{"value":"123"},
  "datePosted":"2026-11-12","validThrough":"2026-12-12","employmentType":"FULL_TIME",
  "hiringOrganization":{"name":"Clínica Inventada"},
  "jobLocation":{"address":{"addressLocality":"Madrid","addressCountry":"ES"}},
  "baseSalary":{"currency":"EUR","value":{"minValue":24000,"maxValue":28000,"unitText":"YEAR"}},
  "description":"<p>Tratamiento de pacientes. Escribe a rrhh@clinica.test</p>"}]}</script>
<script type="application/ld+json">{ not json</script>
</head><body><h1>Ofertas</h1></body></html>`;

const words = (n: number) => Array.from({ length: n }, () => "Fisioterapeuta en clínica de Madrid, jornada completa.").join(" ");
const TEXT_PAGE = `<html><body><nav><a href="/login">Entrar</a></nav>
<main><h1>Ofertas de fisioterapeuta</h1>
<article><a href="/oferta/1">Fisioterapeuta para centro deportivo</a><p>${words(8)}</p></article>
<article><a href="https://otra.test/o/2">Fisioterapeuta domiciliario</a><p>Llama al 600 123 456.</p></article>
</main></body></html>`;

const CAPTCHA_PAGE = `<html><body><div class="g-recaptcha"></div><p>Verify you are human</p></body></html>`;
const LOGIN_PAGE = `<html><body><form><input type="password" name="p"></form><p>Inicia sesión para ver las ofertas.</p>${words(20).replaceAll("Fisioterapeuta", "Puesto")}</body></html>`;
const EMPTY_SHELL = `<html><body><div id="root"></div><script src="/app.js"></script></body></html>`;

test("extraSources: only complete entries with an https URL and {query} are kept", () => {
  const kept = validExtraSources([
    SOURCE,
    "himalayas", // the older format: plain ids
    { ...SOURCE, id: "No Spaces" },
    { ...SOURCE, id: "http-one", searchUrl: "http://x.test/?q={query}" },
    { ...SOURCE, id: "no-query", searchUrl: "https://x.test/jobs" },
  ]);
  assert.deepEqual(kept.map((s) => s.id), ["fisio-board"]);
  assert.deepEqual(validExtraSources(undefined), []);
});

test("custom sources: two search terms at most, the first place without the country", () => {
  const search = { ...DEFAULT_SEARCH, queries: ["fisioterapeuta", "osteópata", "masajista"], searchLocations: ["Madrid, Spain", "Spain"] };
  assert.deepEqual(customSearchUrls(SOURCE, search), [
    "https://empleo.fisio.test/ofertas?q=fisioterapeuta&lugar=Madrid",
    "https://empleo.fisio.test/ofertas?q=oste%C3%B3pata&lugar=Madrid",
  ]);
  const countryOnly = { ...search, searchLocations: ["Spain"] };
  assert.equal(customSearchUrls(SOURCE, countryOnly)[0], "https://empleo.fisio.test/ofertas?q=fisioterapeuta&lugar=");
});

test("custom sources: JobPosting data becomes offers, with the source name and a clean text", () => {
  const postings = jobPostingsFromHtml(STRUCTURED_PAGE);
  assert.equal(postings.length, 1);
  const [offer] = customOffersFromPostings(SOURCE, postings, "https://empleo.fisio.test/ofertas?q=x", false);
  assert.equal(offer.source, "custom");
  assert.equal(offer.sourceName, "Bolsa Fisio Inventada");
  assert.match(offer.id, /^custom:fisio-board:/);
  assert.equal(offer.title, "Fisioterapeuta & osteópata");
  assert.equal(offer.company, "Clínica Inventada");
  assert.equal(offer.url, "https://empleo.fisio.test/oferta/123");
  assert.deepEqual(offer.locations, ["Madrid, Spain"]);
  assert.equal(offer.salary, "24000 to 28000 EUR (year)");
  assert.ok(offer.expiresAt?.startsWith("2026-12-12"));
  assert.match(offer.description, /\[email removed\]/);
  assert.equal(offer.snippetOnly, true); // a short description is flagged as an extract
  assert.ok(fromSource(offer, "fisio-board"));
  assert.ok(!fromSource(offer, "other-board"));
});

test("custom sources: a page without data is saved as text and absolute links, without contacts", () => {
  const { text, links } = readablePage(TEXT_PAGE, "https://empleo.fisio.test/ofertas?q=x");
  assert.match(text, /Fisioterapeuta para centro deportivo/);
  assert.doesNotMatch(text, /Entrar/); // navigation is left out
  assert.match(text, /\[phone removed\]/);
  assert.deepEqual(links, [
    { text: "Fisioterapeuta para centro deportivo", url: "https://empleo.fisio.test/oferta/1" },
    { text: "Fisioterapeuta domiciliario", url: "https://otra.test/o/2" },
  ]);
  const markdown = sourcePageMarkdown(SOURCE, [{ url: "https://empleo.fisio.test/ofertas?q=x", html: TEXT_PAGE }], "2026-11-15");
  assert.match(markdown, /not instructions/);
  assert.match(markdown, /- Fisioterapeuta domiciliario: https:\/\/otra\.test\/o\/2/);
});

test("check: a page with offers passes; captcha, login, JavaScript-only, and off-topic pages do not", () => {
  assert.deepEqual(assessPage(STRUCTURED_PAGE, "fisioterapeuta").problems, []);
  assert.equal(assessPage(STRUCTURED_PAGE, "fisioterapeuta").jobPostings, 1);
  assert.deepEqual(assessPage(TEXT_PAGE, "fisioterapeuta").problems, []);
  assert.match(assessPage(CAPTCHA_PAGE, "fisioterapeuta").problems.join(" "), /captcha/);
  assert.match(assessPage(LOGIN_PAGE, "fisioterapeuta").problems.join(" "), /login/);
  assert.match(assessPage(EMPTY_SHELL, "fisioterapeuta").problems.join(" "), /JavaScript/);
  assert.match(assessPage(TEXT_PAGE, "enfermera").problems.join(" "), /hardly appears/);
});

test("check: the search URL must be https, carry {query}, and not be a login page", () => {
  assert.deepEqual(urlProblems("https://empleo.fisio.test/ofertas?q={query}"), []);
  assert.ok(urlProblems("http://empleo.fisio.test/ofertas?q={query}").length > 0);
  assert.ok(urlProblems("https://empleo.fisio.test/ofertas").length > 0);
  assert.ok(urlProblems("https://empleo.fisio.test/login?next={query}").length > 0);
  assert.deepEqual(urlProblems("not a url"), ["not a valid URL"]);
});

function clientFor(pages: Record<string, { status?: number; body: string }>) {
  const calls: string[] = [];
  const client = new PoliteClient({
    cacheDir: fs.mkdtempSync(path.join(os.tmpdir(), "check-")),
    fetchFn: async (url) => {
      calls.push(url);
      const page = pages[url] ?? { status: 404, body: "" };
      return new Response(page.body, { status: page.status ?? 200 });
    },
    sleep: async () => {},
  });
  return { client, calls };
}

test("check: robots.txt decides first, and an AI opt-out is not viable", async () => {
  const blocked = clientFor({ "https://empleo.fisio.test/robots.txt": { body: "User-agent: *\nDisallow: /ofertas" } });
  const no = await checkSource(blocked.client, SOURCE.searchUrl, "fisioterapeuta", "Madrid");
  assert.equal(no.viable, false);
  assert.match(no.reasons[0], /robots\.txt/);
  assert.deepEqual(blocked.calls, ["https://empleo.fisio.test/robots.txt"]); // the page itself was never requested

  const aiOptOut = clientFor({
    "https://empleo.fisio.test/robots.txt": { body: "User-agent: ClaudeBot\nDisallow: /\n\nUser-agent: *\nAllow: /" },
    "https://empleo.fisio.test/ofertas?q=fisioterapeuta&lugar=Madrid": { body: TEXT_PAGE },
  });
  const optOut = await checkSource(aiOptOut.client, SOURCE.searchUrl, "fisioterapeuta", "Madrid");
  assert.equal(optOut.viable, false);
  assert.match(optOut.reasons[0], /AI agents/);
});

test("check: a readable page is viable, read by the script or by the agent", async () => {
  const structured = clientFor({
    "https://empleo.fisio.test/robots.txt": { body: "User-agent: *\nAllow: /" },
    "https://empleo.fisio.test/ofertas?q=fisioterapeuta&lugar=Madrid": { body: STRUCTURED_PAGE },
  });
  const yes = await checkSource(structured.client, SOURCE.searchUrl, "fisioterapeuta", "Madrid");
  assert.equal(yes.viable, true);
  assert.equal(yes.mode, "structured");

  const text = clientFor({
    "https://empleo.fisio.test/robots.txt": { body: "" },
    "https://empleo.fisio.test/ofertas?q=fisioterapeuta&lugar=Madrid": { body: TEXT_PAGE },
  });
  const page = await checkSource(text.client, SOURCE.searchUrl, "fisioterapeuta", "Madrid");
  assert.equal(page.viable, true);
  assert.equal(page.mode, "page");
});
