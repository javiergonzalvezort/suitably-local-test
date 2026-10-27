# Sample persona: Alba Ferrer Soler

**Everything in this folder is invented.** Alba, her employers, her university, the job offers, and the companies behind them do not exist. Any resemblance to real people or organisations is a coincidence. Contact details use reserved example values (`example.com`, a placeholder phone number).

The folder has the same layout as your private `me/` workspace, so it shows what each step produces:

| Path | Written by | What it is |
|---|---|---|
| `profile/*.md`, `preferences.md` | the setup skill | Alba's profile and what she is looking for |
| `search.json` | the setup skill | search terms and filters for the scripts |
| `offers/fetched.json` | `find-offers` script | eight invented offers (normally fetched from Himalayas and Remote OK) |
| `offers/evaluations.json` | the rank skill | the agent's classification of each shortlisted offer |
| `applications/lumen-parcel-analytics-engineer/` | the tailor skill | a tailored CV and cover letter for the best offer |

Try it with `npm run demo`, which copies this folder to `demo-workspace/` (ignored by git) and runs the scripts on the copy. To use it from your agent, ask it to work on `demo-workspace` instead of `me`.

Use this persona for demos and recordings, never a real person's data.
