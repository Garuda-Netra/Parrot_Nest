# ParrotNest 🦜

Hey there! ParrotNest is something I built because I was tired of sharing sensitive text and files through apps that store your data forever and never ask permission. So I made my own thing — a clean, fast, privacy-first sharing tool that self-destructs.

There are two features inside:

- **ParrotShare** — Paste text or drop files, get a 5-digit code, share it. The person on the other end enters the code and retrieves your content. No accounts, no tracking, no permanent storage.
- **ParrotURL** — Paste any long URL and get a short link with a QR code. It expires on its own schedule. When it's gone, it's gone.

Everything has a self-destruct timer. You pick how long the data lives (5 minutes, 1 hour, 1 day, 2 days), and when time's up, it's wiped from the database and the server. No leftovers.

---

## What's inside

```
ParrotNest/
├── frontend/   → Vite + TypeScript + Tailwind (deployed on Vercel)
└── backend/    → Node.js + Express + MongoDB (deployed on Render)
```

---

## Running it locally

### Step 1 — Install dependencies

Open two terminals and run:

```bash
# Terminal 1 - Backend
cd backend
npm install

# Terminal 2 - Frontend
cd frontend
npm install
```

### Step 2 — Set up your environment files

**Backend** — copy the example and fill in your values:
```bash
cd backend
copy .env.example .env
```

| Variable | What it does |
|---|---|
| `MONGO_URI` | Your MongoDB Atlas connection string |
| `BASE_URL` | Your backend URL (locally: `http://localhost:5000`) |
| `PUBLIC_LINK_BASE_URL` | Where short links should appear to come from (locally: `http://localhost:5173`) |
| `CORS_ORIGINS` | Frontend origin allowed to talk to backend (locally: `http://localhost:5173`) |
| `PORT` | Port to run the backend on (default: `5000`) |
| `RATE_LIMIT_REQUESTS` | Max requests per window (default: `100`) |
| `RATE_LIMIT_WINDOW_SECONDS` | Rate limit window in seconds (default: `900`) |

**Frontend** — copy the example and fill in your values:
```bash
cd frontend
copy .env.example .env.local
```

| Variable | What it does |
|---|---|
| `VITE_API_BASE_URL` | Points to your backend (locally: `http://localhost:5000`) |
| `VITE_APP_DOMAIN` | Your frontend URL for link previews (optional) |

### Step 3 — Start both servers

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```

Then open **http://localhost:5173** and you're good to go.

---

## Deploying to production

### Backend → Render

You can use the `render.yaml` in the repo root, or set it up manually:

- **Root directory:** `backend`
- **Build command:** `npm install`
- **Start command:** `npm start`

Set these environment variables in your Render dashboard:

| Variable | Value |
|---|---|
| `MONGO_URI` | Your MongoDB Atlas URI |
| `BASE_URL` | Your Render service URL |
| `PUBLIC_LINK_BASE_URL` | Your Vercel frontend URL (so short links look like they come from your domain) |
| `CORS_ORIGINS` | `https://your-frontend.vercel.app` (comma-separate multiple origins) |
| `RATE_LIMIT_REQUESTS` | `100` |
| `RATE_LIMIT_WINDOW_SECONDS` | `900` |
| `PORT` | `5000` |

### Frontend → Vercel

Set the project root to `frontend`, then add these env vars:

| Variable | Value |
|---|---|
| `VITE_API_BASE_URL` | Your Render backend URL |
| `VITE_APP_DOMAIN` | Your Vercel frontend URL (optional) |
| `BACKEND_REDIRECT_BASE_URL` | Your Render backend URL (used by the redirect proxy) |

> Short links will appear on your Vercel domain (e.g. `https://your-app.vercel.app/abc123`). The `vercel.json` file already handles routing — you don't need to touch it.

---

## Smoke test after deploying

Once everything's live, run through this quickly:

1. Create a clip and note the 5-digit code
2. Open a different browser/tab and retrieve it with that code
3. Create a short URL and confirm it redirects correctly
4. Delete something from history and confirm it disappears from the UI and the database
5. Check your browser console — there should be zero CORS errors

---

## API reference

**Clip endpoints:**
```
POST   /api/clip/create          → Create a new clip
GET    /api/clip/:code           → Retrieve a clip by code
DELETE /api/clip/:code           → Delete a clip (requires delete token)
GET    /api/clip/download/:file  → Download a file attached to a clip
POST   /api/clip/bulk-delete     → Delete multiple clips/URLs at once
```

**URL endpoints:**
```
POST   /api/url/shorten          → Create a short URL
DELETE /api/url/:shortId         → Delete a short URL (requires delete token)
GET    /:shortId                 → Redirect to original URL
```

---

## A few things worth knowing

- Clip codes are always 5 digits
- Max file size per upload: **10 MB**
- Max total combined upload per request: **10 MB**
- Allowed file types: text, docs, source code, images (JPG/PNG), audio (MP3), video (MP4)
- Executables and anything that could run as a web script are blocked
- Self-destruct timers are enforced both by MongoDB TTL indexes and a periodic server-side cleanup job that also removes uploaded files from disk
- Delete tokens are hashed with SHA-256 before being stored — even if someone got the database, they couldn't use them

---

Built by **Prince** 🦜
