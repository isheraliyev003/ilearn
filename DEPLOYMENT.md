# Deploy ilearn (Neon + Vercel + Render)

Stack: **Neon** (PostgreSQL), **Vercel** (Next.js frontend), **Render** (NestJS API). CI runs on GitHub Actions; hosting can auto-deploy from GitHub.

## 1. Database (Neon)

1. Create a project at [https://neon.tech](https://neon.tech).
2. Copy the **connection string** (must include `?sslmode=require` if Neon shows it — Prisma works with Neon’s pooled or direct URL).
3. Keep it for Render (`DATABASE_URL`).

## 2. Backend (Render)

**Option A — Blueprint (recommended if starting fresh)**

1. In Render: **New** → **Blueprint**, connect this GitHub repo.
2. Approve the service from `render.yaml`.
3. In the **ilearn-api** service → **Environment**, set:
   - `DATABASE_URL` — Neon connection string
   - `CORS_ORIGIN` — your Vercel URL, e.g. `https://your-app.vercel.app` (no trailing slash)
   - `RESEND_API_KEY` — API key for sending email sign-in codes
   - `EMAIL_FROM` — verified sender, e.g. `ilearn <auth@yourdomain.com>`
   - Optional: `AI_PROVIDER`, `SERPER_API_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY` (see `backend/.env.example`)

**Option B — Manual Web Service**

1. **New** → **Web Service**, connect the repo, **Root Directory** empty (monorepo root).
2. **Build command:**  
   `npm ci && npm run build -w shared && npm run build -w backend && npm run prisma:deploy -w backend`
3. **Start command:**  
   `npm run start:prod -w backend`
4. Add the same environment variables as above.

`PORT` is set by Render; do not override unless you know you need to.

For local development, email auth has a console fallback: if `RESEND_API_KEY`
or `EMAIL_FROM` are missing, or if email delivery fails, the backend logs the
6-digit sign-in code to the terminal instead of blocking sign-in.

## 3. Frontend (Vercel) — do this after the API is live

1. Import the repo at [https://vercel.com](https://vercel.com).
2. **Root Directory:** `frontend`
3. Framework: Next.js (auto-detected). `frontend/vercel.json` installs from the repo root and builds `shared` + `frontend`.
4. **Environment variables** (Production — and Preview if you want previews to hit the same API):
   - **`NEXT_PUBLIC_API_URL`** = your Render API **origin** with **no trailing slash**, e.g. `https://ilearn-api-twwu.onrender.com`
5. Deploy. Open the Vercel URL and confirm pages load.
6. **CORS:** In Render → **ilearn-api** → **Environment**, set **`CORS_ORIGIN`** to allowed origins, **no path, no trailing slash**. You can list several separated by commas, e.g. `http://localhost:3000,https://ilearn-frontend-eight.vercel.app`. Save — Render will redeploy. Without this, the browser may block API calls from the deployed site.

## 4. GitHub Actions

- **CI** (`.github/workflows/ci.yml`): on every push and PR to `main`, runs `lint:ci`, build, and backend tests.
- **Render deploy hook (optional):** If you use Render’s **Deploy Hook** instead of GitHub auto-deploy, add the hook URL as repository secret `RENDER_DEPLOY_HOOK_URL`. If you use Render’s **GitHub integration** for auto-deploy, leave this unset so CI does not trigger a duplicate deploy.

## 5. Order of operations

1. Neon → get `DATABASE_URL`
2. Render → set env, deploy API, confirm `GET https://<your-api>/health`
3. Request a sign-in code locally or in production and confirm the email arrives
4. Vercel → set `NEXT_PUBLIC_API_URL` to that API origin, deploy
