/**
 * Escape regular expression special characters.
 */
export function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Skill matching uses token boundaries.
 * "Java" must not match "JavaScript".
 * "C" must not match "C#" or "C++".
 * "C++", "C#", and "Node.js" must match literally.
 * Uses lookarounds that treat #, +, and . as part of a token, and escapes regex characters.
 */
export function matchSkillToken(text, term) {
  if (!text || !term) return false;
  const escaped = escapeRegex(term.trim()).replace(/\s+/g, '\\s+');
  const regex = new RegExp(`(?<![a-zA-Z0-9#+.])(?:${escaped})(?![a-zA-Z0-9#+.])`, 'i');
  return regex.test(text);
}

// Equivalence dictionary for skills and their interchangeable terms / aliases
const baseEquivalents = {
  'Data Analysis': ['data analytics', 'analyzing data', 'analyzed data'],
  Healthcare: ['clinical data', 'patient data', 'hospital'],
  'Healthcare Industry': ['clinical data', 'patient data', 'hospital'],
  'Data Quality': ['data validation', 'data cleansing', 'data cleaning'],
  'Data Visualization': ['tableau', 'power bi', 'reporting dashboards'],
  'Data Management': ['data governance', 'database management'],
  'Business Intelligence': ['power bi', 'bi reporting', 'tableau'],
  Statistics: ['statistical analysis', 'statistical modeling', 'statistical methods'],
  'Data Extraction': ['extracting data', 'etl', 'data ingestion'],
  Analytics: ['data analysis', 'statistical analysis'],
  'Data Modeling': ['data models', 'dimensional modeling', 'data modelling'],
  'Data Processing': ['etl', 'data transformation'],
  'Data Security': ['hipaa', 'data protection', 'access controls'],
  'Data Collection': ['data gathering', 'collecting data', 'data ingestion'],
  'Data pipeline': ['data pipelines', 'etl pipeline', 'etl workflows'],
  'Extract, Transform, Load': ['etl', 'extract transform and load', 'extract transform load'],
  ETL: ['extract, transform, load', 'extract transform and load', 'extract transform load'],
  'Project Leadership': ['led cross functional projects', 'led projects'],
  'Heating, Ventilation, and Air Conditioning (HVAC) design and optimization': [
    'hvac design', 'design hvac', 'designed hvac', 'design and engineer comprehensive hvac systems',
    'designed and implemented hvac systems', 'design and analysis of hvac', 'hvac system design',
    'mechanical system design', 'hvac equipment selection', 'designed heating ventilation',
    'hvac load calculations', 'hvac design calculations', 'hvac system design and optimization'
  ],
  'Mechanical engineering fundamentals': ['mechanical engineering', 'mechanical engineer'],
  'Building services engineering': ['building services', 'mep design', 'mep systems', 'building mechanical systems'],
  'Data Center facilities and critical environment considerations': ['data center', 'data centre', 'critical facilities'],
  'Risk assessment and mitigation': ['risk assessment', 'risk mitigation', 'risk assessments'],
  'Design and engineering design methodologies': [
    'engineering design', 'design calculations', 'design specifications',
    'design methodologies', 'mechanical drawings', 'mechanical designs'
  ],
  'English as a Second Language': ['esl', 'esol', 'tesol'],
  'Teaching English as a Foreign Language': ['tefl', 'efl instruction'],
  Teaching: ['teacher', 'classroom instruction', 'teaching assistant'],
  'Reading Comprehension': ['reading instruction', 'reading skills'],
  Writing: ['writing instruction', 'academic writing'],
  Listening: ['listening skills', 'listening comprehension'],
  'International English Language Testing System': ['ielts'],
  IELTS: ['international english language testing system'],
  'Test of English as a Foreign Language': ['toefl'],
  TOEFL: ['test of english as a foreign language'],
  Pedagogy: ['pedagogical', 'teaching methods', 'instructional strategies'],
  'Curriculum Development': ['curriculum design', 'lesson planning', 'designed curriculum'],
  'Educational Assessment': ['student assessment', 'formative assessment', 'assessing student progress'],
  'Language Acquisition': ['language instruction', 'language learning'],
  'Working With Children': ['elementary students', 'primary school', 'young learners'],
  Engineering: ['engineer', 'engineering'],
  'Failure Analysis': ['failure investigation', 'fractographic analysis', 'fractography', 'failure mechanisms'],
  'Strong analytical thinking and problem-solving abilities': ['problem solving', 'analytical thinking', 'troubleshooting'],
  'Data interpretation and technical reporting': ['technical reporting', 'technical reports', 'data interpretation'],
  'Root cause analysis': ['rca', 'root cause investigations', 'root causes', '8d methodology'],
  'Attention to detail and accuracy': ['attention to detail', 'detail oriented'],
  'Effective communication and teamwork': ['cross functional collaboration', 'communication skills', 'teamwork'],
  'Facility Management': ['facilities management', 'facilities manager', 'facility manager', 'facility operations'],
  'Building Management Systems': ['building automation', 'bms', 'bas'],
  'Multi-unit Homes': ['multi family', 'multifamily', 'residential properties', 'apartment complexes'],
  'Asset Management': ['asset lifecycle', 'asset tracking'],
  'Safety Management': ['safety compliance', 'osha', 'workplace safety'],
  'Preventive Maintenance': ['preventative maintenance', 'scheduled maintenance'],
  'Environmental Management Systems': ['iso 14001', 'environmental compliance'],
  'Mortgage Lending': ['residential lending', 'mortgage loans'],
  'Mortgage Loan Processing': ['mortgage processor', 'loan processing', 'processed mortgage'],
  'Loan Documents': ['closing documents', 'loan documentation', 'closing packages', 'loan files'],
  Funding: ['loan disbursement', 'funded loans'],
  Mortgages: ['mortgage', 'mortgages'],
  Settlement: ['settlement statements', 'closing disclosure'],
  'Loan Origination': ['loan originator', 'loan origination system', 'encompass'],
  'Truth In Lending Act': ['tila', 'trid'],
  Loans: ['loan', 'loans'],
  'Written communication': ['written correspondence', 'written communication skills'],
  'United States Federal Housing Administration': ['fha'],
  'Sales Strategy': ['go to market strategy', 'sales strategies', 'sales planning'],
  'Customer Success': ['customer retention', 'client retention', 'account management'],
  'Revenue Targets': ['sales quotas', 'revenue goals', 'sales targets'],
  'Sales Management': ['sales manager', 'managed sales team', 'sales leadership'],
  'Cash Handling': ['cash transactions', 'cash register', 'cash reconciliation', 'handling cash', 'counted cash'],
  'POS Systems Operation': ['pos', 'point of sale', 'cash register'],
  POS: ['pos systems operation', 'point of sale', 'cash register'],
  'Shelf Restocking': ['restocking', 'restocked shelves', 'stocked shelves', 'replenished shelves', 'stock replenishment'],
  'Customer Service': ['customer inquiries', 'assisted customers', 'customer support'],
  'Communication Skills': ['communication', 'communicated with customers'],
  'Data Privacy': ['privacy compliance', 'data protection', 'gdpr', 'ccpa'],
  'Information Security': ['infosec', 'cybersecurity', 'data security'],
  'Information Management': ['information governance', 'records management', 'data governance'],
  'Regulatory Requirements': ['regulatory compliance', 'compliance requirements'],
  'Law Department Management': ['legal operations', 'legal department management'],
  'Data Glossary': ['data dictionary', 'business glossary'],
  'Federal Law': ['federal regulations', 'federal statutes'],
  'Information Gathering': ['fact finding', 'document review'],
  'Workstream Governance': ['project governance', 'workflow governance'],
  Paralegals: ['paralegal', 'legal assistant'],
  'Professional Cleaning': ['commercial cleaning', 'cleaned', 'janitorial', 'sanitized', 'cleaning procedures'],
  Housekeeping: ['housekeeper', 'room attendant', 'guest room cleaning'],
  'Trash Pickup': ['waste disposal', 'trash removal', 'emptied trash', 'removed trash', 'collected trash', 'waste management'],
  Linens: ['linen', 'bed sheets', 'laundry', 'bedding'],
  Hygiene: ['sanitation', 'disinfection', 'hygiene standards', 'sanitized'],
  Furniture: ['upholstery', 'dusted furniture', 'furniture cleaning']
};

// Build a bidirectional lookup for skill aliases
export const equivalents = { ...baseEquivalents };
for (const [key, aliases] of Object.entries(baseEquivalents)) {
  for (const alias of aliases) {
    if (!equivalents[alias]) equivalents[alias] = [];
    if (!equivalents[alias].includes(key)) equivalents[alias].push(key);
  }
}

export function getSkillAliases(skill) {
  const list = [skill, ...(equivalents[skill] ?? [])];
  // Check case-insensitive match in dictionary
  const lower = skill.toLowerCase();
  for (const [key, vals] of Object.entries(equivalents)) {
    if (key.toLowerCase() === lower) {
      list.push(...vals);
    }
  }
  return [...new Set(list)];
}

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'in', 'of', 'for', 'to', 'with', 'at', 'by', 'on',
  'senior', 'sr', 'jr', 'junior', 'lead', 'principal', 'staff', 'associate'
]);

/**
 * Tokenize a role title into normalized alphanumeric words, filtering out stop words.
 */
export function tokenizeTitle(title) {
  if (!title || typeof title !== 'string') return new Set();
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .split(/\s+/)
      .filter((w) => w && !STOP_WORDS.has(w))
  );
}

/**
 * Score designation from titles using normalized token overlap.
 * Evaluates containment and Jaccard similarity.
 * Thresholds:
 * - same: containment >= 0.6 or Jaccard >= 0.45 (20 points)
 * - related: containment >= 0.25 or Jaccard >= 0.15 (10 points)
 * - unrelated: otherwise (0 points)
 */
export function scoreDesignationByOverlap(jobTitle, candidateDesignation) {
  if (!jobTitle || !candidateDesignation) return { score: 0, label: 'unrelated', method: 'rule' };

  const jToks = tokenizeTitle(jobTitle);
  const cToks = tokenizeTitle(candidateDesignation);
  if (!jToks.size || !cToks.size) return { score: 0, label: 'unrelated', method: 'rule' };

  let matchCount = 0;
  for (const c of cToks) {
    if (jToks.has(c)) {
      matchCount++;
    } else {
      // Stem / prefix matching (e.g. clean/housekeeper, instruct/teacher)
      for (const j of jToks) {
        if ((c.startsWith(j) || j.startsWith(c)) && Math.min(c.length, j.length) >= 4) {
          matchCount += 0.8;
          break;
        }
      }
    }
  }

  const jaccard = matchCount / (jToks.size + cToks.size - matchCount);
  const containment = matchCount / Math.min(jToks.size, cToks.size);

  if (containment >= 0.6 || jaccard >= 0.45) {
    return { score: 20, label: 'same', method: 'rule' };
  }
  if (containment >= 0.25 || jaccard >= 0.15) {
    return { score: 10, label: 'related', method: 'rule' };
  }
  return { score: 0, label: 'unrelated', method: 'rule' };
}

const round = (value) => Math.round(value * 100) / 100;

export function candidateEvidence(candidate) {
  const lines = [
    ...(candidate.skills ?? []),
    ...(candidate.history ?? []).flatMap((role) => [role.title, ...(role.evidence ?? [])])
  ];
  return lines.filter(Boolean).map((line) => ({ line }));
}

/**
 * Expected years rule fallback on title keywords:
 * Intern, junior, cashier, and cleaner map to 0–1.
 * Mid-level maps to 3.
 * Senior, lead, and manager map to 5–6.
 * Director and head map to 8–10.
 */
export function inferExpectedYears(title) {
  if (!title) return { years: 3, method: 'rule', reason: 'Default mid-level role' };
  const lower = title.toLowerCase();
  if (/director|head\b/i.test(lower)) return { years: 8, method: 'rule', reason: 'Senior executive role' };
  if (/senior|lead\b|manager/i.test(lower)) return { years: 5, method: 'rule', reason: 'Senior / managerial role' };
  if (/intern|junior|cashier|cleaner|housekeeper/i.test(lower)) return { years: 1, method: 'rule', reason: 'Entry-level role' };
  return { years: 3, method: 'rule', reason: 'Standard professional role' };
}

/**
 * Score candidate-job pair.
 * confirmed: optional array of confirmed skills or judgment overrides.
 */
export function score(job, candidate, evidence, confirmed = []) {
  const matched = job.skills.filter((skill) => {
    if (confirmed.includes(skill)) return true;
    const terms = getSkillAliases(skill);
    return terms.some((term) => evidence.some(({ line }) => matchSkillToken(line, term)));
  });
  const missing = job.skills.filter((skill) => !matched.includes(skill));

  // Designation scored from titles (token overlap rule fallback, or LLM designation label in Phase 2)
  let designationScore = 0;
  let designationMethod = 'rule';
  if (typeof confirmed?.designationLabel === 'string') {
    designationMethod = 'llm';
    designationScore = confirmed.designationLabel === 'same' ? 20 : confirmed.designationLabel === 'related' ? 10 : 0;
  } else {
    const desig = scoreDesignationByOverlap(job.title, candidate.designation);
    designationScore = desig.score;
    designationMethod = desig.method;
  }

  const expectedYears = job.expected_years ?? inferExpectedYears(job.title).years;
  const skillsScore = round((50 * matched.length) / job.skills.length);
  const experienceScore = round(30 * Math.min(1, Number(candidate.experience ?? 0) / expectedYears));
  const total = round(skillsScore + experienceScore + designationScore);

  const examples = matched.slice(0, 3).join(', ');
  const reason = `${matched.length}/${job.skills.length} skills${examples ? ` (${examples})` : ''}; ${
    candidate.experience == null ? 'work dates unavailable' : `${Number(candidate.experience)} total years documented`
  }; latest role ${candidate.designation || 'unavailable'}.`;

  return {
    jobId: job.id,
    candidateId: candidate.id,
    skillsScore,
    experienceScore,
    designationScore,
    total,
    matched,
    missing,
    reason,
    methods: {
      skills: confirmed.length && matched.some((s) => confirmed.includes(s)) ? 'llm' : 'dictionary',
      experience: 'rule',
      designation: designationMethod
    }
  };
}

export function byRank(a, b) {
  return b.total - a.total || b.skillsScore - a.skillsScore || a.candidateId.localeCompare(b.candidateId, 'en', { numeric: true });
}
