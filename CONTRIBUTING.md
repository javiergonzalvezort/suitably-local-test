# Contributing

Thank you for your interest.

## Issues: welcome

Open an issue for bugs, unclear documentation, a source you would like supported, or a setup step that failed. Include the output of `npm run doctor`.

**Never paste your CV, profile, or anything from your `me/` folder into an issue.** Issues are public. If a problem needs real data to reproduce, describe it with the sample persona in `examples/persona/` instead.

## Pull requests: not accepted yet

Pull requests are not accepted for now. The project has a single copyright holder, and outside contributions will need a contributor agreement first. This will be announced in the README when it changes. Ideas in issues are very welcome in the meantime.

## Ground rules for the code (for the maintainer, and later for contributors)

- **TypeScript, plain and conventional.** Node runs the `.ts` files directly (type stripping), so there is no build step. Use only erasable syntax: no `enum`, no `namespace`, no parameter properties. Imports end in `.ts`.
- **No runtime dependencies** unless there is a strong reason. Development dependencies (TypeScript, Node types) are fine.
- **Deterministic work in scripts, judgment in skills.** Fetching, robots.txt, rate limits, deduplication, scoring arithmetic, and PDF rendering are scripts. The model classifies and writes.
- **Safe defaults.** Sources are an allowlist in `config/sources.json`. No scraping of login-protected pages, no proxy rotation, no CAPTCHA solving, no stealth features. A source is only added after its terms and robots.txt have been read and the review date is recorded. LinkedIn is the one documented exception to robots.txt (public job pages, no login, low volume); see `docs/sources.md`.
- **Personal data never in git.** Sample data is fictional and lives in `examples/`. The pre-commit hook in `.githooks/` enforces this; do not bypass it with `--no-verify`.
- Before committing: `npm test` and `npm run typecheck` (after `npm install`).

## Licence

By contributing (once contributions open), you agree that your contribution is licensed under the GNU Affero General Public License v3.0, the licence of this project.
