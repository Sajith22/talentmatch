import Link from 'next/link';
import { rows } from '../../lib/db.js';
import { Pager, readNumber } from '../components.jsx';

export const dynamic = 'force-dynamic';
const pageSize = 24;

export default async function Candidates({ searchParams }) {
  const query = await searchParams;
  const q = typeof query.q === 'string' ? query.q.trim().slice(0, 120) : '';

  try {
    // Searchable list by candidate ID, name, or title (designation)
    const predicate = `(
      id = $1
      OR strpos(lower(name), lower($1)) > 0
      OR strpos(lower(coalesce(designation, '')), lower($1)) > 0
      OR strpos(lower(coalesce(company, '')), lower($1)) > 0
      OR strpos(lower(concat_ws(' ', id, name, designation, company, array_to_string(skills, ' '))), lower($1)) > 0
      OR $1 = ''
    )`;

    const [{ total }] = await rows(
      `SELECT count(*)::int AS total FROM candidates WHERE ${predicate}`,
      [q]
    );

    const pages = Math.max(1, Math.ceil(total / pageSize));
    const page = readNumber(query.page, 1, pages, 1);

    const profiles = await rows(
      `SELECT id, name, designation, company, experience, skills
       FROM candidates
       WHERE ${predicate}
       ORDER BY name, id
       LIMIT $2 OFFSET $3`,
      [q, pageSize, (page - 1) * pageSize]
    );

    return (
      <>
        <p className="eyebrow">Recruitment workspace</p>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-2">Candidates</h1>
        <p className="lede mb-6 text-gray-600">Search profiles by candidate ID, name, or title.</p>

        <div className="section-head flex flex-wrap justify-between items-end gap-4 mb-6">
          <p className="text-sm font-medium text-gray-600">{total} profiles found</p>
          <form className="flex items-center gap-2">
            <label htmlFor="q" className="text-sm font-medium text-gray-700">
              Find a candidate
            </label>
            <input
              id="q"
              name="q"
              type="search"
              placeholder="Candidate ID, name, or title..."
              defaultValue={q}
              maxLength={120}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm w-64 max-w-full"
            />
            <button className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-md text-sm font-medium transition-colors">
              Search
            </button>
          </form>
        </div>

        {profiles.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {profiles.map((candidate) => (
              <Link
                className="panel card p-5 bg-white rounded-xl border border-gray-200 shadow-sm hover:border-emerald-600 hover:shadow-md transition flex flex-col justify-between"
                key={candidate.id}
                href={`/candidates/${candidate.id}`}
              >
                <div>
                  <small className="text-xs font-bold uppercase tracking-wide text-emerald-700">
                    CV {candidate.id}
                  </small>
                  <h2 className="text-lg font-bold text-gray-900 mt-1 mb-1">{candidate.name}</h2>
                  <p className="text-sm font-medium text-gray-700">{candidate.designation || 'Designation unavailable'}</p>
                  {candidate.company && <p className="text-xs text-gray-500 mt-0.5">{candidate.company}</p>}
                </div>
                <div className="card-footer mt-4 pt-3 border-t border-gray-100 flex justify-between items-center text-xs text-emerald-700 font-semibold">
                  <span>
                    {candidate.experience == null
                      ? 'Dates unavailable'
                      : `${Number(candidate.experience)} years documented`}
                  </span>
                  <span aria-hidden="true">→</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="panel p-6 bg-white rounded-xl text-center text-gray-600">
            {q ? 'No profiles match your search query.' : 'No profiles have been imported yet.'}
          </p>
        )}

        <Pager page={page} pages={pages} query={{ q }} />
      </>
    );
  } catch (err) {
    return (
      <div className="panel error border-red-300 bg-red-50 p-6 rounded-lg text-red-900">
        <h2 className="text-xl font-bold text-red-800 mb-2">Error loading candidates</h2>
        <p className="text-sm font-mono bg-red-100 p-3 rounded mb-3">{err.message}</p>
      </div>
    );
  }
}
