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
  maxAgeDays: number;
  shortlistSize: number;
};

export type SourceConfig = SourceLimits & {
  name: string;
  enabled: boolean;
  maxQueries: number;
};

export const DEFAULT_SEARCH: SearchSettings = {
  queries: [],
  titleKeywords: [],
  excludeKeywords: [],
  allowedLocations: [],
  maxAgeDays: 30,
  shortlistSize: 20,
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
