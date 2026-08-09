/**
 * Κάθε σημείο του `src/` που δηλώνει **στρώση**, ταξινομημένο σε **ρητή** κατάσταση.
 * Καμία σιωπηλή απόρριψη: άγνωστη κατάσταση ⇒ `throw` με όνομα (δες `assertClosed`).
 *
 * 🔴 ΤΡΕΙΣ ΔΙΑΛΕΚΤΟΙ, ΚΑΙ ΕΙΝΑΙ **ΜΙΑ** ΕΠΙΦΑΝΕΙΑ — ΜΕΤΡΗΜΕΝΟ, ΟΧΙ ΥΠΟΤΕΘΕΙΜΕΝΟ.
 * Σε ζωντανή συνεδρία (2026-08-08, `document.styleSheets` του `/dxf/viewer`) βρέθηκαν
 * **δίπλα-δίπλα, στο ίδιο μεταγλωττισμένο stylesheet, με ίδια τιμή**:
 *     `.z-\[9999\]`                                  ← Tailwind arbitrary, από `.tsx`
 *     `.DxfContextMenu-module__0zPq2q__menuContent`  ← CSS module, από `.css`
 * Δηλαδή ο διαχωρισμός «CSS έναντι Tailwind» υπάρχει **μόνο στην πηγή**· ο browser
 * βλέπει έναν κανόνα. Πύλη που διαβάζει μόνο αρχεία `.css` είναι **δομικά τυφλή** στο
 * μισό πρόβλημα — και το χειρότερο ζει ακριβώς στο τυφλό μισό (`z-[99999]`).
 *
 * 🏆 ΠΟΥ ΞΕΠΕΡΝΑΜΕ ΤΑ ΕΡΓΑΛΕΙΑ ΤΩΝ ΜΕΓΑΛΩΝ (και τα τρία μετρημένα, όχι φιλόδοξα):
 *  1. **Ύπαρξη, όχι πρόθεμα.** Τα `z-index-token-enforcer`, `stylelint-scales`,
 *     `stylelint-z-index-value-constraint` κρίνουν αν η τιμή *μοιάζει* με token
 *     (πρόθεμα `--z-`). Ένα `var(--z-index-tooltop)` περνά **πράσινο** και βάφει `auto`.
 *     Αυτό το repo έχει **μετρημένα 210** αδέσποτα `var()` (CHECK 3.43), οπότε ο έλεγχος
 *     προθέματος θα ήταν πράσινος πάνω σε σπασμένη αναφορά. Εδώ ρωτάμε την **κλίμακα**.
 *  2. **Tailwind arbitrary.** Κανένα από τα παραπάνω δεν βλέπει `z-[9999]`· το αίτημα
 *     είναι ακόμη ανοιχτό στο `eslint-plugin-tailwindcss` (#290).
 *  3. **Παράλληλο λεξιλόγιο.** Κανένα δεν ανιχνεύει μια **δεύτερη** κλίμακα που
 *     ξαναορίζει τα ίδια ονόματα ρόλων με άλλους αριθμούς — που ήταν εδώ η **ρίζα**
 *     (`--cp-z-tooltip: 10000` έναντι `--z-index-tooltip: 1800`).
 *
 * @module scripts/lib/zindex/sites
 */

'use strict';

const fs = require('fs');
const path = require('path');

const { GLOBAL_LAYER_FLOOR, CSS_VAR_PREFIX, KEYWORDS, indexByCssVar } = require('./scale');
const { listCssFiles, stripCommentsKeepingLines, buildDefinitionIndex, RUNTIME_NAMESPACES }
  = require('../css-vars/custom-property-index');
const { walkSourceFiles, isInsideComment } = require('../contrast/text-primary-sites');

/** Καθεμία **ρητή**. Δεν υπάρχει «άλλο» — δες `assertClosed`. */
const STATES = Object.freeze({
  SCALE_TOKEN: 'scale-token',
  SCALE_REFERENCE: 'scale-reference',
  RUNTIME_PROPERTY: 'runtime-property',
  KEYWORD: 'keyword',
  LOCAL_STACKING: 'local-stacking',
  RAW_LITERAL: 'raw-literal',
  UNKNOWN_TOKEN: 'unknown-token',
  PARALLEL_SCALE: 'parallel-scale',
});

/** Οι καταστάσεις που **μπλοκάρουν** χωρίς baseline (ZERO-TOL). */
const ZERO_TOLERANCE = Object.freeze([STATES.UNKNOWN_TOKEN, STATES.PARALLEL_SCALE]);
/** Η κατάσταση που κρατιέται σε **baseline** και μόνο μειώνεται (RATCHET). */
const RATCHETED = Object.freeze([STATES.RAW_LITERAL]);

const SOURCE_EXT = new Set(['.ts', '.tsx']);
const toPosix = (p) => p.split(path.sep).join('/');
const lineOf = (text, index) => text.slice(0, index).split('\n').length;

// ---------------------------------------------------------------------------
// ΔΙΑΛΕΚΤΟΣ 1 — CSS
// ---------------------------------------------------------------------------

/**
 * Οι θέσεις όπου το `z-index` είναι **δήλωση**, όχι κείμενο μέσα σε επιλογέα.
 *
 * 🔴 ΜΕΤΡΗΜΕΝΟ ΨΕΥΔΩΣ ΘΕΤΙΚΟ ΠΟΥ ΑΥΤΟ ΑΠΟΤΡΕΠΕΙ: το `globals.css:1315` γράφει
 *     `div[style*="z-index: 99999" i]:not([class*="nextjs"]) { … }`
 * Ένα σκέτο `/z-index\s*:/` το μετράει ως δήλωση **99999** — ενώ είναι επιλογέας που
 * κυνηγά inline style του dev overlay του Next.js, δηλαδή **άμυνα**, όχι παράβαση.
 * Κριτήριο: ο πρώτος σημαντικός χαρακτήρας **πριν** πρέπει να είναι όριο δήλωσης.
 */
function findCssDeclarations(css) {
  const out = [];
  const re = /z-index\s*:\s*([^;}]*)/g;
  let m;
  while ((m = re.exec(css)) !== null) {
    let i = m.index - 1;
    while (i >= 0 && /\s/.test(css[i])) i -= 1;
    const prev = i < 0 ? '{' : css[i];
    if (prev !== '{' && prev !== ';' && prev !== '}') continue; // επιλογέας/συμβολοσειρά
    out.push({ raw: m[1].trim(), index: m.index });
  }
  return out;
}

/**
 * Ορισμοί **δεύτερης** κλίμακας: `--<κάτι>-z-<κάτι>: <αριθμός ≥ 1000>`.
 *
 * ⚠️ Ο δικός μας πρόθεμα εξαιρείται — αλλιώς η ίδια η κλίμακα θα κατήγγειλε τον εαυτό
 * της. Το κατώφλι είναι το **ίδιο** με των χρήσεων: μια ιδιωτική `--x-z-badge: 3` είναι
 * τοπική στοίβαξη με όνομα, όχι αντίπαλο λεξιλόγιο.
 */
function findParallelScaleDefs(css) {
  const out = [];
  const re = /(--[A-Za-z0-9_-]*-?z-[A-Za-z0-9_-]+)\s*:\s*([^;}]+)/g;
  let m;
  while ((m = re.exec(css)) !== null) {
    const name = m[1];
    if (name.startsWith(CSS_VAR_PREFIX)) continue;
    const value = Number(String(m[2]).trim());
    if (!Number.isInteger(value) || value < GLOBAL_LAYER_FLOOR) continue;
    out.push({ name, value, index: m.index });
  }
  return out;
}

// ---------------------------------------------------------------------------
// ΔΙΑΛΕΚΤΟΙ 2 & 3 — Tailwind arbitrary + inline style, μέσα σε TS/TSX
// ---------------------------------------------------------------------------

/** `z-[9999]` · `[z-index:var(--x)]` · `zIndex: 10000` · `zIndex: '2147483646'`. */
const TS_PATTERNS = [
  { dialect: 'tailwind', re: /\bz-\[([^\]]+)\]/g },
  { dialect: 'tailwind', re: /\[z-index:([^\]]+)\]/g },
  { dialect: 'inline', re: /\bzIndex\s*:\s*('[^']*'|"[^"]*"|`[^`]*`|[^,;}\n]+)/g },
];

function findTsSites(text) {
  const out = [];
  for (const { dialect, re } of TS_PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      if (isInsideComment(text, m.index)) continue;
      out.push({ dialect, raw: m[1].trim().replace(/^['"`]|['"`]$/g, '').trim(), index: m.index });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Η ΤΑΞΙΝΟΜΗΣΗ — μία συνάρτηση, κάθε κλάδος ρητός
// ---------------------------------------------------------------------------

const isRuntimeNamespace = (name) => RUNTIME_NAMESPACES.some((ns) => name.startsWith(ns.prefix));

/**
 * Το `!important` είναι **προτεραιότητα, όχι τιμή** — δεν αλλάζει τη στρώση, αλλάζει
 * ποιος κανόνας κερδίζει.
 *
 * 🔴 ΜΕΤΡΗΜΕΝΟ ΨΕΥΔΕΣ ΠΡΑΣΙΝΟ ΠΟΥ ΑΥΤΟ ΚΛΕΙΝΕΙ (2026-08-08): χωρίς αυτή τη γραμμή, το
 * `Number('2147483647 !important')` είναι `NaN`, οπότε ο ταξινομητής έπεφτε στον κλάδο
 * «έκφραση TS» και έβαφε **`scale-reference`** — δηλαδή ✅ — **εννέα** δηλώσεις, ανάμεσά
 * τους **και τις έξι** `z-index: 2147483647 !important` του `globals.css`. Είναι ακριβώς
 * οι έξι που το ADR-780 §4.4 ονομάζει ωμές και που **νικούν** το `--z-index-critical`
 * (ο αγωγός CSS το στρογγυλοποιεί σε 2147480000). Η πύλη ήταν πράσινη **πάνω στο ίδιο
 * το εύρημα που την γέννησε**: το σχήμα «0 = κανείς δεν κοίταξε», μέσα στο όργανο που
 * υπάρχει για να το κυνηγά. Χωρίς άγκυρα, μια μελλοντική «απλοποίηση» το ξαναφέρνει.
 */
const stripImportant = (value) => value.replace(/!\s*important\s*$/i, '').trim();

/**
 * Η **μοναδική** συνάρτηση που αποδίδει κατάσταση. Καμία διαδρομή δεν επιστρέφει
 * `undefined`· ο τελικός κλάδος είναι ρητός.
 *
 * ⚠️ Η ΣΕΙΡΑ ΕΙΝΑΙ ΣΥΜΒΟΛΑΙΟ: το `var()` κρίνεται **πριν** ρωτηθεί αν είναι αριθμός,
 * γιατί ένα `var(--z-index-viewer-menu, 9999)` περιέχει **και** τα δύο — και η σωστή
 * ετυμηγορία είναι «token», αλλιώς κάθε νόμιμο fallback θα γινόταν παράβαση.
 */
function classify(raw, definedNames, byCssVar) {
  const value = stripImportant(raw.trim());
  if (!value) return { state: STATES.KEYWORD, detail: 'κενή τιμή' };
  if (KEYWORDS.has(value)) return { state: STATES.KEYWORD, detail: value };

  const varMatch = value.match(/var\(\s*(--[A-Za-z0-9_-]+)/);
  if (varMatch) {
    const name = varMatch[1];
    if (byCssVar.has(name)) {
      return { state: STATES.SCALE_TOKEN, detail: `${name} = ${byCssVar.get(name).value}` };
    }
    if (isRuntimeNamespace(name)) return { state: STATES.RUNTIME_PROPERTY, detail: `${name} (βιβλιοθήκη)` };
    if (definedNames.has(name)) {
      const where = definedNames.get(name);
      // Ορίζεται — αλλά ΟΧΙ από την κλίμακα. Δεύτερο λεξιλόγιο σε χρήση.
      if (/setProperty|\.ts$|\.tsx$/.test(where)) {
        return { state: STATES.RUNTIME_PROPERTY, detail: `${name} ορίζεται σε χρόνο εκτέλεσης (${where})` };
      }
      return { state: STATES.PARALLEL_SCALE, detail: `${name} ορίζεται στο ${where}, εκτός κλίμακας` };
    }
    return { state: STATES.UNKNOWN_TOKEN, detail: `${name} δεν ορίζεται πουθενά ⇒ z-index: auto` };
  }

  const n = Number(value);
  if (!Number.isFinite(n)) {
    // Έκφραση TS (`dxfZIndex.ui.sidebar`, `base + 10`). Δεν είναι ωμός αριθμός.
    return { state: STATES.SCALE_REFERENCE, detail: value.slice(0, 60) };
  }
  if (Math.abs(n) < GLOBAL_LAYER_FLOOR) return { state: STATES.LOCAL_STACKING, detail: String(n) };
  return { state: STATES.RAW_LITERAL, detail: `${n} — ζήτησέ το από την κλίμακα` };
}

// ---------------------------------------------------------------------------
// Η ΣΑΡΩΣΗ
// ---------------------------------------------------------------------------

function scanCss(repoRoot, definedNames, byCssVar) {
  const found = [];
  for (const file of listCssFiles(repoRoot)) {
    const full = path.join(repoRoot, file);
    if (!fs.existsSync(full)) continue;
    const css = stripCommentsKeepingLines(fs.readFileSync(full, 'utf8'));
    for (const d of findCssDeclarations(css)) {
      const { state, detail } = classify(d.raw, definedNames, byCssVar);
      found.push({ file, line: lineOf(css, d.index), dialect: 'css', raw: d.raw, state, detail });
    }
    for (const p of findParallelScaleDefs(css)) {
      found.push({
        file, line: lineOf(css, p.index), dialect: 'css-definition', raw: `${p.name}: ${p.value}`,
        state: STATES.PARALLEL_SCALE,
        detail: `${p.name} = ${p.value} — δεύτερη κλίμακα δίπλα στην κλίμακα`,
      });
    }
  }
  return found;
}

function scanSources(repoRoot, definedNames, byCssVar) {
  const found = [];
  const srcDir = path.join(repoRoot, 'src');
  for (const full of walkSourceFiles(srcDir)) {
    if (!SOURCE_EXT.has(path.extname(full))) continue;
    const text = fs.readFileSync(full, 'utf8');
    if (!text.includes('zIndex') && !text.includes('z-[') && !text.includes('z-index')) continue;
    const file = toPosix(path.relative(repoRoot, full));
    for (const s of findTsSites(text)) {
      const { state, detail } = classify(s.raw, definedNames, byCssVar);
      found.push({ file, line: lineOf(text, s.index), dialect: s.dialect, raw: s.raw, state, detail });
    }
  }
  return found;
}

/**
 * ⛔ ΚΛΕΙΣΤΗ ΛΟΓΙΣΤΙΚΗ, FAIL-CLOSED. Κάθε εύρημα οφείλει να έχει **ονομασμένη**
 * κατάσταση. Ένα αντικείμενο που ξεφεύγει θα μετριόταν σιωπηλά ως «τίποτα», και ένα
 * άθροισμα που κλείνει χωρίς να ρωτά «ποιος κρίθηκε;» επικυρώνει τον εαυτό του
 * (το μάθημα του CHECK 3.39 Κ15β / 3.40).
 */
function assertClosed(found) {
  const known = new Set(Object.values(STATES));
  const census = {};
  for (const state of known) census[state] = 0;
  for (const f of found) {
    if (!known.has(f.state)) {
      throw new Error(`CHECK 3.50: άγνωστη κατάσταση "${f.state}" στο ${f.file}:${f.line}`);
    }
    census[f.state] += 1;
  }
  const total = Object.values(census).reduce((a, b) => a + b, 0);
  if (total !== found.length) {
    throw new Error(`CHECK 3.50: η λογιστική δεν κλείνει — ${total} ≠ ${found.length}`);
  }
  return census;
}

function scanAll(repoRoot, roles) {
  const byCssVar = indexByCssVar(roles);
  const definedNames = buildDefinitionIndex(repoRoot);
  const found = [...scanCss(repoRoot, definedNames, byCssVar), ...scanSources(repoRoot, definedNames, byCssVar)];
  found.sort((a, b) => (a.file === b.file ? a.line - b.line : a.file.localeCompare(b.file)));
  return { found, census: assertClosed(found) };
}

module.exports = {
  STATES,
  ZERO_TOLERANCE,
  RATCHETED,
  findCssDeclarations,
  findParallelScaleDefs,
  findTsSites,
  stripImportant,
  classify,
  scanCss,
  scanSources,
  assertClosed,
  scanAll,
};
