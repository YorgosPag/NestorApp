/**
 * CHECK 3.69 — Η ΑΠΟΔΕΙΞΗ ΑΔΕΙΑΣ, ΔΙΑΒΑΣΜΕΝΗ ΑΠΟ ΤΟ ΙΔΙΟ ΤΟ ΑΡΧΕΙΟ (ADR-805).
 *
 * 🔑 **ΓΙΑΤΙ Η ΑΥΘΕΝΤΙΑ ΔΕΝ ΕΙΝΑΙ Η ΔΗΛΩΣΗ ΤΟΥ ΑΝΘΡΩΠΟΥ.** Μια γραμματοσειρά TrueType κουβαλά
 * την άδειά της **μέσα της**: το `name` table ορίζει `ID 0` (copyright), `ID 13` (License
 * Description) και `ID 14` (License Info URL). Επαληθεύτηκε ζωντανά σε **7 από 7** αρχεία του
 * έργου. Άρα η πύλη **δεν χρειάζεται να εμπιστευτεί κανέναν**: συγκρίνει τη δήλωση του μητρώου
 * με ό,τι λέει το **ίδιο το αρχείο**, και μια απόκλιση είναι `license-drift`.
 *
 * ⚠️ **Το ίδιο ισχύει για τα base64 modules**: το `ROBOTO_REGULAR_BASE64` **ΕΙΝΑΙ** ένα TTF —
 * αποκωδικοποιείται και διαβάζεται με τον **ίδιο** αναγνώστη. Δεν υπάρχει «δεύτερη διαδρομή
 * που την εμπιστευόμαστε», και αυτό είναι σκόπιμο: αυτά τα bytes **ενσωματώνονται σε κάθε PDF
 * που φεύγει σε πελάτη**, δηλαδή είναι η πιο εκτεθειμένη διανομή του έργου.
 *
 * ⚠️ **Τα `.typeface.json` του three.js κρατούν τα ΙΔΙΑ πεδία, αλλού**: μέσα στο
 * `original_font_information` (`copyright`, `license_url`). Δεν είναι εξαίρεση — είναι **άλλη
 * μορφή της ίδιας απόδειξης**, γι' αυτό ζει εδώ και όχι σε ξεχωριστό μονοπάτι κώδικα.
 *
 * @module scripts/lib/font-assets/evidence
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

/** Καταλήξεις που θεωρούνται δυαδικό γραμματοσειράς. */
const FONT_EXTENSIONS = /\.(ttf|otf|woff2?)$/i;
const TYPEFACE_JSON = /\.typeface\.json$/i;

/**
 * Αναγνώριση SPDX **από το κείμενο της απόδειξης**.
 *
 * ⚠️ **ΔΕΝ είναι δεύτερη λίστα επιτρεπόμενων** — είναι **αναγνωριστής**: μεταφράζει «τι λέει το
 * αρχείο» σε SPDX ώστε να συγκριθεί με το **ένα** `.license-allowlist.json`. Ό,τι δεν
 * αναγνωρίζεται επιστρέφει `null` και γίνεται **ρητή κατάσταση** (`license-unverifiable`),
 * ποτέ σιωπηλό πέρασμα.
 *
 * ⚠️ Το `LicenseRef-*` είναι **έγκυρο** SPDX για άδειες εκτός καταλόγου (§10.1 της
 * προδιαγραφής) — έτσι μια προσαρμοσμένη άδεια αποκτά **όνομα** αντί να γίνει «άγνωστο».
 */
const SPDX_SIGNATURES = [
  [/apache\s+license,?\s+version\s+2\.0|apache\.org\/licenses\/LICENSE-2\.0/i, 'Apache-2.0'],
  [/SIL\s+Open\s+Font\s+License,?\s+Version\s+1\.1|scripts\.sil\.org\/OFL|openfontlicense\.org/i, 'OFL-1.1'],
  [/ellak\.gr\/fonts\/MgOpen/i, 'LicenseRef-MgOpen'],
  [/\bMIT\s+License\b|opensource\.org\/licenses\/MIT/i, 'MIT'],
  [/\bGNU\s+General\s+Public\s+License\b|\bGPL\b/i, 'GPL-3.0-or-later'],
  [/Ubuntu\s+Font\s+Licence/i, 'LicenseRef-UFL-1.0'],
];

/** Μετάφρασε ό,τι λέει το αρχείο σε SPDX, ή `null` αν δεν αναγνωρίζεται. */
function spdxFromEvidence(evidence) {
  const haystack = [evidence.license, evidence.licenseURL, evidence.copyright]
    .filter(Boolean)
    .join(' \n ');
  if (!haystack.trim()) return null;
  for (const [re, spdx] of SPDX_SIGNATURES) {
    if (re.test(haystack)) return spdx;
  }
  return null;
}

/** Διάβασε το `name` table ενός TTF/OTF buffer. */
function readOpenTypeNames(buffer) {
  // eslint-disable-next-line global-require
  const opentype = require('opentype.js');
  const font = opentype.parse(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
  );
  const table = font.names.windows || font.names.macintosh || font.names || {};
  const pick = (key) => {
    const value = table[key];
    if (!value) return null;
    return String(value.en ?? Object.values(value)[0] ?? '').trim() || null;
  };
  return {
    family: pick('fontFamily'),
    subfamily: pick('fontSubfamily'),
    copyright: pick('copyright'),
    license: pick('license'),
    licenseURL: pick('licenseURL'),
    glyphs: font.numGlyphs,
  };
}

/** Απόδειξη από `.typeface.json` του three.js — ίδια πεδία, άλλη θέση. */
function readTypefaceJson(text) {
  const data = JSON.parse(text);
  const info = data.original_font_information || {};
  return {
    family: data.familyName ?? info.font_family_name ?? null,
    subfamily: null,
    copyright: info.copyright ?? null,
    license: info.license ?? null,
    licenseURL: info.license_url ?? null,
    glyphs: Object.keys(data.glyphs || {}).length,
  };
}

/**
 * Βγάλε το base64 σώμα ενός module γραμματοσειράς και αποκωδικοποίησέ το.
 *
 * ⚠️ Ταιριάζει **τη μεγαλύτερη** συμβολοσειρά base64 του αρχείου, όχι «την πρώτη»: ένα module
 * μπορεί να έχει σχόλια ή βοηθητικές σταθερές, και το «πρώτη» θα διάλεγε αυθαίρετα.
 */
function decodeBase64Module(text) {
  const candidates = [...text.matchAll(/'([A-Za-z0-9+/=]{512,})'/g)].map((m) => m[1]);
  if (candidates.length === 0) return null;
  const longest = candidates.reduce((a, b) => (b.length > a.length ? b : a));
  return Buffer.from(longest, 'base64');
}

/**
 * Η απόδειξη ενός περιουσιακού στοιχείου. Πετά **μόνο** αν το αρχείο λείπει· κάθε άλλη
 * αποτυχία γίνεται `{ unreadable: <λόγος> }` ώστε ο κριτής να τη δώσει **όνομα** αντί να σκάσει.
 */
function readEvidence(repoRoot, relPath) {
  const abs = path.join(repoRoot, relPath);
  if (!fs.existsSync(abs)) return { missing: true };
  try {
    if (TYPEFACE_JSON.test(relPath)) {
      const ev = readTypefaceJson(fs.readFileSync(abs, 'utf8'));
      return { ...ev, bytes: fs.statSync(abs).size, spdx: spdxFromEvidence(ev) };
    }
    if (FONT_EXTENSIONS.test(relPath)) {
      const buf = fs.readFileSync(abs);
      const ev = readOpenTypeNames(buf);
      return { ...ev, bytes: buf.length, spdx: spdxFromEvidence(ev) };
    }
    // base64 module (.ts/.js) — τα bytes ΕΙΝΑΙ TTF, ίδιος αναγνώστης.
    const decoded = decodeBase64Module(fs.readFileSync(abs, 'utf8'));
    if (!decoded) return { unreadable: 'δεν βρέθηκε σώμα base64 στο module' };
    const ev = readOpenTypeNames(decoded);
    return { ...ev, bytes: decoded.length, spdx: spdxFromEvidence(ev) };
  } catch (error) {
    return { unreadable: String(error && error.message).slice(0, 160) };
  }
}

module.exports = {
  FONT_EXTENSIONS,
  TYPEFACE_JSON,
  SPDX_SIGNATURES,
  spdxFromEvidence,
  readEvidence,
  decodeBase64Module,
};
