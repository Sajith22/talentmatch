import Link from 'next/link';
import { notFound } from 'next/navigation';
import { rows } from '../../../lib/db.js';
import { Tags } from '../../components.jsx';

export const dynamic = 'force-dynamic';

export default async function Candidate({ params }) {
  const { id } = await params;
  const [candidate] = await rows('SELECT * FROM candidates WHERE id=$1', [id]);
  if (!candidate) notFound();
  const jobs = await rows(`SELECT j.id,j.title,m.total_score,m.reason FROM matches m
    JOIN jobs j ON j.id=m.job_id WHERE m.candidate_id=$1
    ORDER BY m.total_score DESC,m.skills_score DESC,j.title`, [id]);
  const fields = [
    ['Latest designation', candidate.designation],
    ['Latest company', candidate.company],
    ['Documented experience', candidate.experience == null ? null : `${Number(candidate.experience)} years`],
    ['Email', candidate.email], ['Phone', candidate.phone]
  ];
  return <>
    <Link className="back" href="/candidates">← All candidates</Link>
    <p className="eyebrow">Candidate · CV {id}</p><h1>{candidate.name}</h1>
    <div className="split profile">
      <section className="panel"><h2>Extracted profile</h2>
        <dl>{fields.map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value || 'Unavailable'}</dd></div>)}</dl>
        <h3>Skills</h3><Tags values={candidate.skills} />
      </section>
      <section className="panel"><h2>Best-matching jobs</h2>
        {jobs.length ? <ol className="ranked-jobs">{jobs.map((job) => <li key={job.id}>
          <Link href={`/jobs/${job.id}`}>{job.title}</Link><strong>{Number(job.total_score)} / 100</strong>
        </li>)}</ol> : <p>Matching has not run yet.</p>}
      </section>
    </div>
    <section className="panel"><h2>Original CV</h2><details><summary>Show full CV text</summary><pre className="raw">{candidate.raw}</pre></details></section>
  </>;
}
