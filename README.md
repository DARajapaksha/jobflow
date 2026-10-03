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
