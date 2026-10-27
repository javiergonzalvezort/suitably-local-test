// Remote OK (https://remoteok.com/api): official public JSON API with the latest
// remote jobs, in one request. Terms: name Remote OK as the source and link to
// the Remote OK job page; do not use the Remote OK logo.
// The first item of the answer is a legal notice, not a job.

import type { Offer } from "../lib/types.ts";
import { htmlToText, stripContacts } from "../lib/text.ts";

export const REMOTEOK_URL = "https://remoteok.com/api";

type RemoteOkJob = {
  id?: string | number;
  position?: string;
  company?: string;
  description?: string;
  tags?: string[];
  location?: string;
  salary_min?: number;
  salary_max?: number;
  date?: string;
  url?: string;
  apply_url?: string;
};

export function normaliseRemoteOk(data: unknown, aiBlocked: boolean): Offer[] {
  if (!Array.isArray(data)) return [];
  const offers: Offer[] = [];
  for (const job of data as RemoteOkJob[]) {
    if (!job.id || !job.position || !job.company || !job.url) continue;
    const salary =
      job.salary_min || job.salary_max
        ? `${[job.salary_min, job.salary_max].filter((n) => n).map((n) => Number(n).toLocaleString("en")).join(" to ")} USD a year`
        : undefined;
    offers.push({
      id: `remoteok:${job.id}`,
      source: "remoteok",
      sourceName: "Remote OK",
      title: job.position.trim(),
      company: job.company.trim(),
      url: job.url,
      applyUrl: job.apply_url || job.url,
      locations: job.location ? [job.location] : [],
      tags: job.tags ?? [],
      salary,
      postedAt: job.date ? new Date(job.date).toISOString() : new Date(0).toISOString(),
      description: aiBlocked ? "" : stripContacts(htmlToText(job.description ?? "")),
      aiBlocked,
    });
  }
  return offers;
}
