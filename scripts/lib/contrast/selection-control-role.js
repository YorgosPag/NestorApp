/**
 * **Ο ρόλος χειριστηρίου επιλογής** — radio · checkbox · switch · slider · progress ·
 * επιλεγμένη μέρα ημερολογίου · native `accent-color` (ADR-770 §17).
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * ΤΟ ΜΕΤΡΗΜΕΝΟ ΓΕΓΟΝΟΣ
 * ═══════════════════════════════════════════════════════════════════════════════
 * Στη ζωντανή δοκιμή της ερώτησης ωραρίου αργιών (ADR-841 Α21.21) ο άνθρωπος πάτησε
 * «Αποθήκευση» χωρίς να βλέπει ποια επιλογή ήταν ενεργή: στο DOM `data-state=checked`,
 * στην οθόνη τίποτα. Κάθε primitive επιλογής ζητούσε `primary`, που σε αυτή την εφαρμογή
 * είναι **επιφάνεια** (`.dark --primary` ≡ `--card` ⇒ 1,00:1). Το slider είχε θεραπευτεί
 * μόνο του (ADR-682 §5.5) — «το πρώτο θύμα ενός καθολικού σφάλματος μοιάζει με ειδική
 * περίπτωση».
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * ΤΙ ΡΩΤΑ — ΤΕΣΣΕΡΑ ΕΡΩΤΗΜΑΤΑ, ΚΑΝΕΝΑ ΤΟ ΑΠΟΡΡΙΦΘΕΝ «ΚΑΘΕ ΖΕΥΓΟΣ»
 * ═══════════════════════════════════════════════════════════════════════════════
 *  (α) **Τιμές** — τα ζεύγη που ο ρόλος δημιουργεί **εκ κατασκευής** (τονισμός/περίγραμμα
 *      πάνω στις ουδέτερες επιφάνειες-ξενιστές· μελάνι πάνω στον τονισμό) ≥ κατώφλι, στα δύο
 *      θέματα. ⚠️ Δεν είναι το «κάθε κείμενο × κάθε επιφάνεια» που απορρίφθηκε τέσσερις
 *      φορές (ADR-770 §16): εδώ **κάθε** ζεύγος συμβαίνει, γιατί το ορίζει ο ίδιος ο ρόλος.
 *  (β) **Ρόλος σε όλο το `src/`** — καμία κλάση κατάστασης (`data-[state=checked|on]:`,
 *      `aria-checked:`/`aria-selected:`) και κανένα `accent-*` δεν λύνεται σε token
 *      ΕΠΙΦΑΝΕΙΑΣ. Κριτήριο **ρόλου**, όπως το 3.38 §16 — χωρίς λίστα ονομάτων.
 *  (γ) **Primitives** — τα αρχεία που **κατέχουν** τον ρόλο δεν ζητούν `--primary` και
 *      αναφέρουν τον ρόλο.
 *  (δ) **Αρχή κλάσεων** — οι τιμές του `COLOR_BRIDGE.selectionControl` / `switch.default`
 *      λύνονται **μόνο** σε tokens του ρόλου. Το `color-bridge.ts` **εκτελείται** (jiti,
 *      ο ίδιος φορτωτής του Tailwind), δεν διαβάζεται με regex.
 *
 * @module scripts/lib/contrast/selection-control-role
 * @see ADR-770 §17 · ADR-682 §5.5.3
 */

'use strict';

const path = require('path');
const { readThemes, describeValue, SURFACE_TOKEN_PATTERN } = require('./css-token-themes');
const { hslToRgb, contrastRatio } = require('./wcag-contrast');
const { resolveClassToken, lookupColor, normalizeColorValue } = require('./tailwind-class-resolver');

/** Τα τρία tokens του ρόλου (M3 `primary`/`on-primary`/`outline`). */
const ROLE = Object.freeze({
  accent: '--control-accent',
  ink: '--control-accent-foreground',
  outline: '--control-outline',
});

/**
 * Οι επιφάνειες όπου **κάθεται** χειριστήριο επιλογής. Δηλωμένες, με λόγο: είναι οι
 * ουδέτερες επιφάνειες σελίδας/κάρτας/αναδυόμενου. Τα `--primary`/`--destructive`/`--bg-*`
 * είναι χρωματιστές επιφάνειες **με δικό τους μελάνι** — ένα checkbox πάνω σε κόκκινο
 * banner δεν είναι ζεύγος που υπόσχεται ο ρόλος.
 */
const HOST_SURFACES = Object.freeze(['--background', '--card', '--popover', '--muted', '--accent', '--secondary']);

/** WCAG 2.2 SC 1.4.11 — δείκτης κατάστασης / όριο χειριστηρίου. */
const NON_TEXT_MIN = 3.0;
/** Το ✓ / η λαβή ON: υπόσχεση ΠΑΝΩ από το 1.4.11 (αναγνωρίσιμο σε μικρό μέγεθος). */
const INK_MIN = 4.5;

/** Τα αρχεία που κατέχουν τον ρόλο, και η αναφορά που το αποδεικνύει. */
const SELECTION_PRIMITIVES = Object.freeze({
  'src/components/ui/radio-group.tsx': 'selectionControl',
  'src/components/ui/checkbox.tsx': 'selectionControl',
  'src/components/ui/calendar.tsx': 'selectionControl',
  'src/components/ui/progress.tsx': 'selectionControl',
  'src/components/ui/switch.tsx': 'COLOR_BRIDGE.switch',
  'src/components/ui/slider.tsx': '--slider-accent',
  // ADR-866 §2.10.8 Β4 — η κάρτα τύπου εγγράφου (`role="radio"`) των επιλογέων μεταφόρτωσης: η επιλεγμένη ετικέτα
  // ήταν `text-primary` ⇒ αόρατη στο σκοτεινό θέμα (μετρημένο στην παραγωγή). Πρώτο primitive έξω από το `ui/`.
  'src/components/shared/files/entry-point-selector-shared.tsx': 'selectionControl',
});

/**
 * Κλάσεις κατάστασης που λύνονται σε επιφάνεια **ΚΑΙ ΕΙΝΑΙ ΓΝΩΣΤΕΣ** — ΑΝΟΙΧΤΑ στο ADR-770
 * §17.6, δηλωμένα με μέτρηση, όχι ξεχασμένα. Κάθε εγγραφή πρέπει να **υπάρχει ακόμα**
 * (αλλιώς η άγκυρα κοκκινίζει: μπαγιάτικη εξαίρεση = σιωπηλή άδεια). Η λίστα **μόνο μικραίνει**.
 *
 *  · toggle ON / ημερολόγιο range-middle: ρόλος *container* (M3 `secondary-container`), όχι
 *    *indicator* — μετρημένο σκοτ. 1,00–1,18. Θεραπεία = νέο ζεύγος `container`, όχι αυτός ο ρόλος.
 *  · switch `destructive` ON: τροχιά `--destructive` σκοτ. **1,48:1** επί `--card`, λαβή 1,74:1 —
 *    κάτω από το 1.4.11. Το `--destructive` είναι επιφάνεια κουμπιού με λευκό από πάνω· η
 *    παραλλαγή ADR-128 θέλει δικό της token τροχιάς (απόφαση token, όχι αυτής της αλλαγής).
 */
const DECLARED_OPEN_STATES = Object.freeze({
  'src/components/ui/toggle.tsx': ['data-[state=on]:bg-accent'],
  'src/components/ui/calendar.tsx': ['aria-selected:bg-accent/50', 'aria-selected:bg-accent'],
  'src/design-system/color-bridge.ts': ['data-[state=checked]:bg-destructive'],
});

const STATE_VARIANT_RE = /(?:^|:)(?:(?:peer|group)-)?(?:data-\[state=(?:checked|on|indeterminate)\]|aria-(?:checked|selected)):/;
const ACCENT_RE = /(?:^|:)!?accent-([a-z][a-z0-9-]*)$/;
const CLASS_FRAGMENT_RE = /[^\s'"`]+/g;

/** Η τιμή RGB ενός token· **fail-closed** αν λείπει ή δεν είναι literal. */
function tokenRgb(theme, name, themeId) {
  const raw = theme.get(name);
  if (raw === undefined) throw new Error(`selection-control-role: λείπει ${name} στο θέμα ${themeId} — fail-closed.`);
  const described = describeValue(raw);
  if (described.kind !== 'literal') {
    throw new Error(`selection-control-role: ${name} (${themeId}) δεν είναι literal HSL («${raw}») — fail-closed.`);
  }
  return hslToRgb(described.hsl);
}

/** (α) Κάθε ζεύγος του ρόλου, στα δύο θέματα, ως γραμμές με λόγο και κατώφλι. */
function measureControlRole(themes = readThemes()) {
  const rows = [];
  for (const themeId of ['light', 'dark']) {
    const theme = themes[themeId];
    const rgb = (name) => tokenRgb(theme, name, themeId);
    for (const fg of [ROLE.accent, ROLE.outline]) {
      for (const bg of HOST_SURFACES) {
        rows.push({ themeId, fg, bg, ratio: contrastRatio(rgb(fg), rgb(bg)), min: NON_TEXT_MIN });
      }
    }
    rows.push({ themeId, fg: ROLE.ink, bg: ROLE.accent, ratio: contrastRatio(rgb(ROLE.ink), rgb(ROLE.accent)), min: INK_MIN });
  }
  return rows;
}

/** Οι γραμμές κάτω από το κατώφλι, σε μορφή αναγνώσιμη μέσα σε `expect(...).toEqual([])`. */
function roleFailures(rows) {
  return rows
    .filter((r) => r.ratio < r.min)
    .map((r) => `${r.themeId}: ${r.fg} πάνω σε ${r.bg} = ${r.ratio.toFixed(2)}:1 < ${r.min}`);
}

/** Σβήνει σχόλια κρατώντας τις αλλαγές γραμμής, ώστε οι αριθμοί γραμμής να μένουν αληθινοί. */
function blankComments(source) {
  const blank = (m) => m.replace(/[^\n]/g, ' ');
  return source.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/(^|[^:])\/\/.*$/gm, (m, lead) => lead + blank(m.slice(lead.length)));
}

/** Σε ποιο token λύνεται ένα λεκτικό κλάσης· `null` αν δεν είναι χρώμα. */
function resolveStateToken(token, palette) {
  const accent = ACCENT_RE.exec(token);
  if (accent) {
    const { value } = lookupColor(palette.colors, accent[1]);
    return value === null ? null : normalizeColorValue(value);
  }
  return resolveClassToken(token, palette);
}

/** (β) Κλάσεις κατάστασης / `accent-*` ενός κειμένου που λύνονται σε token ΕΠΙΦΑΝΕΙΑΣ. */
function findSurfaceStateIndicators(source, palette) {
  const hits = [];
  blankComments(source).split('\n').forEach((line, i) => {
    for (const [token] of line.matchAll(CLASS_FRAGMENT_RE)) {
      if (!STATE_VARIANT_RE.test(token) && !ACCENT_RE.test(token)) continue;
      const resolved = resolveStateToken(token, palette);
      if (!resolved || resolved.form !== 'css-var' || !SURFACE_TOKEN_PATTERN.test(resolved.varName)) continue;
      hits.push({ line: i + 1, token, varName: resolved.varName });
    }
  });
  return hits;
}

/** (γ) Ένα primitive του ρόλου: ζητά `--primary`; αναφέρει τον ρόλο; */
function primitiveViolations(relPath, source, palette) {
  const required = SELECTION_PRIMITIVES[relPath];
  const code = blankComments(source);
  const out = [];
  if (required && !code.includes(required)) out.push(`${relPath}: δεν αναφέρει «${required}»`);
  code.split('\n').forEach((line, i) => {
    for (const [token] of line.matchAll(CLASS_FRAGMENT_RE)) {
      const resolved = resolveStateToken(token, palette);
      if (resolved && resolved.form === 'css-var' && resolved.varName === '--primary') {
        out.push(`${relPath}:${i + 1} ${token} ⇒ --primary`);
      }
    }
  });
  return out;
}

/** Εκτελεί το `color-bridge.ts` με τον φορτωτή του Tailwind (jiti). */
function loadColorBridge(repoRoot = process.cwd()) {
  const from = { paths: [repoRoot, __dirname] };
  const loadConfig = require(require.resolve('tailwindcss/loadConfig', from));
  const bridge = loadConfig(path.join(repoRoot, 'src/design-system/color-bridge.ts'));
  if (!bridge || !bridge.selectionControl || !bridge.switch) {
    throw new Error('selection-control-role: το COLOR_BRIDGE δεν έδωσε selectionControl/switch — fail-closed.');
  }
  return bridge;
}

/** (δ) Κάθε κλάση χρώματος των τιμών του ρόλου λύνεται σε token του ρόλου (ή `transparent`). */
function roleAuthorityViolations(roleObjects, palette) {
  const allowed = new Set(Object.values(ROLE));
  const out = [];
  for (const [name, obj] of Object.entries(roleObjects)) {
    for (const [key, classes] of Object.entries(obj)) {
      for (const token of String(classes).split(/\s+/).filter(Boolean)) {
        const r = resolveStateToken(token, palette);
        if (!r || r.form === 'not-a-color' || r.form === 'keyword') continue;
        if (r.form === 'css-var' && allowed.has(r.varName)) continue;
        out.push(`${name}.${key}: ${token} ⇒ ${r.varName || r.form}`);
      }
    }
  }
  return out;
}

module.exports = {
  ROLE,
  HOST_SURFACES,
  NON_TEXT_MIN,
  INK_MIN,
  SELECTION_PRIMITIVES,
  DECLARED_OPEN_STATES,
  measureControlRole,
  roleFailures,
  findSurfaceStateIndicators,
  primitiveViolations,
  loadColorBridge,
  roleAuthorityViolations,
};
