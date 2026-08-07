/**
 * 🎨 SSoT — **προσομοίωση αχρωματοψίας και αντιληπτική απόσταση χρωμάτων**.
 *
 * ## Γιατί υπάρχει ως ξεχωριστό module (ADR-771 Φ.1)
 * Αυτή η μηχανή γεννήθηκε μέσα στο `validate-chart-palette.js` (CHECK 3.32) και ήταν σωστή —
 * αλλά **ιδιωτική**. Όταν το ADR-771 χρειάστηκε την ίδια ερώτηση για **άλλη** οικογένεια
 * χρωμάτων (τα σημάδια ζωντάνιας των κελιών, `TABLE_BOUND_STATE`), υπήρχαν δύο δρόμοι:
 * αντιγραφή των πινάκων Machado σε δεύτερο αρχείο, ή εξαγωγή.
 *
 * Η αντιγραφή θα ήταν **ακριβώς** το sibling clone που πιάνει το CHECK 3.28 (N.18) — και
 * χειρότερα: δύο αντίγραφα ενός μοντέλου προσομοίωσης αποκλίνουν σιωπηλά, και τότε δύο πύλες
 * απαντούν **διαφορετικά** στην ίδια ερώτηση «διακρίνονται αυτά τα δύο χρώματα;».
 *
 * ## 🔴 Το μοντέλο ΕΙΝΑΙ μέρος του προτύπου
 * Τα κατώφλια (ΔE ≥ 8 σε CVD, ≥ 15 σε φυσιολογική όραση) είναι **βαθμονομημένα σε αυτό το
 * μοντέλο**. Αλλαγή του μοντέλου αλλάζει σιωπηλά το τι περνά — γι' αυτό οι πίνακες μένουν
 * αυτούσιοι εδώ, με την πηγή τους ονομασμένη:
 *
 * > Machado, Oliveira & Fernandes (2009), *A Physiologically-based Model for Simulation of
 * > Color Vision Deficiency*, severity 1.0.
 *
 * ⚠️ **ΜΗΝ** «στρογγυλοποιήσεις» τους συντελεστές και **ΜΗΝ** προσθέσεις τριτανωπία χωρίς να
 * βαθμονομήσεις ξανά τα κατώφλια: η τριτανωπία είναι ~0,01% του πληθυσμού και ο πίνακάς της
 * μετακινεί το κίτρινο δραματικά ⇒ θα γέμιζε τις πύλες με ψευδώς θετικά.
 *
 * ## Γιατί OKLab για την απόσταση
 * Η ευκλείδεια απόσταση σε OKLab είναι αντιληπτικά ομοιόμορφη — σε αντίθεση με sRGB, όπου
 * «ίδια αριθμητική διαφορά» σημαίνει τελείως διαφορετική ορατή διαφορά ανά περιοχή.
 *
 * @module scripts/lib/contrast/cvd
 * @see scripts/validate-chart-palette.js — CHECK 3.32 (παλέτα γραφημάτων)
 * @see scripts/check-state-channel-distinctness.js — ADR-771 Φ.1 (σημάδια ζωντάνιας)
 */

'use strict';

/**
 * Machado-Oliveira-Fernandes 2009, severity 1.0.
 *
 * Εφαρμόζονται σε **γραμμικό** RGB (μετά το EOTF), όχι σε sRGB bytes.
 */
const MACHADO = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
};

/** Οι τύποι αχρωματοψίας που προσομοιώνονται — δες την κεφαλίδα για το γιατί όχι τριτανωπία. */
const CVD_KINDS = ['protan', 'deutan'];

/** sRGB EOTF (IEC 61966-2-1) — από τιμή 0..1 σε γραμμικό φως. */
const s2lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** `[r,g,b]` σε 0..1 → γραμμικό. */
const linOf = (rgb) => rgb.map((c) => s2lin(clamp01(c)));

/** HSL (h σε μοίρες, s/l σε %) → `[r,g,b]` σε 0..1. */
function hslToRgb(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
}

/** `#rrggbb` (ή `#rgb`) → `[r,g,b]` σε 0..1· `null` αν δεν είναι έγκυρο hex. */
function hexToRgb(hex) {
  if (typeof hex !== 'string') return null;
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (m === null) return null;
  const raw = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  return [0, 2, 4].map((i) => parseInt(raw.slice(i, i + 2), 16) / 255);
}

const toHex = (rgb) =>
  '#' + rgb.map((v) => Math.round(255 * clamp01(v)).toString(16).padStart(2, '0')).join('');

function oklabFromLin([r, g, b]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ];
}

/** `[L, C]` σε OKLCh — φωτεινότητα και κορεσμός. */
const oklch = (rgb) => {
  const [L, a, b] = oklabFromLin(linOf(rgb));
  return [L, Math.hypot(a, b)];
};

const relLum = (rgb) => {
  const [r, g, b] = linOf(rgb);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** WCAG 2.x λόγος αντίθεσης, 1..21. */
const contrast = (a, b) => {
  const [hi, lo] = [relLum(a), relLum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** Το χρώμα όπως το βλέπει μάτι με τη δοθείσα ανεπάρκεια. */
function simulate(rgb, kind) {
  const [r, g, b] = linOf(rgb);
  const M = MACHADO[kind];
  return M.map((row) => clamp01(row[0] * r + row[1] * g + row[2] * b));
}

/**
 * Αντιληπτική απόσταση δύο χρωμάτων, ×100.
 *
 * `kind === null` ⇒ φυσιολογική όραση· αλλιώς μετά από προσομοίωση CVD.
 */
function deltaE(rgb1, rgb2, kind) {
  const a = oklabFromLin(kind ? simulate(rgb1, kind) : linOf(rgb1));
  const b = oklabFromLin(kind ? simulate(rgb2, kind) : linOf(rgb2));
  return 100 * Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/**
 * Η **χειρότερη** αντιληπτική απόσταση δύο χρωμάτων σε όλους τους τύπους CVD.
 *
 * Αυτή είναι η ερώτηση που θέλει κάθε πύλη διακριτότητας: όχι «διακρίνονται σε πρωτανωπία;»
 * αλλά «**διακρίνονται πάντα;**». Ο ελάχιστος από τους τύπους είναι η μόνη τίμια απάντηση.
 */
function worstCvdDeltaE(rgb1, rgb2) {
  return Math.min(...CVD_KINDS.map((kind) => deltaE(rgb1, rgb2, kind)));
}

module.exports = {
  MACHADO,
  CVD_KINDS,
  s2lin,
  clamp01,
  linOf,
  hslToRgb,
  hexToRgb,
  toHex,
  oklabFromLin,
  oklch,
  relLum,
  contrast,
  simulate,
  deltaE,
  worstCvdDeltaE,
};
