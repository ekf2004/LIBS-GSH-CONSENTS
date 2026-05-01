# LIBS GSH Consent Generator

A bookmarkable web app for generating Good Samaritan Hospital consent forms from a PDF of booking sheets.

Companion to the [LIBS Babylon Consent Generator](https://github.com/ekf2004/LIBS-BABYLON-CONSENTS).

> **Setting this up?** See [DEPLOYMENT.md](./DEPLOYMENT.md) for step-by-step setup.

## Workflow

1. Donna scans the day's booking sheets into one PDF
2. She opens this site (bookmarked) and drops the PDF onto it
3. The site sends each page to a Cloudflare Worker, which uses Claude vision to extract patient name, doctor, procedure, and date
4. The extracted data shows in a review table; she can edit any cell to fix typos
5. Click "Generate consents" → downloads a merged PDF, one consent per patient

## Repository layout

```
.
├── index.html                # Main page
├── styles.css                # Styling
├── app.js                    # UI flow / state machine
├── consent-generator.js      # Browser PDF generator (overlays text on blank consent template)
└── assets/
    ├── GSH_BLANK_CONSENT.pdf # Blank GSH consent template
    └── pdf-lib.min.js        # Bundled pdf-lib (so the site works offline / without CDN)
```

## Configuration

Edit the top of `app.js`:

```js
const WORKER_URL = "https://gsh-extract.your-subdomain.workers.dev";
```

When `WORKER_URL` is empty, the app runs in **demo mode** — it returns a canned 23-patient dataset for UI testing without needing the backend.

## Backend (Cloudflare Worker)

The extraction backend lives in [TODO: separate repo or `worker/` folder].
It receives a PDF, rasterizes each page, calls Claude API with vision, and returns structured JSON:

```json
{ "patients": [
    { "patient_name": "JOHN DAINO, JR", "doctor": "Dr. Eric Fanaee",
      "procedure": "LEFT SACROILIAC JOINT INJECTION", "procedure_date": "5/4/26" },
    ...
] }
```

## Deployment

This is a static site — push to `main` branch and enable GitHub Pages (Settings → Pages → Source: `main`, root).
The site will be at `https://ekf2004.github.io/LIBS-GSH-CONSENTS/`.

## Local testing

```bash
python3 -m http.server 8000
# visit http://localhost:8000
```

Demo mode (with `WORKER_URL = ""`) lets you exercise the full upload → review → generate flow with canned data, no backend needed.

## Modifying the consent layout

Field positions live in `consent-generator.js` (constants at the top). The reference scan is 1275×1650 px at 150 DPI; coordinates are in those pixels and converted to PDF points by `pxToPt()`.

To change a field's position, find the appropriate `*_PX` constant, adjust, and reload.
