import Link from 'next/link';
import { notFound } from 'next/navigation';
import { rows } from '../../../lib/db.js';
import { Pager, Tags, readNumber } from '../../components.jsx';
import { inferExpectedYears } from '../../../lib/matching.js';

export const dynamic = 'force-dynamic';
const pageSize = 20;

export default async function Job({ params, searchParams }) {
  const { id } = await params;
  const query = await searchParams;
  const min = readNumber(query.min, 0, 100, 0);

  try {
    const [job] = await rows(
      'SELECT id, title, description, skills, expected_years FROM jobs WHERE id = $1',
      [id]
    );
    if (!job) notFound();

    const expectedMethodInfo = inferExpectedYears(job.title);

    const [{ ranked, visible }] = await rows(
      'SELECT count(*)::int AS ranked, count(*) FILTER (WHERE total_score >= $2)::int AS visible FROM matches WHERE job_id = $1',
      [id, min]
    );

    const pages = Math.max(1, Math.ceil(visible / pageSize));
    const page = readNumber(query.page, 1, pages, 1);

    const matches = await rows(
      `SELECT m.job_id, m.candidate_id, m.total_score, m.skills_score, m.experience_score, m.designation_score,
              m.matched, m.missing, m.reason, m.skills_method, m.experience_method, m.designation_method,
              c.name, c.designation
       FROM matches m
       JOIN candidates c ON c.id = m.candidate_id
       WHERE m.job_id = $1 AND m.total_score >= $2
       ORDER BY m.total_score DESC, m.skills_score DESC, m.candidate_id::int
       LIMIT $3 OFFSET $4`,
      [id, min, pageSize, (page - 1) * pageSize]
    );

    return (
      <>
        <Link className="back inline-block mb-4 text-emerald-700 hover:underline" href="/jobs">
          ← All jobs
        </Link>
        <p className="eyebrow">Role {id}</p>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-2">{job.title}</h1>
        <p className="lede mb-6 text-gray-600">
          <strong>{job.expected_years} years expected</strong>{' '}
          <span className="muted text-sm text-gray-500">
            (method: {expectedMethodInfo.method} · {expectedMethodInfo.reason})
          </span>
        </p>

        <section className="panel mb-6 p-6 bg-white rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold mb-3">Required skills</h2>
          <Tags values={job.skills} />
          <details className="mt-4 pt-3 border-t border-gray-100">
            <summary className="cursor-pointer text-sm font-medium text-emerald-700">Read full job description</summary>
            <p className="raw mt-2 text-sm text-gray-700 whitespace-pre-wrap">{job.description}</p>
          </details>
        </section>

        <section>
          <div className="section-head flex flex-wrap justify-between items-end gap-4 mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Ranked candidates</h2>
              <p className="text-sm text-gray-500">
                {ranked > 0 ? `${visible} of ${ranked} results (minimum score ≥ ${min})` : '0 candidates ranked'}
              </p>
            </div>
            <form className="flex items-center gap-2">
              <label htmlFor="min" className="text-sm font-medium text-gray-700">
                Minimum score
              </label>
              <input
                id="min"
                name="min"
                type="number"
                min="0"
                max="100"
                defaultValue={min}
                className="w-20 px-3 py-1.5 border border-gray-300 rounded-md text-sm"
              />
              <button className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-md text-sm font-medium transition-colors">
                Apply
              </button>
            </form>
          </div>

          {!matches.length && (
            <p className="panel p-6 bg-white rounded-xl text-center text-gray-600">
              {ranked > 0
                ? 'No candidates meet this score. Try a lower minimum.'
                : 'not matched yet'}
            </p>
          )}

          <div className="stack space-y-4">
            {matches.map((m, i) => (
              <article className="panel result p-5 bg-white rounded-xl border border-gray-200 shadow-sm" key={m.candidate_id}>
                <div className="result-head flex justify-between items-start gap-4">
                  <div>
                    <small className="text-xs uppercase font-bold text-emerald-700">
                      #{(page - 1) * pageSize + i + 1} · CV {m.candidate_id}
                    </small>
                    <h3 className="text-lg font-bold text-gray-900">
                      <Link className="hover:text-emerald-700 hover:underline" href={`/candidates/${m.candidate_id}`}>
                        {m.name}
                      </Link>
                    </h3>
                    <p className="text-sm text-gray-600">{m.designation || 'Designation unavailable'}</p>
                  </div>
                  <div className="score text-2xl font-black text-emerald-700 text-right">
                    {Number(m.total_score)}{' '}
                    <small className="text-xs font-normal text-gray-500">/ 100</small>
                  </div>
                </div>

                <div className="factors flex flex-wrap gap-2 my-3 text-xs">
                  <span className="px-2.5 py-1 bg-gray-50 border border-gray-200 rounded-md">
                    Skills: <strong className="font-semibold">{Number(m.skills_score)} / 50</strong>{' '}
                    <span className="text-gray-400">({m.skills_method || 'dictionary'})</span>
                  </span>
                  <span className="px-2.5 py-1 bg-gray-50 border border-gray-200 rounded-md">
                    Experience: <strong className="font-semibold">{Number(m.experience_score)} / 30</strong>{' '}
                    <span className="text-gray-400">({m.experience_method || 'rule'})</span>
                  </span>
                  <span className="px-2.5 py-1 bg-gray-50 border border-gray-200 rounded-md">
                    Designation: <strong className="font-semibold">{Number(m.designation_score)} / 20</strong>{' '}
                    <span className="text-gray-400">({m.designation_method || 'rule'})</span>
                  </span>
                </div>

                <p className="reason text-sm text-gray-700 my-2">{m.reason}</p>

                <div className="split grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 pt-3 border-t border-gray-100">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-800 mb-1">Matched skills</h4>
                    <Tags values={m.matched} kind="positive" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Missing skills</h4>
                    <Tags values={m.missing} />
                  </div>
                </div>
              </article>
            ))}
          </div>

          <Pager page={page} pages={pages} query={{ min: String(min) }} />
        </section>
      </>
    );
  } catch (err) {
    return (
      <div className="panel error border-red-300 bg-red-50 p-6 rounded-lg text-red-900">
        <h2 className="text-xl font-bold text-red-800 mb-2">Error loading job details</h2>
        <p className="text-sm font-mono bg-red-100 p-3 rounded mb-3">{err.message}</p>
        <Link className="text-sm font-semibold text-emerald-700 underline" href="/jobs">
          ← Return to jobs list
        </Link>
      </div>
    );
  }
}
