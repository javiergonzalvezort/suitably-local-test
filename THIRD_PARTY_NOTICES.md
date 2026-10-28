# Third-party notices

## ai-job-search

Source: https://github.com/ai-job-search-dev/ai-job-search (formerly MadsLorentzen/ai-job-search), release v1.6.0. Licence: MIT, reproduced below.

Some ideas and rules are adapted from it. They were rewritten and shortened, not copied file for file. Adapted files carry a comment that points here.

| File in this project | Derived from (upstream path) | What was taken |
|---|---|---|
| `scripts/check-cv.ts` (cliché list and long-dash warning) | `.claude/skills/job-application-assistant/03-writing-style.md` | The "no clichés, no long dashes" writing rules |
| `.agents/skills/rank/SKILL.md` (and its copy in `.claude/skills/`) | `.claude/skills/job-application-assistant/04-job-evaluation.md` | The eligibility gate (silence is not permission; a company-wide welcome does not cover a restricted role), the language gate (fail, flag, pass; flag when unsure), and function-over-title matching |
| `scripts/sources/linkedin.ts` | `.agents/skills/linkedin-search/cli/src/helpers.ts` and `url-reference.md` | The LinkedIn public job page endpoints and their parameters, and the card, description, and job-criteria parsing |
| `.agents/skills/tailor/SKILL.md` (and its copy in `.claude/skills/`) | `.claude/skills/job-application-assistant/03-writing-style.md` | The interview backtrack test (fine, ask, never), forward-looking letters, no clichés or long dashes, a specific headline instead of "Application for..." |

Everything else in this project was written from scratch.

```text
MIT License

Copyright (c) 2026 Mads Lorentzen

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
