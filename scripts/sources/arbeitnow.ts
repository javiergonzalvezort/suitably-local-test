// Arbeitnow (https://www.arbeitnow.com/api/job-board-api): free public JSON API,
// the 300 newest jobs in one request, mostly in Germany and remote in Europe.
// Terms: personal, non-commercial use; link back to Arbeitnow. The API can be
// withdrawn at any time ("please do not abuse").

import type { Offer } from "../lib/types.ts";
import { htmlToText, stripContacts } from "../lib/text.ts";

export const ARBEITNOW_URL = "https://www.arbeitnow.com/api/job-board-api";

type ArbeitnowJob = {
  slug?: string;
  company_name?: string;
  title?: string;
  description?: string;
  remote?: boolean;
  url?: string;
  tags?: string[];
  job_types?: string[];
  location?: string;
  created_at?: number; // seconds
};

export function normaliseArbeitnow(data: unknown, aiBlocked: boolean): Offer[] {
  const jobs = (data as { data?: ArbeitnowJob[] } | null)?.data;
  if (!Array.isArray(jobs)) return [];
  const offers: Offer[] = [];
  for (const job of jobs) {
    if (!job.slug || !job.title || !job.company_name || !job.url) continue;
    offers.push({
      id: `arbeitnow:${job.slug}`,
      source: "arbeitnow",
      sourceName: "Arbeitnow",
      title: job.title.trim(),
      company: job.company_name.trim(),
      url: job.url,
      applyUrl: job.url,
      // A remote job does not say from where; an on-site one names a city.
      locations: job.remote || !job.location ? [] : [job.location],
      tags: [...(job.tags ?? []), ...(job.remote ? ["Remote"] : [])],
      employmentType: job.job_types?.join(", ") || undefined,
      postedAt: job.created_at ? new Date(job.created_at * 1000).toISOString() : new Date(0).toISOString(),
      description: aiBlocked ? "" : stripContacts(htmlToText(job.description ?? "")),
      aiBlocked,
    });
  }
  return offers;
}
