# Jobflow

Job board with employer and job-seeker roles. React + Node.js/Express + PostgreSQL.
See [docs/DESIGN.md](docs/DESIGN.md) for architecture, UML, schema, API and wireframes.

## Local setup

```bash
# 1. Start PostgreSQL
docker compose up -d

# 2. Configure and run the API
cd server
cp .env.example .env
npm install
npm run migrate      # create tables
npm run seed         # demo data
npm run dev          # http://localhost:5000/api/health
```

Demo logins (dev only), password `Password123!`:
`employer@jobflow.dev`, `employer2@jobflow.dev`, `seeker@jobflow.dev`

Reset everything: `npm run db:reset`

## Auth API

| Method | Endpoint | Notes |
|---|---|---|
| POST | `/api/auth/register` | `{ fullName, email, password, role: "seeker" \| "employer", companyName? }`; logs the user in |
| POST | `/api/auth/login` | `{ email, password }`; sets an httpOnly `token` cookie |
| POST | `/api/auth/logout` | clears the cookie |
| GET | `/api/auth/me` | current user plus company (employer) or profile (seeker) |

Run the tests with `npm test` in `server/` (they use the database in `DATABASE_URL` and clean up after themselves).

## Jobs API

| Method | Endpoint | Access | Notes |
|---|---|---|---|
| GET | `/api/categories` | public | category list |
| GET | `/api/jobs` | public | `q, category, location, type, mode, salaryMin, sort, page, limit` (see below) |
| GET | `/api/jobs/:id` | public | open jobs; owners also see their drafts / closed jobs |
| POST | `/api/jobs` | employer | company comes from the logged-in employer |
| PATCH | `/api/jobs/:id` | employer (owner) | partial update; `status`: `draft`, `open`, `closed` |
| DELETE | `/api/jobs/:id` | employer (owner) | |
| GET | `/api/employer/jobs` | employer | own listings with `applicantCount`; optional `?status=` |

Search example: `/api/jobs?q=react developer&mode=remote,hybrid&type=internship&salaryMin=100000&sort=salary_desc&page=2&limit=10`.
`type` and `mode` accept comma-separated lists. Response: `{ data: [...], pagination: { page, limit, total, totalPages } }`.

## Resume upload API

| Method | Endpoint | Access | Notes |
|---|---|---|---|
| PUT | `/api/me/resume` | seeker | `multipart/form-data`, file in field `resume`; PDF only, max `MAX_RESUME_MB` (default 5) |
| GET | `/api/me/resume` | seeker | downloads your own default resume |
| DELETE | `/api/me/resume` | seeker | removes it |

Files are stored through a storage driver chosen by `STORAGE_DRIVER`: `local` (default; saved under `UPLOAD_DIR`) or `s3`
(any S3-compatible bucket; set the `S3_*` variables in `.env.example` and keep the bucket private). Files are never served
by a public URL, only through API endpoints that check who is asking.

## Applications API

| Method | Endpoint | Access | Notes |
|---|---|---|---|
| POST | `/api/jobs/:id/applications` | seeker | `multipart/form-data`: `coverLetter` (optional) and `resume` (PDF, optional: falls back to your saved default resume) |
| GET | `/api/me/applications` | seeker | own applications with job info; optional `?status=` |
| GET | `/api/jobs/:id/applications` | employer (owner) | applicants with profile info; `?status=&page=&limit=` |
| GET | `/api/applications/:id` | applicant or job owner | details (others get 404) |
| PATCH | `/api/applications/:id/status` | employer (owner) | `{ "status": "reviewed" \| "shortlisted" \| "rejected" \| "hired" }`, following the allowed transitions |
| GET | `/api/applications/:id/resume` | applicant or job owner | downloads the resume that was sent |

`GET /api/jobs/:id` also returns `viewer.application` (id and status, or `null`) when a seeker is logged in.

## Postman

Import `docs/Jobflow.postman_collection.json`. Login sets an httpOnly cookie that Postman sends automatically
(one session at a time: log in as the role you need). Requests save `jobId` and `applicationId` into collection variables.
