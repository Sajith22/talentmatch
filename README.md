# TalentMatch

TalentMatch is a recruiter review app built with Next.js App Router, Node.js and PostgreSQL. It imports the assessment dataset once, ranks 472 candidate records across 10 jobs, and stores the results. The pages read saved results from SQL.

## Run locally

Requires Node.js 24 and the provided assessment data. Extract `Data.zip` to a separate directory with `corpus/` and `queries/` directly inside it. From this project directory:

```sh
npm ci
cp .env.example .env
npm run import -- "/path/to/extracted/Data"
npm run match
npm run dev
```

In Windows PowerShell use `Copy-Item .env.example .env`. Visit `http://localhost:3000/jobs`. With no `DATABASE_URL`, the app uses PGlite, an embedded PostgreSQL engine that stores its database under the ignored `.local/` directory. Stop the app before importing or rerunning matching against this local database.

`npm run import` replaces the dataset and clears old rankings in a transaction. `npm run match` regenerates all rankings and replaces `results/top10.csv`. Run these sequentially on a dedicated assessment database. `npm test` checks core extraction and scoring. `npm run build` checks the production bundle.

## Import

All 472 CV files and all 10 job files are used. Filenames are record IDs, including when two resumes share a name or email. The parser extracts the name from the first line and contacts from the header. It recognizes work and skills section labels, plus separate, aligned and pipe-delimited role date layouts. The most recent role supplies designation and company. Role intervals are combined at month granularity to avoid counting concurrent employment twice. A year-only range uses January through December where the month is unavailable. Present roles run through the current month. Missing values remain null or empty lists. The original text is stored for reviewer inspection. The Paralegal title is extracted from the opening sentence of job 46795.

Spot-check IDs include 10004, 10015, 10040, 10078, 10103, 10310, 11500 and 11663. These cover different section labels and both separate and inline date layouts.

## Matching and scoring

The baseline scores all 4,720 pairs. An evidence index consists of the CV's skills and role titles and descriptions. Identity and contact fields play no role in scoring.

| Factor | Rule |
| --- | --- |
| Skills, 50 points | 50 × matched requirements / listed requirements. Whole-phrase matching includes a curated equivalence list, such as point of sale for POS Systems Operation and ETL for Extract, Transform, Load. |
| Experience, 30 points | 30 × min(documented years / expected years, 1). Expected years are an assumption based on title seniority. Director is 8, senior engineer and regional manager are 5, cashier and cleaner are 1, and the remaining specialist roles are 3. |
| Designation, 20 points | 20 for the same or a very similar current role, 10 for related work, and 0 for unrelated or missing roles. Role-specific title patterns are in `lib/matching.js`. |

Totals sum the displayed factor scores. Ties favor greater skill coverage, then lower numeric candidate ID. Reasons come from the factors and identify examples of matched skills, documented years and latest role. IELTS remains a missing skill when the CV shows general English teaching without exam-specific evidence.

### Optional LLM skill adjudication

Set `LLM_BASE_URL` (the provider's OpenAI-compatible API base, typically ending in `/v1`), `LLM_API_KEY` and `LLM_MODEL` before running `npm run match`. The matcher sends job title, baseline missing skills and selected CV evidence lines for up to 12 candidates per job. Enable this only if the data owner permits processing CV excerpts with the provider. It omits contact and identity fields and redacts common contact patterns in the evidence. The model returns skill and line indexes with a verbatim quote. The code rejects invalid indexes and quotes absent from the cited line. Human review is still needed to judge whether a quote actually proves equivalence. Failed requests retain baseline scores and the script reports the failure count. The model cannot set the numerical scores directly.

ChatGPT assisted with implementation and equivalence rules. The committed CSV comes from the deterministic baseline. The external LLM path is configurable and the assessment data has not been sent to an external model API.

## Deploy to Vercel with hosted PostgreSQL

1. Create a dedicated hosted PostgreSQL database, for example Neon. Use a TLS connection string. Put it in the local ignored `.env` as `DATABASE_URL`. On an empty hosted database run the same import and match commands locally using your extracted data.
2. Publish the source and `results/top10.csv` to a public GitHub repository. Confirm `git status --short` contains no raw data, local database or secrets. The source package excludes those files. If you initialize Git yourself:

   ```sh
   git init -b main
   git add .
   git commit -m "Build TalentMatch assessment"
   git remote add origin https://github.com/YOUR-USERNAME/talentmatch.git
   git push -u origin main
   ```

3. Import the repository into Vercel as a Next.js project with Node.js 24. Set `DATABASE_URL` and a strong random `REVIEW_PASSWORD` in the production environment, then deploy. For a deployed instance with a database URL, the app requires reviewer access. The username is `reviewer`. Share the password with the assessors privately. Use HTTPS for the hosted review URL.
4. Open the live link in a private browser session and verify it prompts for credentials. Sign in, open a job, apply the minimum-score filter, and open a candidate profile and original CV. Reply to the assignment email with both URLs and the reviewer access instructions.

## Tradeoffs and next steps

The matcher uses role-specific wording rules. It can miss paraphrases and occasionally over-credit ambiguous evidence. Total career experience may include unrelated years because the brief scores total documented experience. Different CVs with the same name remain separate records by design. The results support human review. More time would go to labeling a relevance sample per job, measuring ranking quality, and validating the optional LLM against the baseline and that labeled sample.
