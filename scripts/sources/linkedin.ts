// LinkedIn public job pages ("jobs-guest" endpoints, no login, no account).
// The same approach as the linkedin-search skill of ai-job-search (MIT); the
// parsers below are adapted from its helpers.ts. See THIRD_PARTY_NOTICES.md.
//
// LinkedIn's User Agreement forbids automated access and its robots.txt disallows
// these pages, so this source does not follow the project's robots.txt rule.
// It is for one person's own search at low volume: see docs/sources.md.
//
// Two steps: a search page per query and place (10 job cards each, no text),
// then the job page of the cards that match your title keywords (the full text).

import type { PoliteClient } from "../lib/http.ts";
import { SourceError } from "../lib/http.ts";
import type { SearchSettings, SourceConfig } from "../lib/settings.ts";
import { containsWords, decodeEntities, htmlToText, stripContacts } from "../lib/text.ts";
import type { Offer } from "../lib/types.ts";

const SEARCH_URL = "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search";
const DETAIL_URL = "https://www.linkedin.com/jobs-guest/jobs/api/jobPosting";
const DAY_SECONDS = 86_400;
const WORKPLACE: Record<string, string> = { onsite: "1", remote: "2", hybrid: "3" };

export type JobCard = {
  id: string;
  title: string;
  company: string;
  location: string;
  date: string | null;
  url: string;
};

export type JobDetail = {
  description: string;
  seniority?: string;
  employmentType?: string;
  jobFunction?: string;
  industries?: string;
};

function clean(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

// One search URL per query and place. LinkedIn's "posted within" filter takes seconds.
export function linkedinSearchUrls(search: SearchSettings, maxQueries: number): string[] {
  const urls: string[] = [];
  for (const query of search.queries.slice(0, maxQueries)) {
    for (const place of search.searchLocations) {
      const params = new URLSearchParams({ keywords: query, location: place });
      params.set("f_TPR", `r${Math.min(search.maxAgeDays, 30) * DAY_SECONDS}`);
      const workplace = WORKPLACE[search.workplace.toLowerCase()];
      if (workplace) params.set("f_WT", workplace);
      params.set("start", "0");
      urls.push(`${SEARCH_URL}?${params.toString()}`);
    }
  }
  return urls;
}

export function linkedinDetailUrl(id: string): string {
  return `${DETAIL_URL}/${id}`;
}

// The search answer is a flat list of cards. Each chunk is parsed on its own,
// so one malformed card cannot break the rest.
export function parseJobCards(html: string): JobCard[] {
  const cards: JobCard[] = [];
  for (const chunk of html.split(/data-entity-urn="urn:li:jobPosting:/).slice(1)) {
    const id = chunk.match(/^(\d+)/)?.[1];
    if (!id) continue;
    const title = clean(chunk.match(/class="base-search-card__title"[^>]*>([\s\S]*?)<\/h3>/i)?.[1] ?? "");
    const company = clean(chunk.match(/class="base-search-card__subtitle"[^>]*>([\s\S]*?)<\/h4>/i)?.[1] ?? "");
    if (!title || !company) continue;
    const location = clean(chunk.match(/class="job-search-card__location"[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? "");
    const date = chunk.match(/class="job-search-card__listdate[^"]*"[^>]*datetime="([^"]+)"/i)?.[1] ?? null;
    cards.push({ id, title, company, location, date, url: `https://www.linkedin.com/jobs/view/${id}` });
  }
  return cards;
}

// The inner HTML of the first <div> with this class, counting nested divs.
function divContent(html: string, className: string): string | null {
  const open = new RegExp(`<div[^>]*class="[^"]*${className}[^"]*"[^>]*>`, "i").exec(html);
  if (!open) return null;
  let i = open.index + open[0].length;
  let depth = 1;
  while (depth > 0) {
    const nextOpen = html.indexOf("<div", i);
    const nextClose = html.indexOf("</div>", i);
    if (nextClose === -1) return null;
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++;
      i = nextOpen + 4;
    } else {
      depth--;
      i = nextClose + 6;
    }
  }
  return html.slice(open.index + open[0].length, i - 6);
}

export function parseJobDetail(html: string): JobDetail {
  const body = divContent(html, "show-more-less-html__markup") ?? divContent(html, "description__text") ?? "";
  const criteria: Record<string, string> = {};
  const itemRe =
    /class="description__job-criteria-subheader"[^>]*>([\s\S]*?)<\/h3>[\s\S]*?class="description__job-criteria-text[^"]*"[^>]*>([\s\S]*?)<\/span>/gi;
  for (const match of html.matchAll(itemRe)) criteria[clean(match[1]).toLowerCase()] = clean(match[2]);
  return {
    description: stripContacts(htmlToText(body)),
    seniority: criteria["seniority level"],
    employmentType: criteria["employment type"],
    jobFunction: criteria["job function"],
    industries: criteria["industries"],
  };
}

export function linkedinOffer(card: JobCard, detail: JobDetail): Offer {
  return {
    id: `linkedin:${card.id}`,
    source: "linkedin",
    sourceName: "LinkedIn",
    title: card.title,
    company: card.company,
    url: card.url,
    applyUrl: card.url, // LinkedIn shows the employer's apply link on the job page
    locations: card.location ? [card.location] : [],
    tags: [detail.jobFunction, detail.industries].filter((t): t is string => Boolean(t)),
    seniority: detail.seniority,
    employmentType: detail.employmentType,
    postedAt: card.date ? new Date(card.date).toISOString() : new Date(0).toISOString(),
    description: detail.description,
    aiBlocked: false,
  };
}

// Only cards whose title matches your keywords are opened, to keep the volume low.
export function cardsWorthOpening(cards: JobCard[], search: SearchSettings, max: number): JobCard[] {
  const seen = new Set<string>();
  const result: JobCard[] = [];
  for (const card of cards) {
    if (seen.has(card.id)) continue;
    seen.add(card.id);
    if (search.excludeKeywords.some((word) => containsWords(card.title, word))) continue;
    if (search.titleKeywords.length > 0 && !search.titleKeywords.some((word) => containsWords(card.title, word))) continue;
    result.push(card);
  }
  return result.slice(0, max);
}

export async function fetchLinkedIn(
  client: PoliteClient,
  source: SourceConfig,
  search: SearchSettings,
  log: (message: string) => void,
): Promise<Offer[]> {
  if (search.searchLocations.length === 0) {
    log(`${source.name}: no "searchLocations" in search.json (for example ["Spain"]); skipped`);
    return [];
  }
  const cards: JobCard[] = [];
  try {
    for (const url of linkedinSearchUrls(search, source.maxQueries)) {
      cards.push(...parseJobCards((await client.getText("linkedin", url, source)).data));
    }
  } catch (error) {
    if (!(error instanceof SourceError)) throw error;
    log(`${source.name}: ${error.message}`);
  }
  const toOpen = cardsWorthOpening(cards, search, source.maxDetails ?? 15);
  const offers: Offer[] = [];
  for (const card of toOpen) {
    try {
      const detail = parseJobDetail((await client.getText("linkedin", linkedinDetailUrl(card.id), source)).data);
      offers.push(linkedinOffer(card, detail));
    } catch (error) {
      if (!(error instanceof SourceError)) throw error;
      log(`${source.name}: ${error.message}; ${toOpen.length - offers.length} job pages not opened`);
      break;
    }
  }
  log(`${source.name}: ${cards.length} cards found, ${toOpen.length} matched your title keywords, ${offers.length} opened`);
  return offers;
}
