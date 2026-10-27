// A small robots.txt parser following RFC 9309: groups of user agents with
// allow/disallow rules; the most specific (longest) matching rule wins, and
// "allow" wins a tie. Also reads Crawl-delay, which many sites still use.

export type RobotsRule = { allow: boolean; pattern: string };
export type RobotsGroup = { agents: string[]; rules: RobotsRule[]; crawlDelaySeconds?: number };
export type Robots = { groups: RobotsGroup[] };

// User-agent tokens of AI crawlers and AI agents. If a site blocks any of these
// for a path, we treat the site as opting out of AI use: its text is never sent
// to the model (only title, company, and link are kept).
export const AI_AGENT_TOKENS = [
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "anthropic-ai",
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "Google-Extended",
  "CCBot",
  "PerplexityBot",
  "Perplexity-User",
  "Applebot-Extended",
  "meta-externalagent",
];

export function parseRobots(text: string): Robots {
  const groups: RobotsGroup[] = [];
  let current: RobotsGroup | null = null;
  let lastWasAgent = false;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const field = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (field === "user-agent") {
      // Consecutive user-agent lines share one group.
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (field === "allow" || field === "disallow") {
      // An empty Disallow means "nothing is disallowed": no rule to add.
      if (value !== "") current.rules.push({ allow: field === "allow", pattern: value });
    } else if (field === "crawl-delay") {
      const seconds = Number(value);
      if (Number.isFinite(seconds) && seconds >= 0) current.crawlDelaySeconds = seconds;
    }
  }
  return { groups };
}

// The groups that apply to an agent: those naming it, otherwise the "*" groups.
export function groupsFor(robots: Robots, agentToken: string): RobotsGroup[] {
  const token = agentToken.toLowerCase();
  const specific = robots.groups.filter((g) => g.agents.includes(token));
  if (specific.length > 0) return specific;
  return robots.groups.filter((g) => g.agents.includes("*"));
}

function patternToRegExp(pattern: string): RegExp {
  const anchored = pattern.endsWith("$");
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const escaped = body
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp("^" + escaped + (anchored ? "$" : ""));
}

// pathAndQuery: for example "/jobs/api/search?q=data".
export function isAllowed(robots: Robots, agentToken: string, pathAndQuery: string): boolean {
  let best: RobotsRule | null = null;
  for (const group of groupsFor(robots, agentToken)) {
    for (const rule of group.rules) {
      if (!patternToRegExp(rule.pattern).test(pathAndQuery)) continue;
      const longer = !best || rule.pattern.length > best.pattern.length;
      const tieAllow = best !== null && rule.pattern.length === best.pattern.length && rule.allow;
      if (longer || tieAllow) best = rule;
    }
  }
  return best === null || best.allow;
}

export function crawlDelayMs(robots: Robots, agentToken: string): number {
  const delays = groupsFor(robots, agentToken)
    .map((g) => g.crawlDelaySeconds)
    .filter((d): d is number => d !== undefined);
  return delays.length > 0 ? Math.max(...delays) * 1000 : 0;
}

// True when a group written specifically for an AI agent disallows this path.
export function blocksAiAgents(robots: Robots, pathAndQuery: string): boolean {
  return AI_AGENT_TOKENS.some((token) => {
    const hasOwnGroup = robots.groups.some((g) => g.agents.includes(token.toLowerCase()));
    return hasOwnGroup && !isAllowed(robots, token, pathAndQuery);
  });
}
