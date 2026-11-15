// InfoJobs (https://www.infojobs.net): Spain's largest general job board.
// Its public search page, without login, embeds the offers of the first results
// page as JSON (title, company, city, contract, full description), so one
// request per search term and province is enough: no job pages are opened.
//
// InfoJobs has an official API, but each user would have to register an app
// with an InfoJobs account. This source reads the public search page instead.
// Its robots.txt allows that page for every crawler except LinkedInBot and
// jobrapido, and this source follows robots.txt. Its terms of use could not be
// read by a script (the legal page refuses automated access), and job boards
// usually forbid automated extraction: like LinkedIn, it is for one person's own
// search at low volume, at their own risk. See docs/sources.md.

import { jsonFromStringLiteral } from "../lib/embedded.ts";
import type { SearchSettings } from "../lib/settings.ts";
import { normalise, stripContacts } from "../lib/text.ts";
import type { Offer } from "../lib/types.ts";

const SEARCH_URL = "https://www.infojobs.net/jobsearch/search-results/list.xhtml";
const PROPS_MARKER = "window.__INITIAL_PROPS__ = JSON.parse(";

// InfoJobs' own province ids, read from its search filters on 2026-11-15.
// The key is the normalised name; places not listed search all of Spain.
const PROVINCES: Record<string, string> = {
  "a coruna": "28", "la coruna": "28", "alava": "2", "araba": "2", "albacete": "3", "alicante": "4", "alacant": "4",
  "almeria": "5", "asturias": "6", "avila": "7", "badajoz": "8", "barcelona": "9", "burgos": "10", "caceres": "11",
  "cadiz": "12", "cantabria": "13", "castellon": "14", "castello": "14", "ceuta": "15", "ciudad real": "16",
  "cordoba": "17", "cuenca": "18", "girona": "19", "gerona": "19", "las palmas": "20", "gran canaria": "20",
  "granada": "21", "guadalajara": "22", "guipuzcoa": "23", "gipuzkoa": "23", "huelva": "24", "huesca": "25",
  "islas baleares": "26", "illes balears": "26", "baleares": "26", "mallorca": "26", "jaen": "27", "la rioja": "29",
  "leon": "30", "lleida": "31", "lerida": "31", "lugo": "32", "madrid": "33", "malaga": "34", "murcia": "36",
  "navarra": "37", "ourense": "38", "orense": "38", "palencia": "39", "pontevedra": "40", "vigo": "40",
  "salamanca": "41", "segovia": "42", "sevilla": "43", "soria": "44", "tarragona": "45",
  "santa cruz de tenerife": "46", "tenerife": "46", "teruel": "47", "toledo": "48", "valencia": "49",
  "valladolid": "50", "vizcaya": "51", "bizkaia": "51", "bilbao": "51", "zamora": "52", "zaragoza": "53",
  "san sebastian": "23", "donostia": "23", "vitoria": "2", "gasteiz": "2", "pamplona": "37", "oviedo": "6",
  "gijon": "6", "santander": "13", "logrono": "29", "palma": "26",
};

// InfoJobs' teleworking filter: 1 on-site, 2 remote only, 3 hybrid.
const TELEWORKING: Record<string, string> = { onsite: "1", remote: "2", hybrid: "3" };

// The province of a place such as "Madrid", "Madrid, Spain" or "Valencia, Comunidad Valenciana".
// Returns null for a whole country ("Spain") or a place InfoJobs does not list.
export function infojobsProvince(place: string): string | null {
  for (const part of place.split(/[,/]/)) {
    const id = PROVINCES[normalise(part).replace(/-/g, " ")];
    if (id) return id;
  }
  return null;
}

// InfoJobs' "published since" filter has three steps: 24 hours, 7 days, 15 days.
function sinceDate(maxAgeDays: number): string {
  if (maxAgeDays <= 1) return "_24_HOURS";
  if (maxAgeDays <= 7) return "_7_DAYS";
  return "_15_DAYS";
}

// One URL per search term and province. Places without a province (a country)
// collapse into one search of all of Spain.
export function infojobsSearchUrls(search: SearchSettings, maxQueries: number): string[] {
  const provinces = [...new Set(search.searchLocations.map(infojobsProvince))];
  if (provinces.length === 0) provinces.push(null);
  const urls: string[] = [];
  for (const query of search.queries.slice(0, maxQueries)) {
    for (const province of provinces) {
      const params = new URLSearchParams({ keyword: query });
      if (province) params.set("provinceIds", province);
      params.set("sinceDate", sinceDate(search.maxAgeDays));
      const teleworking = TELEWORKING[search.workplace.toLowerCase()];
      if (teleworking) params.set("teleworkingIds", teleworking);
      urls.push(`${SEARCH_URL}?${params.toString()}`);
    }
  }
  return urls;
}

// The fields we use from one offer in the embedded JSON.
type InfojobsOffer = {
  code?: string;
  title?: string;
  description?: string;
  city?: string;
  link?: string;
  contractType?: string;
  workday?: string;
  teleworking?: string;
  publishedAt?: string;
  companyName?: string;
  salaryDescription?: string;
};

// The offers in one search page, or null if the page has no search results
// (for example a captcha page).
export function parseInfojobsPage(html: string): InfojobsOffer[] | null {
  const props = jsonFromStringLiteral(html, PROPS_MARKER) as { offers?: unknown } | null;
  if (!props || !Array.isArray(props.offers)) return null;
  return props.offers as InfojobsOffer[];
}

// The offer's page without tracking parameters ("?applicationOrigin=...").
function cleanLink(link: string): string {
  const absolute = link.startsWith("//") ? "https:" + link : link;
  return absolute.split("?")[0];
}

export function normaliseInfojobs(offers: InfojobsOffer[], aiBlocked: boolean): Offer[] {
  const result: Offer[] = [];
  for (const job of offers) {
    if (!job.code || !job.title || !job.link) continue;
    const url = cleanLink(job.link);
    const remote = /solo teletrabajo/i.test(job.teleworking ?? "");
    result.push({
      id: `infojobs:${job.code}`,
      source: "infojobs",
      sourceName: "InfoJobs",
      title: job.title.trim(),
      // Some employers publish without their name.
      company: job.companyName?.trim() || "Company not named",
      url,
      applyUrl: url, // candidates apply on the InfoJobs offer page
      locations: [job.city ? `${job.city.trim()}, Spain` : "Spain"],
      tags: [job.teleworking, remote ? "Remote" : undefined].filter((t): t is string => Boolean(t)),
      employmentType: [job.contractType, job.workday].filter(Boolean).join(", ") || undefined,
      salary: job.salaryDescription?.trim() || undefined,
      postedAt: job.publishedAt ? new Date(job.publishedAt).toISOString() : new Date(0).toISOString(),
      description: aiBlocked ? "" : stripContacts((job.description ?? "").trim()),
      aiBlocked,
    });
  }
  return result;
}
