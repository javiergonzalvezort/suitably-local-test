// Loads the two settings files: the user's search.json and config/sources.json.

import fs from "node:fs";
import path from "node:path";
import { readJson, REPO_ROOT } from "./workspace.ts";
import type { SourceLimits } from "./http.ts";
import type { ExtraSource } from "../sources/custom.ts";

export type SearchSettings = {
  queries: string[]; // sent to the sources
  titleKeywords: string[]; // an offer must contain one of these in its title or tags
  excludeKeywords: string[]; // an offer with one of these in its title is dropped
  allowedLocations: string[]; // offers restricted to other places are dropped
  searchLocations: string[]; // places sent to sources that search by place (LinkedIn, InfoJobs, Indeed), e.g. "Spain", "Madrid, Spain"
  workplace: string; // LinkedIn and InfoJobs filter: "remote", "hybrid", "onsite", or "" for any
  maxAgeDays: number;
  shortlistSize: number;
  extraSources: ExtraSource[]; // complementary sources the user chose and check-source found viable
};

export type SourceConfig = SourceLimits & {
  name: string;
  enabled: boolean; // false turns the source off
  maxQueries: number;
  maxDetails?: number; // LinkedIn: how many job pages to open per run
};

export const DEFAULT_SEARCH: SearchSettings = {
  queries: [],
  titleKeywords: [],
  excludeKeywords: [],
  allowedLocations: [],
  searchLocations: [],
  workplace: "",
  maxAgeDays: 7,
  shortlistSize: 20,
  extraSources: [],
};

// A complementary source needs an id, a name, and an https search URL with {query}.
// Anything else (for example the plain ids of an older version) is ignored.
export function validExtraSources(raw: unknown): ExtraSource[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (s): s is ExtraSource =>
      Boolean(s) &&
      typeof s === "object" &&
      typeof s.id === "string" &&
      /^[a-z0-9-]+$/.test(s.id) &&
      typeof s.name === "string" &&
      typeof s.searchUrl === "string" &&
      s.searchUrl.startsWith("https://") &&
      s.searchUrl.includes("{query}"),
  );
}

export function loadSearchSettings(file: string): SearchSettings {
  if (!fs.existsSync(file)) {
    throw new Error(`${file} not found. Run "npm run init-workspace" and set up your profile first.`);
  }
  const saved = readJson<Partial<SearchSettings>>(file);
  return { ...DEFAULT_SEARCH, ...saved, extraSources: validExtraSources(saved.extraSources) };
}

export function loadSources(): Record<string, SourceConfig> {
  const config = readJson<{ sources: Record<string, SourceConfig> }>(path.join(REPO_ROOT, "config", "sources.json"));
  return config.sources;
}

// The default sources a run uses: every enabled one, or only `only` (--source).
export function activeSources(sources: Record<string, SourceConfig>, only?: string): [string, SourceConfig][] {
  return Object.entries(sources).filter(([id, source]) => source.enabled && (!only || id === only));
}
