import Link from 'next/link';
import { rows } from '../../lib/db.js';
import { Pager, readNumber } from '../components.jsx';

export const dynamic = 'force-dynamic';
const pageSize = 24;

export default async function Candidates({ searchParams }) {
  const query = await searchParams;
  const q = typeof query.q === 'string' ? query.q.trim().slice(0, 120) : '';
  const predicate = "strpos(lower(concat_ws(' ', id, name, designation, company, array_to_string(skills, ' '))), lower($1)) > 0 OR $1 = ''";
  const [{ total }] = await rows(`SELECT count(*)::int AS total FROM candidates WHERE ${predicate}`, [q]);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = readNumber(query.page, 1, pages, 1);
  const profiles = await rows(`SELECT id,name,designation,company,experience FROM candidates WHERE ${predicate}
    ORDER BY name,id LIMIT $2 OFFSET $3`, [q, pageSize, (page - 1) * pageSize]);
  return <>
    <p className="eyebrow">Recruitment workspace</p><h1>Candidates</h1>
    <p className="lede">Search profiles by name, CV ID, role, company or skill.</p>
    <div className="section-head"><p>{total} profiles</p><form>
      <label htmlFor="q">Find a candidate</label><input id="q" name="q" type="search" defaultValue={q} maxLength={120} /><button>Search</button>
    </form></div>
    {profiles.length ? <div className="grid">{profiles.map((candidate) => <Link className="panel card" key={candidate.id} href={`/candidates/${candidate.id}`}>
      <small>CV {candidate.id}</small><h2>{candidate.name}</h2><p>{candidate.designation || 'Designation unavailable'}</p>
      {candidate.company && <p>{candidate.company}</p>}
      <div className="card-footer"><span>{candidate.experience == null ? 'Dates unavailable' : `${Number(candidate.experience)} years documented`}</span><span aria-hidden="true">→</span></div>
    </Link>)}</div> : <p className="panel">{q ? 'No profiles match your search.' : 'No profiles have been imported.'}</p>}
    <Pager page={page} pages={pages} query={{ q }} />
  </>;
}
