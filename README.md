# Backchannel

Sourced due diligence on the companies that approach you. Paste a recruiter email; get the
company's ownership, money, layoffs, leadership and employee sentiment, every fact linked to the
source behind it, plus scores, risks and questions to ask.

## Run it

```sh
npm install
cp .env.example .env          # add ANTHROPIC_API_KEY
cp profile.example.json profile.json   # optional: lets it judge role fit for you
npm run web                   # http://localhost:3210
```

Or from the terminal: `npm run dev -- research --file email.txt` (add `--deep` for full research).
Terminal runs appear in the web app too.

## What a run costs

A quick check is about $0.20 and a minute. Full research is about $1.30 and two to four minutes.
Repeat requests are served from cache for free. Spend is capped at $20 a month (`src/config.ts`);
new runs stop at the cap.

## Develop

`npm test` (unit tests), `npm run typecheck`, `npm run eval` (the five-company eval set; fill in
hand-checked ground truth in `evals/fixtures/index.ts`). See `CLAUDE.md` for the rules the code follows.
