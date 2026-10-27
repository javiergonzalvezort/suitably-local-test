// A polite HTTP client for job sources. Before each request it:
//   1. answers from the local cache when a fresh copy exists (no request at all),
//   2. checks the site's robots.txt and refuses disallowed paths,
//   3. waits so requests to one host are at least minDelayMs (or Crawl-delay) apart,
//   4. counts requests per source per day and stops at the daily cap.
// One request at a time: the scripts await each call before the next.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { APP_NAME, USER_AGENT } from "./app.ts";
import { blocksAiAgents, crawlDelayMs, isAllowed, parseRobots } from "./robots.ts";
import type { Robots } from "./robots.ts";

export type SourceLimits = {
  minDelayMs: number;
  dailyRequestCap: number;
  cacheHours: number;
};

export type JsonResult = {
  data: unknown;
  fromCache: boolean;
  aiBlocked: boolean; // the site opts out of AI agents for this path
};

export class SourceError extends Error {}

type FetchFn = (url: string, init: { headers: Record<string, string> }) => Promise<Response>;

export type ClientOptions = {
  cacheDir: string;
  fetchFn?: FetchFn; // tests pass a fake
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

const ROBOTS_CACHE_HOURS = 24;

export class PoliteClient {
  private cacheDir: string;
  private fetchFn: FetchFn;
  private now: () => number;
  private sleep: (ms: number) => Promise<void>;
  private lastRequestAt = new Map<string, number>();
  private robotsByOrigin = new Map<string, Robots>();

  constructor(options: ClientOptions) {
    this.cacheDir = options.cacheDir;
    this.fetchFn = options.fetchFn ?? ((url, init) => fetch(url, init));
    this.now = options.now ?? (() => Date.now());
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  async getJson(sourceId: string, url: string, limits: SourceLimits): Promise<JsonResult> {
    const cached = this.readCache(url, limits.cacheHours);
    if (cached) return { ...cached, fromCache: true };

    const target = new URL(url);
    const robots = await this.robotsFor(target.origin, limits);
    const pathAndQuery = target.pathname + target.search;
    if (!isAllowed(robots, APP_NAME, pathAndQuery)) {
      throw new SourceError(`robots.txt of ${target.host} does not allow ${pathAndQuery}; skipped`);
    }
    const aiBlocked = blocksAiAgents(robots, pathAndQuery);

    this.countRequest(sourceId, limits.dailyRequestCap);
    const delay = Math.max(limits.minDelayMs, crawlDelayMs(robots, APP_NAME));
    const response = await this.politeFetch(url, delay, "application/json");
    if (response.status === 429) {
      throw new SourceError(`${target.host} asked us to slow down (HTTP 429). Try again later.`);
    }
    if (!response.ok) throw new SourceError(`${target.host} answered HTTP ${response.status}`);
    const data: unknown = await response.json();
    this.writeCache(url, { data, aiBlocked });
    return { data, fromCache: false, aiBlocked };
  }

  private async politeFetch(url: string, delayMs: number, accept: string): Promise<Response> {
    const host = new URL(url).host;
    const last = this.lastRequestAt.get(host);
    if (last !== undefined) {
      const wait = last + delayMs - this.now();
      if (wait > 0) await this.sleep(wait);
    }
    this.lastRequestAt.set(host, this.now());
    try {
      return await this.fetchFn(url, { headers: { "User-Agent": USER_AGENT, Accept: accept } });
    } catch (error) {
      throw new SourceError(`could not reach ${host}: ${(error as Error).message}`);
    }
  }

  private async robotsFor(origin: string, limits: SourceLimits): Promise<Robots> {
    const known = this.robotsByOrigin.get(origin);
    if (known) return known;

    const file = path.join(this.cacheDir, "robots", new URL(origin).host + ".txt");
    let text: string | null = null;
    if (fs.existsSync(file) && this.now() - fs.statSync(file).mtimeMs < ROBOTS_CACHE_HOURS * 3_600_000) {
      text = fs.readFileSync(file, "utf8");
    } else {
      const response = await this.politeFetch(origin + "/robots.txt", limits.minDelayMs, "text/plain");
      if (response.ok) {
        text = await response.text();
      } else if (response.status >= 400 && response.status < 500) {
        text = ""; // RFC 9309: no robots.txt (4xx) means everything is allowed
      } else {
        // RFC 9309: a server error means we must assume everything is disallowed.
        throw new SourceError(`could not read robots.txt of ${origin} (HTTP ${response.status}); skipped`);
      }
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, text, "utf8");
    }
    const robots = parseRobots(text);
    this.robotsByOrigin.set(origin, robots);
    return robots;
  }

  private countRequest(sourceId: string, cap: number): void {
    const day = new Date(this.now()).toISOString().slice(0, 10);
    const file = path.join(this.cacheDir, `requests-${day}.json`);
    const counts: Record<string, number> = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
    const used = counts[sourceId] ?? 0;
    if (used >= cap) {
      throw new SourceError(`daily limit of ${cap} requests reached for ${sourceId}; cached results are still used`);
    }
    counts[sourceId] = used + 1;
    fs.mkdirSync(this.cacheDir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(counts, null, 2), "utf8");
  }

  private cacheFile(url: string): string {
    const key = crypto.createHash("sha256").update(url).digest("hex").slice(0, 32);
    return path.join(this.cacheDir, "http", key + ".json");
  }

  private readCache(url: string, cacheHours: number): { data: unknown; aiBlocked: boolean } | null {
    const file = this.cacheFile(url);
    if (!fs.existsSync(file)) return null;
    const entry = JSON.parse(fs.readFileSync(file, "utf8")) as { fetchedAt: number; data: unknown; aiBlocked: boolean };
    if (this.now() - entry.fetchedAt > cacheHours * 3_600_000) return null;
    return { data: entry.data, aiBlocked: entry.aiBlocked };
  }

  private writeCache(url: string, value: { data: unknown; aiBlocked: boolean }): void {
    const file = this.cacheFile(url);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ url, fetchedAt: this.now(), ...value }), "utf8");
  }
}
