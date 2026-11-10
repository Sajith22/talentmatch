import { mkdir, writeFile, rename } from 'node:fs/promises';
import { close, rows, transaction } from '../lib/db.js';
import { byRank, candidateEvidence, score } from '../lib/matching.js';
import { adjudicate } from '../lib/adjudicate.js';

const csvCell = (value) => '"' + String(value).replaceAll('"', '""') + '"';
const llmSettings = ['LLM_BASE_URL', 'LLM_API_KEY', 'LLM_MODEL'].filter((key) => process.env[key]);
if (llmSettings.length > 0 && llmSettings.length !== 3) throw new Error('Configure all three LLM variables or leave them empty.');
const useLlm = llmSettings.length === 3;
const csv = ['job_id,rank,candidate_id,total_score,skills_score,experience_score,designation_score,reason'];
let failures = 0;
try {
  const jobs = await rows('SELECT * FROM jobs ORDER BY id');
  const candidates = await rows('SELECT id, designation, experience, skills, history FROM candidates');
  if (!jobs.length || !candidates.length) throw new Error('Import jobs and candidates first.');
  const evidence = new Map(candidates.map((candidate) => [candidate.id, candidateEvidence(candidate)]));
  const all = [];
  for (const job of jobs) {
    const results = candidates.map((candidate) => score(job, candidate, evidence.get(candidate.id))).sort(byRank);
    if (useLlm) {
      const lookup = new Map(candidates.map((candidate) => [candidate.id, candidate]));
      for (let i = 0; i < Math.min(12, results.length); i++) {
        const baseline = results[i];
        const candidate = lookup.get(baseline.candidateId);
        try {
          const confirmed = await adjudicate(job, evidence.get(candidate.id), baseline);
          results[i] = score(job, candidate, evidence.get(candidate.id), confirmed);
        } catch {
          failures++;
        }
      }
      results.sort(byRank);
    }
    all.push(...results);
    results.slice(0, 10).forEach((m, index) => csv.push([
      m.jobId, index + 1, m.candidateId, m.total, m.skillsScore, m.experienceScore, m.designationScore, m.reason
    ].map(csvCell).join(',')));
    console.log(`${job.id} ${job.title}: ${results.length} matches, highest ${results[0].total}`);
  }
  await transaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(141)');
    await client.query('DELETE FROM matches');
    for (let offset = 0; offset < all.length; offset += 200) {
      const batch = all.slice(offset, offset + 200);
      const values = batch.flatMap((m) => [m.jobId, m.candidateId, m.total, m.skillsScore, m.experienceScore, m.designationScore, m.matched, m.missing, m.reason]);
      const placeholders = batch.map((_, row) => '(' + Array.from({ length: 9 }, (_, column) => '$' + (row * 9 + column + 1)).join(',') + ')');
      await client.query('INSERT INTO matches VALUES ' + placeholders.join(','), values);
    }
  });
  await mkdir('results', { recursive: true });
  await writeFile('results/.top10.tmp', csv.join('\n') + '\n');
  await rename('results/.top10.tmp', 'results/top10.csv');
  if (failures) console.warn(`${failures} LLM requests failed. The affected pairs retain their baseline scores.`);
  console.log(`Saved ${all.length} pairs and exported ${csv.length - 1} ranked rows.`);
} finally {
  await close();
}
