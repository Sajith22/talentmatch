# TalentMatch

TalentMatch is a recruiter review app built with Next.js App Router, Node.js and PostgreSQL. It imports the assessment dataset once, ranks 472 candidate records across 10 jobs, and stores the results. The pages read saved results from SQL.

## Local setup

Requires Node.js 24 and the provided assessment data. Extract `Data.zip` to a separate directory with `corpus/` and `queries/` directly inside it. From this project directory:

```sh
npm ci
cp .env.example .env        # Windows PowerShell: Copy-Item .env.example .env
# Edit .env and set DATABASE_URL (leave blank for local embedded PGlite)
```

Visit `http://localhost:3000/jobs` after running the import and match steps below.  
With no `DATABASE_URL`, the app uses PGlite, an embedded PostgreSQL engine that stores its database under the ignored `.local/` directory.

## How to run import, match, and export

Stop the dev server before running these commands if you are using the local PGlite database. Run them sequentially:

```sh
# 1. Import all CVs and job files into the database (clears old data first)
npm run import -- "/path/to/extracted/Data"

# 2. Score all candidate-job pairs and write results/top10.csv
npm run match

# 3. Start the development server to browse results
npm run dev
```

The import reads every file in `corpus/` and `queries/`. It replaces the full dataset in one transaction, so re-running it is safe.  
The match script scores all 4,720 pairs (472 candidates × 10 jobs), writes them to the `matches` table, and atomically writes `results/top10.csv` only after the database transaction succeeds.  
The CSV is committed to the repository so reviewers can inspect rankings without running the pipeline.

```sh
# Run tests
npm test

# Build the production bundle
npm run build
```

## CV extraction approach and candidate IDs

Each file in `corpus/` has a numeric filename. That filename is the candidate ID — the CV text inside is not consulted for identity. This means two files with the same name or email remain separate records.

The parser (`lib/parse.js`) extracts fields in this order:

1. **Name** — first non-blank line of the file.
2. **Email and phone** — scanned from the header block (top ~15 lines) using regex patterns.
3. **Skills** — lines under section headings that contain "SKILL" or "COMPETENC". Bullet-prefixed lines and comma-separated inline lists are both handled.
4. **Work history** — lines under section headings that contain "EXPERIENCE", "EMPLOYMENT", "HISTORY", "WORK", or similar. The parser recognises three date layouts:
   - Separate line: `Month YYYY – Month YYYY` or `Month YYYY – Present`
   - Aligned/indented date column on the same line as the job title
   - Pipe-delimited: `Job Title | Company | Jan 2019 – Dec 2021`
5. **Designation and company** — taken from the most recent role (the first date range found).
6. **Experience** — total documented months, computed by merging overlapping intervals so concurrent roles count once. Stored as fractional years.
7. **Raw text** — stored verbatim for reviewer inspection.

**Year-only assumption:** When only a year is given (e.g. `2014 – 2017`), the parser treats the start as January of the start year and the end as December of the end year. This maximises the documented experience from the available information and is the most common convention in recruitment. The assumption is documented here and in `lib/parse.js`.

**Present roles:** "Present", "Current", "Now", and "Till date" resolve to the configured current date, which defaults to `2026-11-10`. Tests pin this value via the `CONFIG` export.

**Unparsed ranges:** Zero date ranges were unparsed across all 472 CVs with the current regex. Lines that superficially resemble date ranges but are not (e.g. company location lines containing place names) are correctly ignored.

Spot-check IDs include 10004, 10015, 10040, 10078, 10103, 10310, 11500, and 11663, covering different section labels and both separate and inline date layouts.

## Matching method

The scorer (`lib/matching.js` and `scripts/match.js`) evaluates every one of the 4,720 candidate-job pairs. No shortlist or pre-filter is applied. Scoring every pair is a deliberate fairness choice: a candidate who matches poorly on one obvious signal might still rank highly on another, and a shortlist would hide that from the reviewer.

| Factor | Weight | Rule |
|---|---|---|
| Skills | 50 pts | `50 × matched / required`. Skills are matched at token boundaries — "Java" does not match "JavaScript", "C" does not match "C#" or "C++". Matching is case-insensitive and includes a bidirectional alias table (e.g. POS ↔ Point of Sale, ETL ↔ Extract Transform Load). |
| Experience | 30 pts | `30 × min(documented_years / expected_years, 1)`. Expected years are inferred from the job title using a keyword rule (see below). The score is capped at 30. |
| Designation | 20 pts | Token-overlap between the candidate's current title and the job title. Same or very similar title: 20 pts. Related: 10 pts. Unrelated or missing: 0 pts. Thresholds: containment ≥ 0.6 or Jaccard ≥ 0.45 → same; containment ≥ 0.25 or Jaccard ≥ 0.15 → related. |

**Expected-years rule (fallback):**

| Title keywords | Expected years |
|---|---|
| intern, junior, cashier, cleaner, housekeeper | 0–1 |
| (default, specialist, analyst) | 3 |
| senior, lead, manager | 5 |
| director, head | 8 |

Ties are broken by higher skills score, then lower numeric candidate ID.

Each `matches` row records which method produced each factor score (`skills_method`, `experience_method`, `designation_method`), one of `"llm"`, `"rule"`, or `"dictionary"`.

## LLM judgments and stored outputs

Three optional LLM judgments can be enabled by setting `LLM_ENABLED=true` and the three `LLM_*` variables. All calls go to an OpenAI-compatible chat endpoint. When disabled (the default), all three fall back to the deterministic rules described in the matching section.

| Judgment | Trigger | Shape | Fallback |
|---|---|---|---|
| Skill aliases | Once per job | `{"skills":[{"skill":"…","aliases":["…"]}]}` | Existing alias dictionary |
| Expected years | Once per job | `{"years": 0–15, "reason": "…"}` | Title-keyword rule table |
| Designation label | Batched per job over unique candidate titles | `{"labels":[{"title":"…","label":"same"\|"related"\|"unrelated"}]}` | Token-overlap thresholds |

The LLM is sent only what each judgment needs: job title, required skill names, or normalized candidate titles. Names, emails, phone numbers, and raw CV text are never sent.

Every LLM response is stored in the `llm_outputs` table:

| Column | Description |
|---|---|
| `id` | Auto-increment primary key |
| `kind` | `"aliases"`, `"expected_years"`, or `"designation"` |
| `job_id` | Job the output belongs to (nullable for global judgments) |
| `input_hash` | SHA-256 of the input sent to the model |
| `model` | Model identifier used |
| `prompt_version` | Integer version of the prompt template |
| `output_json` | Full JSON response from the model, validated against schema |
| `created_at` | Timestamp |

A re-run reuses a stored output when the `input_hash` matches, so the LLM is called only for genuinely new inputs. Schema validation is strict — malformed output is rejected and the fallback is used instead.

## Known limitations

- **Experience is total career experience.** A candidate with 10 years in an unrelated field gets full experience credit. The brief scores total documented years.
- **Alias coverage is hand-curated.** The alias table covers the most common equivalences in this dataset but cannot cover all possible paraphrases.
- **Designation overlap is title-only.** The scorer uses the candidate's most recent job title. A candidate with a relevant title buried in past roles may score lower.
- **Year-only ranges are approximate.** See the year-only assumption section above.
- **LLM path is untested against a live API** in this repository. The fallback paths are fully tested.
- **Different CVs with the same name are separate records by design.** Two files with the same content but different filenames produce two separate candidates with different scores.

## AI tools used

Antigravity (Google DeepMind) assisted with implementation: writing `lib/parse.js`, `lib/matching.js`, `lib/llm.js`, the test suite, the match script, and the UI pages. The committed `results/top10.csv` comes from the deterministic baseline (LLM disabled). The assessment data has not been sent to any external model API.

## Next steps

- Label a relevance sample per job and measure NDCG to validate ranking quality.
- Broaden the alias table or enable the LLM path to cover domain-specific paraphrases.
- Add weighted experience: score only years in roles relevant to the target job.
- Surface the candidate's history timeline on the detail page.

## Reviewer access

The app is protected by HTTP Basic Auth middleware (`proxy.js`). To access a deployed instance:

1. The deployer sets a strong random value as `REVIEW_PASSWORD` in the Vercel environment variables.
2. Open the hosted URL in a browser. You will be prompted for credentials.
3. Enter username `reviewer` and the password shared with you privately.

For local development, set `REVIEW_PASSWORD` in your `.env` file. Leave it blank to bypass auth (the middleware only challenges when a password is configured).
