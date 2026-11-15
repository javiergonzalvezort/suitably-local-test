// Checks whether a job site the user chose can work as a complementary source,
// with one request (plus its robots.txt), before the agent adds it to
// "extraSources" in search.json. It checks that:
//   - robots.txt allows the search page and does not opt out of AI agents;
//   - the page answers without a login, a captcha, or a bot check;
//   - the page shows offers for the search term: as JobPosting data, or as text.
// It cannot read a site's terms of use: the agent tells the user so.
//
// Usage: npm run check-source -- --url "https://site.example/jobs?q={query}" --query "fisioterapeuta" [--place "Madrid"] [--workspace <folder>]

import { parseArgs, stringOption } from "./lib/args.ts";
import { PoliteClient, SourceError } from "./lib/http.ts";
import { isMain } from "./lib/main.ts";
import { workspacePaths } from "./lib/workspace.ts";
import { assessPage, CUSTOM_LIMITS, fillSearchUrl } from "./sources/custom.ts";

export type CheckResult = {
  viable: boolean;
  url: string;
  mode?: "structured" | "page"; // how find-offers will read it
  reasons: string[]; // why not viable, or what to know
};

// The search URL must be https, carry {query}, and have no login or account path.
export function urlProblems(template: string): string[] {
  const problems: string[] = [];
  let url: URL;
  try {
    url = new URL(template.replaceAll("{query}", "x").replaceAll("{place}", "y"));
  } catch {
    return ["not a valid URL"];
  }
  if (url.protocol !== "https:") problems.push("the URL must start with https://");
  if (!template.includes("{query}")) problems.push("the URL needs {query} where the search term goes");
  if (/login|signin|sign-in|account|cuenta|acceso|mi-area|candidato\/area/i.test(url.pathname)) {
    problems.push("the URL points to a login or account page");
  }
  return problems;
}

export async function checkSource(client: PoliteClient, template: string, query: string, place: string): Promise<CheckResult> {
  const problems = urlProblems(template);
  const url = problems.length === 0 ? fillSearchUrl(template, query, place) : template;
  if (problems.length > 0) return { viable: false, url, reasons: problems };
  const host = new URL(url).host;
  let html: string;
  try {
    const result = await client.getText(`check:${host}`, url, { ...CUSTOM_LIMITS, cacheHours: 1 });
    if (result.aiBlocked) {
      return { viable: false, url, reasons: ["its robots.txt opts out of AI agents, so its offers could never reach the agent"] };
    }
    html = result.data;
  } catch (error) {
    if (!(error instanceof SourceError)) throw error;
    return { viable: false, url, reasons: [error.message] };
  }
  const page = assessPage(html, query);
  if (page.problems.length > 0) return { viable: false, url, reasons: page.problems };
  if (page.jobPostings > 0) {
    return { viable: true, url, mode: "structured", reasons: [`the page carries ${page.jobPostings} offers as JobPosting data: the script reads them directly`] };
  }
  return {
    viable: true,
    url,
    mode: "page",
    reasons: [`the search term appears ${page.queryMentions} times in the page text: after each search, the agent reads the saved page and extracts the offers`],
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const template = stringOption(args, "url");
  const query = stringOption(args, "query");
  if (!template || !query) {
    console.error('Usage: npm run check-source -- --url "https://site.example/jobs?q={query}" --query "search term" [--place "Madrid"]');
    process.exit(1);
  }
  const paths = workspacePaths(stringOption(args, "workspace"));
  const client = new PoliteClient({ cacheDir: paths.cacheDir });
  const result = await checkSource(client, template, query, stringOption(args, "place") ?? "");
  console.log(`${result.viable ? "VIABLE" : "NOT VIABLE"}: ${result.url}`);
  for (const reason of result.reasons) console.log(`- ${reason}`);
  if (result.viable) console.log("Its terms of use were not checked: the user decides whether to use it, for their own search only.");
  process.exitCode = result.viable ? 0 : 2;
}

if (isMain(import.meta.url)) {
  await main();
}
