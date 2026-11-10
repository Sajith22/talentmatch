'use client';
export default function ErrorPage({ reset }) {
  return <section className="panel"><h1>TalentMatch is unavailable</h1>
    <p>Check the database connection and confirm the dataset has been imported.</p>
    <button onClick={reset}>Try again</button>
  </section>;
}
