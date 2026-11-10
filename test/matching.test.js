import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCandidate, parseJob, parseDateRange, mergeIntervals, CONFIG } from '../lib/parse.js';
import { score, candidateEvidence, matchSkillToken } from '../lib/matching.js';

test('skill matching uses token boundaries and literal matching for symbols', () => {
  // "Java" must not match "JavaScript"
  assert.equal(matchSkillToken('Proficient in JavaScript development', 'Java'), false);
  assert.equal(matchSkillToken('Proficient in Java development', 'Java'), true);

  // "C" must not match "C#" or "C++"
  assert.equal(matchSkillToken('Skilled in C# and .NET', 'C'), false);
  assert.equal(matchSkillToken('Skilled in C++ programming', 'C'), false);
  assert.equal(matchSkillToken('Skilled in C programming', 'C'), true);

  // "C++", "C#", and "Node.js" must match literally
  assert.equal(matchSkillToken('Experience with C++ systems', 'C++'), true);
  assert.equal(matchSkillToken('Experience with C programming', 'C++'), false);

  assert.equal(matchSkillToken('Expert in C# backend APIs', 'C#'), true);
  assert.equal(matchSkillToken('Expert in C backend APIs', 'C#'), false);

  assert.equal(matchSkillToken('Building apps with Node.js and Express', 'Node.js'), true);
  assert.equal(matchSkillToken('Building apps with Node or JS', 'Node.js'), false);
});

test('alias matching: ETL matches Extract, Transform, Load through the alias list', () => {
  const job = { id: 'test-job', title: 'Data Engineer', skills: ['ETL'], expected_years: 3 };
  const candidate = {
    id: 'cand-etl',
    skills: ['Extract, Transform, Load'],
    history: [],
    designation: 'Data Engineer',
    experience: 4
  };
  const result = score(job, candidate, candidateEvidence(candidate));
  assert.deepEqual(result.matched, ['ETL']);
  assert.equal(result.skillsScore, 50);

  // Also test reverse: job requiring 'Extract, Transform, Load' matches CV with 'ETL'
  const job2 = { id: 'test-job-2', title: 'Data Engineer', skills: ['Extract, Transform, Load'], expected_years: 3 };
  const candidate2 = {
    id: 'cand-etl-2',
    skills: ['ETL'],
    history: [],
    designation: 'Data Engineer',
    experience: 4
  };
  const result2 = score(job2, candidate2, candidateEvidence(candidate2));
  assert.deepEqual(result2.matched, ['Extract, Transform, Load']);
  assert.equal(result2.skillsScore, 50);
});

test('date parsing handles all required formats, separators, and current tokens in one table', () => {
  const pinnedDate = new Date('2026-11-10');
  // Pin currentDate in config for deterministic testing
  CONFIG.currentDate = pinnedDate;

  // Single test table covering all specified formats, separators, and end tokens
  const table = [
    // Standard formats with en-dash
    { input: '01/2021 – Present', expectedMonths: 71, desc: 'MM/YYYY to Present with en dash' },
    { input: '2021.01 – 2023.06', expectedMonths: 30, desc: 'YYYY.MM to YYYY.MM with en dash' },
    { input: '2014 - 2017', expectedMonths: 48, desc: 'Year-only range YYYY - YYYY (Jan start year to Dec end year)' },
    { input: 'January 2021 – Present', expectedMonths: 71, desc: 'Full month MMMM YYYY to Present with en dash' },
    { input: 'Sept 2019 – Jun 2021', expectedMonths: 22, desc: 'Abbreviated month Sept YYYY to Jun YYYY with en dash' },
    { input: 'Jan 2019 – Dec 2020', expectedMonths: 24, desc: 'Jan YYYY to Dec YYYY with en dash' },

    // End tokens: "Current", "Now", "Till date"
    { input: '01/2021 - Current', expectedMonths: 71, desc: 'Hyphen separator with Current' },
    { input: '01/2021 — Now', expectedMonths: 71, desc: 'Em dash separator with Now' },
    { input: '01/2021 to Till date', expectedMonths: 71, desc: 'Word "to" separator with Till date' },

    // Separators: en dash (–), em dash (—), hyphen (-), and "to"
    { input: 'Jan 2019 - Dec 2020', expectedMonths: 24, desc: 'Hyphen separator' },
    { input: 'Jan 2019 — Dec 2020', expectedMonths: 24, desc: 'Em dash separator' },
    { input: 'Jan 2019 – Dec 2020', expectedMonths: 24, desc: 'En dash separator' },
    { input: 'Jan 2019 to Dec 2020', expectedMonths: 24, desc: 'to separator' }
  ];

  for (const row of table) {
    const range = parseDateRange(row.input, pinnedDate);
    assert.ok(range, `Expected "${row.input}" to be parseable (${row.desc})`);
    const months = range.to - range.from;
    assert.equal(months, row.expectedMonths, `Mismatch for "${row.input}" (${row.desc}): expected ${row.expectedMonths}, got ${months}`);
  }
});

test('unparseable ranges are logged and counted per candidate without being silently dropped', () => {
  const pinnedDate = new Date('2026-11-10');
  const logged = [];
  const originalWarn = console.warn;
  console.warn = (...args) => logged.push(args.join(' '));

  try {
    const raw = `Candidate Test
contact@example.com
Work History
Software Engineer
Tech Corp
Invalid Date Range - Ongoing
Did some coding.
Product Manager
Old Corp
2015 - 2018
Managed roadmap.`;

    const candidate = parseCandidate('cand-unparsed-1', raw, pinnedDate);
    assert.equal(candidate.unparsedCount, 1, 'Should count exactly 1 unparseable range');
    assert.ok(candidate.unparsedRanges.includes('Invalid Date Range - Ongoing'), 'Should store the unparsed range string');
    assert.ok(logged.some((msg) => msg.includes('cand-unparsed-1') && msg.includes('Invalid Date Range - Ongoing')), 'Should log unparseable range to console');
  } finally {
    console.warn = originalWarn;
  }
});

test('overlapping roles count once via interval merging (union not sum)', () => {
  // Counting convention:
  // Each calendar month is treated as a half-open unit interval [fromMonth, toMonth)
  // where fromMonth = year * 12 + startMonthIndex (0-indexed, inclusive)
  // and toMonth = year * 12 + endMonthIndex + 1 (inclusive of end month).
  //
  // Role A: 2018-01 to 2020-06 -> [2018*12 + 0, 2020*12 + 6) = 30 months.
  // Role B: 2019-01 to 2021-01 -> [2019*12 + 0, 2021*12 + 1) = 25 months.
  //
  // Sum of lengths = 30 + 25 = 55 months.
  // Union interval = [2018*12 + 0, 2021*12 + 1) = 37 months.
  // Expected month count: exactly 37 months (3.08 years).

  const roleA = [2018 * 12 + 0, 2020 * 12 + 6]; // 30 months
  const roleB = [2019 * 12 + 0, 2021 * 12 + 1]; // 25 months

  const merged = mergeIntervals([roleA, roleB]);
  assert.deepEqual(merged, [[2018 * 12 + 0, 2021 * 12 + 1]]);
  const totalMonths = merged.reduce((sum, [start, end]) => sum + (end - start), 0);
  assert.equal(totalMonths, 37, 'Union of overlapping roles must be exactly 37 months (not 55 months)');

  // Test full candidate experience calculation with these overlapping roles
  const raw = `Overlap Candidate
overlap@example.com
Work History
Role One
Company A
01/2018 – 06/2020
Evidence A
Role Two
Company B
01/2019 – 01/2021
Evidence B`;

  const candidate = parseCandidate('cand-overlap', raw, new Date('2026-11-10'));
  // 37 months / 12 = 3.08 years (rounded to 2 decimal places)
  assert.equal(candidate.experience, 3.08);
});

test('year-only ranges run from January of start year to December of end year (assumption)', () => {
  // Assumption: Year-only ranges (e.g. 2014 - 2017) run from January 1 of start year (month 0)
  // to December 31 of end year (month 12), representing 4 full years (48 months).
  const range = parseDateRange('2014 - 2017', new Date('2026-11-10'));
  assert.ok(range);
  assert.equal(range.from, 2014 * 12 + 0); // Jan 2014
  assert.equal(range.to, 2017 * 12 + 12); // Dec 2017
  assert.equal(range.to - range.from, 48); // 4 full years = 48 months
});

test('uses file identity and counts overlapping roles only once', () => {
  const raw = `Example Name
+94 77 123 4567 | user@example.com
Work History
Cashier
Shop One
January 2024 – Present
Process POS payments.
Retail Associate
Shop Two
January 2023 – December 2024
Restocked shelves.
Professional Skills
Cash handling, point of sale`;
  const candidate = parseCandidate('001', raw, new Date('2025-12-10'));
  assert.equal(candidate.id, '001');
  assert.equal(candidate.name, 'Example Name');
  assert.equal(candidate.designation, 'Cashier');
  assert.equal(candidate.company, 'Shop One');
  assert.equal(candidate.email, 'user@example.com');
  assert.equal(candidate.phone, '+94 77 123 4567');
  assert.equal(candidate.experience, 3);
  assert.deepEqual(candidate.skills, ['Cash handling', 'point of sale']);
});

test('extracts inline and pipe-separated date layouts', () => {
  const inline = parseCandidate('101', 'Example\nWork Experience\nShop\nCashier     Jan 2021 - Dec 2022');
  assert.equal(inline.designation, 'Cashier');
  assert.equal(inline.experience, 2);
  const pipe = parseCandidate('102', 'Example\nProfessional Experience\nDirector\nCompany | City | 2020 – 2022');
  assert.equal(pipe.company, 'Company');
  assert.equal(pipe.experience, 3);
});

test('uses aliases, caps experience and records unsupported skills', () => {
  const job = parseJob('44719', 'Cashier\nAbout Required Skills:\n- POS Systems Operation\n- Shelf Restocking\n\nWhat We Offer');
  const candidate = { id: '1', skills: ['POS'], history: [], designation: 'Cashier', experience: 7 };
  const match = score(job, candidate, candidateEvidence(candidate));
  assert.equal(match.total, 75);
  assert.equal(match.skillsScore, 25);
  assert.equal(match.experienceScore, 30);
  assert.equal(match.designationScore, 20);
  assert.deepEqual(match.missing, ['Shelf Restocking']);
  const weak = { id: '2', skills: ['postgraduate studies'], history: [], designation: null, experience: null };
  assert.equal(score(job, weak, candidateEvidence(weak)).total, 0);
});

test('extracts a job title from the first sentence', () => {
  const job = parseJob('46795', 'We are seeking a Paralegal, Privacy and Information Management to join our team.\nRequired Skills\n- Legal Research');
  assert.equal(job.title, 'Paralegal, Privacy and Information Management');
  assert.equal(job.expected_years, 3);
});
