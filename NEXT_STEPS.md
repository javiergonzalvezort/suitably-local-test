# Next steps

State after the first session (2026-10-27). Done: repo skeleton (AGPL-3.0), doctor, Windows and macOS installers, privacy pre-commit hook, fictional persona, job search on Himalayas and Remote OK, ranking (shortlist, evaluations, score), tailored CV and cover letter (check, render), and the `npm run demo` flow. 44 tests pass (`npm test`, `npm run typecheck`).

## Before the first mentoring session

1. ~~Workflow skills~~ Done 2026-10-28: `setup`, `find-offers`, `rank`, `tailor` in `.agents/skills/`, copied to `.claude/skills/` by `npm run sync-skills` (a test fails if the copy drifts). Pointers: `GEMINI.md`, `.cursor/rules/main.mdc`. Not yet tried by an agent: step 4.
3. **Test the installers on clean machines**: a Windows laptop without Git/Node/Typst, and a Mac without Homebrew. Only dry runs were tested (`$env:DRY_RUN='1'` / `DRY_RUN=1`). The clone path (`irm ... | iex`) needs the pushed repo.
4. **One real run with Claude Code** on the persona (`demo-workspace`): setup, rank of the live shortlist, tailor. Measure tokens and time on a Pro plan.
5. ~~Re-read the terms~~ Done 2026-10-28: both allow this use; see `docs/sources.md`.
6. ~~Session flow~~ Done 2026-10-28: setup starts from `me/documents/` and three to five questions, `profile/questions.md` as the context layer, Arbeitnow and LinkedIn (public job pages, as in ai-job-search) as sources, ranking with best matches, others closing within 7 days, and the rest explained, tailor iterates offer by offer. Step 4 should try this flow.

## Guide fixes from the first workshop (2026-11-14)

Done 2026-11-15 in `docs/manual.md`, `docs/guia.html` and `docs/guia-suitably.pdf`. Step 2 is now split into Git and VS Code. Git on Windows: which download to pick (64-bit or ARM64), Notepad as the editor (VS Code is not installed yet, and the default is Vim), `main` as the initial branch, and Next on every other screen. Git on Mac: Terminal, `git --version`, and the Command Line Tools prompt, because git-scm has no Mac download button. There is now a `git --version` check. VS Code on Mac: install from Applications, not Downloads. Logins: the Claude extension is the only one (Google accounts choose "Continue with Google"), so ignore the VS Code "Sign in" prompt. Troubleshooting gained a manual Node.js row.

Left out on purpose:
- `git config user.name` / `user.email`, because participants clone and pull but never commit.
- `core.editor "code --wait"` and the Mac `code` PATH command, because the session never opens a Git editor.

## Later

- `docs/` in Spanish (setup guide for non-developers, costs per agent, privacy, FAQ); README in Spanish.
- Supervised apply (field plan, never submit; email drafts only). Interview prep: done 2026-11-10 (`interview-prep` skill), not yet tried by an agent.
- Public ATS boards (Greenhouse, Lever, Ashby) over a user-maintained company list (question 4 of `questions.md` collects it).
- ~~InfoJobs and Indeed~~ Done 2026-11-15: default sources with LinkedIn (public search pages, no login; Indeed only keeps the search extract, robots.txt disallows job pages). Himalayas, Remote OK, and Arbeitnow became complementary sources, offered by the setup skill before the first search (`extraSources` in `search.json`). To check in a workshop: Indeed answered the scripts User-Agent with a Cloudflare bot check on 2026-11-15, so it may often give no offers.
- More complementary sources: Infoempleo (robots.txt allows its search pages; terms and an HTML parser pending), EURES (find the current search endpoint), sector boards for non-tech profiles (health, dental, administration). Tecnoempleo is out: its robots.txt disallows Claude.
- InfoJobs official API as an option for users who register an app (more stable than the public page if InfoJobs adds a captcha).
- Adzuna: terms allow personal job search with a free per-user key, but its API host's robots.txt disallows everything and listings need its logo; revisit if Spanish coverage is thin.
- ~~Applications log~~ Done 2026-11-10: `applications/log.json` written by the agent, `npm run applications` turns it into `applications.xlsx` (no dependencies).
- Himalayas: drop jobs that closed before their expiry date (the single-job endpoint answers 410). Today only `expiresAt` is checked.
- CI (GitHub Actions) that runs `npm test`, `npm run typecheck`, and the demo with Typst.
- Second agent (Codex or Gemini CLI) tested end to end.
- A contributor agreement (DCO or CLA) before accepting pull requests.

## Known limits

- Himalayas: only the first page per search term (robots.txt disallows `page=` URLs).
- The shortlist's location filter is text matching; offers with no stated location pass.
- `check-cv` checks facts and numbers, not wording: a human still reads every document.
- Fonts: Arial on Windows and macOS; elsewhere Typst falls back to its bundled Libertinus Serif.
