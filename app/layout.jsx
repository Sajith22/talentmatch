import Link from 'next/link';
import './style.css';

export const metadata = {
  title: 'TalentMatch | Recruitment workspace',
  description: 'Review candidate fit with transparent, evidence-based scores.',
  robots: { index: false, follow: false }
};

export default function Layout({ children }) {
  return <html lang="en"><body>
    <header><div className="bar">
      <Link href="/jobs" className="brand"><span>TM</span>TalentMatch</Link>
      <nav aria-label="Main navigation"><Link href="/jobs">Jobs</Link><Link href="/candidates">Candidates</Link></nav>
    </div></header>
    <main>{children}</main>
    <footer>TalentMatch · Recruitment assessment</footer>
  </body></html>;
}
