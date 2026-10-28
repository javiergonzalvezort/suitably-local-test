# Job sources

The list of sources is an allowlist in [`config/sources.json`](../config/sources.json); anything not listed there is never contacted. Three sources offer public APIs whose terms allow this use. LinkedIn does not, and is included the same way as in [ai-job-search](https://github.com/ai-job-search-dev/ai-job-search): read [its section](#linkedin) before you use it.

## Included sources

| Source | How | Limits shipped | Your duties when you use the offers |
|---|---|---|---|
| [Himalayas](https://himalayas.app/api) | Public JSON search API, first page of each search term (up to 5 terms) | 2 s between requests, 30 requests a day, 6 h cache | Name Himalayas and keep the link to the job page; apply through the unchanged application link; ignore expired or closed jobs; keep the offers for yourself, never pass them on to other job boards or aggregators |
| [Remote OK](https://remoteok.com/api) | Public JSON API, latest jobs, one request | 2 s between requests (robots.txt asks for 1 s), 4 requests a day, 6 h cache | Name Remote OK and keep the link to the Remote OK job page; do not use the Remote OK logo |
| [Arbeitnow](https://www.arbeitnow.com/blog/job-board-api) | Free public JSON API, newest 300 jobs (mostly Germany, and remote in Europe), one request | 2 s between requests, 4 requests a day, 6 h cache | Personal, non-commercial use; link back to Arbeitnow; do not republish |
| [LinkedIn](#linkedin) | Public job pages, without login: one search page (10 jobs) per search term and place, then the job page of those whose titles match your keywords | 3 s between requests, up to 3 terms and 15 job pages a run, 60 requests a day, 6 h cache, no retries | See below: against LinkedIn's terms; your own search only, at your own risk |

Terms were last read on 2026-10-28 for this local, one-person use, and robots.txt on 2026-10-27:

- **Himalayas** (terms "current as of Oct 28, 2026"): the scraping ban (clauses 30 and 93) does not cover the public API used within its documentation and rate limits, nor "an AI assistant or other software acting for one individual" (clause 30A). The API may be used in personal and commercial integrations (clause 113), with the duties in the table.
- **Remote OK** (legal page "updated October 26, 2026", and the notice in the API response): link back to the Remote OK job page and name Remote OK as the source, or API access may be suspended; no logo without written permission.
- **Arbeitnow** (terms page without a date, read 2026-10-28, and the notice in the API response): "This is a free public API for jobs, please do not abuse. I would appreciate linking back to the site." The terms allow the materials "for personal, non-commercial transitory viewing only" and ask for "a link back to Arbeitnow.com"; the API can be revoked at any time. Its robots.txt allows everything.

Sites change their terms: each entry in `config/sources.json` records the dates, and they should be re-checked before relying on them.

## LinkedIn

LinkedIn has no public jobs API. Its [User Agreement](https://www.linkedin.com/legal/user-agreement) forbids scraping and automated access, and its robots.txt disallows these pages to crawlers it has not approved. LinkedIn enforces this, mostly against companies that collect data at scale.

The LinkedIn source does what the linkedin-search skill of ai-job-search does, more slowly: it reads the public job pages that anyone can open without an account (`jobs-guest` endpoints).

- **No login, ever.** Your LinkedIn account is never used, so it cannot be restricted for this. LinkedIn may still slow down or block requests from your connection for a while (HTTP 429): the script then stops LinkedIn for that run and does not retry.
- **Low volume.** At most 3 search pages and 15 job pages a run, 3 seconds apart, 60 requests a day, and repeated runs within 6 hours are answered from the local cache.
- **robots.txt is not followed for this source** (`"honourRobots": false` in `config/sources.json`). It is the only exception.
- **For your own search only.** Do not share, publish, or resell the offers, and do not raise the limits.
- **Your choice.** You use it at your own risk. To turn it off, set `"enabled": false` for `linkedin` in `config/sources.json`; you can still paste LinkedIn offers you open yourself.

## Sources reviewed and not included

| Source | Why not, for now |
|---|---|
| InfoJobs | It has an official API with per-user app registration, but on 2026-10-28 its developer site's terms of use link was empty, so the terms could not be read. Paste InfoJobs offers instead. |
| Adzuna | Its API terms allow personal job search with a free key per user, but each listing must show the Adzuna logo, and the API host's robots.txt disallows everything. To revisit if Spanish coverage is thin. |

## How the scripts behave

- **robots.txt is honoured** for every request (RFC 9309, including wildcards), except for LinkedIn (see above). If a path is disallowed, the request is not made. If robots.txt cannot be read because of a server error, the source is skipped.
- **Himalayas pagination:** its robots.txt disallows URLs with `page=`. The scripts follow that for the API too, so only the first page of each search is fetched. Use more specific search terms instead of more pages.
- **AI opt-outs:** if a site's robots.txt blocks AI agents (for example `ClaudeBot`, `GPTBot`, `Claude-User`), the offer text is not kept: only the title, company, and link, so nothing from that site reaches the model.
- **Rate limits:** one request at a time, a minimum delay per host (or the site's `Crawl-delay` if longer), a daily request cap per source, and a local cache so repeated runs within a few hours cost nothing. HTTP 429 ("slow down") stops that source for the run, without retrying.
- **Identification:** every request carries a User-Agent with the project name and repository URL. No proxies, no browser imitation, no CAPTCHA solving.
- **Contact details** (emails, phone numbers) are removed from offers before they are saved.
- **Only search terms and places are sent** to the sources: never your name, email, or CV.

## Sites that are not supported

InfoJobs, Indeed, Glassdoor, Tecnoempleo, Wellfound, Welcome to the Jungle, and any page behind a login. Their terms forbid automated access, or they have not been reviewed.

For offers you found on one of these sites, open them yourself and paste their text into the agent ("add these offers"). The agent saves them to `me/offers/pasted.json`, with the closing date if the offer states one, and they are ranked with the rest. Offers opened by you are ordinary personal use.

## Changing the limits

You can edit `config/sources.json`, but the defaults are deliberately gentle. If you raise them or add a source, you are responsible for complying with that site's terms.
