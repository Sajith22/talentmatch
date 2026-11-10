import Link from 'next/link';
import { rows } from '../../lib/db.js';

export const dynamic = 'force-dynamic';

export default async function Jobs() {
  try {
    const jobs = await rows(`
      SELECT j.id, j.title, j.expected_years, cardinality(j.skills) AS skill_count,
             count(m.candidate_id)::int AS ranked, max(m.total_score) AS best
      FROM jobs j
      LEFT JOIN matches m ON m.job_id = j.id
      GROUP BY j.id, j.title, j.expected_years, j.skills
      ORDER BY j.id
    `);

    return (
      <>
        <p className="eyebrow">Recruitment workspace</p>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-2">Jobs</h1>
        <p className="lede">Open a role to review ranked candidates and the evidence behind their scores.</p>
        <div className="stats">
          <strong>{jobs.length} roles</strong>
          <span>{jobs.filter((job) => job.ranked > 0).length} matched</span>
        </div>
        {jobs.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {jobs.map((job) => (
              <Link className="panel card p-5 flex flex-col justify-between hover:shadow-md transition-shadow" href={`/jobs/${job.id}`} key={job.id}>
                <div>
                  <small>ROLE {job.id}</small>
                  <h2 className="text-xl font-semibold mt-1 mb-2">{job.title}</h2>
                  <p>{job.skill_count} required skills · {job.expected_years} years expected</p>
                </div>
                <div className="card-footer mt-4 pt-3 border-t border-gray-100 flex justify-between items-center">
                  <span>
                    {job.ranked > 0 ? `${job.ranked} ranked · Best ${Number(job.best)}/100` : 'not matched yet'}
                  </span>
                  <span aria-hidden="true">→</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="panel">Import the assessment dataset to view jobs.</p>
        )}
      </>
    );
  } catch (err) {
    return (
      <div className="panel error border-red-300 bg-red-50 p-6 rounded-lg text-red-900">
        <h2 className="text-xl font-bold text-red-800 mb-2">Failed to load jobs query</h2>
        <p className="text-sm font-mono bg-red-100 p-3 rounded mb-3">{err.message}</p>
        <p className="text-sm text-red-700">Please check your database connection and ensure dataset migration has been run.</p>
      </div>
    );
  }
}
