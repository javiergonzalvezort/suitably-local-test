// Checks that everything needed is installed and set up, and explains how to fix
// what is missing in plain language. Run with: npm run doctor  (add --online to
// also check that the job sources can be reached).

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { APP_NAME, USER_AGENT } from "./lib/app.ts";
import { parseArgs } from "./lib/args.ts";
import { isMain } from "./lib/main.ts";
import { REPO_ROOT, workspacePaths } from "./lib/workspace.ts";

export type Status = "ok" | "warn" | "fail";

export type CheckResult = {
  name: string;
  status: Status;
  detail: string;
  fix?: string;
};

export type Platform = "win32" | "darwin" | "linux";

// Runs a command and returns its output, or null if it could not run.
// Injected into the checks so tests can fake it.
export type CommandRunner = (command: string) => string | null;

export const MIN_NODE = [22, 18, 0];

export function defaultRunner(command: string): string | null {
  // shell: true lets Windows find .cmd wrappers (npm, claude). The commands are
  // fixed strings written in this file, never user input.
  const result = spawnSync(command, { shell: true, encoding: "utf8", cwd: REPO_ROOT });
  if (result.error || result.status !== 0) return null;
  return (result.stdout || result.stderr || "").trim();
}

export function parseVersion(text: string): number[] | null {
  const match = text.match(/(\d+)\.(\d+)(?:\.(\d+))?/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3] ?? 0)];
}

export function isAtLeast(version: number[], minimum: number[]): boolean {
  for (let i = 0; i < minimum.length; i++) {
    const a = version[i] ?? 0;
    if (a > minimum[i]) return true;
    if (a < minimum[i]) return false;
  }
  return true;
}

function installHint(platform: Platform, tool: "git" | "node" | "typst"): string {
  const winget = { git: "Git.Git", node: "OpenJS.NodeJS.LTS", typst: "Typst.Typst" }[tool];
  const brew = { git: "git", node: "node", typst: "typst" }[tool];
  if (platform === "win32") {
    return `Run the installer again (install.ps1), or in PowerShell: winget install --id ${winget} -e. Then close and reopen the terminal.`;
  }
  if (platform === "darwin") {
    return `Run the installer again (install.sh), or in Terminal: brew install ${brew}. Then open a new terminal window.`;
  }
  return `Install ${tool} with your package manager, then open a new terminal.`;
}

export function checkNode(nodeVersion: string, platform: Platform): CheckResult {
  const version = parseVersion(nodeVersion);
  if (version && isAtLeast(version, MIN_NODE)) {
    return { name: "Node.js", status: "ok", detail: `version ${nodeVersion}` };
  }
  return {
    name: "Node.js",
    status: "fail",
    detail: `version ${nodeVersion} is too old (need ${MIN_NODE.join(".")} or newer)`,
    fix: installHint(platform, "node"),
  };
}

export function checkTool(
  run: CommandRunner,
  platform: Platform,
  tool: "git" | "typst",
  purpose: string,
): CheckResult {
  const name = tool === "git" ? "Git" : "Typst";
  const output = run(`${tool} --version`);
  if (output) return { name, status: "ok", detail: output.split("\n")[0] };
  return {
    name,
    status: "fail",
    detail: `not found (needed ${purpose})`,
    fix: installHint(platform, tool),
  };
}

// The agents this project has instructions for. Claude Code is the one tested.
const AGENTS = [
  { command: "claude", label: "Claude Code" },
  { command: "codex", label: "Codex CLI" },
  { command: "gemini", label: "Gemini CLI" },
];

export function checkAgent(run: CommandRunner, platform: Platform): CheckResult {
  const found = AGENTS.filter((agent) => run(`${agent.command} --version`) !== null).map((a) => a.label);
  if (found.length > 0) {
    return { name: "Coding agent", status: "ok", detail: `found: ${found.join(", ")}` };
  }
  const install =
    platform === "win32"
      ? "In PowerShell: irm https://claude.ai/install.ps1 | iex"
      : "In Terminal: curl -fsSL https://claude.ai/install.sh | bash";
  return {
    name: "Coding agent",
    status: "fail",
    detail: "no supported agent found (Claude Code is recommended; it needs a paid Claude plan)",
    fix: `Install Claude Code. ${install}. Then run "claude" once and sign in. Official guide: https://docs.claude.com/en/docs/claude-code/setup`,
  };
}

export function checkHooks(run: CommandRunner): CheckResult {
  const insideRepo = run("git rev-parse --is-inside-work-tree");
  if (insideRepo !== "true") {
    return {
      name: "Privacy check for commits",
      status: "warn",
      detail: "this folder is not a git repository, so there is nothing to protect yet",
    };
  }
  const hooksPath = run("git config core.hooksPath");
  if (hooksPath === ".githooks") {
    return { name: "Privacy check for commits", status: "ok", detail: "pre-commit hook is on" };
  }
  return {
    name: "Privacy check for commits",
    status: "warn",
    detail: "the pre-commit hook that blocks personal files is off",
    fix: "Run: git config core.hooksPath .githooks",
  };
}

export function checkIgnored(run: CommandRunner): CheckResult {
  if (run("git rev-parse --is-inside-work-tree") !== "true") {
    return { name: "Personal folder ignored by git", status: "warn", detail: "not a git repository" };
  }
  const ignored = run("git check-ignore me/profile/about.md");
  if (ignored) return { name: "Personal folder ignored by git", status: "ok", detail: "me/ is ignored" };
  return {
    name: "Personal folder ignored by git",
    status: "fail",
    detail: "me/ is NOT ignored by git, so your data could be committed",
    fix: 'Restore the line "/me/" in .gitignore (git checkout .gitignore).',
  };
}

export function checkWorkspace(workspaceRoot: string): CheckResult {
  const name = "Your workspace (me/)";
  if (!fs.existsSync(workspaceRoot)) {
    return { name, status: "warn", detail: "not created yet", fix: "Run: npm run init-workspace" };
  }
  const about = path.join(workspaceRoot, "profile", "about.md");
  const text = fs.existsSync(about) ? fs.readFileSync(about, "utf8") : "";
  if (text.includes("TODO")) {
    return {
      name,
      status: "warn",
      detail: "profile not filled in yet",
      fix: 'Open the project in your agent and ask: "Set up my profile". Or try the sample first: npm run demo',
    };
  }
  return { name, status: "ok", detail: "profile found" };
}

async function checkSourcesOnline(): Promise<CheckResult> {
  const urls = ["https://himalayas.app/robots.txt", "https://remoteok.com/robots.txt"];
  const failed: string[] = [];
  for (const url of urls) {
    try {
      const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
      if (!response.ok) failed.push(`${url} (HTTP ${response.status})`);
    } catch {
      failed.push(url);
    }
  }
  if (failed.length === 0) return { name: "Job sources reachable", status: "ok", detail: "Himalayas, Remote OK" };
  return {
    name: "Job sources reachable",
    status: "warn",
    detail: `could not reach: ${failed.join(", ")}`,
    fix: "Check your internet connection. A company network or VPN may block these sites.",
  };
}

export function runChecks(run: CommandRunner, platform: Platform, nodeVersion: string, workspaceRoot: string) {
  return [
    checkNode(nodeVersion, platform),
    checkTool(run, platform, "git", "to download and update the project"),
    checkTool(run, platform, "typst", "to turn CVs and cover letters into PDF"),
    checkAgent(run, platform),
    checkHooks(run),
    checkIgnored(run),
    checkWorkspace(workspaceRoot),
  ];
}

export function formatReport(results: CheckResult[]): string {
  const icon: Record<Status, string> = { ok: "[ OK ]", warn: "[WARN]", fail: "[FAIL]" };
  const lines = results.map((r) => {
    const line = `${icon[r.status]} ${r.name}: ${r.detail}`;
    return r.fix ? `${line}\n       How to fix: ${r.fix}` : line;
  });
  const failures = results.filter((r) => r.status === "fail").length;
  const warnings = results.filter((r) => r.status === "warn").length;
  const summary =
    failures > 0
      ? `${failures} problem(s) must be fixed before you start.`
      : warnings > 0
        ? "Ready to go, with notes above."
        : "Everything is ready.";
  return [`${APP_NAME} doctor`, "", ...lines, "", summary].join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const platform = (["win32", "darwin"].includes(process.platform) ? process.platform : "linux") as Platform;
  const workspace = typeof args.options.workspace === "string" ? args.options.workspace : undefined;
  const results = runChecks(defaultRunner, platform, process.versions.node, workspacePaths(workspace).root);
  if (args.options.online) results.push(await checkSourcesOnline());
  console.log(formatReport(results));
  process.exitCode = results.some((r) => r.status === "fail") ? 1 : 0;
}

// Only run when called directly (node scripts/doctor.ts), not when imported by tests.
if (isMain(import.meta.url)) {
  await main();
}
