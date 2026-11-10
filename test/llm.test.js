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
