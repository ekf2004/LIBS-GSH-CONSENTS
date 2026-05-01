// GSH Consent Generator — front-end logic.
//
// State machine: upload → extract → review → generate → done
// Each step is a section in the DOM with class .step; toggling .active shows one.
//
// Depends on: pdf-lib (window.PDFLib), window.generateMergedConsents
// (loaded via plain <script> tags before this file).

(function () {

// ---- Config ----
// The Cloudflare Worker URL. When empty, the app runs in "demo mode" using
// stub data — useful for UI testing before the Worker is deployed.
const WORKER_URL = "https://gsh-extract.libs-tools.workers.dev";  

// Path to the blank consent template (committed in this repo)
const BLANK_CONSENT_PATH = "./assets/GSH_BLANK_CONSENT.pdf";

// ---- DOM helpers ----
const $ = (id) => document.getElementById(id);
const steps = ["step-upload", "step-extract", "step-review", "step-generate", "step-done", "step-error"];

function showStep(id) {
  steps.forEach((s) => $(s).classList.toggle("active", s === id));
}

function showError(message) {
  $("error-message").textContent = message;
  showStep("step-error");
}

// ---- Application state ----
let extractedPatients = [];        // array of {patient_name, doctor, procedure, procedure_date, _problems}
let blankConsentBytes = null;       // ArrayBuffer of the blank template
let lastGeneratedPdfBytes = null;   // Uint8Array — the merged consents PDF

// ---- Step 1: file picker / drag-drop ----
function setupDropzone() {
  const dz = $("dropzone");
  const input = $("file-input");

  // Click → open native picker
  dz.addEventListener("click", () => input.click());
  dz.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      input.click();
    }
  });

  input.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) handleFile(file);
  });

  // Drag handlers
  ["dragenter", "dragover"].forEach((evt) =>
    dz.addEventListener(evt, (e) => {
      e.preventDefault();
      dz.classList.add("drag-over");
    }),
  );
  ["dragleave", "drop"].forEach((evt) =>
    dz.addEventListener(evt, (e) => {
      e.preventDefault();
      dz.classList.remove("drag-over");
    }),
  );
  dz.addEventListener("drop", (e) => {
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });
}

async function handleFile(file) {
  if (!file.name.toLowerCase().endsWith(".pdf")) {
    showError(`Expected a PDF — got "${file.name}"`);
    return;
  }
  showStep("step-extract");
  $("extract-status").textContent = `Reading ${file.name}…`;
  $("progress-bar").style.width = "10%";

  try {
    const fileBytes = await file.arrayBuffer();
    extractedPatients = await extractFromPdf(fileBytes, file.name);

    if (!extractedPatients.length) {
      throw new Error("No booking sheets found in this PDF.");
    }

    renderReview(extractedPatients);
    showStep("step-review");
  } catch (err) {
    console.error(err);
    showError(err.message || String(err));
  }
}

// ---- Step 2: extraction ----
async function extractFromPdf(pdfBytes, filename) {
  if (!WORKER_URL) {
    // Demo mode: return canned data so the UI can be tested without a backend.
    return demoExtraction();
  }

  // Upload PDF to worker, get back JSON list of patients
  $("extract-status").textContent = "Uploading to extraction service…";
  $("progress-bar").style.width = "30%";

  const response = await fetch(`${WORKER_URL}/extract`, {
    method: "POST",
    headers: { "Content-Type": "application/pdf" },
    body: pdfBytes,
  });

  $("progress-bar").style.width = "80%";

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(`Extraction failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  $("progress-bar").style.width = "100%";
  return data.patients;
}

function demoExtraction() {
  // Simulates a successful extraction for UI testing. Same 23 patients
  // we've been using throughout development.
  $("extract-status").textContent = "Demo mode (no backend configured) — using canned data";
  return [
    { patient_name: "JOHN DAINO, JR", doctor: "Dr. Eric Fanaee", procedure: "LEFT SACROILIAC JOINT INJECTION", procedure_date: "5/4/26" },
    { patient_name: "DANIEL CARROLL", doctor: "Dr. Eric Fanaee", procedure: "BILATERAL LUMBAR L2, L3, L4, L5 MEDIAL BRANCH BLOCK", procedure_date: "5/4/26" },
    { patient_name: "PAUL GALEA", doctor: "Dr. Eric Fanaee", procedure: "BILATERAL LUMBAR L3, L4, L5 MEDIAL BRANCH BLOCK", procedure_date: "5/4/26" },
    { patient_name: "MELISSA YOUNG", doctor: "Dr. Eric Fanaee", procedure: "RIGHT CERVICAL C2, C3, C4 MEDIAL BRANCH BLOCK", procedure_date: "5/4/26" },
    { patient_name: "ELLEN FIELDS", doctor: "Dr. Eric Fanaee", procedure: "BILATERAL GREATER TROCHANTER BURSA INJECTION", procedure_date: "5/4/26" },
    { patient_name: "CHRISTINE FOLAN", doctor: "Dr. Eric Fanaee", procedure: "BILATERAL LUMBAR L4-L5, L5-S1 TRANSFORAMINAL EPIDURAL STEROID INJECTION", procedure_date: "5/4/26" },
    { patient_name: "CAROL CALL", doctor: "Dr. Eric Fanaee", procedure: "BILATERAL LUMBAR L5-S1, S1 TRANSFORAMINAL EPIDURAL STEROID INJECTION", procedure_date: "5/4/26" },
    { patient_name: "CAROLANN SOKOL", doctor: "Dr. Eric Fanaee", procedure: "LEFT CAUDAL EPIDURAL STEROID INJECTION WITH GANGLION OF IMPAR BLOCK", procedure_date: "5/4/26" },
    { patient_name: "MARGARET NORMANDIA", doctor: "Dr. Eric Fanaee", procedure: "MIDLINE CERVICAL C7-T1 EPIDURAL STEROID INJECTION AND BILATERAL PARACERVICAL TRIGGER POINT INJECTION", procedure_date: "5/4/26" },
    { patient_name: "RANDI ABRAMS", doctor: "Dr. Eric Fanaee", procedure: "RIGHT LUMBAR L3-L4 EPIDURAL STEROID INJECTION", procedure_date: "5/4/26" },
    { patient_name: "LISA MOORE", doctor: "Dr. Eric Fanaee", procedure: "LEFT CERVICAL C6-C7 EPIDURAL STEROID INJECTION", procedure_date: "5/4/26" },
    { patient_name: "JOSEPH COLASANTI", doctor: "Dr. Eric Fanaee", procedure: "LEFT LUMBAR L4-L5, L5-S1 TRANSFORAMINAL EPIDURAL STEROID INJECTION AND LEFT LUMBAR L4-L5 FACET CYST ASPIRATION", procedure_date: "5/4/26" },
    { patient_name: "WILLIAM GOLDEN", doctor: "Dr. Eric Fanaee", procedure: "RIGHT CERVICAL C6, C7, C8 RADIOFREQUENCY ABLATION", procedure_date: "5/4/26" },
    { patient_name: "KRISTIN SLATTERY", doctor: "Dr. Eric Fanaee", procedure: "LEFT CERVICAL C2, C3, C4 RADIOFREQUENCY ABLATION", procedure_date: "5/4/26" },
    { patient_name: "PHILIP STEFANELLI", doctor: "Dr. Eric Fanaee", procedure: "LEFT LUMBAR L3, L4, L5 RADIOFREQUENCY ABLATION", procedure_date: "5/4/26" },
    { patient_name: "MICHELLE SPERLING - GARCIA", doctor: "Dr. Eric Fanaee", procedure: "LEFT LUMBAR L3, L4, L5 RADIOFREQUENCY ABLATION", procedure_date: "5/4/26" },
    { patient_name: "TREVOR MCKELLOR", doctor: "Dr. Eric Fanaee", procedure: "LEFT LUMBAR L4-L5, L5-S1 TRANSFORAMINAL EPIDURAL STEROID INJECTION", procedure_date: "5/4/26" },
    { patient_name: "LEYDI CUARTAS", doctor: "Dr. Eric Fanaee", procedure: "LEFT LUMBAR L4-L5, L5-S1 TRANSFORAMINAL EPIDURAL STEROID INJECTION", procedure_date: "5/4/26" },
    { patient_name: "JESSICA MANNARA", doctor: "Dr. Eric Fanaee", procedure: "MIDLINE LUMBAR L5-S1 EPIDURAL STEROID INJECTION", procedure_date: "5/4/26" },
    { patient_name: "DAYNA MARIE HALUPA", doctor: "Dr. Eric Fanaee", procedure: "LEFT CERVICAL C6-C7 EPIDURAL STEROID INJECTION", procedure_date: "5/4/26" },
    { patient_name: "MICHELE PEREZ", doctor: "Dr. Eric Fanaee", procedure: "BOTOX INJECTIONS FOR MIGRAINES", procedure_date: "5/4/26" },
    { patient_name: "CHRISTOPHER BERGIN", doctor: "Dr. Eric Fanaee", procedure: "LEFT CERVICAL C6-C7 EPIDURAL STEROID INJECTION", procedure_date: "5/4/26" },
    { patient_name: "CHRISTOPHER GORMAN", doctor: "Dr. Eric Fanaee", procedure: "RIGHT LUMBAR L4-L5, L5-S1 TRANSFORAMINAL EPIDURAL STEROID INJECTION", procedure_date: "5/4/26" },
  ];
}

// ---- Step 3: review table ----
function renderReview(patients) {
  const tbody = $("review-tbody");
  tbody.innerHTML = "";

  patients.forEach((p, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td class="editable" data-field="patient_name">${escapeHtml(p.patient_name || "")}</td>
      <td class="editable" data-field="doctor">${escapeHtml(p.doctor || "")}</td>
      <td class="editable" data-field="procedure">${escapeHtml(p.procedure || "")}</td>
      <td class="editable" data-field="procedure_date">${escapeHtml(p.procedure_date || "")}</td>
      <td class="status-cell ${statusClass(p)}">${statusLabel(p)}</td>
    `;
    tbody.appendChild(tr);

    // Wire up inline editing for the four data cells
    tr.querySelectorAll("td.editable").forEach((cell) => {
      cell.addEventListener("click", () => beginEdit(cell, i));
    });
  });
}

function statusClass(p) {
  if (!p.patient_name || !p.doctor || !p.procedure || !p.procedure_date) return "status-error";
  if (p._problems && p._problems.length) return "status-warn";
  return "status-ok";
}
function statusLabel(p) {
  if (!p.patient_name || !p.doctor || !p.procedure || !p.procedure_date) return "Missing";
  if (p._problems && p._problems.length) return "Review";
  return "OK";
}

function beginEdit(cell, rowIndex) {
  if (cell.contentEditable === "true") return;
  cell.contentEditable = "true";
  cell.focus();
  // Select all on first click for easy overwriting
  const range = document.createRange();
  range.selectNodeContents(cell);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);

  const finish = () => {
    cell.contentEditable = "false";
    const field = cell.dataset.field;
    const value = cell.textContent.trim();
    extractedPatients[rowIndex][field] = value;
    // Re-render only the status cell of this row
    const tr = cell.closest("tr");
    const statusCell = tr.querySelector(".status-cell");
    statusCell.className = `status-cell ${statusClass(extractedPatients[rowIndex])}`;
    statusCell.textContent = statusLabel(extractedPatients[rowIndex]);
  };

  cell.addEventListener("blur", finish, { once: true });
  cell.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      cell.blur();
    }
    if (e.key === "Escape") {
      cell.textContent = extractedPatients[rowIndex][cell.dataset.field] || "";
      cell.blur();
    }
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

// ---- Step 4: generate ----
async function generateConsents() {
  showStep("step-generate");
  try {
    if (!blankConsentBytes) {
      const resp = await fetch(BLANK_CONSENT_PATH);
      if (!resp.ok) throw new Error(`Could not load blank consent template: ${resp.status}`);
      blankConsentBytes = await resp.arrayBuffer();
    }

    const valid = extractedPatients.filter(
      (p) => p.patient_name && p.doctor && p.procedure && p.procedure_date,
    );
    if (!valid.length) {
      throw new Error("No complete patient records to generate.");
    }

    lastGeneratedPdfBytes = await window.generateMergedConsents(valid, blankConsentBytes);
    $("done-summary").textContent = `Generated ${valid.length} consent${valid.length === 1 ? "" : "s"}.`;
    showStep("step-done");
  } catch (err) {
    console.error(err);
    showError(err.message || String(err));
  }
}

function downloadPdf() {
  if (!lastGeneratedPdfBytes) return;
  const blob = new Blob([lastGeneratedPdfBytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `GSH_Consents_${todayStamp()}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function todayStamp() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

// ---- Wiring ----
function init() {
  setupDropzone();
  $("btn-back-to-upload").addEventListener("click", reset);
  $("btn-restart").addEventListener("click", reset);
  $("btn-error-restart").addEventListener("click", reset);
  $("btn-generate").addEventListener("click", generateConsents);
  $("btn-download").addEventListener("click", downloadPdf);
}

function reset() {
  extractedPatients = [];
  lastGeneratedPdfBytes = null;
  $("file-input").value = "";
  $("progress-bar").style.width = "0%";
  showStep("step-upload");
}

document.addEventListener("DOMContentLoaded", init);
})();
