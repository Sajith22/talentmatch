// Equivalent terms are reviewed against each requirement and matched as whole phrases.
const equivalents = {
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
  'Extract, Transform, Load': ['etl', 'extract transform and load'],
  'Project Leadership': ['led cross functional projects', 'led projects'],
  'Heating, Ventilation, and Air Conditioning (HVAC) design and optimization': ['hvac design', 'design hvac', 'designed hvac', 'design and engineer comprehensive hvac systems', 'designed and implemented hvac systems', 'design and analysis of hvac', 'hvac system design', 'mechanical system design', 'hvac equipment selection', 'designed heating ventilation', 'hvac load calculations', 'hvac design calculations', 'hvac system design and optimization'],
  'Mechanical engineering fundamentals': ['mechanical engineering', 'mechanical engineer'],
  'Building services engineering': ['building services', 'mep design', 'mep systems', 'building mechanical systems'],
  'Data Center facilities and critical environment considerations': ['data center', 'data centre', 'critical facilities'],
  'Risk assessment and mitigation': ['risk assessment', 'risk mitigation', 'risk assessments'],
  'Design and engineering design methodologies': ['engineering design', 'design calculations', 'design specifications', 'design methodologies', 'mechanical drawings', 'mechanical designs'],
  'English as a Second Language': ['esl', 'esol', 'tesol'],
  'Teaching English as a Foreign Language': ['tefl', 'efl instruction'],
  Teaching: ['teacher', 'classroom instruction', 'teaching assistant'],
  'Reading Comprehension': ['reading instruction', 'reading skills'],
  Writing: ['writing instruction', 'academic writing'],
  Listening: ['listening skills', 'listening comprehension'],
  'International English Language Testing System': ['ielts'],
  'Test of English as a Foreign Language': ['toefl'],
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

const roles = {
  29243: [/healthcare.*(data|analyst)|clinical data analyst|health informatics analyst/i, /data analyst|business intelligence|data scientist|clinical analyst|data engineer/i],
  32447: [/hvac.*engineer|mechanical.*hvac|building services engineer|senior mechanical engineer/i, /mechanical engineer|mep engineer|facilities engineer|mechanical designer/i],
  35129: [/ielts.*(teach|instruct|tutor)|(teach|instruct|tutor).*ielts/i, /english.*(teach|instruct|tutor)|esl|tesol|language.*(teacher|instructor)/i],
  36044: [/failure analysis engineer|failure analyst/i, /reliability engineer|quality engineer|materials engineer|test engineer|mechanical engineer|semiconductor engineer/i],
  37020: [/regional facilities manager|director of facilities|facilities director/i, /facilit|property manager|maintenance manager|building manager|maintenance leader/i],
  38671: [/loan clos|mortgage clos/i, /mortgage|escrow|loan processor|loan officer|loan originator|underwriter/i],
  39060: [/sales director|director.*sales|head of sales|vp.*sales|vice president.*sales/i, /sales manager|manager.*sales|business development manager|sales lead|sales executive/i],
  44719: [/cashier|checkout operator/i, /retail|store associate|sales associate|store manager|customer service associate/i],
  46795: [/paralegal.*privacy|privacy.*paralegal|information governance paralegal/i, /paralegal|legal assistant|privacy analyst|privacy officer|legal operations/i],
  47576: [/housekeep|room attendant|hotel cleaner/i, /cleaner|janitor|custodian|laundry attendant|sanitation worker/i]
};

const normalize = (text) => ' ' + text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() + ' ';
const round = (value) => Math.round(value * 100) / 100;

export function candidateEvidence(candidate) {
  const lines = [...candidate.skills, ...candidate.history.flatMap((role) => [role.title, ...role.evidence])];
  return lines.map((line) => ({ line, normalized: normalize(line) }));
}

export function score(job, candidate, evidence, confirmed = []) {
  const matched = job.skills.filter((skill) => confirmed.includes(skill) || [skill, ...(equivalents[skill] ?? [])]
    .some((term) => evidence.some(({ normalized }) => normalized.includes(normalize(term)))));
  const missing = job.skills.filter((skill) => !matched.includes(skill));
  const [same, related] = roles[job.id] ?? [/$^/, /$^/];
  const designation = candidate.designation ?? '';
  const designationScore = designation && same.test(designation) ? 20 : designation && related.test(designation) ? 10 : 0;
  const skillsScore = round(50 * matched.length / job.skills.length);
  const experienceScore = round(30 * Math.min(1, Number(candidate.experience ?? 0) / job.expected_years));
  const examples = matched.slice(0, 3).join(', ');
  const reason = `${matched.length}/${job.skills.length} skills${examples ? ` (${examples})` : ''}; ${candidate.experience == null ? 'work dates unavailable' : `${Number(candidate.experience)} total years documented`}; latest role ${designation || 'unavailable'}.`;
  return { jobId: job.id, candidateId: candidate.id, skillsScore, experienceScore, designationScore,
    total: round(skillsScore + experienceScore + designationScore), matched, missing, reason };
}

export function byRank(a, b) {
  return b.total - a.total || b.skillsScore - a.skillsScore || a.candidateId.localeCompare(b.candidateId, 'en', { numeric: true });
}
