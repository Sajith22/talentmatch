import Link from 'next/link';
import { notFound } from 'next/navigation';
import { rows } from '../../../lib/db.js';
import { Tags } from '../../components.jsx';

export const dynamic = 'force-dynamic';

export default async function Candidate({ params }) {
  const { id } = await params;

  try {
    const [candidate] = await rows(
      'SELECT id, name, email, phone, designation, company, experience, skills, raw, history FROM candidates WHERE id = $1',
      [id]
    );
    if (!candidate) notFound();

    const jobs = await rows(
      `SELECT j.id, j.title, m.total_score, m.skills_score, m.experience_score, m.designation_score, m.reason
       FROM matches m
       JOIN jobs j ON j.id = m.job_id
       WHERE m.candidate_id = $1
       ORDER BY m.total_score DESC, m.skills_score DESC, j.title`,
      [id]
    );

    const fields = [
      ['Latest designation', candidate.designation],
      ['Latest company', candidate.company],
      ['Documented experience', candidate.experience == null ? null : `${Number(candidate.experience)} years`],
      ['Email', candidate.email],
      ['Phone', candidate.phone]
    ];

    return (
      <>
        <Link className="back inline-block mb-4 text-emerald-700 hover:underline" href="/candidates">
          ← All candidates
        </Link>
        <p className="eyebrow">Candidate · CV {id}</p>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-6">{candidate.name}</h1>

        <div className="split grid grid-cols-1 md:grid-cols-2 gap-6 profile mb-6">
          <section className="panel p-6 bg-white rounded-xl border border-gray-200 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100">Extracted profile</h2>
            <dl className="divide-y divide-gray-100 text-sm">
              {fields.map(([key, value]) => (
                <div className="py-2.5 flex justify-between gap-4" key={key}>
                  <dt className="text-gray-500 font-medium">{key}</dt>
                  <dd className="text-gray-900 text-right font-semibold">{value || 'Unavailable'}</dd>
                </div>
              ))}
            </dl>
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 mt-6 mb-2">Skills</h3>
            <Tags values={candidate.skills} />
          </section>

          <section className="panel p-6 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100">Best-matching jobs</h2>
            {jobs.length ? (
              <ol className="ranked-jobs space-y-3 overflow-y-auto max-h-96 pr-2">
                {jobs.map((job) => (
                  <li
                    className="p-3 bg-gray-50 hover:bg-emerald-50 rounded-lg border border-gray-100 transition flex justify-between items-center gap-4"
                    key={job.id}
                  >
                    <div>
                      <Link className="text-sm font-bold text-gray-900 hover:text-emerald-700 hover:underline block" href={`/jobs/${job.id}`}>
                        {job.title}
                      </Link>
                      <small className="text-xs text-gray-500">Role {job.id}</small>
                    </div>
                    <strong className="text-base font-bold text-emerald-700 whitespace-nowrap">
                      {Number(job.total_score)} <span className="text-xs font-normal text-gray-500">/ 100</span>
                    </strong>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-gray-500 my-auto text-center py-6">Matching has not run yet.</p>
            )}
          </section>
        </div>

        <section className="panel p-6 bg-white rounded-xl border border-gray-200 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900 mb-3">Original CV</h2>
          <details className="mt-2" open>
            <summary className="cursor-pointer text-sm font-semibold text-emerald-700 hover:underline mb-3">
              Full CV text
            </summary>
            <pre className="raw p-4 bg-gray-50 rounded-lg border border-gray-200 text-xs font-mono text-gray-800 overflow-x-auto whitespace-pre-wrap leading-relaxed">
              {candidate.raw}
            </pre>
          </details>
        </section>
      </>
    );
  } catch (err) {
    return (
      <div className="panel error border-red-300 bg-red-50 p-6 rounded-lg text-red-900">
        <h2 className="text-xl font-bold text-red-800 mb-2">Error loading candidate profile</h2>
        <p className="text-sm font-mono bg-red-100 p-3 rounded mb-3">{err.message}</p>
        <Link className="text-sm font-semibold text-emerald-700 underline" href="/candidates">
          ← Return to candidates list
        </Link>
      </div>
    );
  }
}
