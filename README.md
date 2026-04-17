# ParrotNest

ParrotNest is a privacy-first sharing tool with two flows:
- ParrotShare: create short-lived secure clips (text/files) with a 6-digit code.
- ParrotURL: create self-destructing short links with auto-generated QR codes.

The codebase is now split for independent deployment:
- `frontend/` -> Vercel
- `backend/` -> Render

## Project Structure
- `frontend/`: Vite + TypeScript + Tailwind website app
- `backend/`: Node.js + Express + MongoDB API

## Local Development

### 1) Install dependencies
```bash
cd frontend
npm install

cd ../backend
npm install
```

### 2) Configure environment files

Backend:
```bash
cd backend
copy .env.example .env
```

Frontend:
```bash
cd frontend
copy .env.example .env.local
```

Set these values:
- Backend `.env`
	- `MONGO_URI`
	- `BASE_URL` (local: `http://localhost:5000`, backend service URL)
	- `PUBLIC_LINK_BASE_URL` (optional local: `http://localhost:5173`, public short-link host)
	- `PORT`
	- `CORS_ORIGINS` (local frontend: `http://localhost:5173`)
	- `RATE_LIMIT_REQUESTS`
	- `RATE_LIMIT_WINDOW_SECONDS`
- Frontend `.env.local`
	- `VITE_API_BASE_URL` (local backend: `http://localhost:5000`)
	- `VITE_APP_DOMAIN` (optional, local frontend URL)

### 3) Run apps

Terminal 1:
```bash
cd backend
npm run dev
```

Terminal 2:
```bash
cd frontend
npm run dev
```

Local URLs:
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:5000`

## Deploy Backend on Render

Use `render.yaml` from repo root or configure manually with:
- Root directory: `backend`
- Build command: `npm install`
- Start command: `npm start`

Render environment variables:
- `MONGO_URI` = your MongoDB Atlas URI
- `BASE_URL` = your Render backend URL
- `PUBLIC_LINK_BASE_URL` = your public short-link domain (for Vercel links: your Vercel frontend URL)
- `CORS_ORIGINS` = `http://localhost:5173,https://your-frontend-name.vercel.app` (replace Vercel URL)
- `RATE_LIMIT_REQUESTS` = `100`
- `RATE_LIMIT_WINDOW_SECONDS` = `900`
- `PORT` = `5000`

## Deploy Frontend on Vercel

Set project root directory to `frontend`.

Vercel environment variables:
- `VITE_API_BASE_URL` = your Render backend URL
- `VITE_APP_DOMAIN` = your Vercel frontend URL (optional)
- `BACKEND_REDIRECT_BASE_URL` = your Render backend URL (used by Vercel redirect proxy)

Short links stay on your Vercel domain (for example `https://your-frontend.vercel.app/abc123`) when:
- backend `PUBLIC_LINK_BASE_URL` points to your Vercel URL
- Vercel function env `BACKEND_REDIRECT_BASE_URL` points to your Render backend URL

`frontend/vercel.json` already routes short IDs to an internal Vercel API proxy (`/api/redirect/:shortId`), so you do not need to edit hardcoded backend domains in rewrites.

`frontend/src/components/api.ts` is configured to fail fast in production if `VITE_API_BASE_URL` is missing.

## Post-Deploy Smoke Test

1. Create a short URL from the deployed frontend.
2. Confirm returned `shortUrl` uses your Vercel domain.
3. Open that short URL and confirm it redirects to the destination URL.
4. Delete the short URL from UI history and confirm success.
5. Verify backend logs show redirect requests and no CORS errors in browser console.

## Core API Routes

Clip:
- `POST /api/clip/create`
- `GET /api/clip/:code`
- `DELETE /api/clip/:code`
- `GET /api/clip/download/:fileName`

URL:
- `POST /api/url/shorten`
- `DELETE /api/url/:shortId`
- `GET /:shortId`

## Known Limits
- Clip code is 6 digits.
- Max file size per file: 10 MB.
- Max combined upload per request: 10 MB.
- Uploads allow docs/text/source-code extensions only (executables and active web payloads are blocked.)


