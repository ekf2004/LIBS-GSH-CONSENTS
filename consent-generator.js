// GSH consent generator — port of generate_consents.py to browser JavaScript.
// Expects pdf-lib loaded as global (window.PDFLib) via <script> tag in index.html.
// Exposes window.generateMergedConsents(patients, blankConsentBytes).

(function () {
const { PDFDocument, StandardFonts, rgb } = window.PDFLib;

// ---- Layout calibration ----
// Reference page: 612 x 792 pt (US Letter).
// All coordinates below are in PIXELS at the 150-DPI reference scan (1275 x 1650 px),
// converted to PDF points by pxToPt(). PDF y-axis is flipped (origin bottom-left).

const PAGE_W_PT = 612;
const PAGE_H_PT = 792;
const REF_W_PX = 1275;
const REF_H_PX = 1650;

function pxToPt(pxX, pxY) {
  return {
    x: (pxX * PAGE_W_PT) / REF_W_PX,
    y: PAGE_H_PT - (pxY * PAGE_H_PT) / REF_H_PX,
  };
}

// Field positions (calibrated against the GSH consent template)
const PATIENT_NAME_CENTER_PX = 985;
const PATIENT_NAME_Y_PX = 110;

const DOCTOR_LINE_CENTER_PX = 450;
const DOCTOR_LINE_BASELINE_PX = 320;

const PROCEDURE_X_PX = 150;
const PROCEDURE_TOP_PX = 380;
const PROCEDURE_WIDTH_PX = 1000;
const PROCEDURE_WIDTH_PT = (PROCEDURE_WIDTH_PX * PAGE_W_PT) / REF_W_PX;

const DATE_X_PX = 825;
const DATE_BASELINE_PX = 1486;

// ---- Text fitting (procedure may need wrapping or font shrinking) ----

function wrapText(text, font, fontSize, maxWidthPt) {
  // Greedy word wrap. Returns array of lines.
  const words = text.split(/\s+/);
  const lines = [];
  let current = [];
  for (const word of words) {
    const trial = [...current, word].join(" ");
    if (font.widthOfTextAtSize(trial, fontSize) <= maxWidthPt) {
      current.push(word);
    } else {
      if (current.length) lines.push(current.join(" "));
      current = [word];
    }
  }
  if (current.length) lines.push(current.join(" "));
  return lines;
}

function fitProcedure(text, font, maxWidthPt) {
  // Try single-line at decreasing sizes
  for (const size of [12, 11, 10]) {
    if (font.widthOfTextAtSize(text, size) <= maxWidthPt) {
      return { fontSize: size, lines: [text], lineHeight: size + 3 };
    }
  }
  // Two-line attempts with tight leading
  for (const size of [11, 10]) {
    const lines = wrapText(text, font, size, maxWidthPt);
    if (lines.length === 2) {
      return { fontSize: size, lines, lineHeight: size + 1 };
    }
  }
  // Three-line fallback
  for (const size of [10, 9]) {
    const lines = wrapText(text, font, size, maxWidthPt);
    if (lines.length <= 3) {
      return { fontSize: size, lines, lineHeight: size + 1 };
    }
  }
  // Last resort — smallest font, however many lines
  const lines = wrapText(text, font, 9, maxWidthPt);
  return { fontSize: 9, lines, lineHeight: 10 };
}

// ---- Drawing helpers ----

function drawCentered(page, font, text, fontSize, centerXPx, baselineYPx) {
  const { x, y } = pxToPt(centerXPx, baselineYPx);
  const w = font.widthOfTextAtSize(text, fontSize);
  page.drawText(text, {
    x: x - w / 2,
    y,
    font,
    size: fontSize,
    color: rgb(0, 0, 0),
  });
}

function drawLeft(page, font, text, fontSize, xPx, baselineYPx) {
  const { x, y } = pxToPt(xPx, baselineYPx);
  page.drawText(text, { x, y, font, size: fontSize, color: rgb(0, 0, 0) });
}

// ---- Main API ----

/**
 * Generate one merged PDF containing one consent per patient.
 *
 * @param {Array<{patient_name: string, doctor: string, procedure: string, procedure_date: string}>} patients
 * @param {ArrayBuffer} blankConsentBytes — the blank GSH consent PDF as bytes
 * @returns {Promise<Uint8Array>} the merged PDF as bytes
 */
async function generateMergedConsents(patients, blankConsentBytes) {
  const merged = await PDFDocument.create();
  const helveticaBold = await merged.embedFont(StandardFonts.HelveticaBold);
  const helvetica = await merged.embedFont(StandardFonts.Helvetica);

  for (const patient of patients) {
    // Load a fresh copy of the blank template each iteration
    const template = await PDFDocument.load(blankConsentBytes);
    const [templatePage] = await merged.copyPages(template, [0]);
    merged.addPage(templatePage);
    const page = merged.getPages()[merged.getPageCount() - 1];

    // 1. Patient name — top-right header, bold 14pt centered
    drawCentered(
      page,
      helveticaBold,
      patient.patient_name,
      14,
      PATIENT_NAME_CENTER_PX,
      PATIENT_NAME_Y_PX,
    );

    // 2. Doctor — centered on the underscore line, bold 12pt
    drawCentered(
      page,
      helveticaBold,
      patient.doctor,
      12,
      DOCTOR_LINE_CENTER_PX,
      DOCTOR_LINE_BASELINE_PX,
    );

    // 3. Procedure — in the white block, bold, auto-fit
    const fit = fitProcedure(patient.procedure, helveticaBold, PROCEDURE_WIDTH_PT);
    const procTopPt = pxToPt(PROCEDURE_X_PX, PROCEDURE_TOP_PX);
    fit.lines.forEach((line, i) => {
      page.drawText(line, {
        x: procTopPt.x,
        y: procTopPt.y - i * fit.lineHeight,
        font: helveticaBold,
        size: fit.fontSize,
        color: rgb(0, 0, 0),
      });
    });

    // 4. Procedure date — on the Physician Signature row, regular 10pt
    drawLeft(
      page,
      helvetica,
      patient.procedure_date,
      10,
      DATE_X_PX,
      DATE_BASELINE_PX,
    );
  }

  return await merged.save();
}

window.generateMergedConsents = generateMergedConsents;
})();
