const months = 'jan feb mar apr may jun jul aug sep oct nov dec'.split(' ');
const dateToken = '(?:(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\.?\\s+)?(?:19|20)\\d{2}';
const range = new RegExp(`^(${dateToken})\\s*[-–—]|^(${dateToken})\\s+to\\s+`, 'i');
const endDate = new RegExp(`^(Present|Current|Now|${dateToken})$`, 'i');

function dateIndex(value, end, now) {
  if (/^(present|current|now)$/i.test(value)) {
    return now.getUTCFullYear() * 12 + now.getUTCMonth() + 1;
  }
  const year = Number(value.slice(-4));
  const month = months.indexOf(value.slice(0, 3).toLowerCase());
  return year * 12 + (month < 0 ? (end ? 12 : 0) : month + Number(end));
}

const heading = /^(?:#{1,6}\s*)?(?:\*\*)?(professional summary|summary|senior executive profile|profile|career objective|objective|professional experience|work experience|work history|employment history|employment|experience|career history|career experience|professional background|education(?: and certifications)?|qualifications|skills(?: and competencies)?|technical skills|professional skills|key skills|core skills|core competencies|certifications|languages|additional information|professional (?:affiliations|development|achievements)|awards|references|achievements|volunteer experience|projects)(?:\*\*)?:?$/i;
const workHeading = /^(professional experience|work experience|work history|employment history|employment|experience|career history|career experience|professional background)$/;
const skillHeading = /skill|competenc/;
const tidy = (line) => line.replace(/^\s*(?:#{1,6}\s+|[-•*]\s+)/, '').replace(/\*\*/g, '').trim();

export function parseCandidate(id, raw, now = new Date()) {
  const lines = raw.replace(/^\uFEFF/, '').split(/\r?\n/).map(tidy).filter(Boolean);
  const firstHeading = lines.findIndex((line, index) => index > 0 && heading.test(line));
  const contact = lines.slice(1, firstHeading > 0 ? firstHeading : 8).join(' ');
  const history = [];
  const skills = [];
  let section = '';
  let role;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const label = line.match(heading)?.[1];
    if (label) {
      section = label.toLowerCase();
      role = undefined;
      continue;
    }
    if (skillHeading.test(section)) {
      skills.push(...line.replace(/^[^:]+:\s*/, '').split(/[,;|]/).map((item) => item.trim()).filter(Boolean));
    }
    if (!workHeading.test(section)) continue;
    const inline = line.match(/^(.*?)\s{2,}(.+)$/);
    const pipeDate = line.match(/^(.*)\s*\|\s*([^|]+)$/);
    const dateLine = (pipeDate?.[2] ?? inline?.[2] ?? line).trim().replace(/^\(|\)$/g, '');
    const start = dateLine.match(range);
    const end = start && dateLine.slice(start[0].length).trim().match(endDate);
    if (end) {
      const from = dateIndex(start[1] || start[2], false, now);
      const to = Math.min(dateIndex(end[1], true, now), dateIndex('Present', true, now));
      const company = pipeDate?.[1].split('|')[0].trim() ?? lines[i - 1];
      const title = pipeDate ? lines[i - 1] : inline?.[1] ?? lines[i - 2];
      if (to <= from || !title || heading.test(title) || heading.test(company)) {
        role = undefined;
        continue;
      }
      const headerLines = pipeDate || inline ? 1 : 2;
      if (role) role.evidence.splice(Math.max(0, role.evidence.length - headerLines), headerLines);
      role = { title, company, dates: dateLine, from, to, current: /present|current|now/i.test(end[1]), evidence: [] };
      history.push(role);
    } else if (role && !/^[-_]+$/.test(line)) {
      role.evidence.push(line);
    }
  }

  const worked = new Set();
  for (const role of history) {
    for (let month = role.from; month < role.to; month++) worked.add(month);
  }
  history.sort((a, b) => Number(b.current) - Number(a.current) || b.to - a.to || b.from - a.from);
  return {
    id, name: lines[0] || '', email: contact.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i)?.[0] ?? null,
    phone: contact.match(/(?<!\w)(?:\+\d|\(\d|\d)[\d ().-]{6,}\d(?!\w)/)?.[0].trim() ?? null,
    designation: history[0]?.title ?? null, company: history[0]?.company ?? null,
    experience: history.length ? Math.round(worked.size / 12 * 100) / 100 : null,
    skills: [...new Set(skills)], raw, history
  };
}

export function parseJob(id, description) {
  const firstLine = description.trim().split(/\r?\n/)[0];
  const title = firstLine.match(/^We are seeking (?:an? )?(.+?) to join/i)?.[1] ?? firstLine;
  const lines = description.split(/\r?\n/);
  const skills = [];
  let inSkills = false;
  for (const line of lines) {
    if (/^(?:about )?required skills:?$/i.test(line.trim())) {
      inSkills = true;
    } else if (inSkills && /^\s*[-•*]\s+/.test(line)) {
      skills.push(tidy(line));
    } else if (inSkills && skills.length && line.trim()) {
      break;
    }
  }
  const expected = /director/i.test(title) ? 8
    : /senior|regional.*manager/i.test(title) ? 5
    : /cashier|cleaner/i.test(title) ? 1 : 3;
  return { id, title, description, skills, expected_years: expected };
}
