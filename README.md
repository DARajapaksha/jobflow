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
