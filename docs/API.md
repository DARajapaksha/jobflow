# API reference

All endpoints are under `/api`. Requests and responses are JSON, except uploads (`multipart/form-data`).
Errors always have the same shape: `{ "error": { "code": "...", "message": "...", "details": [...] } }`.
Authentication is an httpOnly cookie set by login. A `Bearer` token is also accepted, which is handy in Postman.

Import [`Jobflow.postman_collection.json`](Jobflow.postman_collection.json) into Postman for a ready-made request for every
endpoint below (login sets the cookie; requests save `jobId` and `applicationId` for the next call).
Health checks: `GET /api/health` (liveness) and `GET /api/health/ready` (also checks the database).

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

## Saved jobs, profile and companies API

| Method | Endpoint | Access | Notes |
|---|---|---|---|
| POST / DELETE | `/api/jobs/:id/save` | seeker | save / unsave (idempotent); only open jobs can be saved |
| GET | `/api/me/saved-jobs` | seeker | newest first, paginated; closed/expired jobs stay listed with `available: false` |
| PATCH | `/api/me/profile` | seeker or employer | seeker: `fullName, headline, bio, skills[], location`; employer (company): `fullName, name, description, website, location`. Send only what changes; `""` or `null` clears a field |
| GET | `/api/companies` | public | companies with open jobs, busiest first; `?q=&page=&limit=` |
| GET | `/api/companies/:id` | public | company details with `openJobCount`; its jobs: `GET /api/jobs?company=<id>` |

For a logged-in seeker, `GET /api/jobs` adds `saved: true|false` to each job, and `GET /api/jobs/:id` returns `viewer: { application, saved }`.

## Profile pictures

| Method | Endpoint | Access | Notes |
|---|---|---|---|
| PUT / DELETE | `/api/me/avatar` | seeker | `multipart/form-data`, field `image` (PNG, JPEG or WebP, max `MAX_IMAGE_MB`, default 5). Stored as a 256 px square |
| PUT / DELETE | `/api/me/logo` | employer | same rules; keeps its shape and transparency, at most 512 px |
| GET | `/api/companies/:id/logo` | public | cached for a year (the URL carries a version that changes when the logo does) |
| GET | `/api/users/:id/avatar` | the seeker, or an employer they applied to | short private cache, tied to the login cookie |

Uploads are decoded and re-encoded as WebP with `sharp`, and the original is never kept. That strips metadata such as
GPS location from phone photos, applies rotation, and rejects SVG, GIF, tiny images and "image bombs"
(more than 25 million pixels). Pictures use the same storage driver as resumes (`STORAGE_DRIVER`).
Run `npm run migrate` once to add the new columns.
