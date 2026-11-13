# Backchannel

Sourced due diligence on the companies that approach you. Paste a recruiter email; get the
company's ownership, money, layoffs, leadership and employee sentiment, every fact linked to the
source behind it, plus scores, risks and questions to ask.

## Run it locally

```sh
npm install
cp .env.example .env     # add ANTHROPIC_API_KEY; leave the rest empty
npm run web              # http://localhost:3210
```

Locally, data lives in `.data/pglite` (real Postgres, in-process) and there is no sign-in.
From the terminal: `npm run dev -- research --file email.txt` (add `--deep` for full research).

## Deploy (Vercel + Supabase, about 15 minutes)

1. **Supabase project.** Create one at supabase.com. Then:
   - *Authentication > Users > Add user > Create new user*: your email, with "Auto confirm" on.
     Only existing users can sign in; nobody can sign up.
   - *Authentication > Emails > Magic link* template: add `{{ .Token }}` to the body, e.g.
     `Your Backchannel code is {{ .Token }}`. The app signs in with this 6-digit code, which works
     even when you open the email on a different device.
2. **Create the tables** from your machine, using the *Session pooler* connection string
   (Supabase > Connect):
   ```sh
   DATABASE_URL='postgresql://…:5432/postgres' npm run db:migrate
   ```
3. **Vercel.** Import the GitHub repo (or run `vercel` in this folder) and set these environment
   variables for Production:
   | Name | Value |
   |---|---|
   | `ANTHROPIC_API_KEY` | your key |
   | `DATABASE_URL` | Supabase *Transaction pooler* string (port 6543) |
   | `NEXT_PUBLIC_SUPABASE_URL` | Project Settings > API > URL |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Project Settings > API Keys > publishable key |
   | `ALLOWED_EMAILS` | your email |
4. Deploy, open the URL, sign in with the emailed code, and fill in your Profile.

The app refuses to run on Vercel without these variables, rather than run unprotected.

## How it is built

- **Research pipeline** (`src/pipeline`): parse, identify the company (stops to ask when unsure),
  ownership and money, people and leadership, then a synthesis with scores, flags and questions.
  Every claim must cite a source the web search actually returned, or it is dropped and listed as a gap.
- **Durable runs** (`src/workflows`): each stage is a separate, retried Vercel Workflow step, so a
  four-minute run survives the 300-second function limit, timeouts and redeploys.
- **Postgres** (`db/migrations`): opportunities, runs, append-only progress events, a spend ledger
  (the $20 monthly cap is a sum over it), an API response cache and your profile. Row-level security
  on every table; live progress over Supabase Realtime.

## What a run costs

A quick check is about $0.30 and a minute. Full research is about $1.20 and four to six minutes.
Repeat requests are served from the cache for free. Spend is capped at $20 a month
(`src/config.ts`); new research stops at the cap.

## Develop

`npm test`, `npm run typecheck`, `npm run eval` (fill in hand-checked ground truth in
`evals/fixtures/index.ts`). `CLAUDE.md` has the rules the code follows.
