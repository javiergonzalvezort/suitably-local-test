# suitably-local-test

A job search helper that runs on your own computer, inside the coding agent you already use (Claude Code first; others later). It finds offers from sources that allow it, ranks them against your profile, and writes a tailored CV and cover letter for the ones worth it. It never applies for you, and your data stays on your machine.

> Status: early version (0.1). Built for guided setup sessions. Expect rough edges.

## What it does

| Step | What happens | Who does the work |
|---|---|---|
| Setup | Reads your documents (CVs, past letters, LinkedIn PDF), asks three to five questions, and drafts your profile | The agent asks; you answer and check |
| Find offers | Searches Himalayas, Remote OK, and Arbeitnow through their public APIs, and LinkedIn's public job pages | A script (rate-limited, low volume) |
| Rank | Classifies each requirement against your profile, then lists the best matches, the ones closing soon, and why the rest scored lower | The agent classifies; a script computes the score |
| Tailor | Writes a CV and a cover letter per offer, checks for invented facts, and revises them with you | The agent writes; a script checks and renders the PDF |

It does **not**: log in to any site, submit applications, or send anything on your behalf.

Your profile grows over time: `me/profile/questions.md` holds deeper questions (motivations, achievements, stories, tone) that you answer as you go. Every CV and cover letter is written from those answers.

## Requirements

- Windows 10/11 or macOS (Linux works if you install the tools yourself)
- A coding agent: [Claude Code](https://claude.com/claude-code) with a paid Claude plan (Pro is enough to start)
- Git, Node.js 22.18 or newer, and [Typst](https://typst.app) (for PDFs). The installer sets these up.

## Install

**Windows** (PowerShell):

```powershell
irm https://raw.githubusercontent.com/javiergonzalvezort/suitably-local-test/main/install.ps1 | iex
```

**macOS** (Terminal):

```bash
curl -fsSL https://raw.githubusercontent.com/javiergonzalvezort/suitably-local-test/main/install.sh | bash
```

If you already downloaded the project, run `powershell -ExecutionPolicy Bypass -File install.ps1` (Windows) or `bash install.sh` (macOS) from its folder instead.

The installer checks and installs Git, Node.js, and Typst, turns on the privacy check for commits, creates your private `me/` folder, and runs the **doctor**. Run the doctor again at any time:

```bash
npm run doctor
```

It lists what is missing and how to fix it, in plain language.

## First run: the sample persona

Before adding anything personal, see the whole flow with a fictional candidate:

```bash
npm run demo
```

This copies the persona in `examples/persona/` to `demo-workspace/`, ranks its sample offers, checks its tailored CV, and renders the PDFs. Everything in the persona is invented. It is also safe to use for recording demos.

## Daily use

Open the project folder in your agent (for Claude Code: `cd` into the folder and run `claude`), then ask in plain words:

- "Get started" or "Set up my profile" (reads the documents you put in `me/documents/` and asks a few questions)
- "Find offers"
- "Rank the offers"
- "Tailor my CV and cover letter for offer 3", or "Prepare applications for the top five"
- "Answer question 7: ..." (adds to your context layer in `me/profile/questions.md`)

The agent follows the instructions in [AGENTS.md](AGENTS.md). What is planned next is in [NEXT_STEPS.md](NEXT_STEPS.md).

## Your data

Read [SECURITY.md](SECURITY.md). In short: everything personal stays in `me/`, which git ignores; a pre-commit hook blocks accidental commits of personal files; your profile is sent only to the model provider of the agent you chose. **Do not fork this repository publicly with your data in it.**

## Job sources

The sources are listed in [config/sources.json](config/sources.json) with their terms and review date; see [docs/sources.md](docs/sources.md). Himalayas, Remote OK, and Arbeitnow offer public APIs for this. **LinkedIn does not**: its terms forbid automated access. The LinkedIn source reads its public job pages without logging in, at low volume, for your own search; you use it at your own risk, and you can turn it off in `config/sources.json`. You are responsible for complying with each site's terms.

## Licence

Copyright (C) 2026 the project authors.

This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, version 3. It is distributed WITHOUT ANY WARRANTY. See [LICENSE](LICENSE).

Parts are adapted from [ai-job-search](https://github.com/ai-job-search-dev/ai-job-search) (MIT, Copyright (c) 2026 Mads Lorentzen); see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Issues are welcome; pull requests are not accepted yet ([CONTRIBUTING.md](CONTRIBUTING.md)).

Not affiliated with Anthropic, Himalayas, Remote OK, Arbeitnow, or LinkedIn. Product names are used only to describe compatibility.
