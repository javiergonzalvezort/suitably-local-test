# suitably-local-test

A job search helper that runs on your own computer, inside the coding agent you already use (Claude Code first; others later). It finds offers from sources that allow it, ranks them against your profile, and writes a tailored CV and cover letter for the ones worth it. It never applies for you, and your data stays on your machine.

> Status: early version (0.1). Built for guided setup sessions. Expect rough edges.

## What it does

| Step | What happens | Who does the work |
|---|---|---|
| Setup | A conversation that turns your CV and your answers into profile files | The agent asks; you answer and check |
| Find offers | Searches Himalayas and Remote OK through their official APIs | A script (rate-limited, honours robots.txt) |
| Rank | Picks likely offers, then classifies each requirement against your profile | The agent classifies; a script computes the score |
| Tailor | Writes a CV and a cover letter for one offer, then checks for invented facts | The agent writes; a script checks and renders the PDF |

It does **not**: scrape LinkedIn or other login-protected sites, submit applications, or send anything on your behalf.

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

- "Set up my profile" (imports your CV and asks questions)
- "Find offers"
- "Rank the offers"
- "Tailor my CV and cover letter for offer 3"

The agent follows the instructions in [AGENTS.md](AGENTS.md) and the skills in `.agents/skills/`.

## Your data

Read [SECURITY.md](SECURITY.md). In short: everything personal stays in `me/`, which git ignores; a pre-commit hook blocks accidental commits of personal files; your profile is sent only to the model provider of the agent you chose. **Do not fork this repository publicly with your data in it.**

## Job sources

Only sources whose terms allow this kind of use are included, listed in [config/sources.json](config/sources.json) with their terms and review date. See [docs/sources.md](docs/sources.md). You are responsible for complying with each site's terms if you change the configuration.

## Licence

Copyright (C) 2026 the project authors.

This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, version 3. It is distributed WITHOUT ANY WARRANTY. See [LICENSE](LICENSE).

Parts are adapted from [ai-job-search](https://github.com/ai-job-search-dev/ai-job-search) (MIT, Copyright (c) 2026 Mads Lorentzen); see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Issues are welcome; pull requests are not accepted yet ([CONTRIBUTING.md](CONTRIBUTING.md)).

Not affiliated with Anthropic, Himalayas, or Remote OK. Product names are used only to describe compatibility.
