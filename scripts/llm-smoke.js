import assert from 'node:assert/strict';
import { getJobSkillAliases, getJobExpectedYears, getJobDesignationLabels, isLlmEnabled } from '../lib/llm.js';

// Explicit live smoke test with synthetic inputs only; kept outside Node's test filename patterns.
// No database/cache reads or writes, no saved rankings changed.
const job = { id: 'llm-smoke-test', title: 'Senior Software Engineer', skills: ['JavaScript', 'SQL'] };
const titles = ['Software Engineer', 'Chef'];
const options = { checkDb: false, storeDb: false };
const realFetch = globalThis.fetch;
let requests = 0;
let successfulResponses = 0;

try {
  assert.ok(isLlmEnabled(), 'Set LLM_ENABLED=true in .env.');
  for (const name of ['LLM_BASE_URL', 'LLM_API_KEY', 'LLM_MODEL']) {
    assert.ok(process.env[name]?.trim(), `Set ${name} in .env.`);
  }
  console.log(`Live LLM test: ${process.env.LLM_BASE_URL} (model: ${process.env.LLM_MODEL})`);

  // Observe real HTTP requests; this forwards to native fetch and never fabricates a response.
  globalThis.fetch = async (...args) => {
    requests++;
    const response = await realFetch(...args);
    if (response.ok) successfulResponses++;
    console.log(`POST request ${requests}: HTTP ${response.status}`);
    return response;
  };

  const aliases = await getJobSkillAliases(job, options);
  assert.equal(aliases.method, 'llm', 'Skill aliases fell back; no validated live response.');
  console.log('Validated skill aliases:', JSON.stringify({ skills: [...aliases.aliasesMap].map(([skill, aliases]) => ({ skill, aliases })) }));

  const years = await getJobExpectedYears(job, options);
  assert.equal(years.method, 'llm', 'Expected years fell back; no validated live response.');
  console.log('Validated expected years:', JSON.stringify({ expected_years: years.years, reason: years.reason }));

  const labels = await getJobDesignationLabels(job, titles, options);
  for (const title of titles) {
    assert.equal(labels.get(title)?.method, 'llm', `Designation ${title} fell back; no validated live response.`);
  }
  console.log('Validated designation labels:', JSON.stringify({ designations: [...labels].map(([title, { label }]) => ({ title, label })) }));
  assert.ok(requests >= 3 && successfulResponses >= 3, 'Expected at least three successful real HTTP responses.');
  console.log(`PASS: ${requests} real HTTP requests; all three judgments returned schema-valid LLM data (no cache or fallback).`);
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
} finally {
  globalThis.fetch = realFetch;
}
