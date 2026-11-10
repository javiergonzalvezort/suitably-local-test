import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import zlib from "node:zlib";
import { applicationRows, validateApplications, writeApplicationsWorkbook } from "../scripts/applications.ts";
import type { Application } from "../scripts/lib/types.ts";
import { readJson, REPO_ROOT } from "../scripts/lib/workspace.ts";
import { columnName, sheetXml, zip } from "../scripts/lib/xlsx.ts";

const LOG = path.join(REPO_ROOT, "examples", "persona", "applications", "log.json");

// Reads every file back from a zip made by zip(), checking each CRC.
function unzip(buffer: Buffer): Record<string, string> {
  const files: Record<string, string> = {};
  let at = 0;
  while (buffer.readUInt32LE(at) === 0x04034b50) {
    const crc = buffer.readUInt32LE(at + 14);
    const size = buffer.readUInt32LE(at + 18);
    const nameLength = buffer.readUInt16LE(at + 26);
    const name = buffer.subarray(at + 30, at + 30 + nameLength).toString("utf8");
    const data = zlib.inflateRawSync(buffer.subarray(at + 30 + nameLength, at + 30 + nameLength + size));
    assert.equal(zlib.crc32(data), crc, `CRC of ${name}`);
    files[name] = data.toString("utf8");
    at += 30 + nameLength + size;
  }
  return files;
}

test("the persona's log is valid", () => {
  const { errors, applications } = validateApplications(readJson<unknown>(LOG));
  assert.deepEqual(errors, []);
  assert.equal(applications.length, 1);
});

test("validation explains what is wrong", () => {
  const { errors } = validateApplications([{ company: "Acme", role: "Analyst", status: "sent", preparedAt: "28/10/2026", keyPoints: [], declared: [{ label: "Salary" }] }]);
  assert.ok(errors.some((e) => e.includes('"status" must be one of prepared, applied')));
  assert.ok(errors.some((e) => e.includes('"preparedAt" must be a date as YYYY-MM-DD')));
  assert.ok(errors.some((e) => e.includes('declared item 1 needs "label" and "value"')));
});

test("an application past prepared needs the date it was sent", () => {
  const [entry] = readJson<Application[]>(LOG);
  const { errors } = validateApplications([{ ...entry, status: "interview", appliedAt: undefined }]);
  assert.ok(errors.some((e) => e.includes('"appliedAt" is needed')));
});

test("rows show what was said and declared, newest first", () => {
  const [entry] = readJson<Application[]>(LOG);
  const older = { ...entry, company: "Older Co", appliedAt: "2026-10-01" };
  const rows = applicationRows([older, entry]);
  assert.equal(rows[0][0], "Applied on");
  assert.equal(rows[1][2], "Lumen Parcel");
  assert.equal(rows[2][2], "Older Co");
  assert.match(rows[1].join("|"), /Salary expectation: 52,000 EUR gross a year/);
  assert.match(rows[1].join("|"), /• dbt tests on the 25 most used models/);
});

test("column names go past Z", () => {
  assert.deepEqual([0, 25, 26, 27, 701, 702].map(columnName), ["A", "Z", "AA", "AB", "ZZ", "AAA"]);
});

test("cells are escaped XML with a filter over the table", () => {
  const xml = sheetXml([["Company", "Notes"], ["A & B <Ltd>", 'said "yes"\u0001']], { sheetName: "x", columnWidths: [10, 10] });
  assert.match(xml, /A &amp; B &lt;Ltd&gt;/);
  assert.match(xml, /said &quot;yes&quot;</);
  assert.match(xml, /<autoFilter ref="A1:B2"\/>/);
});

test("the workbook is a valid zip with the parts Excel needs", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "apps-"));
  const file = path.join(dir, "applications.xlsx");
  writeApplicationsWorkbook(readJson<Application[]>(LOG), file);
  const files = unzip(fs.readFileSync(file));
  assert.deepEqual(Object.keys(files).sort(), [
    "[Content_Types].xml",
    "_rels/.rels",
    "xl/_rels/workbook.xml.rels",
    "xl/styles.xml",
    "xl/workbook.xml",
    "xl/worksheets/sheet1.xml",
  ]);
  assert.match(files["xl/worksheets/sheet1.xml"], /Lumen Parcel/);
  assert.match(files["xl/workbook.xml"], /'Applications'!\$A\$1:\$M\$2/);
});

test("zip keeps non-ASCII names and content", () => {
  const files = unzip(zip({ "carpeta/año.txt": "Candidatura enviada: sí" }));
  assert.equal(files["carpeta/año.txt"], "Candidatura enviada: sí");
});

test("the persona's interview guide has every field the template reads", () => {
  const prep = readJson<Record<string, unknown>>(
    path.join(REPO_ROOT, "examples", "persona", "applications", "lumen-parcel-analytics-engineer", "interview-prep.json"),
  );
  const template = fs.readFileSync(path.join(REPO_ROOT, "templates", "interview-prep.typ"), "utf8");
  // Every top-level field read as data.<field> in the template must exist in the example.
  const fields = new Set([...template.matchAll(/data\.([a-zA-Z]+)/g)].map((m) => m[1]));
  for (const field of fields) assert.ok(field in prep, `interview-prep.json lacks "${field}"`);
  for (const q of prep.questions as { group: string; question: string; why: string; answer: string[] }[]) {
    assert.ok(q.group && q.question && q.why && Array.isArray(q.answer), q.question);
  }
});
