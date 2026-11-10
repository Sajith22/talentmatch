CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL,
  skills TEXT[] NOT NULL, expected_years INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS candidates (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT, phone TEXT,
  designation TEXT, company TEXT, experience NUMERIC(5,2),
  skills TEXT[] NOT NULL, raw TEXT NOT NULL, history JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS matches (
  job_id TEXT REFERENCES jobs(id) ON DELETE CASCADE,
  candidate_id TEXT REFERENCES candidates(id) ON DELETE CASCADE,
  total_score NUMERIC(5,2) NOT NULL,
  skills_score NUMERIC(4,2) NOT NULL CHECK (skills_score BETWEEN 0 AND 50),
  experience_score NUMERIC(4,2) NOT NULL CHECK (experience_score BETWEEN 0 AND 30),
  designation_score NUMERIC(4,2) NOT NULL CHECK (designation_score BETWEEN 0 AND 20),
  matched TEXT[] NOT NULL, missing TEXT[] NOT NULL, reason TEXT NOT NULL,
  PRIMARY KEY (job_id, candidate_id),
  CHECK (total_score = skills_score + experience_score + designation_score)
);
CREATE INDEX IF NOT EXISTS matches_candidate ON matches(candidate_id, total_score DESC);
