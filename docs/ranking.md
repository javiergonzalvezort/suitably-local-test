# How ranking works

Ranking splits the work so the model only does what needs judgment, and the arithmetic stays the same every time.

1. **Shortlist** (script, `npm run shortlist`). From all fetched and pasted offers it drops expired ones, ones older than `maxAgeDays`, ones with an `excludeKeywords` word in the title, ones without any `titleKeywords` word in the title or tags, and ones restricted to locations outside `allowedLocations`. It keeps the best `shortlistSize` (most keyword hits, then newest). These settings live in your `search.json`.
2. **Evaluation** (agent, rank skill). For each shortlisted offer, the agent runs the gates (eligibility, language, location, deal-breakers) and classifies every requirement in the offer against your profile: `yes`, `partial`, `no`, or `unknown`, with the evidence. It does not choose a score.
3. **Score** (script, `npm run score`). Turns each evaluation into a score from 0 to 100 and writes `offers/ranking.md`.

## The formula

| Part | Value |
|---|---|
| Requirement value | yes = 1, partial = 0.5, unknown = 0.25, no = 0 |
| `must` | average value of the must-have requirements (0.5 if none) |
| `nice` | average value of the nice-to-have requirements (0.5 if none) |
| `level` | seniority fit = 1, unknown = 0.6, below = 0.5, above = 0.3 |
| **Score** | **65 × must + 20 × nice + 15 × level** |

Caps:

- One must-have missing (`no`): the score is at most 65. Two or more: at most 45.
- Hard stops: failed eligibility, failed language gate, impossible location, or any of your deal-breakers. The score is at most 10 and the verdict is always "skip".

Verdict: 70 or more is **Apply**, 50 to 69 is **Maybe**, below 50 is **Skip**.

The score is a sorting aid, not a decision. Read the strengths, gaps, and notes in `ranking.md` before you choose.
