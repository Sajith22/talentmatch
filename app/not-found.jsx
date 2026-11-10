import Link from 'next/link';
export default function NotFound() {
  return <section className="panel"><h1>Record unavailable</h1>
    <p>This record is missing or the link is out of date.</p><Link href="/jobs">Back to jobs</Link>
  </section>;
}
