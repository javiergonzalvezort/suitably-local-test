// Turns applications/log.json into applications.xlsx: one row per application,
// with what the user sent and declared, so they can keep the story consistent
// in interviews. The agent keeps log.json up to date; this script only renders it.
// Usage: npm run applications [-- --workspace <folder>]

import fs from "node:fs";
import path from "node:path";
import { parseArgs, stringOption } from "./lib/args.ts";
import { isMain } from "./lib/main.ts";
import type { Application, ApplicationStatus } from "./lib/types.ts";
import { readJson, workspacePaths } from "./lib/workspace.ts";
import { xlsx } from "./lib/xlsx.ts";

export const STATUSES: ApplicationStatus[] = ["prepared", "applied", "interview", "offer", "rejected", "withdrawn"];

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function validateApplications(raw: unknown): { applications: Application[]; errors: string[] } {
  const errors: string[] = [];
  if (!Array.isArray(raw)) return { applications: [], errors: ["log.json must be a JSON array"] };
  raw.forEach((item: Record<string, unknown>, index) => {
    const where = `item ${index + 1} (${String(item?.company ?? "no company")}, ${String(item?.role ?? "no role")})`;
    for (const field of ["offerId", "company", "role", "sourceName", "url", "folder", "offerSummary"]) {
      if (typeof item?.[field] !== "string") errors.push(`${where}: "${field}" must be text`);
    }
    if (!STATUSES.includes(item?.status as ApplicationStatus)) {
      errors.push(`${where}: "status" must be one of ${STATUSES.join(", ")}`);
    }
    if (typeof item?.preparedAt !== "string" || !DATE.test(item.preparedAt)) {
      errors.push(`${where}: "preparedAt" must be a date as YYYY-MM-DD`);
    }
    if (item?.appliedAt !== undefined && (typeof item.appliedAt !== "string" || !DATE.test(item.appliedAt))) {
      errors.push(`${where}: "appliedAt" must be a date as YYYY-MM-DD`);
    }
    if (item?.status !== "prepared" && item?.status !== "withdrawn" && item?.appliedAt === undefined) {
      errors.push(`${where}: "appliedAt" is needed once the status is past "prepared"`);
    }
    if (!Array.isArray(item?.keyPoints)) errors.push(`${where}: "keyPoints" must be a list (use [] if empty)`);
    const declared = item?.declared;
    if (!Array.isArray(declared)) {
      errors.push(`${where}: "declared" must be a list (use [] if nothing was declared)`);
    } else {
      declared.forEach((d: Record<string, unknown>, i) => {
        if (typeof d?.label !== "string" || typeof d?.value !== "string") {
          errors.push(`${where}: declared item ${i + 1} needs "label" and "value"`);
        }
      });
    }
  });
  return { applications: errors.length === 0 ? (raw as Application[]) : [], errors };
}

const COLUMNS: { title: string; width: number; value: (a: Application) => string }[] = [
  { title: "Applied on", width: 12, value: (a) => a.appliedAt ?? "" },
  { title: "Status", width: 11, value: (a) => a.status },
  { title: "Company", width: 22, value: (a) => a.company },
  { title: "Role", width: 30, value: (a) => a.role },
  { title: "Location", width: 18, value: (a) => a.location ?? "" },
  { title: "What the job is", width: 50, value: (a) => a.offerSummary },
  { title: "What you said (CV and letter)", width: 60, value: (a) => a.keyPoints.map((p) => `• ${p}`).join("\n") },
  { title: "What you declared", width: 40, value: (a) => a.declared.map((d) => `${d.label}: ${d.value}`).join("\n") },
  { title: "Next step", width: 30, value: (a) => a.nextStep ?? "" },
  { title: "Notes", width: 40, value: (a) => a.notes ?? "" },
  { title: "Offer link", width: 40, value: (a) => `${a.url} (via ${a.sourceName})` },
  { title: "Folder", width: 40, value: (a) => a.folder },
  { title: "Prepared on", width: 12, value: (a) => a.preparedAt },
];

// Newest first: sent applications by date sent, then the ones not sent yet.
export function applicationRows(applications: Application[]): string[][] {
  const sorted = [...applications].sort((a, b) =>
    (b.appliedAt ?? b.preparedAt).localeCompare(a.appliedAt ?? a.preparedAt),
  );
  return [COLUMNS.map((c) => c.title), ...sorted.map((a) => COLUMNS.map((c) => c.value(a)))];
}

export function writeApplicationsWorkbook(applications: Application[], file: string): void {
  const book = xlsx(applicationRows(applications), {
    sheetName: "Applications",
    columnWidths: COLUMNS.map((c) => c.width),
  });
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, book);
}

if (isMain(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const paths = workspacePaths(stringOption(args, "workspace"));
  const logFile = path.join(paths.applicationsDir, "log.json");
  const output = path.join(paths.applicationsDir, "applications.xlsx");
  if (!fs.existsSync(logFile)) {
    console.log(`No applications logged yet (${logFile} does not exist).`);
    process.exit(0);
  }
  const { applications, errors } = validateApplications(readJson<unknown>(logFile));
  if (errors.length > 0) {
    console.error(`log.json has problems:\n- ${errors.join("\n- ")}`);
    process.exit(1);
  }
  try {
    writeApplicationsWorkbook(applications, output);
  } catch (error) {
    // Windows locks a file that is open in Excel.
    if ((error as NodeJS.ErrnoException).code === "EBUSY" || (error as NodeJS.ErrnoException).code === "EPERM") {
      console.error(`Could not write ${output}: close it in Excel and run this again.`);
      process.exit(1);
    }
    throw error;
  }
  const counts = STATUSES.map((s) => [s, applications.filter((a) => a.status === s).length] as const)
    .filter(([, n]) => n > 0)
    .map(([s, n]) => `${n} ${s}`);
  console.log(`Wrote ${output}: ${applications.length} application(s)${counts.length ? ` (${counts.join(", ")})` : ""}.`);
}
