// Fetches offers from the job sources, using the search terms in your
// search.json, and writes them to offers/fetched.json:
//   - the default sources in config/sources.json (LinkedIn, InfoJobs, Indeed);
//   - the complementary sources you chose ("extraSources" in search.json). Their
//     offers are read from the page's JobPosting data when it has some; otherwise
//     the page is saved to offers/sources/<id>.md for your agent to read.
// Offers you pasted by hand (offers/pasted.json) are merged in.
//
// Usage: npm run find-offers [-- --workspace <folder>] [-- --source <id>] [-- --dry-run]

import fs from "node:fs";
import path from "node:path";
import { parseArgs, stringOption } from "./lib/args.ts";
import { PoliteClient, SourceError } from "./lib/http.ts";
import { isMain } from "./lib/main.ts";
import { activeSources, loadSearchSettings, loadSources } from "./lib/settings.ts";
import type { SearchSettings, SourceConfig } from "./lib/settings.ts";
import { normalise } from "./lib/text.ts";
import type { Offer } from "./lib/types.ts";
import { readJson, REPO_ROOT, workspacePaths, writeJson } from "./lib/workspace.ts";
import type { WorkspacePaths } from "./lib/workspace.ts";
import {
  CUSTOM_LIMITS,
  customOffersFromPostings,
  customSearchUrls,
  jobPostingsFromHtml,
  sourcePageMarkdown,
} from "./sources/custom.ts";
import type { ExtraSource } from "./sources/custom.ts";
import { indeedSearchUrls, normaliseIndeed, parseIndeedPage } from "./sources/indeed.ts";
import { infojobsSearchUrls, normaliseInfojobs, parseInfojobsPage } from "./sources/infojobs.ts";
import { fetchLinkedIn, linkedinSearchUrls } from "./sources/linkedin.ts";

// The URLs a default source will request for these settings.
export function plannedRequests(sourceId: string, source: SourceConfig, search: SearchSettings): string[] {
  if (sourceId === "linkedin") return linkedinSearchUrls(search, source.maxQueries);
  if (sourceId === "infojobs") return infojobsSearchUrls(search, source.maxQueries);
  if (sourceId === "indeed") return indeedSearchUrls(search, source.maxQueries);
  return [];
}

// The offers in one search page of InfoJobs or Indeed, or null if it has no
// search results (the site answered something else, such as a captcha page).
function normaliseHtmlFor(sourceId: string, html: string, aiBlocked: boolean): Offer[] | null {
  if (sourceId === "infojobs") {
    const offers = parseInfojobsPage(html);
    return offers && normaliseInfojobs(offers, aiBlocked);
  }
  if (sourceId === "indeed") {
    const cards = parseIndeedPage(html);
    return cards && normaliseIndeed(cards, aiBlocked);
  }
  return [];
}

// Removes duplicates: same id, or the same company and title from another source.
export function dedupe(offers: Offer[]): Offer[] {
  const seenIds = new Set<string>();
  const seenKeys = new Set<string>();
  const result: Offer[] = [];
  for (const offer of offers) {
    const key = normalise(offer.company) + "|" + normalise(offer.title);
    if (seenIds.has(offer.id) || seenKeys.has(key)) continue;
    seenIds.add(offer.id);
    seenKeys.add(key);
    result.push(offer);
  }
  return result;
}

// True when an offer came from the source with this id (default or complementary).
export function fromSource(offer: Offer, sourceId: string): boolean {
  return offer.source === sourceId || offer.id.startsWith(`custom:${sourceId}:`);
}

async function fetchDefaultSource(client: PoliteClient, id: string, source: SourceConfig, search: SearchSettings): Promise<Offer[]> {
  if (id === "linkedin") return fetchLinkedIn(client, source, search, (message) => console.log(message));
  const urls = plannedRequests(id, source, search);
  const offers: Offer[] = [];
  let cachedCount = 0;
  for (const url of urls) {
    try {
      const result = await client.getText(id, url, source);
      const found = normaliseHtmlFor(id, result.data, result.aiBlocked);
      if (found === null) {
        console.warn(`${source.name}: the answer had no search results (the site may be asking for a captcha); stopped for this run`);
        break;
      }
      offers.push(...found);
      if (result.fromCache) cachedCount++;
    } catch (error) {
      if (!(error instanceof SourceError)) throw error;
      console.warn(`${source.name}: ${error.message}`);
      break; // stop this source for this run; never retry in a loop
    }
  }
  const cacheNote = cachedCount > 0 ? ` (${cachedCount} of ${urls.length} answers from the local cache)` : "";
  console.log(`${source.name}: ${offers.length} offers${cacheNote}`);
  return offers;
}

// A complementary source: its JobPosting data when the page has it, otherwise
// the page saved for the agent. Returns the offers read and whether a page was saved.
async function fetchExtraSource(client: PoliteClient, source: ExtraSource, search: SearchSettings, paths: WorkspacePaths) {
  const offers: Offer[] = [];
  const pages: { url: string; html: string }[] = [];
  for (const url of customSearchUrls(source, search)) {
    try {
      const result = await client.getText(`custom:${source.id}`, url, CUSTOM_LIMITS);
      if (result.aiBlocked) {
        console.warn(`${source.name}: this site now opts out of AI agents in its robots.txt; skipped. Remove it or paste its offers.`);
        return { offers: [], savedPage: false };
      }
      const postings = jobPostingsFromHtml(result.data);
      if (postings.length > 0) offers.push(...customOffersFromPostings(source, postings, url, false));
      else pages.push({ url, html: result.data });
    } catch (error) {
      if (!(error instanceof SourceError)) throw error;
      console.warn(`${source.name}: ${error.message}`);
      break;
    }
  }
  if (pages.length > 0) {
    fs.mkdirSync(paths.sourcePagesDir, { recursive: true });
    const file = path.join(paths.sourcePagesDir, `${source.id}.md`);
    fs.writeFileSync(file, sourcePageMarkdown(source, pages, new Date().toISOString().slice(0, 10)), "utf8");
    console.log(`${source.name}: ${offers.length} offers read, and ${pages.length} page(s) saved to ${path.relative(REPO_ROOT, file)} for your agent to read`);
  } else {
    console.log(`${source.name}: ${offers.length} offers`);
  }
  return { offers, savedPage: pages.length > 0 };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const paths = workspacePaths(stringOption(args, "workspace"));
  const search = loadSearchSettings(paths.search);
  if (search.queries.length === 0) {
    console.error(`No search terms in ${path.relative(REPO_ROOT, paths.search)}. Ask your agent to "set up my profile" first.`);
    process.exit(1);
  }
  const only = stringOption(args, "source");
  const sources = activeSources(loadSources(), only);
  const extras = search.extraSources.filter((s) => !only || s.id === only);
  if (sources.length === 0 && extras.length === 0) {
    console.error(only ? `No enabled source called "${only}" in config/sources.json or in extraSources.` : "No enabled sources.");
    process.exit(1);
  }

  if (args.options["dry-run"]) {
    for (const [id, source] of sources) {
      const more = id === "linkedin" ? `\n  and up to ${source.maxDetails ?? 15} job pages whose titles match` : "";
      console.log(`${source.name}: would request\n  ${plannedRequests(id, source, search).join("\n  ")}${more}`);
    }
    for (const source of extras) console.log(`${source.name} (your source): would request\n  ${customSearchUrls(source, search).join("\n  ")}`);
    return;
  }

  // Pages saved and offers extracted from them last time are stale now.
  for (const source of extras) fs.rmSync(path.join(paths.sourcePagesDir, `${source.id}.md`), { force: true });
  if (fs.existsSync(paths.extracted)) {
    const kept = readJson<Offer[]>(paths.extracted).filter((offer) => !extras.some((s) => fromSource(offer, s.id)));
    writeJson(paths.extracted, kept);
  }

  const client = new PoliteClient({ cacheDir: paths.cacheDir });
  const all: Offer[] = [];
  for (const [id, source] of sources) all.push(...(await fetchDefaultSource(client, id, source, search)));
  const savedPages: string[] = [];
  for (const source of extras) {
    const result = await fetchExtraSource(client, source, search, paths);
    all.push(...result.offers);
    if (result.savedPage) savedPages.push(source.name);
  }

  // With --source, keep what the other sources found last time.
  if (only && fs.existsSync(paths.fetched)) {
    all.push(...readJson<Offer[]>(paths.fetched).filter((offer) => !fromSource(offer, only) && offer.source !== "pasted"));
  }
  if (fs.existsSync(paths.pasted)) all.push(...readJson<Offer[]>(paths.pasted));
  const offers = dedupe(all);
  writeJson(paths.fetched, offers);
  const names = [...sources.map(([, s]) => s.name), ...extras.map((s) => s.name)];
  console.log(`\nSaved ${offers.length} offers to ${path.relative(REPO_ROOT, paths.fetched)}.`);
  console.log(`Offers come from ${names.join(", ")}: each one links back to its page at the source.`);
  if (savedPages.length > 0) {
    console.log(`Your agent now reads the saved pages of ${savedPages.join(", ")} (offers/sources/) and adds their offers to offers/extracted.json.`);
  }
  console.log('Next: "npm run shortlist", or ask your agent to rank the offers.');
}

if (isMain(import.meta.url)) {
  await main();
}
