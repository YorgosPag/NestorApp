#!/usr/bin/env node
/**
 * **Ποιες επιφάνειες μπορεί να παρουσιάσει η εφαρμογή** — και ποιο είναι το *μέγιστο δυνατό*
 * contrast πάνω σε καθεμία (ADR-771 Φ.3 / CHECK 3.45).
 *
 * ## Γιατί ΠΑΡΑΓΕΤΑΙ και δεν γράφεται
 * Μια χειρόγραφη λίστα θεμάτων θα ήταν **δεύτερη αυθεντία** δίπλα στο `PRESET_THEMES` — το
 * ακριβές σχήμα των δύο λιστών namespace του CHECK 3.34 και της λίστας 18-έναντι-26 του
 * CHECK 3.37: αποκλίνει σιωπηλά, και το πράσινο αρχίζει να σημαίνει «δεν κοίταξα».
 * Εδώ η λίστα **είναι** το `PRESET_THEMES`, λυμένο μέσα από το `variables.css`.
 *
 * ## 🔴 Η ΤΕΤΑΡΤΗ επιφάνεια δεν είναι χρώμα — είναι ΦΡΑΓΜΑ
 * Το θέμα `custom` δέχεται **οποιοδήποτε** χρώμα από τον χρήστη, άρα δεν απαριθμείται. Η
 * τίμια απάντηση δεν είναι δείγμα αλλά το **χειρότερο δυνατό**: η αντίθεση με το λευκό είναι
 * `1,05/(L+0,05)` και με το μαύρο `(L+0,05)/0,05`, άρα το καλύτερο των δύο ελαχιστοποιείται
 * όπου εξισώνονται — `L = √(1,05·0,05) − 0,05`, δίνοντας **4,58:1**.
 *
 * Δηλαδή **κάθε κατώφλι πάνω από 4,58 είναι αθετήσιμο από μία επιλογή χρώματος**, όσα preset
 * θέματα κι αν περάσουν. Ένας έλεγχος που κοίταζε μόνο τα 9 preset θα έλεγε «εντάξει» για ένα
 * κατώφλι 7,0 και θα έσπαγε στον πρώτο χρήστη — δείγμα αντί για απόδειξη.
 *
 * @see ./promise-sites.js — η άλλη μισή ερώτηση: ποιες υποσχέσεις δίνονται
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const { hexToRgb } = require('../contrast/cvd');
const { contrastRatio } = require('../contrast/wcag-contrast');
const { initializerOf, parseSource } = require('./ts-read');

const CANVAS_THEME_TS = 'src/subapps/dxf-viewer/config/canvas-theme.ts';
const VARIABLES_CSS = 'src/styles/design-system/generated/variables.css';
const TABLE_INK_TS = 'src/subapps/dxf-viewer/bim/table/table-ink.ts';

/** Τα δύο άκρα — η μόνη επιλογή που έχει ένα αυτόματο μελάνι (AutoCAD ACI 7). */
const WHITE = [255, 255, 255];
const BLACK = [0, 0, 0];

/**
 * 🔴 **ΠΡΟΣΑΡΜΟΓΕΑΣ ΜΟΝΑΔΩΝ — ΤΟ ΠΛΗΡΩΣΕ Η ΒΑΘΜΟΝΟΜΗΣΗ.**
 *
 * Τα δύο SSoT της γειτονιάς έχουν **αντίθετες συμβάσεις** και **καμία δεν το λέει στο όνομά
 * της**: το `cvd.hexToRgb` επιστρέφει κανάλια **0..1** (τα θέλει έτσι το μοντέλο Machado),
 * ενώ το `wcag-contrast.contrastRatio` περιμένει **0..255**. Το ωμό ζευγάρωμά τους δεν πετάει
 * τίποτα — απαντά **20,9 για κάθε επιφάνεια**, δηλαδή «όλα εντάξει, πάντα».
 *
 * Το έπιασε η {@link calibrate} στην **πρώτη** εκτέλεση, πριν γραφτεί μία γραμμή ετυμηγορίας.
 * Χωρίς αυτήν, η πύλη θα είχε γεννηθεί **μονίμως πράσινη** — η έκτη εμφάνιση του «0 = κανείς
 * δεν κοίταξε», μέσα στο όργανο που το κυνηγά.
 *
 * ⚠️ Ο προσαρμογέας μένει **εδώ, στο σύνορο**: μια «διόρθωση» σε κάποια από τις δύο βιβλιοθήκες
 * θα άλλαζε σιωπηλά τους καταναλωτές της άλλης ερώτησης (CHECK 3.32 / 3.41).
 */
function hexToRgb255(hex) {
  const unit = hexToRgb(hex);
  return unit === null ? null : unit.map((c) => c * 255);
}

/**
 * Το μέγιστο contrast που μπορεί να πετύχει **οποιοδήποτε** χρώμα πάνω σε αυτή την επιφάνεια.
 * `null` όταν η επιφάνεια δεν αναλύεται — ποτέ `0`, ποτέ `NaN`: ένας αριθμός εκεί θα γινόταν
 * ετυμηγορία χωρίς μέτρηση.
 */
function maxAchievableOn(hex) {
  const rgb = hexToRgb255(hex);
  if (rgb === null) return null;
  const best = Math.max(contrastRatio(WHITE, rgb), contrastRatio(BLACK, rgb));
  return Number.isFinite(best) ? best : null;
}

/**
 * Το φράγμα του `custom` θέματος — κλειστός τύπος, **επαληθευμένος αριθμητικά** από τον
 * καλούντα ({@link calibrate}). Δύο ανεξάρτητοι δρόμοι στην ίδια τιμή· αν αποκλίνουν, κάτι
 * από τα δύο είναι λάθος και θέλουμε να το μάθουμε πριν από κάθε ετυμηγορία.
 */
function customSurfaceCeiling() {
  return Math.sqrt(1.05 * 0.05) / 0.05;
}

/**
 * **ΒΑΘΜΟΝΟΜΗΣΗ.** Δύο γνωστές τιμές πριν από κάθε κρίση: (α) λευκό vs μαύρο = 21,00· (β) το
 * κλειστό φράγμα του `custom` συμφωνεί με αριθμητική σάρωση όλων των 256 ουδέτερων γκρι.
 * Επιστρέφει `null` σε επιτυχία, αλλιώς το μήνυμα σφάλματος.
 *
 * Υπάρχει επειδή πληρώθηκε: ένας έλεγχος αυτής ακριβώς της φάσης τύπωσε «🔴 ΑΝΕΦΙΚΤΟ» από
 * `NaN` (λάθος υπογραφή API) και το εύρημα φαινόταν απολύτως εύλογο.
 */
function calibrate() {
  const known = contrastRatio(WHITE, BLACK);
  if (!Number.isFinite(known) || Math.abs(known - 21) > 0.01) {
    return `λευκό vs μαύρο = ${known} (αναμενόταν 21,00) — το όργανο δεν μετρά αυτό που νομίζουμε`;
  }
  const closed = customSurfaceCeiling();

  // (β) Ο κλειστός τύπος συμφωνεί με αριθμητική ελαχιστοποίηση πάνω στον ΟΡΙΣΜΟ (συνεχές L).
  let numeric = Infinity;
  for (let i = 0; i <= 100000; i += 1) {
    const l = i / 100000;
    numeric = Math.min(numeric, Math.max(1.05 / (l + 0.05), (l + 0.05) / 0.05));
  }
  if (!Number.isFinite(numeric) || Math.abs(numeric - closed) > 1e-4) {
    return `φράγμα custom: αριθμητική ελαχιστοποίηση ${numeric.toFixed(5)} ≠ κλειστός τύπος ${closed.toFixed(5)}`;
  }

  // (γ) Η διαδρομή hex→rgb→contrast σέβεται το φράγμα: κανένα από τα 256 ουδέτερα γκρι δεν
  // πέφτει ΚΑΤΩ από αυτό. Αν πέσει, ο προσαρμογέας μονάδων ξανάσπασε.
  let worstGrey = Infinity;
  for (let v = 0; v <= 255; v += 1) {
    const best = maxAchievableOn(`#${v.toString(16).padStart(2, '0').repeat(3)}`);
    if (best === null) return `ουδέτερο γκρι ${v} δεν αναλύθηκε`;
    worstGrey = Math.min(worstGrey, best);
  }
  if (worstGrey < closed - 1e-9 || worstGrey - closed > 0.05) {
    return `φράγμα custom: χειρότερο 8-bit γκρι ${worstGrey.toFixed(4)} εκτός εύρους του ${closed.toFixed(4)}`;
  }
  return null;
}

/** `--name: value;` από ένα stylesheet → χάρτης. Ένα πέρασμα, χωρίς εξάρτηση από σειρά. */
function readCssCustomProperties(repoRoot) {
  const text = fs.readFileSync(path.join(repoRoot, VARIABLES_CSS), 'utf8');
  const out = new Map();
  for (const m of text.matchAll(/(--[\w-]+)\s*:\s*([^;}]+)[;}]/g)) out.set(m[1], m[2].trim());
  return out;
}

/** `#hex` → πεζό αυτούσιο· `var(--x)` → η τιμή του `--x` αν είναι hex· αλλιώς `null`. */
function resolveCssColor(cssValue, vars) {
  const raw = cssValue.trim();
  if (raw.startsWith('#')) return raw.toLowerCase();
  const ref = /^var\((--[\w-]+)\)$/.exec(raw);
  const value = ref ? vars.get(ref[1]) : undefined;
  return value && value.startsWith('#') ? value.toLowerCase() : null;
}

/** Η τιμή μιας ιδιότητας-συμβολοσειράς μέσα σε object literal. */
function stringProp(objectLiteral, propName) {
  for (const prop of objectLiteral.properties) {
    if (!ts.isPropertyAssignment(prop)) continue;
    const key = ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name) ? prop.name.text : null;
    if (key === propName && ts.isStringLiteral(prop.initializer)) return prop.initializer.text;
  }
  return null;
}

/**
 * Κάθε επιφάνεια που μπορεί να βρεθεί κάτω από μια οντότητα: τα preset θέματα καμβά, το
 * προεπιλεγμένο `custom`, και το **χαρτί**. Ρίχνει σφάλμα σε ανεπίλυτη επιφάνεια —
 * **fail-closed**: μια επιφάνεια που δεν μετρήθηκε δεν επιτρέπεται να μετρηθεί ως εντάξει.
 */
function presentableSurfaces(repoRoot) {
  const vars = readCssCustomProperties(repoRoot);
  const themeAst = parseSource(path.join(repoRoot, CANVAS_THEME_TS));
  const presets = initializerOf(themeAst, 'PRESET_THEMES');
  if (presets === null || !ts.isArrayLiteralExpression(presets)) {
    throw new Error(`Το PRESET_THEMES δεν βρέθηκε ως array literal στο ${CANVAS_THEME_TS}`);
  }

  const out = [];
  for (const element of presets.elements) {
    if (!ts.isObjectLiteralExpression(element)) throw new Error('Στοιχείο PRESET_THEMES χωρίς object literal');
    const key = stringProp(element, 'key');
    const cssValue = stringProp(element, 'cssValue');
    if (key === null || cssValue === null) throw new Error('Θέμα χωρίς key/cssValue');
    const hex = resolveCssColor(cssValue, vars);
    if (hex === null) throw new Error(`Ανεπίλυτη επιφάνεια θέματος «${key}»: ${cssValue}`);
    out.push({ key, hex, origin: CANVAS_THEME_TS });
  }

  const customDefault = initializerOf(themeAst, 'DEFAULT_CUSTOM_COLOR');
  if (customDefault === null || !ts.isStringLiteral(customDefault)) {
    throw new Error(`Το DEFAULT_CUSTOM_COLOR δεν βρέθηκε στο ${CANVAS_THEME_TS}`);
  }
  out.push({ key: 'custom(default)', hex: customDefault.text.toLowerCase(), origin: CANVAS_THEME_TS });

  const paper = initializerOf(parseSource(path.join(repoRoot, TABLE_INK_TS)), 'TABLE_PAPER_HEX');
  if (paper === null || !ts.isStringLiteral(paper)) {
    throw new Error(`Το TABLE_PAPER_HEX δεν βρέθηκε στο ${TABLE_INK_TS}`);
  }
  out.push({ key: 'paper', hex: paper.text.toLowerCase(), origin: TABLE_INK_TS });

  return out;
}

/**
 * Το **ανώτατο εφικτό** κατώφλι που κρατιέται παντού: το ελάχιστο ανάμεσα στο χειρότερο preset και
 * στο μαθηματικό φράγμα του `custom`. Επιστρέφει και **ποιος** το επιβάλλει, ώστε το μήνυμα
 * της πύλης να λέει τι να διορθώσει κανείς, όχι μόνο ότι κάτι χάλασε.
 */
function reachabilityLimits(surfaces) {
  let worstPreset = { key: null, max: Infinity };
  for (const s of surfaces) {
    const max = maxAchievableOn(s.hex);
    if (max === null) throw new Error(`Επιφάνεια «${s.key}» (${s.hex}) δεν αναλύεται`);
    if (max < worstPreset.max) worstPreset = { key: s.key, max };
  }
  return { worstPreset, customCeiling: customSurfaceCeiling() };
}

module.exports = {
  CANVAS_THEME_TS,
  VARIABLES_CSS,
  TABLE_INK_TS,
  calibrate,
  customSurfaceCeiling,
  maxAchievableOn,
  presentableSurfaces,
  reachabilityLimits,
};
