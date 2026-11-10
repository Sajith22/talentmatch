import Link from 'next/link';
import { rows } from '../../lib/db.js';

export const dynamic = 'force-dynamic';

export default async function Jobs() {
  const jobs = await rows(`SELECT j.id, j.title, j.expected_years, cardinality(j.skills) AS skill_count,
    count(m.candidate_id)::int AS ranked, max(m.total_score) AS best
    FROM jobs j LEFT JOIN matches m ON m.job_id=j.id GROUP BY j.id ORDER BY j.title`);
  return <>
    <p className="eyebrow">Recruitment workspace</p>
    <h1>Jobs</h1>
    <p className="lede">Open a role to review ranked candidates and the evidence behind their scores.</p>
    <div className="stats"><strong>{jobs.length} roles</strong><span>{jobs.filter((job) => job.ranked).length} matched</span></div>
    {jobs.length ? <div className="grid">{jobs.map((job) => <Link className="panel card" href={`/jobs/${job.id}`} key={job.id}>
      <small>ROLE {job.id}</small>
      <h2>{job.title}</h2>
      <p>{job.skill_count} required skills · {job.expected_years} years expected</p>
      <div className="card-footer"><span>{job.ranked ? `${job.ranked} ranked · Best ${Number(job.best)}/100` : 'Awaiting matching'}</span><span aria-hidden="true">→</span></div>
    </Link>)}</div> : <p className="panel">Import the assessment dataset to view jobs.</p>}
  </>;
}
