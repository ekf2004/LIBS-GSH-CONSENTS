# LIBS GSH Consents — Deployment Guide

This is the master setup guide for getting the GSH consent generator live and working for Donna.

## What you're deploying

Two pieces:

1. **Static website** (`LIBS-GSH-CONSENTS` repo) — what Donna bookmarks and uses. Lives on GitHub Pages.
2. **Cloudflare Worker** (in `worker/` folder of this same repo) — the backend that does extraction. Free tier covers our usage.

## Total time estimate: ~20 minutes once

You'll need:
- A GitHub account with the `LIBS-GSH-CONSENTS` repo created (already done)
- An Anthropic API key (sign up at https://console.anthropic.com — they include a $5 free credit)
- A Cloudflare account (free, sign up at https://cloudflare.com)

## Steps

### 1. Push the static site

Copy the top-level files (everything except the `worker/` folder) into your `LIBS-GSH-CONSENTS` repo and push to `main`:

```
.
├── index.html
├── styles.css
├── app.js
├── consent-generator.js
├── README.md
└── assets/
    ├── GSH_BLANK_CONSENT.pdf
    └── pdf-lib.min.js
```

Then enable GitHub Pages: Settings → Pages → Source: `main`, root folder.

The site goes live at **https://ekf2004.github.io/LIBS-GSH-CONSENTS/** in about a minute.

In demo mode (default), it works with hardcoded test data — useful for showing Donna the workflow before the backend is set up.

### 2. Deploy the Worker

```bash
cd worker
npm install
npx wrangler login            # opens browser to sign into Cloudflare
npx wrangler secret put ANTHROPIC_API_KEY
# (paste your Anthropic API key when prompted)
npx wrangler deploy
```

Wrangler prints the deployed URL, e.g. `https://gsh-extract.YOUR-SUBDOMAIN.workers.dev`. Copy it.

### 3. Wire the site to the Worker

Edit `app.js` line 11:

```js
const WORKER_URL = "https://gsh-extract.YOUR-SUBDOMAIN.workers.dev";
```

Commit and push. The site is now fully wired.

### 4. Test with a real booking sheet PDF

Visit the site, drop a booking sheet PDF onto it, and verify:
- Patient names extract correctly
- Doctors map to "Dr. Eric Fanaee" / "Dr. Clarence Kong"
- Procedures appear without CPT codes
- Procedure dates are correct (M/D/YY format)

If anything is wrong, the table is editable — click any cell and fix it before clicking Generate.

## Cost

| Service | Free tier | Donna's expected use | Likely cost |
|---|---|---|---|
| GitHub Pages | unlimited | ~25 page loads/day | $0 |
| Cloudflare Workers | 100K req/day | ~25 extractions/day | $0 |
| Anthropic API | $5 trial credit | ~$0.25 per batch | ~$5/month after credit runs out |

## Updating

- **Site changes:** edit files, commit, push. Live in seconds.
- **Worker changes:** `cd worker && npx wrangler deploy`. Live in seconds.
- **Consent layout tweaks:** edit field positions in `consent-generator.js` (constants near top).
- **Doctor list changes:** update `DOCTOR_MAP` in `worker/src/index.js`, redeploy.

## Files

```
.
├── index.html              # Page structure (the part Donna sees)
├── styles.css              # Visual styling
├── app.js                  # UI flow / state machine
├── consent-generator.js    # PDF generator (overlays text on consent template)
├── README.md               # Repo overview
├── DEPLOYMENT.md           # This file
├── assets/
│   ├── GSH_BLANK_CONSENT.pdf  # The blank consent template
│   └── pdf-lib.min.js         # PDF library (bundled, no CDN)
└── worker/                 # Cloudflare Worker (extraction backend)
    ├── src/index.js
    ├── wrangler.toml
    ├── package.json
    └── README.md
```
