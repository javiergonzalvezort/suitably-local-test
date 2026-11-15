// Loads the two settings files: the user's search.json and config/sources.json.

import fs from "node:fs";
import path from "node:path";
import { readJson, REPO_ROOT } from "./workspace.ts";
import type { SourceLimits } from "./http.ts";

export type SearchSettings = {
  queries: string[]; // sent to the sources
  titleKeywords: string[]; // an offer must contain one of these in its title or tags
  excludeKeywords: string[]; // an offer with one of these in its title is dropped
  allowedLocations: string[]; // offers restricted to other places are dropped
  searchLocations: string[]; // places sent to sources that search by place (LinkedIn, InfoJobs, Indeed), e.g. "Spain", "Madrid, Spain"
  workplace: string; // LinkedIn and InfoJobs filter: "remote", "hybrid", "onsite", or "" for any
  maxAgeDays: number;
  shortlistSize: number;
  extraSources: string[]; // complementary sources the user chose, on top of the default ones (ids from config/sources.json)
};

export type SourceConfig = SourceLimits & {
  name: string;
  enabled: boolean; // false turns the source off for everyone, even if a user chose it
  default: boolean; // true: searched for every user; false: complementary, only if listed in extraSources
  goodFor?: string; // for complementary sources: which profiles it suits, shown by the setup skill
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

export function loadSearchSettings(file: string): SearchSettings {
  if (!fs.existsSync(file)) {
    throw new Error(`${file} not found. Run "npm run init-workspace" and set up your profile first.`);
  }
  return { ...DEFAULT_SEARCH, ...readJson<Partial<SearchSettings>>(file) };
}

export function loadSources(): Record<string, SourceConfig> {
  const config = readJson<{ sources: Record<string, SourceConfig> }>(path.join(REPO_ROOT, "config", "sources.json"));
  return config.sources;
}

// The sources a run uses: the default ones plus the complementary ones the user
// chose in search.json, leaving out any source switched off in config/sources.json.
// With --source, only that one (default or not), so a single source can be retried.
export function activeSources(
  sources: Record<string, SourceConfig>,
  search: SearchSettings,
  only?: string,
): [string, SourceConfig][] {
  return Object.entries(sources).filter(([id, source]) => {
    if (!source.enabled) return false;
    if (only) return id === only;
    return source.default || search.extraSources.includes(id);
  });
}
