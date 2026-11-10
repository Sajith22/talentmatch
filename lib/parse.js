/**
 * Configurable defaults for parsing.
 * "Present" uses the current date from this config value so tests and runtime can pin it.
 * The default assessment date is 2026-11-10.
 */
export const CONFIG = {
  currentDate: new Date('2026-11-10')
};

const MONTH_NAMES = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11
};

/**
 * Converts a date token (start or end) to a month index (year * 12 + month).
 * For start dates: month is 0-indexed (Jan = 0).
 * For end dates: month is inclusive through the end of the month (Jan end = 1).
 *
 * Assumption for year-only ranges (e.g. 2014 - 2017):
 * Runs from January of the start year (year * 12 + 0) to December of the end year (year * 12 + 12).
 */
export function parseDateIndex(token, isEnd, now = CONFIG.currentDate) {
  const str = token.trim();
  if (/^(present|current|now|till\s+date)$/i.test(str)) {
    return now.getUTCFullYear() * 12 + now.getUTCMonth() + 1;
  }
  // MM/YYYY or MM.YYYY or MM-YYYY
  let m = str.match(/^(\d{1,2})[\/.-](\d{4})$/);
  if (m) {
    const month = Number(m[1]) - 1;
    const year = Number(m[2]);
    if (month >= 0 && month <= 11) return isEnd ? year * 12 + month + 1 : year * 12 + month;
  }
  // YYYY.MM or YYYY/MM or YYYY-MM
  m = str.match(/^(\d{4})[\/.-](\d{1,2})$/);
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]) - 1;
    if (month >= 0 && month <= 11) return isEnd ? year * 12 + month + 1 : year * 12 + month;
  }
  // Month Name + Year: "January 2021", "Sept 2019", "Jan 2019", "Jan. 2019"
  m = str.match(/^([a-z]+)\.?\s*,?\s*(\d{4})$/i);
  if (m) {
    const month = MONTH_NAMES[m[1].toLowerCase()];
    const year = Number(m[2]);
    if (month !== undefined) return isEnd ? year * 12 + month + 1 : year * 12 + month;
  }
  // Year only: "2014"
  // Year-only ranges run from January of start year to December of end year (documented assumption)
  m = str.match(/^(\d{4})$/);
  if (m) {
    const year = Number(m[1]);
    return isEnd ? year * 12 + 12 : year * 12 + 0;
  }
  return null;
}

const RANGE_REGEX = /^([a-zA-Z]+\.?\s*,?\s*\d{4}|\d{1,2}[\/.-]\d{4}|\d{4}[\/.-]\d{1,2}|\d{4})\s*(?:[-–—]|\bto\b)\s*(present|current|now|till\s+date|[a-zA-Z]+\.?\s*,?\s*\d{4}|\d{1,2}[\/.-]\d{4}|\d{4}[\/.-]\d{1,2}|\d{4})$/i;

/**
 * Parses a date range string into { from, to, current, raw }.
 * Handles en dash (–), em dash (—), hyphen (-), and "to" as separators.
 * Handles end tokens: Present, Current, Now, Till date, or another date token.
 */
export function parseDateRange(dateStr, now = CONFIG.currentDate) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const m = dateStr.trim().replace(/^\(|\)$/g, '').match(RANGE_REGEX);
  if (!m) return null;
  const from = parseDateIndex(m[1], false, now);
  const to = Math.min(parseDateIndex(m[2], true, now), parseDateIndex('present', true, now));
  if (from == null || to == null || to <= from) return null;
  return {
    from,
    to,
    current: /present|current|now|till\s+date/i.test(m[2]),
    raw: dateStr.trim()
  };
}

/**
 * Merges overlapping and contiguous half-open intervals [from, to] into a minimal disjoint set.
 * Union counting: Overlapping roles count once (length of union, not sum).
 */
export function mergeIntervals(intervals) {
  if (!intervals.length) return [];
  const valid = intervals
    .filter(([start, end]) => typeof start === 'number' && typeof end === 'number' && end > start)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (!valid.length) return [];
  const merged = [valid[0].slice()];
  for (let i = 1; i < valid.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = valid[i];
    if (curr[0] <= prev[1]) {
      prev[1] = Math.max(prev[1], curr[1]);
    } else {
      merged.push(curr.slice());
    }
  }
  return merged;
}

const heading = /^(?:#{1,6}\s*)?(?:\*\*)?(professional summary|summary|senior executive profile|profile|career objective|objective|professional experience|work experience|work history|employment history|employment|experience|career history|career experience|professional background|education(?: and certifications)?|qualifications|skills(?: and competencies)?|technical skills|professional skills|key skills|core skills|core competencies|certifications|languages|additional information|professional (?:affiliations|development|achievements)|awards|references|achievements|volunteer experience|projects)(?:\*\*)?:?$/i;
const workHeading = /^(professional experience|work experience|work history|employment history|employment|experience|career history|career experience|professional background)$/;
const skillHeading = /skill|competenc/;
const tidy = (line) => line.replace(/^\s*(?:#{1,6}\s+|[-•*]\s+)/, '').replace(/\*\*/g, '').trim();

export function parseCandidate(id, raw, now = CONFIG.currentDate) {
  const lines = raw.replace(/^\uFEFF/, '').split(/\r?\n/).map(tidy).filter(Boolean);
  const firstHeading = lines.findIndex((line, index) => index > 0 && heading.test(line));
  const contact = lines.slice(1, firstHeading > 0 ? firstHeading : 8).join(' ');
  const history = [];
  const skills = [];
  const unparsedRanges = [];
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
    const dateCandidate = (pipeDate?.[2] ?? inline?.[2] ?? line).trim().replace(/^\(|\)$/g, '');

    // Check if this looks like a date range candidate
    const parsed = parseDateRange(dateCandidate, now);

    if (parsed) {
      const company = pipeDate?.[1].split('|')[0].trim() ?? lines[i - 1];
      const title = pipeDate ? lines[i - 1] : inline?.[1] ?? lines[i - 2];
      if (!title || heading.test(title) || heading.test(company)) {
        role = undefined;
        continue;
      }
      const headerLines = pipeDate || inline ? 1 : 2;
      if (role) role.evidence.splice(Math.max(0, role.evidence.length - headerLines), headerLines);
      role = {
        title,
        company,
        dates: dateCandidate,
        from: parsed.from,
        to: parsed.to,
        current: parsed.current,
        evidence: []
      };
      history.push(role);
    } else {
      // Check if this line looks like an attempted date range that failed parsing
      // Heuristic: has a range separator and date keywords/years, or was an inline/pipe date column
      const hasSep = /[-–—]|\bto\b/i.test(dateCandidate);
      const hasDateWord = /(?:(?<!\p{L})(?:19\d{2}|20\d{2}|jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|present|current|now|till\s+date|ongoing|date)(?!\p{L}))/iu.test(dateCandidate);
      const isRoleDateColumn = Boolean(pipeDate || inline);
      const isNarrative = /^(manage|lead|develop|responsi|work|overs|creat|assist|utiliz|partic|prepar|maintain|perform|collab)/i.test(dateCandidate);

      if (hasSep && (hasDateWord || isRoleDateColumn) && !isNarrative && dateCandidate.length < 60) {
        unparsedRanges.push(dateCandidate);
        console.warn(`Candidate ${id}: unparseable date range: "${dateCandidate}"`);
      } else if (role && !/^[-_]+$/.test(line)) {
        role.evidence.push(line);
      }
    }
  }

  // Interval merging for total experience
  const intervals = history.map((r) => [r.from, r.to]);
  const merged = mergeIntervals(intervals);
  const totalMonthsWorked = merged.reduce((sum, [start, end]) => sum + (end - start), 0);
  const experience = history.length ? Math.round((totalMonthsWorked / 12) * 100) / 100 : null;

  history.sort((a, b) => Number(b.current) - Number(a.current) || b.to - a.to || b.from - a.from);

  return {
    id,
    name: lines[0] || '',
    email: contact.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i)?.[0] ?? null,
    phone: contact.match(/(?<!\w)(?:\+\d|\(\d|\d)[\d ().-]{6,}\d(?!\w)/)?.[0].trim() ?? null,
    designation: history[0]?.title ?? null,
    company: history[0]?.company ?? null,
    experience,
    skills: [...new Set(skills)],
    raw,
    history,
    unparsedCount: unparsedRanges.length,
    unparsedRanges
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
