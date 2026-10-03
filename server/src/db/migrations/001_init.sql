-- Jobflow initial schema

CREATE TYPE user_role  AS ENUM ('seeker', 'employer', 'admin');
CREATE TYPE job_type   AS ENUM ('full_time', 'part_time', 'contract', 'internship');
CREATE TYPE work_mode  AS ENUM ('onsite', 'remote', 'hybrid');
CREATE TYPE job_status AS ENUM ('draft', 'open', 'closed');
CREATE TYPE app_status AS ENUM ('submitted', 'reviewed', 'shortlisted', 'rejected', 'hired');

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name     VARCHAR(120) NOT NULL,
  role          user_role NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Case-insensitive uniqueness: Alice@x.com and alice@x.com are the same account
CREATE UNIQUE INDEX users_email_unique ON users (lower(email));

CREATE TABLE seeker_profiles (
  user_id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  headline        VARCHAR(160),
  bio             TEXT,
  skills          TEXT[] NOT NULL DEFAULT '{}',
  location        VARCHAR(120),
  resume_key      VARCHAR(500),   -- storage key of the default resume file
  resume_filename VARCHAR(255)    -- original filename shown to users
);

CREATE TABLE companies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        VARCHAR(160) NOT NULL,
  description TEXT,
  website     VARCHAR(255),
  location    VARCHAR(120),
  logo_url    VARCHAR(500)
);

CREATE TABLE categories (
  id   SERIAL PRIMARY KEY,
  name VARCHAR(80) UNIQUE NOT NULL
);

CREATE TABLE jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  category_id   INT REFERENCES categories(id),
  title         VARCHAR(160) NOT NULL,
  description   TEXT NOT NULL,
  location      VARCHAR(120),
  job_type      job_type  NOT NULL,
  work_mode     work_mode NOT NULL,
  salary_min    INT CHECK (salary_min IS NULL OR salary_min >= 0),
  salary_max    INT,
  status        job_status NOT NULL DEFAULT 'open',
  search_vector TSVECTOR GENERATED ALWAYS AS (
                  to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))
                ) STORED,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ,
  CHECK (salary_max IS NULL OR salary_min IS NULL OR salary_max >= salary_min)
);

CREATE TABLE applications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  seeker_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cover_letter    TEXT,
  resume_key      VARCHAR(500) NOT NULL,   -- storage key of the uploaded resume
  resume_filename VARCHAR(255) NOT NULL,
  status          app_status NOT NULL DEFAULT 'submitted',
  applied_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (job_id, seeker_id)               -- one application per job per seeker
);

CREATE TABLE saved_jobs (
  seeker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id    UUID NOT NULL REFERENCES jobs(id)  ON DELETE CASCADE,
  saved_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (seeker_id, job_id)
);

-- Search and filtering
CREATE INDEX idx_jobs_search     ON jobs USING GIN (search_vector);
CREATE INDEX idx_jobs_filters    ON jobs (status, category_id, job_type, work_mode);
CREATE INDEX idx_jobs_location   ON jobs (lower(location));
CREATE INDEX idx_jobs_company    ON jobs (company_id);
CREATE INDEX idx_apps_seeker     ON applications (seeker_id);
CREATE INDEX idx_apps_job        ON applications (job_id);
CREATE INDEX idx_companies_owner ON companies (owner_id);
