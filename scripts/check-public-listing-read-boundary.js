#!/usr/bin/env node
/**
 * CHECK 3.74 — **ΤΟ ΣΥΝΟΡΟ ΑΝΑΓΝΩΣΗΣ ΤΗΣ ΔΗΜΟΣΙΑΣ ΠΡΟΒΟΛΗΣ** (ADR-839 §8).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * Η ΕΡΩΤΗΣΗ: «διαβάζει κάποιος αγγελία ΧΩΡΙΣ να περάσει από το σύνορο;»
 * ────────────────────────────────────────────────────────────────────────────
 *
 * 🔴 **Η ΑΙΤΙΑ, μετρημένη στην παραγωγή 2026-08-31**: τρία σημεία έκαναν
 * `data() as PublicListing` πάνω σε έγγραφα που είχαν **15 από τα 18 πεδία** του
 * τύπου. Η οθόνη 3 κατέρρευσε σε λευκό (`legality.map` σε `undefined`) για
 * ανώνυμο επισκέπτη, και **κανένα** εργαλείο δεν μπορούσε να το δει: το `as`
 * είναι εντολή στον μεταγλωττιστή να πάψει να ρωτά.
 *
 * 🔑 **ΓΙΑΤΙ ΤΟ Κ1 ΕΙΝΑΙ ΠΛΗΡΕΣ — ο μεταγλωττιστής κλείνει κάθε άλλη πόρτα.** Το
 * `.data()` επιστρέφει `DocumentData`, ποτέ `PublicListing`· ένα
 * `const l: PublicListing = snap.data()` **δεν μεταγλωττίζεται**. Άρα ο μόνος
 * τρόπος να μπει ωμό έγγραφο στον τύπο είναι ρητός ισχυρισμός — και το
 * `as unknown as PublicListing` περιέχει κι αυτό το ζητούμενο. Το `as any` το
 * απαγορεύει ήδη ο N.2.
 *
 * ⚠️ **ΤΟ ΠΡΩΤΟ Κ2 ΓΕΝΝΗΘΗΚΕ ΘΟΛΟ ΚΑΙ ΑΝΤΙΚΑΤΑΣΤΑΘΗΚΕ — μετρημένο.** Ρωτούσε
 * *«αρχείο που αναφέρει `PUBLIC_LISTINGS` και καλεί κάπου `.data()`»* και έβγαλε
 * **2 ψευδώς θετικά στα 3**: το `publish-public-listing.ts` και το
 * `rebuild-public-listings.service.ts` καλούν `.data()` σε **άλλες** συλλογές
 * (`properties`, `owner_properties`), ενώ το `public_listings` το αγγίζουν μόνο
 * για `doc.id`. Ποσοστό 67% — πολύ πάνω από τον πήχη του ≤10% που το έργο απαιτεί
 * για **μπλοκάρουσα** πύλη. Χωρίς πληροφορία τύπων η γειτνίαση δεν διακρίνεται,
 * και μια πύλη που κοκκινίζει σε σωστό κώδικα διδάσκει να την παρακάμπτουν.
 *
 * 🔴 **ΤΟ ΣΗΜΕΡΙΝΟ Κ2 ΕΙΝΑΙ Ο ΠΑΡΟΝΟΜΑΣΤΗΣ**: *«έχει το σύνορο
 * καταναλωτές;»*. Χωρίς αυτό, κάποιος «λύνει» ένα κόκκινο Κ1 σβήνοντας την κλήση
 * της μετάφρασης — και η πύλη γίνεται **πράσινη με μηδέν προστασία**. Είναι το
 * σχήμα «*0 = κανείς δεν κοίταξε*» που το έργο έχει μετρήσει τέσσερις φορές.
 *
 * ⚠️ **ΜΗΝ το κάνεις ratchet.** Δεν υπάρχει «λιγότεροι ανεξέλεγκτοι αναγνώστες
 * από χθες» — **ένας** αρκεί για λευκή οθόνη σε δημόσια σελίδα. Το zero-tol
 * είναι εφικτό επειδή **μετρήθηκε**: το ίδιο ρεύμα δουλειάς μηδένισε και τα τρία.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΜΙΑ ΜΗΧΑΝΗ, ΠΙΝΑΚΑΣ ΣΥΝΟΡΩΝ (ADR-842 §7.6.12, 2026-09-06)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το §8 #11 γέννησε **δεύτερο** σύνορο ανάγνωσης — `owner_properties`, με **19** ωμά
 * `as OwnerProperty` σε **14** αρχεία. Η προφανής κίνηση ήταν δεύτερο script· ⛔
 * **απορρίφθηκε**: θα ήταν **δεύτερος κριτής για την ίδια ερώτηση**, ελεύθερος να
 * αποκλίνει στη διάλεκτο, στις εξαιρέσεις ή στο σχήμα της αναφοράς — κατά γράμμα το
 * σχήμα που τιμωρεί το ADR-749.
 *
 * ⇒ Ο έλεγχος έγινε **πίνακας** ({@link BOUNDARIES}): μία γραμμή ανά συλλογή, ίδια Κ1
 * και Κ2 για όλες. Το CHECK **κρατά τον αριθμό του** — αυτό που μεγάλωσε είναι η
 * εμβέλεια, όχι η ταυτότητα.
 *
 * ⚠️ **Το Κ2 γίνεται ΑΚΟΜΑ πιο σημαντικό με δύο γραμμές**: ένα σύνορο χωρίς
 * καταναλωτές δίνει **πράσινο Κ1 επειδή κανείς δεν διαβάζει**, και με δύο σύνορα η
 * σιωπή του ενός θα κρυβόταν πίσω από την υγεία του άλλου.
 *
 * Escape: `SKIP_LISTING_READ_BOUNDARY=1` (δικαιολόγησέ το στον Giorgio).
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const SRC = path.join(PROJECT_ROOT, 'src');
const BS = path.sep;

const RED = '\x1b[0;31m';
const GREEN = '\x1b[0;32m';
const DIM = '\x1b[2m';
const NC = '\x1b[0m';

/**
 * **Τα σύνορα ανάγνωσης — μία γραμμή ανά συλλογή.**
 *
 * 🔑 Κάθε γραμμή απαντά το ίδιο ζεύγος: *«ποιος είναι ο **ένας** ισχυρισμός;»* (Κ1) και
 * *«τον **ζητά** κανείς;»* (Κ2). Νέα συλλογή με σύνορο ⇒ **μία γραμμή εδώ**, τίποτα
 * άλλο.
 */
const BOUNDARIES = [
  {
    adr: 'ADR-839',
    typeName: 'PublicListing',
    custodian: 'src/lib/listings/public-listing-from-document.ts',
    module: 'public-listing-from-document',
    remedy: '«readStoredListing(raw, id)» ή «publicListingFromDocument(raw, id)»',
  },
  {
    adr: 'ADR-842 §7.6.12',
    typeName: 'OwnerProperty',
    custodian: 'src/lib/owner-property/owner-property-from-document.ts',
    module: 'owner-property-from-document',
    remedy: '«readStoredOwnerProperty(raw, id)» ή «ownerPropertyFromDocument(raw, id)»',
  },
];

/** Ο ισχυρισμός που ψάχνει η Κ1 για μια γραμμή του πίνακα. */
const assertionOf = (typeName) => new RegExp(`\\bas\\s+${typeName}\\b`);

/**
 * 🔶 Συμβατότητα με τις άγκυρες της πύλης — η **πρώτη** γραμμή είναι το ADR-839.
 * Οι άγκυρες εκτελούν τη μηχανή σε μίνι-repo· δεν χρειάζεται να ξέρουν τον πίνακα.
 */
const CUSTODIAN = BOUNDARIES[0].custodian;
const CUSTODIAN_MODULE = BOUNDARIES[0].module;

/**
 * 🔶 **Δηλωμένες εξαιρέσεις — με λόγο, ποτέ σιωπηλά.**
 *
 * Οι άγκυρες κατασκευάζουν *fixtures*: εκεί το `as PublicListing` δηλώνει
 * **πρόθεση δοκιμής**, δεν ισχυρίζεται γνώση για έγγραφο της βάσης. Το ίδιο το
 * αρχείο των αγκυρών του ADR-839 **οφείλει** να το χρησιμοποιεί, αλλιώς δεν θα
 * μπορούσε να δοκιμάσει τη διάβρωση που η πύλη απαγορεύει.
 */
const EXEMPT_PATTERNS = [/__tests__\//, /\.test\.tsx?$/, /\.spec\.tsx?$/];

// ---------------------------------------------------------------------------

/**
 * 🔑 **Η ρίζα περνιέται, δεν ζητιέται** — ώστε οι άγκυρες να ΕΚΤΕΛΟΥΝ την πύλη σε
 *    μίνι-repo αντί να την περιγράφουν. Πύλη που δεν μπορεί να δοκιμαστεί σε
 *    ελεγχόμενο δέντρο αποδεικνύεται μόνο όταν σπάσει η παραγωγή — που είναι
 *    ακριβώς το πώς έφτασε εδώ το ADR-839.
 */
function collectSourceFiles(dir, root = PROJECT_ROOT, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.next') collectSourceFiles(full, root, acc);
    } else if (/\.tsx?$/.test(entry.name) && !/\.d\.ts$/.test(entry.name)) {
      acc.push(path.relative(root, full).split(BS).join('/'));
    }
  }
  return acc;
}

const isExempt = (rel) => EXEMPT_PATTERNS.some((pattern) => pattern.test(rel));

/** Σβήνει σχόλια, ώστε ένα `as PublicListing` μέσα σε τεκμηρίωση να μη μετρά. */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

// ---------------------------------------------------------------------------
// Κ1 — ο ισχυρισμός ζει σε ΕΝΑ σπίτι
// ---------------------------------------------------------------------------

function measureK1(files, root = PROJECT_ROOT, boundary = BOUNDARIES[0]) {
  const ASSERTION = assertionOf(boundary.typeName);
  const offenders = [];

  for (const rel of files) {
    if (rel === boundary.custodian || isExempt(rel)) continue;

    // 🔑 **Δύο αναγνώσεις, επίτηδες**: η κρίση γίνεται στο κείμενο *χωρίς* σχόλια
    //    (ώστε ένα `as PublicListing` μέσα σε τεκμηρίωση να μη μετρά), αλλά ο
    //    **αριθμός γραμμής** μετριέται στο *αρχικό*. Η πρώτη εκδοχή τύπωνε τη
    //    γραμμή του απογυμνωμένου κειμένου και έστελνε τον άνθρωπο 72 γραμμές
    //    πιο πάνω — δείκτης που δείχνει λάθος είναι χειρότερος από κανέναν.
    const original = fs.readFileSync(path.join(root, rel), 'utf8');
    if (!ASSERTION.test(stripComments(original))) continue;

    const line = original.split('\n').findIndex((text) => ASSERTION.test(text)) + 1;
    offenders.push({ file: rel, line });
  }
  return offenders;
}

// ---------------------------------------------------------------------------
// Κ2 — ο παρονομαστής: το σύνορο έχει καταναλωτές
// ---------------------------------------------------------------------------



/**
 * Ποιοι **παραγωγικοί** καταναλωτές ζητούν τη μετάφραση.
 *
 * Επιστρέφει τη λίστα (όχι απλώς πλήθος) ώστε η αναφορά να λέει **ποιοι** — μια
 * πύλη που λέει μόνο «0» αφήνει τον άνθρωπο να ψάχνει τι έσπασε.
 */
function measureK2(files, root = PROJECT_ROOT, boundary = BOUNDARIES[0]) {
  const importsCustodian = new RegExp(`from\\s+['"][^'"]*${boundary.module}['"]`);
  return files.filter(
    (rel) =>
      rel !== boundary.custodian &&
      !isExempt(rel) &&
      importsCustodian.test(stripComments(fs.readFileSync(path.join(root, rel), 'utf8')))
  );
}

// ---------------------------------------------------------------------------

function main() {
  if (process.env.SKIP_LISTING_READ_BOUNDARY === '1') {
    console.log(`${DIM}  ⏭️  CHECK 3.74 — παρακάμφθηκε (SKIP_LISTING_READ_BOUNDARY=1)${NC}`);
    return 0;
  }

  const files = collectSourceFiles(SRC);
  let failed = false;

  for (const boundary of BOUNDARIES) {
    if (!fs.existsSync(path.join(PROJECT_ROOT, boundary.custodian))) {
      console.error(
        `${RED}❌ CHECK 3.74 — λείπει το ίδιο το σύνορο: ${boundary.custodian}${NC}`
      );
      failed = true;
      continue;
    }

    const k1 = measureK1(files, PROJECT_ROOT, boundary);
    const consumers = measureK2(files, PROJECT_ROOT, boundary);

    // 🔑 Τυπώνεται **ακόμα και στο μηδέν** — πύλη που σιωπά όταν περνά δεν
    //    ξεχωρίζει από πύλη που δεν έτρεξε (μάθημα CHECK 3.48).
    console.log(
      `${DIM}  CHECK 3.74 — ${boundary.typeName} (${boundary.adr}): ` +
        `${k1.length} ισχυρισμοί εκτός σπιτιού · ${consumers.length} καταναλωτές${NC}`
    );

    for (const { file, line } of k1) {
      console.error(
        `${RED}  ⛔ Κ1 ${file}:${line} — «as ${boundary.typeName}» έξω από ${boundary.custodian}${NC}`
      );
    }

    if (consumers.length === 0) {
      console.error(
        `${RED}  ⛔ Κ2 (${boundary.typeName}) — το σύνορο ΔΕΝ ΕΧΕΙ ΚΑΝΕΝΑΝ καταναλωτή.${NC}\n` +
          `${RED}     Το Κ1 είναι πράσινο επειδή κανείς δεν διαβάζει — όχι επειδή διαβάζει σωστά.${NC}`
      );
    }

    if (k1.length > 0 || consumers.length === 0) {
      console.error(
        `\n${RED}❌ CHECK 3.74 (${boundary.adr}) — το «${boundary.typeName}» διαβάζεται χωρίς φύλακα.${NC}\n` +
          `   Θεραπεία: ${boundary.remedy}.\n` +
          `   ΜΗΝ προσθέσεις «?? []» ή «?? 'apartment'» στην οθόνη — αυτό θεραπεύει το δείγμα, όχι την κλάση.\n`
      );
      failed = true;
    }
  }

  if (failed) return 1;

  console.log(
    `${GREEN}✅ CHECK 3.74 — και τα ${BOUNDARIES.length} σύνορα ανάγνωσης έχουν φύλακα ` +
      `(${files.length} αρχεία).${NC}`
  );
  return 0;
}

if (require.main === module) process.exit(main());

module.exports = {
  measureK1,
  measureK2,
  collectSourceFiles,
  BOUNDARIES,
  CUSTODIAN,
  CUSTODIAN_MODULE,
};
