import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCandidate, parseJob } from '../lib/parse.js';
import { score, candidateEvidence } from '../lib/matching.js';

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
