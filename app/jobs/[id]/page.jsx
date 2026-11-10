import Link from 'next/link';
import { notFound } from 'next/navigation';
import { rows } from '../../../lib/db.js';
import { Pager, Tags, readNumber } from '../../components.jsx';

export const dynamic = 'force-dynamic';
const pageSize = 20;

export default async function Job({ params, searchParams }) {
  const { id } = await params;
  const query = await searchParams;
  const min = readNumber(query.min, 0, 100, 0);
  const [job] = await rows('SELECT * FROM jobs WHERE id=$1', [id]);
  if (!job) notFound();
  const [{ ranked, visible }] = await rows(
    'SELECT count(*)::int AS ranked, count(*) FILTER (WHERE total_score >= $2)::int AS visible FROM matches WHERE job_id=$1', [id, min]);
  const pages = Math.max(1, Math.ceil(visible / pageSize));
  const page = readNumber(query.page, 1, pages, 1);
  const matches = await rows(`SELECT m.*, c.name, c.designation FROM matches m JOIN candidates c ON c.id=m.candidate_id
    WHERE job_id=$1 AND total_score >= $2 ORDER BY total_score DESC, skills_score DESC, candidate_id::int
    LIMIT $3 OFFSET $4`, [id, min, pageSize, (page - 1) * pageSize]);
  return <>
    <Link className="back" href="/jobs">← All jobs</Link>
    <p className="eyebrow">Role {id}</p><h1>{job.title}</h1>
    <p className="lede">{job.expected_years} years expected <span className="muted">(inferred from role seniority)</span></p>
    <section className="panel">
      <h2>Required skills</h2><Tags values={job.skills} />
      <details><summary>Read full job description</summary><p className="raw">{job.description}</p></details>
    </section>
    <section>
      <div className="section-head"><div><h2>Ranked candidates</h2><p>{visible} of {ranked} results</p></div>
      <form><label htmlFor="min">Minimum score</label><input id="min" name="min" type="number" min="0" max="100" defaultValue={min} /><button>Apply</button></form></div>
      {!matches.length && <p className="panel">{ranked ? 'No candidates meet this score. Try a lower minimum.' : 'Matching has not run yet. Run npm run match after importing the dataset.'}</p>}
      <div className="stack">{matches.map((m, i) => <article className="panel result" key={m.candidate_id}>
        <div className="result-head"><div><small>#{(page - 1) * pageSize + i + 1} · CV {m.candidate_id}</small>
          <h3><Link href={`/candidates/${m.candidate_id}`}>{m.name}</Link></h3><p>{m.designation || 'Designation unavailable'}</p></div>
          <div className="score">{Number(m.total_score)} <small>/ 100</small></div></div>
        <div className="factors"><span>Skills <b>{Number(m.skills_score)} / 50</b></span><span>Experience <b>{Number(m.experience_score)} / 30</b></span><span>Designation <b>{Number(m.designation_score)} / 20</b></span></div>
        <p className="reason">{m.reason}</p>
        <div className="split"><div><h4>Matched skills</h4><Tags values={m.matched} kind="positive" /></div><div><h4>Missing skills</h4><Tags values={m.missing} /></div></div>
      </article>)}</div>
      <Pager page={page} pages={pages} query={{ min: String(min) }} />
    </section>
  </>;
}
