# ParrotNest

ParrotNest is a privacy-first sharing tool with two simple flows:
- ParrotClip: create a short-lived secure clip for text or files using a 4-digit code.
- ParrotURL: create self-destructing short links with auto-generated QR codes.

This project is designed to feel fast and simple for users while still enforcing safe backend defaults for production.

## What Matters Most
- Self-destruct expiry for clips and short URLs.
- Delete-token protected erase operations.
- QR code generated automatically when a short URL is created.
- Session-based local history in the browser.
- Strict upload guardrails (allowed docs/text/source-code files only).

## Stack
- Frontend: Vite + TypeScript + Tailwind CSS
- Backend: Node.js + Express + MongoDB (Mongoose)

## Quick Start
### 1) Install dependencies
```bash
npm install
cd backend
npm install
```

### 2) Configure environment
Copy and edit environment values:
```bash
cd backend
copy .env.example .env
```

Required variables:
- MONGO_URI
- BASE_URL
- PORT
- CORS_ORIGINS
- RATE_LIMIT_REQUESTS
- RATE_LIMIT_WINDOW_SECONDS

For frontend, optional:
- VITE_API_BASE_URL (set this when frontend and backend are on different hosts)

### 3) Run locally
Terminal 1:
```bash
npm run dev
```

Terminal 2:
```bash
cd backend
npm run dev
```

Frontend default: http://localhost:5173  
Backend default: http://localhost:5000

## Core API Routes
### Clip
- POST /api/clip/create
- GET /api/clip/:code
- DELETE /api/clip/:code
- GET /api/clip/download/:fileName

### URL
- POST /api/url/shorten
- DELETE /api/url/:shortId
- GET /:shortId

## Production Checklist
- Rotate database credentials before deployment.
- Keep backend/.env out of version control.
- Set explicit CORS_ORIGINS (do not use * in production).
- Set BASE_URL to the real public backend URL.
- Build frontend with:
```bash
npm run build
```
- Start backend with:
```bash
cd backend
npm run start
```

## Known Limits
- Clip code is 4 digits.
- Max file size per file: 10 MB.
- Max combined upload per request: 10 MB.
- Uploads allow docs/text/source-code extensions only (executables and active web payloads are blocked).


