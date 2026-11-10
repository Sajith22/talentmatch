import { readdir, readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { close, db, transaction } from '../lib/db.js';
import { parseCandidate, parseJob } from '../lib/parse.js';

async function load(path, folder, parse) {
  const directory = join(path, folder);
  const files = (await readdir(directory, { withFileTypes: true }))
    .filter((file) => file.isFile() && /^\d+$/.test(file.name));
  return Promise.all(files.map(async ({ name }) => parse(name, await readFile(join(directory, name), 'utf8'))));
}

const path = process.argv[2];
if (!path) throw new Error('Usage: npm run import -- path/to/unzipped/Data');
await mkdir('.local', { recursive: true });
try {
  const [jobs, candidates] = await Promise.all([load(path, 'queries', parseJob), load(path, 'corpus', parseCandidate)]);
  if (jobs.length !== 10 || jobs.some((job) => !job.skills.length) || candidates.length < 20) {
    throw new Error('Import requires ten jobs with required skills and at least 20 CVs.');
  }
  const database = await db();
  const schema = await readFile(new URL('../lib/schema.sql', import.meta.url), 'utf8');
  if (database.exec) await database.exec(schema);
  else await database.query(schema);
  await transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(141)");
    await client.query('DELETE FROM matches');
    await client.query('DELETE FROM candidates');
    await client.query('DELETE FROM jobs');
    for (const { id, title, description, skills, expected_years } of jobs) {
      await client.query('INSERT INTO jobs (id, title, description, skills, expected_years) VALUES ($1,$2,$3,$4,$5)', [id, title, description, skills, expected_years]);
    }
    for (const c of candidates) {
      await client.query('INSERT INTO candidates (id, name, email, phone, designation, company, experience, skills, raw, history) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [
        c.id, c.name, c.email, c.phone, c.designation, c.company, c.experience, c.skills, c.raw, JSON.stringify(c.history)
      ]);
    }
  });
  console.log(`Imported ${jobs.length} jobs and ${candidates.length} candidates.`);
} finally {
  await close();
}
