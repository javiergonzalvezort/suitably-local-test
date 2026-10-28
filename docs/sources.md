# Job sources

The project only fetches offers from sources whose terms allow this use, through their official APIs. The list is an allowlist in [`config/sources.json`](../config/sources.json); anything not listed there is never contacted.

## Included sources

| Source | How | Limits shipped | Your duties when you use the offers |
|---|---|---|---|
| [Himalayas](https://himalayas.app/api) | Public JSON search API, first page of each search term (up to 5 terms) | 2 s between requests, 30 requests a day, 6 h cache | Name Himalayas and keep the link to the job page; apply through the unchanged application link; ignore expired or closed jobs; keep the offers for yourself, never pass them on to other job boards or aggregators |
| [Remote OK](https://remoteok.com/api) | Public JSON API, latest jobs, one request | 2 s between requests (robots.txt asks for 1 s), 4 requests a day, 6 h cache | Name Remote OK and keep the link to the Remote OK job page; do not use the Remote OK logo |

Terms were last read on 2026-10-28 for this local, one-person use, and robots.txt on 2026-10-27:

- **Himalayas** (terms "current as of Oct 28, 2026"): the scraping ban (clauses 30 and 93) does not cover the public API used within its documentation and rate limits, nor "an AI assistant or other software acting for one individual" (clause 30A). The API may be used in personal and commercial integrations (clause 113), with the duties in the table.
- **Remote OK** (legal page "updated October 26, 2026", and the notice in the API response): link back to the Remote OK job page and name Remote OK as the source, or API access may be suspended; no logo without written permission.

Sites change their terms: each entry in `config/sources.json` records the dates, and they should be re-checked before relying on them.

## How the scripts behave

- **robots.txt is honoured** for every request (RFC 9309, including wildcards). If a path is disallowed, the request is not made. If robots.txt cannot be read because of a server error, the source is skipped.
- **Himalayas pagination:** its robots.txt disallows URLs with `page=`. The scripts follow that for the API too, so only the first page of each search is fetched. Use more specific search terms instead of more pages.
- **AI opt-outs:** if a site's robots.txt blocks AI agents (for example `ClaudeBot`, `GPTBot`, `Claude-User`), the offer text is not kept: only the title, company, and link, so nothing from that site reaches the model.
- **Rate limits:** one request at a time, a minimum delay per host (or the site's `Crawl-delay` if longer), a daily request cap per source, and a local cache so repeated runs on the same day cost nothing. HTTP 429 ("slow down") stops that source for the run, without retrying.
- **Identification:** every request carries a User-Agent with the project name and repository URL. No proxies, no browser imitation, no CAPTCHA solving.
- **Contact details** (emails, phone numbers) are removed from offers before they are saved.
- **Only search terms are sent** to the sources: never your name, email, or CV.

## Sites that are not supported, on purpose

LinkedIn, InfoJobs, Indeed, Glassdoor, Tecnoempleo, Wellfound, Welcome to the Jungle, and any page behind a login. Their terms forbid automated access, or they have not been reviewed.

For an offer you found on one of these sites, open it yourself and paste its text into the agent ("add this offer"). The agent saves it to `me/offers/pasted.json`, and it is ranked with the rest. One offer at a time, opened by you, is ordinary personal use.

## Changing the limits

You can edit `config/sources.json`, but the defaults are deliberately gentle. If you raise them or add a source, you are responsible for complying with that site's terms.
