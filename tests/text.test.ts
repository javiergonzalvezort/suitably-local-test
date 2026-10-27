import assert from "node:assert/strict";
import { test } from "node:test";
import { containsWords, htmlToText, stripContacts } from "../scripts/lib/text.ts";

test("turns HTML into readable text", () => {
  const text = htmlToText("<p>We use <strong>dbt</strong> &amp; SQL.</p><ul><li>Remote</li><li>Fair&nbsp;pay</li></ul>");
  assert.equal(text, "We use dbt & SQL.\n\n- Remote\n- Fair pay");
});

test("removes emails and phone numbers but keeps salaries and dates", () => {
  const text = stripContacts("Contact ana.recruiter@company.test or +34 912 345 678. Salary 45,000 to 52,000 EUR. Start 2026-11-01.");
  assert.equal(text, "Contact [email removed] or [phone removed]. Salary 45,000 to 52,000 EUR. Start 2026-11-01.");
});

test("matches whole words only", () => {
  assert.equal(containsWords("Senior BI Developer", "bi"), true);
  assert.equal(containsWords("Ambitious Engineer", "bi"), false);
  assert.equal(containsWords("Ingeniería de Datos", "ingenieria"), true);
});
