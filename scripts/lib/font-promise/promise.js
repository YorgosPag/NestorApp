/**
 * CHECK 3.67 — Η ΥΠΟΣΧΕΣΗ ΓΡΑΜΜΑΤΟΣΕΙΡΑΣ (ADR-803).
 *
 * «Υπόσχεται ο πίνακας υποκατάστασης όψη που **δεν φορτώνεται ΠΟΤΕ**;»
 *
 * 🔴 **ΤΟ ΓΕΓΟΝΟΣ (μετρημένο 2026-08-25)**: ο `FONT_SUBSTITUTION_TABLE` υπόσχεται **5**
 * οικογένειες-υποκατάστατα· το `CAD_SUBSTITUTE_FONTS` φορτώνει **1**. Δηλαδή **4 στις 5**
 * υποσχέσεις είναι ανεκπλήρωτες — ανάμεσά τους το `romand.shx → «Liberation Sans Bold»`, που
 * είναι η **έντονη** γραφή του πιο κοινού CAD κειμένου, και το `isocpeur → «ISO 3098»`, η
 * τυπική γραμματοσειρά μηχανολογικού σχεδίου.
 *
 * ## 🔑 Η υποκατάσταση είναι ΑΛΥΣΙΔΑ ΔΥΟ ΒΗΜΑΤΩΝ, και μόνο το ΠΡΩΤΟ αναφέρεται
 *
 *   `romand.shx`  ──①──►  «Liberation Sans Bold»  ──②──►  εφεδρική του browser
 *
 * Το βήμα ① το καταγράφει ο `MissingFontReport` και το δείχνει το `MissingFontBanner` — σωστά.
 * Το βήμα ② είναι **σιωπηλό**: ο `resolveEntityFont` επιστρέφει `null`, η βαφή πέφτει στο CSS,
 * και **κανείς δεν το λέει**.
 *
 * 🏆 **Η ΠΡΑΚΤΙΚΗ ΤΩΝ ΜΕΓΑΛΩΝ, ΕΡΕΥΝΗΜΕΝΗ**: το **AutoCAD** *ειδοποιεί* («Missing SHX Files —
 * one or more SHX files are missing»), και ο πίνακας χαρτογράφησής του (`acad.fmp`) δείχνει σε
 * γραμματοσειρές **που υπάρχουν** στο σύστημα· το `FONTALT` είναι η **τελευταία** εφεδρεία. Το
 * **Revit** *δεν* ειδοποιεί — και είναι τεκμηριωμένο **παράπονο** χρηστών. Άρα ο πήχης είναι
 * «AutoCAD», όχι «Revit».
 *
 * ⚠️ **ΚΑΙ ΕΝΑ ΣΚΑΛΙ ΠΑΝΩ**: το AutoCAD ελέγχει **στο άνοιγμα του σχεδίου** — δηλαδή αφού το
 * λάθος έχει ήδη φύγει στον χρήστη. Εδώ ελέγχεται **στο commit**, και επιπλέον επαληθεύεται
 * ότι το **αρχείο** κάθε δηλωμένης όψης **υπάρχει όντως** στον δίσκο (`unloadable-preload`) —
 * ερώτημα που κανένα CAD δεν μπορεί καν να θέσει, γιατί οι όψεις του είναι του **συστήματος**.
 *
 * @module scripts/lib/font-promise/promise
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const TABLE = 'src/subapps/dxf-viewer/text-engine/fonts/font-substitution-table.ts';
const PRELOAD = 'src/subapps/dxf-viewer/text-engine/fonts/cad-font-preload.ts';
const DECLARATIONS_FILE = '.font-promise.json';
const PUBLIC_DIR = 'public';

const PROMISE_RE = /substituteFamily:\s*'([^']+)'/g;
const LOADED_RE = /cacheName:\s*'([^']+)'/g;
const URL_RE = /url:\s*'([^']+)'/g;

const STATES = {
  UNKEEPABLE: 'unkeepable-promise',
  UNLOADABLE_PRELOAD: 'unloadable-preload',
  ORPHAN_DECLARATION: 'orphan-declaration',
  REASONLESS_DECLARATION: 'reasonless-declaration',
  BUNDLED: 'bundled-promise',
  DECLARED_SYNTHESIZED: 'declared-synthesized',
};

/** ⛔ **ΔΕΝ μπαίνουν ΠΟΤΕ σε baseline** — δες `buildPayload` στο CLI. */
const BLOCKING = [STATES.UNLOADABLE_PRELOAD, STATES.ORPHAN_DECLARATION, STATES.REASONLESS_DECLARATION];
const MIN_REASON_LENGTH = 40;

function read(repoRoot, rel) {
  const file = path.join(repoRoot, rel);
  if (!fs.existsSync(file)) {
    throw new Error(`${rel} λείπει — η πύλη δεν έχει αυθεντία, και «καμία ανεκπλήρωτη υπόσχεση» θα ήταν ψέμα.`);
  }
  return fs.readFileSync(file, 'utf8');
}

function matchAll(text, re) {
  return [...text.matchAll(new RegExp(re.source, re.flags))].map((m) => m[1]);
}

function readDeclarations(repoRoot) {
  const file = path.join(repoRoot, DECLARATIONS_FILE);
  if (!fs.existsSync(file)) throw new Error(`${DECLARATIONS_FILE} λείπει — το κλειστό σύνολο είναι μέρος της πύλης.`);
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!raw || typeof raw.browserSynthesized !== 'object' || raw.browserSynthesized === null) {
    throw new Error(`${DECLARATIONS_FILE}: περίμενα αντικείμενο "browserSynthesized".`);
  }
  return raw.browserSynthesized;
}

/**
 * Η απογραφή: τι υπόσχεται ο πίνακας, τι φορτώνει ο preloader, τι δηλώθηκε.
 *
 * ⚠️ Το `override` υπάρχει **μόνο** για τη σουίτα — η παραγωγή διαβάζει πάντα από τον δίσκο.
 */
function takeInventory(repoRoot, override = {}) {
  const table = override.table ?? read(repoRoot, TABLE);
  const preload = override.preload ?? read(repoRoot, PRELOAD);
  const declarations = override.declarations ?? readDeclarations(repoRoot);

  return {
    promised: [...new Set(matchAll(table, PROMISE_RE))].sort(),
    loaded: [...new Set(matchAll(preload, LOADED_RE))].sort(),
    urls: matchAll(preload, URL_RE),
    declarations,
    repoRoot,
    fileExists: override.fileExists ?? ((url) => fs.existsSync(path.join(repoRoot, PUBLIC_DIR, url.replace(/^\//, '')))),
  };
}

/**
 * Κρίνει. Κάθε υπόσχεση, κάθε δήλωση και κάθε αρχείο preload παίρνει **ακριβώς μία**
 * κατάσταση· άγνωστη ⇒ `throw` **με όνομα**.
 */
function judge(inv) {
  const rows = [];
  const push = (state, id, detail) => rows.push({ state, id, detail });
  const loaded = new Set(inv.loaded);
  const declared = new Set(Object.keys(inv.declarations));

  for (const family of inv.promised) {
    if (loaded.has(family)) { push(STATES.BUNDLED, family, 'υπόσχεση που φορτώνεται όντως'); continue; }
    if (declared.has(family)) {
      const reason = inv.declarations[family] && inv.declarations[family].reason;
      if (typeof reason !== 'string' || reason.trim().length < MIN_REASON_LENGTH) {
        push(STATES.REASONLESS_DECLARATION, family, `ο λόγος είναι ΥΠΟΧΡΕΩΤΙΚΟΣ και >=${MIN_REASON_LENGTH} χαρακτήρες`);
      } else {
        push(STATES.DECLARED_SYNTHESIZED, family, reason);
      }
      continue;
    }
    push(STATES.UNKEEPABLE, family, 'υπόσχεται όψη που ΔΕΝ φορτώνεται ΠΟΤΕ — σιωπηλή πτώση στην εφεδρική του browser');
  }

  // ⚠️ Δήλωση για οικογένεια που ΔΕΝ υπόσχεται κανείς = μητρώο που σαπίζει.
  for (const family of [...declared].sort()) {
    if (!inv.promised.includes(family)) {
      push(STATES.ORPHAN_DECLARATION, family, 'δηλώθηκε αλλά ΚΑΝΕΙΣ δεν την υπόσχεται — σβήσε τη δήλωση');
    }
  }

  // 🔑 Το σκαλί πάνω από το AutoCAD: υπάρχει ΟΝΤΩΣ το αρχείο κάθε φορτωμένης όψης;
  for (const url of inv.urls) {
    if (!inv.fileExists(url)) push(STATES.UNLOADABLE_PRELOAD, url, 'δηλώθηκε ως φορτωμένη αλλά το ΑΡΧΕΙΟ δεν υπάρχει');
  }

  return { rows, tally: tallyOf(rows) };
}

function tallyOf(rows) {
  const known = new Set(Object.values(STATES));
  const tally = Object.fromEntries([...known].map((s) => [s, 0]));
  for (const r of rows) {
    if (!known.has(r.state)) throw new Error(`CHECK 3.67 — άγνωστη κατάσταση «${r.state}»`);
    tally[r.state] += 1;
  }
  return tally;
}

const idsOf = (verdict, state) => verdict.rows.filter((r) => r.state === state).map((r) => r.id);

module.exports = {
  TABLE, PRELOAD, DECLARATIONS_FILE,
  STATES, BLOCKING, MIN_REASON_LENGTH,
  takeInventory, judge, tallyOf, idsOf,
};
