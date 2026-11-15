# Job sources

The scripts only contact the default sources in [`config/sources.json`](../config/sources.json) and the complementary sources each user chose and checked (`extraSources` in their `me/search.json`). Nothing else is ever contacted.

## Default and complementary sources

- **Default sources**, searched for everyone: **LinkedIn, InfoJobs, and Indeed**, the portals most used in Spain. None of them offers a public jobs API that works without registering, so the scripts read their public pages without login, at low volume. LinkedIn is included the same way as in [ai-job-search](https://github.com/ai-job-search-dev/ai-job-search). Read [their sections](#linkedin) before you use them.
- **Complementary sources**, chosen by each user: see [Complementary sources](#complementary-sources). There is no fixed list.

In `config/sources.json`, `"enabled": false` turns a default source off.

## Included sources

| Source | | How | Limits shipped | Your duties when you use the offers |
|---|---|---|---|---|
| [LinkedIn](#linkedin) | default | Public job pages, without login: one search page (10 jobs) per search term and place, then the job page of those whose titles match your keywords | 3 s between requests, up to 3 terms and 15 job pages a run, 60 requests a day, 6 h cache, no retries | See below: against LinkedIn's terms; your own search only, at your own risk |
| [InfoJobs](#infojobs) | default | Public search page, without login: one page (about 20 offers, with their full text) per search term and province | 3 s between requests, up to 3 terms a run, 30 requests a day, 6 h cache, no retries | See below: terms not readable by a script; your own search only, at your own risk |
| [Indeed](#indeed) | default | Public search page, without login: one page (15 jobs, with a short extract) per search term and place; job pages are never opened | 3 s between requests, up to 3 terms a run, 30 requests a day, 6 h cache, no retries | See below: personal, non-commercial job search only |

Terms and robots.txt were last read on 2026-10-28 (LinkedIn) and 2026-11-15 (InfoJobs, Indeed): see each section below.

Sites change their terms: each entry in `config/sources.json` records the dates, and they should be re-checked before relying on them.

## LinkedIn

LinkedIn has no public jobs API. Its [User Agreement](https://www.linkedin.com/legal/user-agreement) forbids scraping and automated access, and its robots.txt disallows these pages to crawlers it has not approved. LinkedIn enforces this, mostly against companies that collect data at scale.

The LinkedIn source does what the linkedin-search skill of ai-job-search does, more slowly: it reads the public job pages that anyone can open without an account (`jobs-guest` endpoints).

- **No login, ever.** Your LinkedIn account is never used, so it cannot be restricted for this. LinkedIn may still slow down or block requests from your connection for a while (HTTP 429): the script then stops LinkedIn for that run and does not retry.
- **Low volume.** At most 3 search pages and 15 job pages a run, 3 seconds apart, 60 requests a day, and repeated runs within 6 hours are answered from the local cache.
- **robots.txt is not followed for this source** (`"honourRobots": false` in `config/sources.json`). It is the only exception.
- **For your own search only.** Do not share, publish, or resell the offers, and do not raise the limits.
- **Your choice.** You use it at your own risk. To turn it off, set `"enabled": false` for `linkedin` in `config/sources.json`; you can still paste LinkedIn offers you open yourself.

## InfoJobs

InfoJobs is Spain's largest general job board. It has an [official API](https://developer.infojobs.net), but each user would have to register an app with an InfoJobs account and keep a key, which is too much to ask of a first-time user. On 2026-10-28 the developer site's terms of use link was empty.

The InfoJobs source reads the public search page instead, without login. That page carries the first results (about 20 offers, with title, company, city, contract, and full text), so one request per search term and province is enough and no job pages are opened.

- **robots.txt is followed.** On 2026-11-15 it allowed the search page to every crawler except LinkedInBot and jobrapido.
- **Terms not read.** The legal page refuses automated access, so its terms of use could not be read by a script. Job boards usually forbid automated extraction: assume InfoJobs does too. Use it for your own search, at low volume, at your own risk, as with LinkedIn.
- **Captcha.** InfoJobs protects some of its pages with a captcha. If the search page answers with one, the source stops for that run and does not try to get past it.
- **No login, never republish.** Your InfoJobs account is never used. Do not share, publish, or resell the offers. To turn it off, set `"enabled": false` for `infojobs`.

## Indeed

Indeed has no public jobs API. The Indeed source reads its public search page for Spain (es.indeed.com), without login: 15 job cards per search term and place, with title, company, place, salary if shown, and a short extract.

- **robots.txt is followed.** It allows search pages (`/jobs`) and disallows job pages (`/viewjob`), so the script never opens a job page. Each Indeed offer only has the extract (`snippetOnly: true`). The agent says so, evaluates it with what it shows, and asks you to paste the full text before tailoring a CV.
- **Terms.** Indeed's terms (1 April 2026) let candidates use the site and its content "para el fin personal y no comercial de buscar empleo", and forbid automating applications. This source is for your own search only, and nothing applies for you.
- **Bot checks.** Indeed's network sometimes answers a script with a bot check (captcha) instead of the page. The source then stops for that run, without retrying or trying to get past it. Try later, or open Indeed yourself and paste the offers.
- To turn it off, set `"enabled": false` for `indeed`.

## Complementary sources

The three default portals miss many offers: those published only on a professional association's board (*colegio profesional*), a sector board, a regional public employment service, or an employer's own careers page. So, before the first search, the setup skill proposes three or four complementary sources chosen for that person, and the user picks the ones they want.

Each chosen source is checked before it is added, with `npm run check-source`, one request plus its robots.txt:

- **robots.txt** must allow the search page and must not opt out of AI agents (otherwise its text could never reach the agent).
- **No wall:** the page must answer without a login, a captcha, a bot check, or an error, and must not be an empty page filled in by JavaScript (the scripts do not run JavaScript).
- **Real results:** the page must show offers for the search term, either as schema.org `JobPosting` data (which many job sites publish for search engines) or as text that mentions the term.

Only sources that pass are saved, in `extraSources` in `me/search.json`, with their search URL and the date of the check. Then, on every search:

- the script requests each source's search page for up to two search terms, with the same rules as the default sources (robots.txt, 3 s between requests, 10 requests a day per source, 6 h cache, no retries);
- if the page carries `JobPosting` data, the script reads the offers from it;
- otherwise it saves the page's text and links to `me/offers/sources/<id>.md`, and the agent extracts the offers into `me/offers/extracted.json`, keeping each offer's own link. These offers are usually short extracts (`snippetOnly`).

**Terms are not checked.** The script cannot read a site's terms of use. A complementary source is for your own search, at low volume, at your own risk, like the default ones: do not share or republish its offers. If a site later blocks the script, it stops for that run; remove it from `extraSources` or paste its offers instead.

Sites checked on 2026-11-15, as examples: Infoempleo (`https://www.infoempleo.com/trabajo/?q={query}`) and Trabajos.com (`https://www.trabajos.com/ofertas-empleo/?CADENA={query}`) were viable as page sources; Tecnoempleo was not (its robots.txt opts out of Claude).

## Sources reviewed and not included

| Source | Why not, for now |
|---|---|
| Himalayas, Remote OK, Arbeitnow | Public APIs for remote and international jobs, included until 2026-11-15. Removed: the complementary sources are now chosen for each person instead of a fixed list. |
| Tecnoempleo | Tech jobs in Spain. Its robots.txt disallows Anthropic's and Claude's crawlers, so its text could never reach the agent. Paste its offers instead. |
| EURES | The European Commission's job portal. Its search page is filled in by JavaScript and its search endpoint was not found on 2026-11-15. |
| Adzuna | Its API terms allow personal job search with a free key per user, but each listing must show the Adzuna logo, and the API host's robots.txt disallows everything. To revisit if Spanish coverage is thin. |

## How the scripts behave

- **robots.txt is honoured** for every request (RFC 9309, including wildcards), except for LinkedIn (see above). If a path is disallowed, the request is not made. If robots.txt cannot be read because of a server error, the source is skipped.
- **Bot checks:** if a site answers with a bot check (captcha) instead of the page, the source stops for that run. No captcha solving, no retries, no changing the User-Agent.
- **One page per search:** only the first results page of each search term is fetched. Use more specific search terms instead of more pages.
- **AI opt-outs:** if a site's robots.txt blocks AI agents (for example `ClaudeBot`, `GPTBot`, `Claude-User`), the offer text is not kept: only the title, company, and link, so nothing from that site reaches the model.
- **Rate limits:** one request at a time, a minimum delay per host (or the site's `Crawl-delay` if longer), a daily request cap per source, and a local cache so repeated runs within a few hours cost nothing. HTTP 429 ("slow down") stops that source for the run, without retrying.
- **Identification:** every request carries a User-Agent with the project name and repository URL. No proxies, no browser imitation, no CAPTCHA solving.
- **Contact details** (emails, phone numbers) are removed from offers before they are saved.
- **Only search terms and places are sent** to the sources: never your name, email, or CV.

## Sites that are not supported

Any page behind a login, and any site that check-source did not find viable (Tecnoempleo, Glassdoor, and most sites that load their offers with JavaScript).

For offers you found on one of these sites, open them yourself and paste their text into the agent ("add these offers"). The agent saves them to `me/offers/pasted.json`, with the closing date if the offer states one, and they are ranked with the rest. Offers opened by you are ordinary personal use.

## Changing the limits

You can edit `config/sources.json`, but the defaults are deliberately gentle, and the limits for complementary sources are fixed in `scripts/sources/custom.ts`. If you raise them or add a source, you are responsible for complying with that site's terms.
