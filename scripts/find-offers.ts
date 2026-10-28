// Fetches offers from the enabled sources in config/sources.json, using the
// search terms in your search.json, and writes them to offers/fetched.json.
// Offers you pasted by hand (offers/pasted.json) are merged in.
//
// Usage: npm run find-offers [-- --workspace <folder>] [-- --source linkedin] [-- --dry-run]

import fs from "node:fs";
import path from "node:path";
import { parseArgs, stringOption } from "./lib/args.ts";
import { PoliteClient, SourceError } from "./lib/http.ts";
import { isMain } from "./lib/main.ts";
import { loadSearchSettings, loadSources } from "./lib/settings.ts";
import type { SearchSettings, SourceConfig } from "./lib/settings.ts";
import { normalise } from "./lib/text.ts";
import type { Offer } from "./lib/types.ts";
import { readJson, REPO_ROOT, workspacePaths, writeJson } from "./lib/workspace.ts";
import { ARBEITNOW_URL, normaliseArbeitnow } from "./sources/arbeitnow.ts";
import { himalayasSearchUrl, normaliseHimalayas } from "./sources/himalayas.ts";
import { fetchLinkedIn, linkedinSearchUrls } from "./sources/linkedin.ts";
import { normaliseRemoteOk, REMOTEOK_URL } from "./sources/remoteok.ts";

// The URLs a source will request for these settings.
export function plannedRequests(sourceId: string, source: SourceConfig, search: SearchSettings): string[] {
  if (sourceId === "himalayas") return search.queries.slice(0, source.maxQueries).map(himalayasSearchUrl);
  if (sourceId === "remoteok") return [REMOTEOK_URL];
  if (sourceId === "arbeitnow") return [ARBEITNOW_URL];
  if (sourceId === "linkedin") return linkedinSearchUrls(search, source.maxQueries);
  return [];
}

function normaliseFor(sourceId: string, data: unknown, aiBlocked: boolean): Offer[] {
  if (sourceId === "himalayas") return normaliseHimalayas(data, aiBlocked);
  if (sourceId === "remoteok") return normaliseRemoteOk(data, aiBlocked);
  if (sourceId === "arbeitnow") return normaliseArbeitnow(data, aiBlocked);
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const paths = workspacePaths(stringOption(args, "workspace"));
  const search = loadSearchSettings(paths.search);
  if (search.queries.length === 0) {
    console.error(`No search terms in ${path.relative(REPO_ROOT, paths.search)}. Ask your agent to "set up my profile" first.`);
    process.exit(1);
  }
  const only = stringOption(args, "source");
  const sources = Object.entries(loadSources()).filter(([id, s]) => s.enabled && (!only || id === only));
  const client = new PoliteClient({ cacheDir: paths.cacheDir });

  const all: Offer[] = [];
  for (const [id, source] of sources) {
    const urls = plannedRequests(id, source, search);
    if (args.options["dry-run"]) {
      const more = id === "linkedin" ? `\n  and up to ${source.maxDetails ?? 15} job pages whose titles match` : "";
      console.log(`${source.name}: would request\n  ${urls.join("\n  ")}${more}`);
      continue;
    }
    if (id === "linkedin") {
      all.push(...(await fetchLinkedIn(client, source, search, (message) => console.log(message))));
      continue;
    }
    let count = 0;
    let cachedCount = 0;
    for (const url of urls) {
      try {
        const result = await client.getJson(id, url, source);
        const offers = normaliseFor(id, result.data, result.aiBlocked);
        count += offers.length;
        if (result.fromCache) cachedCount++;
        all.push(...offers);
      } catch (error) {
        if (error instanceof SourceError) {
          console.warn(`${source.name}: ${error.message}`);
          break; // stop this source for this run; never retry in a loop
        }
        throw error;
      }
    }
    const cacheNote = cachedCount > 0 ? ` (${cachedCount} of ${urls.length} answers from the local cache)` : "";
    console.log(`${source.name}: ${count} offers${cacheNote}`);
  }
  if (args.options["dry-run"]) return;

  // With --source, keep what the other sources found last time.
  if (only && fs.existsSync(paths.fetched)) {
    all.push(...readJson<Offer[]>(paths.fetched).filter((offer) => offer.source !== only && offer.source !== "pasted"));
  }
  if (fs.existsSync(paths.pasted)) all.push(...readJson<Offer[]>(paths.pasted));
  const offers = dedupe(all);
  writeJson(paths.fetched, offers);
  console.log(`\nSaved ${offers.length} offers to ${path.relative(REPO_ROOT, paths.fetched)}.`);
  console.log(`Offers come from ${sources.map(([, s]) => s.name).join(", ")}: each one links back to its page at the source.`);
  console.log('Next: "npm run shortlist", or ask your agent to rank the offers.');
}

if (isMain(import.meta.url)) {
  await main();
}
