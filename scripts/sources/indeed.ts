// Indeed Spain (https://es.indeed.com): a large general job board and aggregator.
// Indeed has no public jobs API. This source reads its public search page,
// without login: the page embeds its 15 job cards as JSON (title, company,
// place, salary if shown, and a short extract of the offer).
//
// Indeed's robots.txt allows search pages (/jobs) and disallows job pages
// (/viewjob). This source follows robots.txt, so it never opens a job page:
// each offer only has the extract (snippetOnly). Indeed's terms (1 April 2026)
// allow candidates to use the site "para el fin personal y no comercial de
// buscar empleo". For one person's own search at low volume. See docs/sources.md.

import { jsonObjectAfter } from "../lib/embedded.ts";
import type { SearchSettings } from "../lib/settings.ts";
import { htmlToText, normalise, stripContacts } from "../lib/text.ts";
import type { Offer } from "../lib/types.ts";

const SEARCH_URL = "https://es.indeed.com/jobs";
const CARDS_MARKER = 'window.mosaic.providerData["mosaic-provider-jobcards"]=';
const COUNTRY_WORDS = new Set(["spain", "espana", "european union", "union europea", "europe", "europa"]);

// Indeed searches one place at a time and already covers Spain only, so a
// country means "no place". "Madrid, Spain" becomes "Madrid".
export function indeedPlace(place: string): string {
  const first = place.split(",")[0].trim();
  return COUNTRY_WORDS.has(normalise(first)) ? "" : first;
}

// Indeed's "published in the last N days" filter accepts 1, 3, 7 and 14.
function fromAge(maxAgeDays: number): string {
  for (const days of [1, 3, 7, 14]) if (maxAgeDays <= days) return String(days);
  return "14";
}

// One URL per search term and place, newest first.
export function indeedSearchUrls(search: SearchSettings, maxQueries: number): string[] {
  const places = [...new Set(search.searchLocations.map(indeedPlace))];
  if (places.length === 0) places.push("");
  const urls: string[] = [];
  for (const query of search.queries.slice(0, maxQueries)) {
    for (const place of places) {
      const params = new URLSearchParams({ q: query, l: place, fromage: fromAge(search.maxAgeDays), sort: "date" });
      urls.push(`${SEARCH_URL}?${params.toString()}`);
    }
  }
  return urls;
}

// The fields we use from one job card in the embedded JSON.
type IndeedCard = {
  jobkey?: string;
  title?: string;
  displayTitle?: string;
  company?: string;
  formattedLocation?: string;
  snippet?: string;
  salarySnippet?: { text?: string };
  pubDate?: number; // milliseconds since 1970
  jobTypes?: string[];
  remoteLocation?: boolean;
  expired?: boolean;
};

// The cards in one search page, or null if the page has no search results
// (for example a block or captcha page).
export function parseIndeedPage(html: string): IndeedCard[] | null {
  const data = jsonObjectAfter(html, CARDS_MARKER) as {
    metaData?: { mosaicProviderJobCardsModel?: { results?: unknown } };
  } | null;
  const results = data?.metaData?.mosaicProviderJobCardsModel?.results;
  return Array.isArray(results) ? (results as IndeedCard[]) : null;
}

export function normaliseIndeed(cards: IndeedCard[], aiBlocked: boolean): Offer[] {
  const offers: Offer[] = [];
  for (const card of cards) {
    const title = (card.displayTitle ?? card.title ?? "").trim();
    if (!card.jobkey || !title || !card.company || card.expired) continue;
    const url = `https://es.indeed.com/viewjob?jk=${encodeURIComponent(card.jobkey)}`;
    const place = card.formattedLocation?.trim();
    offers.push({
      id: `indeed:${card.jobkey}`,
      source: "indeed",
      sourceName: "Indeed",
      title,
      company: card.company.trim(),
      url,
      applyUrl: url, // the Indeed job page shows how to apply
      // Indeed Spain lists jobs in Spain; "Remoto" alone gets the country added.
      locations: [place ? `${place}, Spain` : "Spain"],
      tags: [...(card.jobTypes ?? []), ...(card.remoteLocation ? ["Remote"] : [])],
      employmentType: card.jobTypes?.join(", ") || undefined,
      salary: card.salarySnippet?.text?.trim() || undefined,
      postedAt: card.pubDate ? new Date(card.pubDate).toISOString() : new Date(0).toISOString(),
      description: aiBlocked ? "" : stripContacts(htmlToText(card.snippet ?? "")),
      aiBlocked,
      snippetOnly: true,
    });
  }
  return offers;
}
