import { mkdir, writeFile, rename } from 'node:fs/promises';
import { stringify } from 'csv-stringify/sync';
import { close, rows, transaction } from '../lib/db.js';
import { byRank, candidateEvidence, score } from '../lib/matching.js';
import { getJobSkillAliases, getJobExpectedYears, getJobDesignationLabels } from '../lib/llm.js';

try {
  const jobs = await rows('SELECT id, title, description, skills, expected_years FROM jobs ORDER BY id');
  const candidates = await rows('SELECT id, designation, experience, skills, history FROM candidates');
  if (!jobs.length || !candidates.length) throw new Error('Import jobs and candidates first.');

  const evidence = new Map(candidates.map((candidate) => [candidate.id, candidateEvidence(candidate)]));
  const candidateTitles = candidates.map((c) => c.designation).filter(Boolean);

  const all = [];
  const top10Rows = [];

  for (const job of jobs) {
    // 1. Skill aliases judgment (LLM with stored output, or dictionary fallback)
    const { aliasesMap, method: skillsMethod } = await getJobSkillAliases(job);

    // 2. Expected years judgment (LLM with stored output, or rule fallback)
    const { years: expectedYears, method: experienceMethod } = await getJobExpectedYears(job);

    // 3. Designation classification (LLM with stored output, or rule fallback)
    const designationLabels = await getJobDesignationLabels(job, candidateTitles);

    const jobWithExpected = { ...job, expected_years: expectedYears };

    const results = candidates
      .map((candidate) => {
        const candEvidence = evidence.get(candidate.id);
        const desigInfo = candidate.designation ? designationLabels.get(candidate.designation) : null;
        const desigLabel = desigInfo?.label ?? 'unrelated';
        const desigMethod = desigInfo?.method ?? 'rule';

        const scored = score(jobWithExpected, candidate, candEvidence, { aliasesMap, designationLabel: desigLabel });
        scored.methods = {
          skills: skillsMethod,
          experience: experienceMethod,
          designation: desigMethod
        };
        return scored;
      })
      .sort(byRank);

    all.push(...results);

    // Top 10 rows for CSV
    results.slice(0, 10).forEach((m, index) => {
      top10Rows.push({
        job_id: m.jobId,
        rank: index + 1,
        candidate_id: m.candidateId,
        total_score: m.total,
        skills_score: m.skillsScore,
        experience_score: m.experienceScore,
        designation_score: m.designationScore,
        reason: m.reason
      });
    });

    console.log(`${job.id} ${job.title}: ${results.length} matches, highest ${results[0].total}`);
  }

  // Save DB results in ONE transaction
  await transaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(141)');
    await client.query('DELETE FROM matches');
    for (let offset = 0; offset < all.length; offset += 200) {
      const batch = all.slice(offset, offset + 200);
      const values = batch.flatMap((m) => [
        m.jobId,
        m.candidateId,
        m.total,
        m.skillsScore,
        m.experienceScore,
        m.designationScore,
        m.matched,
        m.missing,
        m.reason,
        m.methods.skills,
        m.methods.experience,
        m.methods.designation
      ]);
      const placeholders = batch.map(
        (_, row) => '(' + Array.from({ length: 12 }, (_, col) => '$' + (row * 12 + col + 1)).join(',') + ')'
      );
      await client.query(
        'INSERT INTO matches (job_id, candidate_id, total_score, skills_score, experience_score, designation_score, matched, missing, reason, skills_method, experience_method, designation_method) VALUES ' +
          placeholders.join(','),
        values
      );
    }
  });

  // Write CSV ONLY AFTER the transaction commit succeeds!
  const csvContent = stringify(top10Rows, {
    header: true,
    columns: [
      { key: 'job_id', header: 'job_id' },
      { key: 'rank', header: 'rank' },
      { key: 'candidate_id', header: 'candidate_id' },
      { key: 'total_score', header: 'total_score' },
      { key: 'skills_score', header: 'skills_score' },
      { key: 'experience_score', header: 'experience_score' },
      { key: 'designation_score', header: 'designation_score' },
      { key: 'reason', header: 'reason' }
    ]
  });

  await mkdir('results', { recursive: true });
  await writeFile('results/.top10.tmp', csvContent);
  await rename('results/.top10.tmp', 'results/top10.csv');

  console.log(`Saved ${all.length} pairs and exported ${top10Rows.length} ranked rows.`);
} finally {
  await close();
}
