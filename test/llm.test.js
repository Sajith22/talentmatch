import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isLlmEnabled,
  computeInputHash,
  validateSkillAliasesSchema,
  validateExpectedYearsSchema,
  validateDesignationLabelsSchema,
  callLlmWithRetry,
  getJobSkillAliases,
  getJobExpectedYears,
  getJobDesignationLabels
} from '../lib/llm.js';
import { adjudicate } from '../lib/adjudicate.js';
import { candidateEvidence, score } from '../lib/matching.js';

const envNames = ['LLM_ENABLED', 'LLM_BASE_URL', 'LLM_API_KEY', 'LLM_MODEL'];
let savedEnv;
let savedFetch;
test.beforeEach(() => {
  savedEnv = Object.fromEntries(envNames.map((name) => [name, process.env[name]]));
  savedFetch = globalThis.fetch;
});
test.afterEach(() => {
  globalThis.fetch = savedFetch;
  for (const name of envNames) {
    if (savedEnv[name] === undefined) delete process.env[name];
    else process.env[name] = savedEnv[name];
  }
});

function enableTestLlm() {
  process.env.LLM_ENABLED = 'true';
  process.env.LLM_BASE_URL = 'https://api.groq.com/openai/v1///';
  process.env.LLM_API_KEY = 'test-key';
  process.env.LLM_MODEL = 'test-model';
}

const noDb = { checkDb: false, storeDb: false };
const completion = (data) => ({
  ok: true,
  status: 200,
  json: async () => ({ choices: [{ message: { content: JSON.stringify(data) } }] })
});

test('validates skill aliases schema correctly', () => {
  // Valid schema
  assert.equal(
    validateSkillAliasesSchema({
      skills: [
        { skill: 'Data Analysis', aliases: ['data analytics', 'analyzing data'] },
        { skill: 'SQL', aliases: ['structured query language'] }
      ]
    }),
    true
  );

  // Invalid schemas
  assert.equal(validateSkillAliasesSchema(null), false);
  assert.equal(validateSkillAliasesSchema({}), false);
  assert.equal(validateSkillAliasesSchema({ skills: 'invalid' }), false);
  assert.equal(validateSkillAliasesSchema({ skills: [] }), false);
  assert.equal(validateSkillAliasesSchema({ skills: [{ skill: '', aliases: [] }] }), false);
  assert.equal(validateSkillAliasesSchema({ skills: [{ skill: 'SQL', aliases: 'invalid' }] }), false);
});

test('validates expected years schema correctly', () => {
  // Valid schemas
  assert.equal(validateExpectedYearsSchema({ expected_years: 5, reason: 'Senior role requires extensive experience.' }), true);
  assert.equal(validateExpectedYearsSchema({ expected_years: 0, reason: 'Entry-level internship.' }), true);
  assert.equal(validateExpectedYearsSchema({ expected_years: 15, reason: 'Executive director role.' }), true);

  // Invalid schemas
  assert.equal(validateExpectedYearsSchema(null), false);
  assert.equal(validateExpectedYearsSchema({}), false);
  assert.equal(validateExpectedYearsSchema({ expected_years: -1, reason: 'Negative' }), false);
  assert.equal(validateExpectedYearsSchema({ expected_years: 16, reason: 'Too high' }), false);
  assert.equal(validateExpectedYearsSchema({ expected_years: 5.5, reason: 'Not an integer' }), false);
  assert.equal(validateExpectedYearsSchema({ expected_years: 5, reason: '' }), false);
  assert.equal(validateExpectedYearsSchema({ expected_years: 'five', reason: 'String year' }), false);
});

test('validates designation labels schema correctly', () => {
  // Valid schema
  assert.equal(
    validateDesignationLabelsSchema({
      designations: [
        { title: 'Data Analyst', label: 'same' },
        { title: 'Business Analyst', label: 'related' },
        { title: 'Chef', label: 'unrelated' }
      ]
    }),
    true
  );

  // Invalid schemas
  assert.equal(validateDesignationLabelsSchema(null), false);
  assert.equal(validateDesignationLabelsSchema({ designations: [] }), false);
  assert.equal(validateDesignationLabelsSchema({ designations: [{ title: 'Analyst', label: 'somewhat' }] }), false);
});

test('with LLM_ENABLED=false, judgments use fallbacks and never make network calls', async () => {
  process.env.LLM_ENABLED = 'false';
  let networkCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => {
    networkCalls++;
    throw new Error('fetch should not be called when LLM_ENABLED=false');
  };

  try {
    const job = { id: 'test-1', title: 'Senior HVAC Engineer', skills: ['HVAC Design', 'Thermodynamics'], description: 'Job' };

    // 1. Skill aliases fallback (dictionary)
    const aliases = await getJobSkillAliases(job, { checkDb: false });
    assert.equal(aliases.method, 'dictionary');
    assert.ok(aliases.aliasesMap.has('HVAC Design'));

    // 2. Expected years fallback (rule)
    const exp = await getJobExpectedYears(job, { checkDb: false });
    assert.equal(exp.method, 'rule');
    assert.equal(exp.years, 5); // Senior maps to 5

    // 3. Designation labels fallback (rule token overlap)
    const desig = await getJobDesignationLabels(job, ['HVAC Engineer', 'Accountant'], { checkDb: false });
    assert.equal(desig.get('HVAC Engineer').method, 'rule');
    assert.equal(desig.get('HVAC Engineer').label, 'same');
    assert.equal(desig.get('Accountant').label, 'unrelated');

    assert.equal(networkCalls, 0, 'Zero network calls must be made when LLM_ENABLED=false');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('mocked LLM rejects malformed output, retries once, and falls back if still invalid', async () => {
  process.env.LLM_ENABLED = 'true';
  process.env.LLM_BASE_URL = 'https://api.openai.com/v1';
  process.env.LLM_API_KEY = 'test-key';
  process.env.LLM_MODEL = 'gpt-4o-mini';

  let attempts = 0;
  const originalFetch = globalThis.fetch;

  // Mock fetch returning invalid schema on attempt 1 and attempt 2
  globalThis.fetch = async () => {
    attempts++;
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({ expected_years: 999, reason: 'Invalid number' })
            }
          }
        ]
      })
    };
  };

  try {
    const job = { id: 'test-2', title: 'Cashier', description: 'Cashier job', skills: ['POS'] };
    const result = await getJobExpectedYears(job, { checkDb: false, storeDb: false });

    // Initial attempt + 1 retry = 2 attempts
    assert.equal(attempts, 2, 'Should attempt once and retry once before falling back');
    // Result falls back to rule table
    assert.equal(result.method, 'rule');
    assert.equal(result.years, 1); // Cashier maps to 1
  } finally {
    globalThis.fetch = originalFetch;
    process.env.LLM_ENABLED = 'false';
  }
});

test('mocked LLM succeeds on retry when first attempt returns malformed output', async () => {
  process.env.LLM_ENABLED = 'true';
  process.env.LLM_BASE_URL = 'https://api.openai.com/v1';
  process.env.LLM_API_KEY = 'test-key';
  process.env.LLM_MODEL = 'gpt-4o-mini';

  let attempts = 0;
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => {
    attempts++;
    if (attempts === 1) {
      // First attempt: broken JSON
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: 'broken json{' } }]
        })
      };
    }
    // Second attempt: valid schema
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                expected_years: 4,
                reason: 'Role requires 4 years of hands-on experience.'
              })
            }
          }
        ]
      })
    };
  };

  try {
    const job = { id: 'test-3', title: 'Data Scientist', description: 'Analytics', skills: ['Python'] };
    const result = await getJobExpectedYears(job, { checkDb: false, storeDb: false });

    assert.equal(attempts, 2, 'Should have succeeded on attempt 2');
    assert.equal(result.method, 'llm');
    assert.equal(result.years, 4);
    assert.equal(result.reason, 'Role requires 4 years of hands-on experience.');
  } finally {
    globalThis.fetch = originalFetch;
    process.env.LLM_ENABLED = 'false';
  }
});

test('verifies privacy: LLM judgments never send candidate PII or raw CV text', async () => {
  process.env.LLM_ENABLED = 'true';
  process.env.LLM_BASE_URL = 'https://api.openai.com/v1';
  process.env.LLM_API_KEY = 'test-key';
  process.env.LLM_MODEL = 'gpt-4o-mini';

  const payloadsSent = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, options) => {
    const body = JSON.parse(options.body);
    payloadsSent.push(body);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                designations: [{ title: 'Software Engineer', label: 'same' }]
              })
            }
          }
        ]
      })
    };
  };

  try {
    const job = { id: 'test-4', title: 'Software Engineer', skills: ['Node.js'] };
    // Candidate has personal data
    const candidateData = {
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+1 555 123 4567',
      raw: 'Full CV content confidential...',
      designation: 'Software Engineer'
    };

    // getJobDesignationLabels receives only the job and the list of titles
    await getJobDesignationLabels(job, [candidateData.designation], { checkDb: false, storeDb: false });

    assert.equal(payloadsSent.length, 1);
    const sentString = JSON.stringify(payloadsSent[0]);
    assert.equal(sentString.includes('John Doe'), false, 'Candidate name must never be sent');
    assert.equal(sentString.includes('john@example.com'), false, 'Candidate email must never be sent');
    assert.equal(sentString.includes('555 123 4567'), false, 'Candidate phone must never be sent');
    assert.equal(sentString.includes('Full CV content'), false, 'Raw CV text must never be sent');
  } finally {
    globalThis.fetch = originalFetch;
    process.env.LLM_ENABLED = 'false';
  }
});

test('OpenAI-compatible POSTs supply validated aliases and judgments to the 50/30/20 scorer', async (t) => {
  enableTestLlm();
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://api.groq.com/openai/v1/chat/completions');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.Authorization, 'Bearer test-key');
    assert.equal(options.headers['Content-Type'], 'application/json');
    assert.ok(options.signal instanceof AbortSignal);
    const body = JSON.parse(options.body);
    assert.equal(body.model, 'test-model');
    assert.deepEqual(body.response_format, { type: 'json_object' });
    assert.deepEqual(body.messages.map(({ role }) => role), ['system', 'user']);
    const payload = JSON.parse(body.messages[1].content);
    requests.push(payload);
    if (payload.skills) return completion({ skills: [{ skill: 'Custom skill', aliases: ['novel equivalent'] }, { skill: 'POS', aliases: [] }] });
    if (payload.titles) return completion({ designations: [{ title: 'Other Title', label: 'related' }] });
    return completion({ expected_years: 5, reason: 'Senior role.' });
  });
  const job = { id: 'test', title: 'Senior Engineer', skills: ['Custom skill', 'POS'] };
  const candidate = { id: '1', designation: 'Other Title', skills: ['novel equivalent', 'point of sale'], history: [], experience: 2.5 };
  const evidence = candidateEvidence(candidate);
  const aliases = await getJobSkillAliases(job, noDb);
  const years = await getJobExpectedYears(job, noDb);
  const labels = await getJobDesignationLabels(job, [candidate.designation, candidate.designation], noDb);
  assert.equal(aliases.method, 'llm');
  assert.equal(years.method, 'llm');
  assert.equal(labels.get(candidate.designation).method, 'llm');
  const result = score({ ...job, expected_years: years.years }, candidate, evidence, {
    aliasesMap: aliases.aliasesMap, designationLabel: labels.get(candidate.designation).label
  });
  assert.deepEqual(result.matched, ['Custom skill', 'POS']);
  assert.equal(result.skillsScore, 50); // LLM alias plus retained dictionary alias
  assert.equal(result.experienceScore, 15); // 30 * 2.5 / 5
  assert.equal(result.designationScore, 10);
  assert.equal(result.total, 75);
  assert.deepEqual(requests, [
    { jobTitle: job.title, skills: job.skills },
    { jobTitle: job.title },
    { jobTitle: job.title, titles: ['Other Title'] }
  ]);
  const unsupported = score(job, { ...candidate, skills: [] }, [], { aliasesMap: aliases.aliasesMap });
  assert.equal(unsupported.skillsScore, 0, 'Aliases must not give credit without candidate evidence.');
});

test('disabled judgments ignore stored LLM output and never access the API or cache', async (t) => {
  process.env.LLM_ENABLED = 'false';
  const client = { query: () => { assert.fail('Disabled LLM must not read cached judgments.'); } };
  t.mock.method(globalThis, 'fetch', () => { assert.fail('Disabled LLM must not call API.'); });
  const job = { title: 'Senior Engineer', skills: ['SQL'] };
  assert.equal((await getJobSkillAliases(job, { client })).method, 'dictionary');
  assert.equal((await getJobExpectedYears(job, { client })).method, 'rule');
  assert.equal((await getJobDesignationLabels(job, ['Engineer'], { client })).get('Engineer').method, 'rule');
  assert.deepEqual(await adjudicate(job, [{ line: 'SQL' }], { missing: ['SQL'] }), []);
});

test('HTTP 429 and 401 fall back immediately and preserve deterministic factor scores', async (t) => {
  enableTestLlm();
  let calls = 0;
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    return { ok: false, status: calls === 1 ? 401 : 429 };
  });
  const job = { id: 'test', title: 'Cashier', skills: ['POS'] };
  const candidate = { id: '1', designation: 'Cashier', skills: ['POS'], history: [], experience: 2 };
  const aliases = await getJobSkillAliases(job, noDb);
  const years = await getJobExpectedYears(job, noDb);
  const labels = await getJobDesignationLabels(job, [candidate.designation], noDb);
  assert.equal(aliases.method, 'dictionary');
  assert.equal(years.method, 'rule');
  assert.equal(labels.get(candidate.designation).method, 'rule');
  const baseline = score(job, candidate, candidateEvidence(candidate));
  const fallback = score({ ...job, expected_years: years.years }, candidate, candidateEvidence(candidate), {
    aliasesMap: aliases.aliasesMap, designationLabel: labels.get(candidate.designation).label
  });
  for (const factor of ['skillsScore', 'experienceScore', 'designationScore', 'total', 'matched', 'missing']) {
    assert.deepEqual(fallback[factor], baseline[factor]);
  }
  assert.deepEqual(await adjudicate(job, [{ line: 'POS' }], { missing: ['POS'] }), []);
  assert.equal(fetchMock.mock.callCount(), 4, 'No retries for auth failures or rate limits.');
});

test('network failures and server errors retry once, then return fallback without throwing', async (t) => {
  enableTestLlm();
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => { throw new Error('network unavailable'); });
  const args = { systemPrompt: 'Return JSON.', userPrompt: '{}', schemaValidator: validateExpectedYearsSchema };
  assert.equal(await callLlmWithRetry(args), null);
  assert.equal(fetchMock.mock.callCount(), 2);
  fetchMock.mock.mockImplementation(async () => ({ ok: false, status: 503 }));
  assert.equal(await callLlmWithRetry(args), null);
  assert.equal(fetchMock.mock.callCount(), 4);
});

test('missing configuration never calls fetch', async (t) => {
  enableTestLlm();
  delete process.env.LLM_MODEL;
  t.mock.method(globalThis, 'fetch', () => { assert.fail('Missing configuration must not call API.'); });
  assert.equal((await getJobExpectedYears({ title: 'Cashier' }, noDb)).method, 'rule');
  assert.deepEqual(await adjudicate({ title: 'Cashier' }, [{ line: 'POS' }], { missing: ['POS'] }), []);
});

test('schema validation rejects omitted, duplicate, and invented skills or titles', async (t) => {
  enableTestLlm();
  const skills = ['SQL', 'JavaScript'];
  assert.equal(validateSkillAliasesSchema({ skills: [{ skill: 'SQL', aliases: [] }] }, skills), false);
  assert.equal(validateSkillAliasesSchema({ skills: [{ skill: 'SQL', aliases: [] }, { skill: 'SQL', aliases: [] }] }, skills), false);
  assert.equal(validateSkillAliasesSchema({ skills: [{ skill: 'Python', aliases: [] }, { skill: 'JavaScript', aliases: [] }] }, skills), false);
  assert.equal(validateDesignationLabelsSchema({ designations: [{ title: 'Invented', label: 'same' }] }, ['Engineer']), false);
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => completion({ skills: [{ skill: 'Invented', aliases: ['SQL'] }] }));
  const result = await getJobSkillAliases({ title: 'Engineer', skills }, noDb);
  assert.equal(result.method, 'dictionary');
  assert.equal(fetchMock.mock.callCount(), 2);
});

test('enabled judgments reuse validated cache without calling fetch', async (t) => {
  enableTestLlm();
  t.mock.method(globalThis, 'fetch', () => { assert.fail('Valid cache should avoid API.'); });
  const cached = {
    skill_aliases: { skills: [{ skill: 'SQL', aliases: ['structured query language'] }] },
    expected_years: { expected_years: 5, reason: 'Senior role.' },
    designation_label: { label: 'same' }
  };
  const client = { query: async (query, [kind]) => ({ rows: [{ output_json: cached[kind] }] }) };
  const job = { title: 'Senior Engineer', skills: ['SQL'] };
  assert.equal((await getJobSkillAliases(job, { client })).method, 'llm');
  assert.equal((await getJobExpectedYears(job, { client })).years, 5);
  assert.equal((await getJobDesignationLabels(job, ['Engineer'], { client })).get('Engineer').label, 'same');
});

test('adjudicator shares JSON-mode client, redacts contact data, and verifies indexed quotes', async (t) => {
  enableTestLlm();
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://api.groq.com/openai/v1/chat/completions');
    const body = JSON.parse(options.body);
    assert.deepEqual(body.response_format, { type: 'json_object' });
    const payload = JSON.parse(body.messages[1].content);
    assert.deepEqual(payload, {
      job: 'Engineer', missingSkills: ['SQL', 'Python'],
      evidence: ['Used SQL daily. [email] [phone] [url]']
    });
    return completion({ matches: [
      { skillIndex: 0, lineIndex: 0, quote: 'Used SQL' },
      { skillIndex: 0, lineIndex: 0, quote: 'Used SQL' },
      { skillIndex: 1, lineIndex: 0, quote: 'invented quote' },
      { skillIndex: 1, lineIndex: 99, quote: 'Used SQL' },
      { skillIndex: -1, lineIndex: 0, quote: 'Used SQL' }
    ] });
  });
  assert.deepEqual(await adjudicate({ title: 'Engineer' }, [
    { line: 'Used SQL daily. user@example.com +94 77 123 4567 https://example.com' }
  ], { missing: ['SQL', 'Python'] }), ['SQL']);
});

test('zero expected years from a valid LLM judgment yields finite scores within 50/30/20 caps', () => {
  const job = { id: 'test', title: 'Intern', skills: ['SQL'], expected_years: 0 };
  const candidate = { id: '1', designation: 'Intern', experience: 0, skills: ['SQL'] };
  const result = score(job, candidate, candidateEvidence(candidate));
  assert.equal(result.skillsScore, 50);
  assert.equal(result.experienceScore, 30);
  assert.equal(result.designationScore, 20);
  assert.equal(result.total, 100);
});
