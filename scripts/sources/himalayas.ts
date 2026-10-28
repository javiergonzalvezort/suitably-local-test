// Himalayas (https://himalayas.app/api): official public JSON API for remote jobs.
// Terms: name Himalayas and link to the job page, keep applicationLink unchanged,
// drop expired jobs, never pass the offers on to other boards (terms clause 113).
//
// Only the first page of each search is requested: Himalayas' robots.txt
// disallows paths with "&page=" or "?page=", and we follow it for the API too.

import type { Offer } from "../lib/types.ts";
import { htmlToText, stripContacts } from "../lib/text.ts";

export function himalayasSearchUrl(query: string): string {
  return `https://himalayas.app/jobs/api/search?q=${encodeURIComponent(query)}&sort=recent`;
}

// The fields we use from one job in the API answer.
type HimalayasJob = {
  title?: string;
  companyName?: string;
  excerpt?: string;
  description?: string;
  employmentType?: string;
  seniority?: string[];
  minSalary?: number | null;
  maxSalary?: number | null;
  currency?: string | null;
  salaryPeriod?: string | null;
  locationRestrictions?: string[];
  categories?: string[];
  pubDate?: number; // seconds since 1970
  expiryDate?: number;
  applicationLink?: string;
  guid?: string;
};

function salaryText(job: HimalayasJob): string | undefined {
  if (!job.minSalary && !job.maxSalary) return undefined;
  const range = [job.minSalary, job.maxSalary].filter((n) => n).map((n) => Number(n).toLocaleString("en")).join(" to ");
  return [range, job.currency ?? "", job.salaryPeriod ? `(${job.salaryPeriod})` : ""].filter(Boolean).join(" ");
}

export function normaliseHimalayas(data: unknown, aiBlocked: boolean): Offer[] {
  const jobs = (data as { jobs?: HimalayasJob[] })?.jobs;
  if (!Array.isArray(jobs)) return [];
  const offers: Offer[] = [];
  for (const job of jobs) {
    if (!job.guid || !job.title || !job.companyName) continue;
    const text = stripContacts(htmlToText(job.description || job.excerpt || ""));
    offers.push({
      id: "himalayas:" + job.guid.replace(/^https?:\/\/[^/]+\//, ""),
      source: "himalayas",
      sourceName: "Himalayas",
      title: job.title,
      company: job.companyName,
      url: job.guid,
      applyUrl: job.applicationLink || job.guid,
      locations: job.locationRestrictions ?? [],
      tags: (job.categories ?? []).map((c) => c.replace(/-/g, " ")),
      seniority: job.seniority?.join(", ") || undefined,
      employmentType: job.employmentType || undefined,
      salary: salaryText(job),
      postedAt: new Date((job.pubDate ?? 0) * 1000).toISOString(),
      expiresAt: job.expiryDate ? new Date(job.expiryDate * 1000).toISOString() : undefined,
      description: aiBlocked ? "" : text,
      aiBlocked,
    });
  }
  return offers;
}
