# Latenly — Agent Notes

## Dev

- `python server.py` — static dev server on **port 8081**
- No build step, no bundler, no typecheck, no linter — vanilla HTML/CSS/JS
- Changes are live immediately on reload

## Architecture

- Static site deployed via **GitHub Pages**, custom domain `www.latenly.com`
- Pages: `/` (landing), `/conectar/` (WhatsApp connect form), `/login/`, `/reporte/` (dashboard/report), `404.html`
- Auth: **Supabase** (frontend only) — detects login via localStorage keys matching `sb-*-*-auth-token`
- Payments: **Hotmart** — checkout URLs are still `PLACEHOLDER` in `index.html`

## Gotchas

- `TODO` and `.github/` are gitignored — do not rely on them being tracked
- CSS is split: `assets/css/global.css` (shared) + per-page stylesheets
- JS is per-page: each route has its own `app.js`
- All text/UI is in Spanish — do not translate without asking
