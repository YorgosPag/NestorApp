'use strict';

/**
 * Η συναρμολόγηση του φύλλου διαλογής (ADR-775 §15).
 *
 * Πρότυπο: **Skia Gold triage UI** — τα golden είναι *ανθρώπινα εγκεκριμένα* artifacts, όχι
 * ό,τι έτυχε να παράγει η τελευταία εκτέλεση. Η διαφορά μας: το Gold είναι υπηρεσία· εδώ αρκεί
 * ένα αρχείο που ανοίγει με διπλό κλικ, χωρίς δίκτυο και χωρίς λογαριασμό.
 */

const { SHEET_CSS } = require('./sheet-style');
const { SHEET_JS } = require('./sheet-script');

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const HEADER = `
<header>
  <h1>ADR-775 · Έγκριση golden — DXF visual regression</h1>
  <nav class="tabs">
    <button class="tab" id="tab-one" aria-selected="true">Έγκριση μία-μία</button>
    <button class="tab" id="tab-grid" aria-selected="false">Επισκόπηση</button>
  </nav>
  <div class="counts">
    <span>✅ <b id="c-yes">0</b></span>
    <span>❌ <b id="c-no">0</b></span>
    <span>υπόλοιπα <b id="c-left">0</b></span>
  </div>
</header>`;

const ONE_VIEW = `
<section id="view-one" class="one">
  <div class="title">
    <h2 id="one-title"></h2>
    <span class="sub" id="one-sub"></span>
    <span class="sub" id="one-pos"></span>
    <span id="verdict"></span>
  </div>
  <div class="frames">
    <figure>
      <figcaption><span>ΥΠΟΨΗΦΙΟ (νέο)</span><span id="cand-cap"></span></figcaption>
      <img id="cand" alt="υποψήφιο">
    </figure>
    <figure id="gold-fig">
      <figcaption><span>ΤΡΕΧΟΥΣΑ ΒΑΣΗ (άκυρη)</span><span id="gold-cap"></span></figcaption>
      <img id="gold" alt="τρέχουσα βάση">
    </figure>
  </div>
  <div class="facts" id="facts"></div>
  <div class="alerts" id="alerts"></div>
  <div class="bar">
    <button class="act yes" id="btn-yes">✅ ΝΑΙ — σωστή εικόνα</button>
    <button class="act no" id="btn-no">❌ ΟΧΙ — λάθος</button>
    <button class="act skip" id="btn-skip">⏭ Παράλειψη</button>
    <button class="act skip" id="btn-prev">← Προηγούμενο</button>
    <button class="act skip" id="btn-save">💾 Αποθήκευση αποφάσεων</button>
    <button class="act skip" id="btn-reset">Μηδενισμός</button>
    <span class="nav"><kbd>→</kbd> ναι · <kbd>←</kbd> όχι · <kbd>↓</kbd> αναίρεση ·
      <kbd>PgUp</kbd>/<kbd>PgDn</kbd> πλοήγηση</span>
  </div>
</section>`;

const GRID_VIEW = `
<section id="view-grid" class="hidden">
  <div class="grid" id="grid"></div>
</section>`;

/**
 * @param {Array<object>} items προ-υπολογισμένες εγγραφές (βλ. `golden-triage.js`)
 * @param {string} source ανθρώπινη περιγραφή της πηγής των υποψηφίων
 */
function renderSheet(items, source) {
  return `<!doctype html>
<html lang="el">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ADR-775 — Έγκριση golden</title>
<style>${SHEET_CSS}</style>
</head>
<body>
${HEADER}
<main>
${ONE_VIEW}
${GRID_VIEW}
</main>
<script>
const SOURCE = ${JSON.stringify(source)};
const ITEMS = ${JSON.stringify(items)};
</script>
<script>${SHEET_JS}</script>
</body>
</html>`;
}

module.exports = { renderSheet, escapeHtml };
