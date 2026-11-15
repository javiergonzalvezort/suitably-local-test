---
name: setup
description: Gets the project started, builds the user's profile from their documents and a few questions, and chooses where to search (default and complementary job sources). Use when the user asks to initialise, start, or get started ("inicializa", "empecemos"), to set up, create, or update their profile, to import their CV, to add or remove job sources ("busca también en..."), or when `me/profile/about.md` still has its TODO line.
---

# Setup: start, documents, first questions, profile

You get the user from a fresh clone to a profile and a search they can run. The profile is the only source of facts for rankings, CVs, and cover letters, so it must be true. Keep the start short: documents, a few questions, a profile drafted from the documents, and where to search. Depth comes later, from `profile/questions.md`.

## Rules

- **Write only what the user confirms.** Show what you drafted and write it after a yes or their corrections.
- **Never invent or round up.** Numbers (percentages, money, team sizes, years) go in only as the documents or the user state them.
- **The user's language**, short messages, plain words.
- **Keep data private.** Read documents with your file tools from `me/documents/`. Never upload them, paste them into a web page, or copy them outside the workspace.
- **No sensitive data unless the user asks for it.** Do not ask about health, disability, religion, political views, union membership, sexual orientation, ethnic origin, age, or family situation. If the user volunteers something like this, ask whether they really want it in the profile before writing it.

## Steps

1. **Check the computer.** Run `npm run doctor`. If something is missing, show its fix and stop until it is solved (Typst can wait until the first PDF). Then `npm run init-workspace` (safe to run again). For a demo, use `--workspace demo-workspace` and skip to "Find offers".

2. **Documents first.** Ask the user to put every useful document in `me/documents/` (the folder's README lists them): all CV versions, past cover letters, the LinkedIn profile as PDF, certificates, portfolio, references. Then list what you found, one line per file with what it is, and ask: "Is anything missing?" Repeat until the user says that is all. If they have no files, they can paste their CV as text.

3. **The first questions.** Read the documents, then ask these in one message, numbered, and say that any can be skipped or answered later:
   1. **Roles**: which jobs are they looking for? Suggest three to five titles that fit the documents (for example "From your CV: Data Analyst, Analytics Engineer, BI Developer"), and ask which to keep or add.
   2. **Where**: city and country they live in, and remote, hybrid, or on-site.
   3. **Relocation**: would they move for a job, and where to?
   4. **Salary**: the minimum or range they expect, in which currency.
   5. **Rule-outs**: anything that rules an offer out whatever else it has (a sector, a contract type, travel, a language), and what matters most.

   Write the answers to `preferences.md` (roles, deal-breakers, location and remote, salary) and fill `search.json`, explaining each field in one line:
   - `queries`: two to five search terms from the roles, as job titles are written in Spain (usually Spanish, sometimes English: "fisioterapeuta", "data analyst"). LinkedIn, InfoJobs, and Indeed search with them. If the user later adds Himalayas, Remote OK, or Arbeitnow (step 5), add the English form too.
   - `titleKeywords`: words that must appear in a title or tag (synonyms, English and Spanish forms).
   - `excludeKeywords`: title words that rule an offer out ("intern", "principal", "sales").
   - `allowedLocations`: where the user may be hired from, as the sources write it ("Worldwide", "Europe", "EMEA", "Spain"); add the relocation places.
   - `searchLocations`: the places LinkedIn, InfoJobs, and Indeed search: a city or province ("Madrid, Spain", "Valencia, Spain"), or "Spain" for the whole country. Each place costs one request per term and source, so keep it to one or two.
   - `workplace`: "remote", "hybrid", "onsite", or "" for any (LinkedIn and InfoJobs).
   - Keep `maxAgeDays` and `shortlistSize` unless the user wants otherwise.

4. **Draft the profile from the documents.** Fill `profile/about.md`, `experience.md` (`## Title | Company | City | YYYY-MM to YYYY-MM`, newest first, company names and titles exactly as the user wants them on a CV), `education.md`, and `skills.md` (strong, working knowledge, learning now). Show a short summary of all of it in one message and ask for corrections; do not walk through it topic by topic. Where documents disagree (two dates for one job), ask which is right.
   Ask only what the gates need and the documents do not say:
   - **Work authorisation**: where they can work without sponsorship, and permit limits. This feeds the eligibility gate.
   - **Languages with levels** (native, C2 to A1; "fluent" is not a level). This feeds the language gate.

5. **Where to search.** Before the first search, tell the user in two lines that every search uses LinkedIn, InfoJobs, and Indeed, and that Indeed only gives a short extract of each offer (the full text is at its link). Then offer the complementary sources, so the search fits their profile:
   - Read `config/sources.json`: the complementary sources are those with `"default": false` and `"enabled": true`. Each has a `goodFor` line.
   - From the documents and the answers to step 3, recommend the ones that fit, each with one line on why ("You want remote work in English: Himalayas has remote jobs open to Spain, often with the salary"). Mention the others in one line, so the user can pick them too. If none fits (an on-site job in one city), say so and recommend none.
   - Ask which to add; "none" is a fine answer. Write their ids to `extraSources` in `search.json` (for example `["himalayas", "remoteok"]`), and add English forms to `queries` if an English-language source was chosen.
   - Tell them that boards not in the list (a sector or professional association board, a company's careers page, another portal) work by pasting: they open the offer and paste its text in the chat.

   Never add a site to `config/sources.json` yourself to satisfy a request: say it is not supported and offer pasting.

6. **The context layer.** Tell the user about `profile/questions.md`: about fifteen deeper questions (why they are looking, achievements with real numbers, stories, how they want to sound). None is needed now. The more they answer, as they search and apply, the more specific and true every CV and cover letter gets, because the tailor skill writes from these answers. If the documents already answer one (a cover letter that tells a story), offer to copy it in with their yes. Put stories they tell you in `profile/stories.md` too.

7. **Finish.** Remove the TODO line from `profile/about.md`. Suggest the next step: "Find offers".

## Updating an existing profile

If the profile is already filled in, ask what changed (new document, new role, new preferences) and edit only those sections. When the user answers a question from `profile/questions.md` in the chat, write the answer under it, and update `preferences.md` or `search.json` if the answer changes the search. To add or remove complementary sources, repeat step 5 and update `extraSources`.
