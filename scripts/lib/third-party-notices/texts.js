/**
 * CHECK 3.84 / ADR-863 — ΤΟ ΚΕΙΜΕΝΟ ΤΗΣ ΑΔΕΙΑΣ: ΥΠΑΡΧΕΙ, ΚΑΙ ΑΠΟ ΠΟΥ ΗΡΘΕ;
 *
 * Η μηχανή πολιτικής (CHECK 12) απαντά «**επιτρέπεται;**» και «**απαιτεί απόδοση;**». Καμία
 * από τις δύο δεν απαντά «**και το κείμενο, το έχουμε;**» — το `runLicenseInventory` επιστρέφει
 * τη δηλωμένη τιμή `license` και το `path`, **ποτέ** το κείμενο. Αυτό το αρχείο κάνει μόνο αυτό.
 *
 * ## 🔴 Ο παρονομαστής, μετρημένος 2026-09-16 πριν γραφτεί γραμμή
 *
 * **957 από τα 1.071** πακέτα prod κουβαλούν αρχείο κειμένου άδειας. **114 όχι** — και σχεδόν
 * όλα είναι `@firebase/*` **Apache-2.0**, δηλαδή ακριβώς η άδεια που στο **§4(α)** απαιτεί
 * *«You must give any other recipients of the Work or Derivative Works a copy of this License»*.
 * Η υποχρέωση **δεν εξαφανίζεται** επειδή ο συντηρητής παρέλειψε το αρχείο.
 *
 * ## 🏆 Πού ξεπερνάμε την πρακτική της αγοράς
 *
 * Το `license-checker` και τα παρόμοια επιστρέφουν `licenseFile: undefined` και **σιωπούν**.
 * Ο **Slack** και το **Figma** τυπώνουν πλήρη κείμενα αλλά κανείς δεν δημοσιεύει **τι έκανε
 * όταν το κείμενο έλειπε**. Εδώ η προέλευση κάθε κειμένου είναι **ρητή κατάσταση** που
 * ταξιδεύει μέχρι το παραγόμενο αρχείο: `package` (το ίδιο το πακέτο), `canonical` (το
 * επίσημο κείμενο του SPDX id από το `licenses/`), ή `missing` — **ποτέ σιωπή**.
 *
 * ⚠️ **ΤΟ `NOTICE` ΔΕΝ ΕΙΝΑΙ ΤΟ `LICENSE`, ΚΑΙ ΜΑΖΕΥΟΝΤΑΙ ΚΑΙ ΤΑ ΔΥΟ.** Η Apache-2.0 **§4(δ)**
 * είναι ξεχωριστή υποχρέωση από το §4(α): αν το έργο έχει αρχείο `NOTICE`, το **περιεχόμενό
 * του** πρέπει να αναπαραχθεί. Ένας συλλέκτης που κρατά «το πρώτο αρχείο που ταίριαξε» θα
 * έχανε συστηματικά τη μισή υποχρέωση.
 *
 * @module scripts/lib/third-party-notices/texts
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const spdx = require('../license-policy/spdx');

/** Ο φάκελος των **κανονικών** κειμένων ανά SPDX id — SSoT για ό,τι δεν κουβαλά το πακέτο. */
const CANONICAL_DIR = 'licenses';

/**
 * Ποια ονόματα αρχείων **είναι** απόδοση.
 *
 * ⚠️ Αγκυρωμένο στην **αρχή** του ονόματος επίτηδες. Χαλαρό `includes('license')` θα μάζευε
 * `license-check.js`, `eslint-license-header.js` και κάθε πηγαίο αρχείο με τη λέξη μέσα —
 * δηλαδή θα παρουσίαζε **κώδικα ως νομικό κείμενο**. Καλύπτονται οι πραγματικές γραφές του
 * οικοσυστήματος: `LICENSE`, `LICENCE`, `LICENSE-MIT`, `LICENSE.txt`, `COPYING`, `NOTICE`.
 */
const LICENSE_FILE_RE = /^(LICEN[CS]E|COPYING|NOTICE)([-._].*)?$/i;

/**
 * Καταλήξεις που **ΕΙΝΑΙ ΚΩΔΙΚΑΣ**, όσο κι αν το όνομα αρχίζει με «license».
 *
 * 🔴 **ΤΟ ΕΠΙΑΣΕ Η ΑΓΚΥΡΑ `Τ3`, ΟΧΙ Ο ΣΥΓΓΡΑΦΕΑΣ** (2026-09-16): το σχήμα από μόνο του δέχεται
 * το `([-._].*)?`, άρα το **`license-check.js`** και το `eslint-license-header.js` περνούσαν —
 * δηλαδή ο συλλέκτης θα παρουσίαζε **πηγαίο κώδικα ως νομικό κείμενο**, ακριβώς αυτό που το
 * docblock από πάνω ισχυριζόταν ότι αποφεύγει. Διορθώθηκε ο **κανόνας**, ποτέ το test.
 */
const CODE_EXTENSION_RE = /\.(js|cjs|mjs|ts|tsx|jsx|json|ya?ml|sh|ps1|py|rb|go|rs|c|h|cpp|java|php)$/i;

/** «Είναι αυτό το όνομα **αρχείο απόδοσης**, ή απλώς κώδικας που τυχαίνει να λέγεται έτσι;» */
const isLicenseFileName = (name) => LICENSE_FILE_RE.test(name) && !CODE_EXTENSION_RE.test(name);

/**
 * Ταβάνι ανά αρχείο. Υπάρχουν πακέτα που ενσωματώνουν ολόκληρα δέντρα αδειών τρίτων σε ένα
 * `LICENSE` (εκατοντάδες KB). ⚠️ Η υπέρβαση γίνεται **ρητή κατάσταση**, ποτέ σιωπηλή περικοπή:
 * μισό νομικό κείμενο είναι χειρότερο από καθόλου, γιατί **μοιάζει** πλήρες.
 */
const MAX_TEXT_BYTES = 256 * 1024;

const TEXT_SOURCE = Object.freeze({
  PACKAGE: 'package',
  CANONICAL: 'canonical',
  MISSING: 'missing',
  UNREADABLE: 'unreadable',
  OVERSIZE: 'oversize',
});

/** Καθαρίζει BOM και κανονικοποιεί τερματισμούς γραμμής — ποτέ δεν αλλάζει το περιεχόμενο. */
const normalize = (text) => text.replace(/^﻿/, '').replace(/\r\n/g, '\n').trimEnd();

/**
 * Τα αρχεία απόδοσης **μέσα** στον κατάλογο ενός πακέτου, ταξινομημένα ώστε το `LICENSE` να
 * προηγείται του `NOTICE` (αναγνωσιμότητα — και τα δύο επιστρέφονται πάντα).
 *
 * @returns {{ok: true, files: Array<{name: string, text: string}>} | {ok: false, state: string, detail: string}}
 */
function readPackageTexts(pkgPath, { readDir = fs.readdirSync, readFile = fs.readFileSync, stat = fs.statSync } = {}) {
  if (!pkgPath) return { ok: false, state: TEXT_SOURCE.MISSING, detail: 'η απογραφή δεν έδωσε διαδρομή πακέτου' };
  let names;
  try {
    names = readDir(pkgPath).filter(isLicenseFileName).sort();
  } catch (error) {
    return { ok: false, state: TEXT_SOURCE.UNREADABLE, detail: `ο κατάλογος δεν διαβάζεται: ${error.message}` };
  }
  if (!names.length) return { ok: false, state: TEXT_SOURCE.MISSING, detail: 'κανένα αρχείο LICENSE/COPYING/NOTICE στο πακέτο' };

  const files = [];
  for (const name of names) {
    const file = path.join(pkgPath, name);
    let size;
    try {
      size = stat(file).size;
    } catch (error) {
      return { ok: false, state: TEXT_SOURCE.UNREADABLE, detail: `${name}: ${error.message}` };
    }
    if (size > MAX_TEXT_BYTES) {
      return { ok: false, state: TEXT_SOURCE.OVERSIZE, detail: `${name}: ${size} bytes > ${MAX_TEXT_BYTES} — δεν περικόπτεται σιωπηλά` };
    }
    try {
      files.push({ name, text: normalize(readFile(file, 'utf8')) });
    } catch (error) {
      return { ok: false, state: TEXT_SOURCE.UNREADABLE, detail: `${name}: ${error.message}` };
    }
  }
  return { ok: true, files: files.filter((f) => f.text.length > 0) };
}

/**
 * Το **κανονικό** κείμενο ενός SPDX id από το `licenses/<id>.txt`.
 *
 * ⚠️ Το id μπαίνει σε όνομα αρχείου ⇒ γίνεται δεκτό **μόνο** το αλφάβητο των SPDX
 * αναγνωριστικών. Χωρίς αυτόν τον φρουρό, μια τιμή `license` από `package.json` τρίτου
 * (ελεύθερο κείμενο, το ελέγχει κανείς) θα ήταν διαδρομή που διαφεύγει από τον φάκελο.
 */
function canonicalText(repoRoot, spdxId, { readFile = fs.readFileSync, exists = fs.existsSync } = {}) {
  if (typeof spdxId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9.+-]*$/.test(spdxId)) return null;
  const file = path.join(repoRoot, CANONICAL_DIR, `${spdxId}.txt`);
  if (!exists(file)) return null;
  try {
    return normalize(readFile(file, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Τα κανονικά κείμενα μιας **έκφρασης** — ένα ανά φύλλο.
 *
 * 🔴 **ΓΡΑΦΤΗΚΕ ΕΠΕΙΔΗ Η ΜΕΤΡΗΣΗ ΤΟ ΑΠΑΙΤΗΣΕ, ΟΧΙ ΓΙΑ ΠΛΗΡΟΤΗΤΑ.** Η πρώτη γραφή δεχόταν
 * μόνο **απλό** id, οπότε το `Apache-2.0 AND MIT` και το `MIT AND ISC` — **δύο υπαρκτά**
 * πακέτα του δέντρου (μέτρηση 2026-09-16) — θα έμεναν «χωρίς κείμενο» **ακόμη κι όταν έχουμε
 * και τα δύο κείμενα**. Η ανάλυση γίνεται με το **υπάρχον** `spdx.leaves`, καμία νέα γραμματική.
 *
 * ⚠️ **ΟΛΑ Ή ΤΙΠΟΤΑ**: αν λείπει **έστω ένα** φύλλο, επιστρέφεται `null`. Μια απόδοση που
 * παρουσιάζει τη μισή υποχρέωση είναι χειρότερη από δηλωμένο κενό — **μοιάζει** πλήρης.
 */
function canonicalTexts(repoRoot, licenseExpression, io = {}) {
  const parsed = spdx.parse(licenseExpression);
  if (!parsed.ok) return null;
  const ids = [...new Set(spdx.leaves(parsed.ast).map((leaf) => leaf.id))];
  const files = [];
  for (const id of ids) {
    const text = canonicalText(repoRoot, id, io);
    if (!text) return null;
    files.push({ name: `${CANONICAL_DIR}/${id}.txt`, text });
  }
  return files.length ? files : null;
}

/**
 * Η **μία** απάντηση για ένα πακέτο: ποιο κείμενο αποδίδεται, και **από πού ήρθε**.
 *
 * Σειρά: το ίδιο το πακέτο → το κανονικό κείμενο του SPDX id → ρητή έλλειψη. Ποτέ δεν
 * «δανείζεται» κείμενο από **άλλο** πακέτο της ίδιας άδειας: το copyright είναι διαφορετικό,
 * και ένα λάθος copyright είναι χειρότερο από ένα δηλωμένο κενό.
 *
 * @returns {{source: string, files: Array<{name: string, text: string}>, detail: string|null}}
 */
function resolveNoticeText(repoRoot, pkg, spdxId, io = {}) {
  const fromPackage = readPackageTexts(pkg.path, io);
  if (fromPackage.ok && fromPackage.files.length) {
    return { source: TEXT_SOURCE.PACKAGE, files: fromPackage.files, detail: null };
  }
  const canonical = canonicalTexts(repoRoot, spdxId, io);
  if (canonical) {
    return {
      source: TEXT_SOURCE.CANONICAL,
      files: canonical,
      detail: fromPackage.ok ? 'το πακέτο δεν κουβαλά κείμενο' : fromPackage.detail,
    };
  }
  return {
    source: fromPackage.ok ? TEXT_SOURCE.MISSING : fromPackage.state,
    files: [],
    detail: `${fromPackage.ok ? 'κανένα κείμενο στο πακέτο' : fromPackage.detail}· ούτε κανονικό κείμενο στο ${CANONICAL_DIR}/${spdxId}.txt`,
  };
}

module.exports = {
  CANONICAL_DIR,
  LICENSE_FILE_RE,
  CODE_EXTENSION_RE,
  isLicenseFileName,
  MAX_TEXT_BYTES,
  TEXT_SOURCE,
  normalize,
  readPackageTexts,
  canonicalText,
  canonicalTexts,
  resolveNoticeText,
};
