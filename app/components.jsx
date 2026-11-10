import Link from 'next/link';

export function Tags({ values, kind }) {
  if (!values.length) return <span className="muted">None</span>;
  return <ul className={`tags ${kind ?? ''}`}>{values.map((value) => <li key={value}>{value}</li>)}</ul>;
}

export function Pager({ page, pages, query }) {
  if (pages <= 1) return null;
  const href = (target) => '?' + new URLSearchParams({ ...query, page: String(target) });
  return <nav className="pager" aria-label="Pagination">
    {page > 1 && <Link href={href(page - 1)}>← Previous</Link>}
    <span>Page {page} of {pages}</span>
    {page < pages && <Link href={href(page + 1)}>Next →</Link>}
  </nav>;
}

export function readNumber(value, min, max, fallback) {
  return typeof value === 'string' && value.trim() && Number.isFinite(Number(value))
    ? Math.max(min, Math.min(max, Math.floor(Number(value)))) : fallback;
}
