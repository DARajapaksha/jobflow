# Deploying Jobflow for free

Checked against the providers' own pages on **7 October 2026**. Free-tier limits change, so re-read the pages linked in
section 8 before you rely on them.

## What you will have

```mermaid
flowchart LR
  B[Browser] -->|HTTPS| R[Render web service<br/>Express: serves the React build and the API]
  R -->|SQL over TLS| N[(Neon Postgres)]
  R -->|S3 API| K[(Backblaze B2 bucket<br/>resumes, photos, logos)]
```

One service, one address, one origin. The login cookie is first-party, there is no CORS or proxy to configure, and file
uploads go straight to the API. Total cost: $0. Time: about 45 minutes.

Why these three, in short:

| Piece | Choice | Why |
|---|---|---|
| App | Render free web service | Runs Node; deploys from GitHub. Its disk is wiped on every restart, so no files are kept on it. |
| Database | Neon (not Render's) | Render's free Postgres **expires after 30 days**. Neon's free plan has no expiry and needs no card. |
| Files | Backblaze B2 | 10 GB free, S3-compatible, **no credit card**. Cloudflare R2 needs a payment method to turn on. |

Render may ask for a card to verify your account (a $1 hold that is cancelled); free services stay free afterwards.

---

## 1. Put the code on GitHub

```powershell
cd D:\Projects\jobflow
git status                      # .env, node_modules, uploads and dist must NOT be listed
git add .
git commit -m "Production setup"
git push
```

Check on github.com that `server/.env` is not in the repository. If it ever was, change every secret in it.

## 2. Database: Neon

1. Sign up at neon.com (no card) and create a project. Pick the **AWS Singapore** region (closest to Sri Lanka, and it
   matches the Render region in `render.yaml`).
2. On the project dashboard open **Connect** and copy the connection string. Prefer the **pooled** one (the host name
   contains `-pooler`). It looks like `postgresql://user:password@ep-xxxx-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`.
3. Keep it somewhere private. This is `DATABASE_URL`.

Neon puts the database to sleep after about 5 idle minutes and wakes it on the next query (a second or two). That is
normal and handled: the app keeps few connections and replaces dropped ones.

## 3. File storage: Backblaze B2

1. Sign up at backblaze.com for **B2 Cloud Storage** (no card).
2. **Buckets, Create a Bucket:** a unique name such as `jobflow-yourname-files`, **Private**, encryption on.
   The bucket must stay private: the API checks who may see a resume before it streams it.
3. Open the bucket and note its **Endpoint**, for example `s3.us-west-004.backblazeb2.com`. The part after `s3.` and
   before `.backblazeb2.com` is the **region**.
4. **Application Keys, Add a New Application Key:** limit it to your bucket, type **Read and Write**. Copy the
   **keyID** and the **applicationKey** immediately (the key is shown once).

You will use them as:

| Variable | Value |
|---|---|
| `S3_ENDPOINT` | `https://s3.us-west-004.backblazeb2.com` (yours) |
| `S3_REGION` | `us-west-004` (yours) |
| `S3_BUCKET` | your bucket name |
| `S3_ACCESS_KEY_ID` | the keyID |
| `S3_SECRET_ACCESS_KEY` | the applicationKey |

No browser CORS setup is needed: files go browser → your API → B2, never browser → B2.

## 3b. Try production settings on your own computer first (recommended)

This catches typos before Render does. In `server/.env` temporarily set the Neon and B2 values, then:

```powershell
cd D:\Projects\jobflow\client; npm run build
cd ..\server
$env:SERVE_CLIENT = "true"
npm run migrate        # creates the tables and the job categories in Neon
npm run dev            # open http://localhost:5000
```

Register a test job seeker, upload a profile photo, then check that the file appears in your B2 bucket.
Put `.env` back to your local values afterwards, and delete the test user (a database client such as Neon's SQL editor works).

## 4. Create the Render service

1. At render.com sign up with GitHub and choose **New, Blueprint**, then pick the `jobflow` repository. Render reads
   `render.yaml` and proposes one free web service named `jobflow` in Singapore.
2. Paste the values it asks for: `DATABASE_URL` and the five `S3_*` values. `JWT_SECRET` is generated for you.
3. **Apply.** The first build takes a few minutes. The start command runs the migrations, then starts the server.

If you prefer to click it together by hand instead: New, Web Service, runtime Node, region Singapore, instance type
Free, then copy the build command, start command, health check path and variables from `render.yaml`.

## 5. Check that it works

Replace the address with yours (Render shows it, `https://jobflow-xxxx.onrender.com`):

1. `/api/health` shows `{"status":"ok"}` and `/api/health/ready` shows `"database":"up"`.
2. The home page loads with jobs, and a refresh on a job page still works.
3. Register an employer, upload a company logo and post a job (the Category list should be full).
4. Register a job seeker, apply with a PDF, and check the file is in your B2 bucket.
5. The Render **Logs** tab shows no red errors.

## 6. Content and safety

- **Do not run `npm run seed` against the live database.** It is for development machines only: it fills the database
  with fake companies and accounts and **wipes users, companies, jobs and applications**. The server refuses to run it
  when `NODE_ENV=production` unless you add `--force`.
- **The live site starts empty, and that is correct.** The only data it needs is the list of job categories, and that
  arrives with the database migrations (`003_categories.sql`), so the search filter and the "post a job" form work from
  the first minute.
- **Add real content through the app.** Register an employer account for an organisation you actually represent and
  post genuine listings. Do not enter invented listings under a real company's name: job seekers may apply to them.
  If you have no genuine listings yet, an empty board with working sign-up is better than a convincing fake one.
- Registration is open. Uploads are limited (5 MB, PDF or image only, images re-encoded) and the API is rate limited.
  B2's free 10 GB is a hard ceiling; check the bucket now and then.
- Resumes can contain phone numbers and home addresses. The README asks visitors to use a dummy PDF, and files are
  only ever served to the owner and to employers they applied to.

## 7. What visitors will experience

- **Cold start.** After 15 minutes without traffic the free service sleeps. The next visitor waits up to about a minute
  (Render shows its own loading page meanwhile). Open the link yourself shortly before you send an application or go
  into an interview.
- **Do not set up an uptime pinger.** Render gives **750 free hours per month to the whole workspace**, shared by every
  free service, and a service uses hours only while awake. One always-on service uses about 744 hours, which would
  leave your other free apps (such as Chatflow) with nothing; at 750 Render suspends **all** your free services until
  next month. A paid always-on instance (Starter, about $7 per month at the time of writing) is the clean fix if
  cold starts ever matter.
- **Neon sleep.** After a quiet spell the first database query takes an extra second or two. Do not ping the database
  either: its free plan allows 100 compute-hours a month, which is less than an always-awake month needs.
  `/api/health` deliberately never touches the database.

## 8. Limits to re-check before you rely on them

| Service | Free plan, as of 7 Oct 2026 | Where to look |
|---|---|---|
| Render | Free web service sleeps after 15 min idle; up to ~1 min to wake; 750 instance hours per workspace per month; ephemeral disk; free Postgres expires after 30 days | render.com/docs/free |
| Neon | No expiry, no card; 100 compute-hours per project per month; 1 GB storage per project (older articles say 0.5 GB, the docs were raised on 1 Oct 2026); scales to zero after ~5 min | neon.com/docs/introduction/plans |
| Backblaze B2 | First 10 GB free, no card; free downloads up to 3x what you store | backblaze.com/cloud-storage/pricing |

## 9. Updating, and when something goes wrong

- **Update:** `git push` to `main`; Render rebuilds and redeploys by itself. GitHub Actions (`.github/workflows/ci.yml`)
  runs the tests on every push.
- **Logs:** Render dashboard, your service, Logs.

| Symptom | Likely cause and fix |
|---|---|
| Build fails with `vite: not found` | The client build lost its dev tools. Keep `npm ci --include=dev` in the build command. |
| `Missing required env var` or `JWT_SECRET must be a random string` | A variable is missing or too short. `JWT_SECRET` needs 32+ characters (Render generates one). |
| `Build the client first` | The client build did not run. Check the build command in Render. |
| Slow or failing first request after a quiet spell | Normal cold start. If it stays broken, check `DATABASE_URL` and that `DATABASE_SSL` is `true`. |
| `/api/health/ready` fails but `/api/health` works | The database is unreachable: wrong or expired `DATABASE_URL`, or the Neon project is suspended. |
| Logging in does nothing | Use the `https://` address (the session cookie is Secure). |
| Uploads fail with a storage error | Check `S3_ENDPOINT` (starts with `https://s3.`), `S3_REGION`, the bucket name and that the key is allowed to write to that bucket. If the name does not resolve, set `S3_FORCE_PATH_STYLE=true`. |
| Many visitors get "Too many requests" | Every visitor looks like one address, so the proxy count is off. Try `TRUST_PROXY=2` (then test by logging in from two networks). |

## 10. After it is live

1. Add the address to your CV (Live Demo), the GitHub README and your portfolio site.
2. Add two or three screenshots to the README.
3. Say honestly on the CV or in the README that the free host may need up to a minute to wake on the first visit.
