import fs from "node:fs";
import path from "node:path";

// The repository root is the parent of the scripts/ folder.
// import.meta.dirname is the folder of this file (scripts/lib).
export const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");

// The default personal workspace. Ignored by git.
export const DEFAULT_WORKSPACE = "me";

export type WorkspacePaths = {
  root: string;
  profileDir: string;
  preferences: string;
  search: string;
  offersDir: string;
  fetched: string;
  pasted: string;
  shortlist: string;
  evaluations: string;
  ranking: string;
  applicationsDir: string;
  cacheDir: string;
};

export function workspacePaths(workspace: string | undefined): WorkspacePaths {
  const root = path.resolve(REPO_ROOT, workspace ?? DEFAULT_WORKSPACE);
  const offersDir = path.join(root, "offers");
  return {
    root,
    profileDir: path.join(root, "profile"),
    preferences: path.join(root, "preferences.md"),
    search: path.join(root, "search.json"),
    offersDir,
    fetched: path.join(offersDir, "fetched.json"),
    pasted: path.join(offersDir, "pasted.json"),
    shortlist: path.join(offersDir, "shortlist.json"),
    evaluations: path.join(offersDir, "evaluations.json"),
    ranking: path.join(offersDir, "ranking.md"),
    applicationsDir: path.join(root, "applications"),
    cacheDir: path.join(root, ".cache"),
  };
}

export function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

export function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n", "utf8");
}

// Reads every Markdown file in the profile folder, joined into one text.
// Used by checks that need "everything the profile says".
export function readProfileText(paths: WorkspacePaths): string {
  if (!fs.existsSync(paths.profileDir)) return "";
  const files = fs
    .readdirSync(paths.profileDir)
    .filter((name) => name.endsWith(".md"))
    .sort();
  const parts = files.map((name) => fs.readFileSync(path.join(paths.profileDir, name), "utf8"));
  if (fs.existsSync(paths.preferences)) parts.push(fs.readFileSync(paths.preferences, "utf8"));
  return parts.join("\n\n");
}
