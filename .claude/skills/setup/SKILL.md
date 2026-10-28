---
name: setup
description: Builds the user's profile from their CV and a short conversation. Use when the user asks to set up, create, or update their profile, import their CV, or when `me/profile/about.md` still has its TODO line.
---

# Setup: profile interview and CV import

You turn the user's CV and answers into the profile files every other step reads. The profile is the only source of facts for rankings, CVs, and cover letters, so it must be true and complete.

## Rules

- **Write only what the user confirms.** Propose a draft of each section, show it, and write it after a yes or their corrections.
- **Never invent or round up.** Numbers (percentages, money, team sizes, years) go in only as the user states them. If a CV line has no number, do not add one; ask whether there is a real one.
- **One topic at a time.** Short questions, plain words, in the user's language. Do not send a long questionnaire.
- **Keep data private.** Read the CV with your file tools from where the user put it (suggest `me/`). Never upload it, paste it into a web page, or copy it outside the workspace.
- **No sensitive data unless the user asks for it.** Do not ask about health, disability, religion, political views, union membership, sexual orientation, ethnic origin, age, or family situation. If the user volunteers something like this, ask whether they really want it in the profile before writing it.

## Steps

1. **Workspace.** If `me/` does not exist, run `npm run init-workspace`. For a demo, use `--workspace demo-workspace` and skip to step 7.
2. **CV.** Ask for the CV as a file (PDF, Word, text) or pasted text. Read it and say in two or three lines what you understood (current role, years of experience, main areas). Ask what is out of date.
3. **`profile/about.md`.** Contact details, headline, summary, work authorisation, and languages with levels. Ask explicitly:
   - Where they can work without sponsorship, and any permit limits (dates, hours). This feeds the eligibility gate.
   - Each language and its level (native, C2 to A1). "Fluent" is not a level: ask which they mean. This feeds the language gate.
4. **`profile/experience.md`.** One section per role, newest first, in the template's format (`## Title | Company | City | YYYY-MM to YYYY-MM`). Use the exact company names and titles the user wants on a CV: the CV check compares against them. For each role, ask what changed because of their work, and keep 3 to 6 bullets.
5. **`profile/education.md` and `profile/skills.md`.** Degrees and certificates with year. Skills split into strong (used at work), working knowledge, and learning now. Ask where each strong skill was used, if the experience does not show it.
6. **`profile/stories.md`.** Ask for two to four short stories (situation, action, result) that show the work they want to do next. These become cover letter paragraphs and interview answers.
7. **`preferences.md`.** Roles they want, must-haves, nice-to-haves, **deal-breakers** (anything here makes an offer a skip), location and remote, salary floor if they want one. Ask about deal-breakers directly: "Is there anything that rules an offer out, whatever else it has?"
8. **`search.json`.** Fill it from the answers and explain each field in one line:
   - `queries`: 2 to 5 search terms for the job sources, in English (the sources are English-language boards).
   - `titleKeywords`: words that must appear in a title or tag for the offer to be shortlisted (include synonyms and the English and Spanish forms).
   - `excludeKeywords`: title words that rule an offer out (for example "intern", "principal", "sales").
   - `allowedLocations`: where the user may be hired from, as the sources write it ("Worldwide", "Europe", "EMEA", "Spain").
   - Keep `maxAgeDays` and `shortlistSize` unless the user wants otherwise.
9. **Finish.** Remove the TODO line from `profile/about.md`. Read the profile back as a short summary and ask for a last check. Then suggest the next step: "Find offers".

## Updating an existing profile

If the profile is already filled in, ask what changed (new role, new skill, new preferences) and edit only those sections. Do not rewrite sections the user did not mention.
