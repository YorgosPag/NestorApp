#!/usr/bin/env node
/**
 * CHECK 3.56 — ΠΥΛΗ ΘΕΜΑΤΟΦΥΛΑΚΗΣ ΑΓΓΕΛΙΑΣ (ADR-777 §8.42)
 *
 * «Αποφασίζει κάποιος **ποιος διαχειρίζεται μια αγγελία** έξω από το SSoT;»
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΡΕΙΣ ΕΜΦΑΝΙΣΕΙΣ ΤΟΥ ΙΔΙΟΥ ΕΛΑΤΤΩΜΑΤΟΣ, ΚΑΜΙΑ ΠΥΛΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το §8.39 βρήκε την ερώτηση «επιτρέπεται σε αυτόν τον άνθρωπο;» απαντημένη σε **δύο**
 * σημεία με **δύο** κριτήρια, και την ένωσε σε `lib/owner-property/listing-custody.ts`.
 * Το §8.42 βρήκε **τρίτο** (`place-interest.service.ts`) — και θα υπήρχε τέταρτο, γιατί
 * η ένωση **δεν άφησε φρουρό πίσω της**.
 *
 * 🔑 ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΗ ΠΥΛΗ ΚΑΙ ΟΧΙ ΕΠΕΚΤΑΣΗ ΤΗΣ 3.35. Το ίδιο το SSoT το δηλώνει
 * γραπτά: *«ΔΕΝ ΕΙΝΑΙ ΔΕΥΤΕΡΗ ΑΥΘΕΝΤΙΑ ΔΙΠΛΑ ΣΤΟ `lib/auth/tenant-ownership.ts` —
 * ΑΛΛΗ ΕΡΩΤΗΣΗ»*. Η 3.35 ρωτά **απομόνωση** («ποιος επιτρέπεται να ΔΕΙ;»)· εδώ
 * ρωτάμε **εξουσιοδότηση** («ποιος επιτρέπεται να ΔΙΑΧΕΙΡΙΣΤΕΙ;»). Ένωσή τους θα
 * ανέφερε αποτυχία θεματοφυλακής ως αποτυχία tenant scope — το λάθος που απορρίπτει
 * ρητά το ADR-775.
 *
 * ⚠️ ΤΑ ΣΧΟΛΙΑ ΚΟΒΟΝΤΑΙ, ΚΑΙ ΕΙΝΑΙ ΤΟ ΜΙΣΟ ΤΟΥ ΠΡΟΒΛΗΜΑΤΟΣ. Μετρημένο 2026-08-21:
 * από **10** εμφανίσεις `authorUserId ===` στο δέντρο, οι **8 ήταν ΣΧΟΛΙΑ** που
 * τεκμηριώνουν τη βλάβη. Πύλη χωρίς `stripComments` θα κοκκίνιζε πάνω στην ίδια την
 * τεκμηρίωση της θεραπείας — το σχήμα `Κ7β` του CHECK 3.50.
 *
 * ⚠️ ΤΟ ΚΡΙΤΗΡΙΟ ΕΙΝΑΙ Η ΣΥΛΛΟΓΗ, ΟΧΙ ΤΟ ΟΝΟΜΑ ΜΕΤΑΒΛΗΤΗΣ. Το
 * `api/demand/competition/route.ts` συγκρίνει `demand.authorUserId !== ctx.uid` —
 * **άλλος πόρος**, η ζήτηση, που δεν έχει θεματοφυλακή. Κριτήριο «οποιοδήποτε
 * `authorUserId ===`» θα το κατήγγειλε: μετρημένα **2 ψευδώς θετικά στα 3** ευρήματα,
 * δηλαδή 67% — πολύ πάνω από τον πήχη <10% για **μπλοκάρουσα** πύλη.
 *
 * ⚠️ ΜΗΝ ΤΟ ΚΑΝΕΙΣ RATCHET. Δεν υπάρχει «λιγότερες αυθεντίες εξουσιοδότησης από χθες»:
 * **μία** αρκεί για να δει ο υπάλληλος αγγελία που δεν του ανήκει, ή να μη δει το
 * γραφείο τη δική του. Είναι εφικτό ως zero-tolerance **επειδή** το §8.42 καθάρισε το
 * τελευταίο — **μετρημένο** (κατάσταση `Μ0`), όχι ελπιζόμενο.
 *
 * Escape: `SKIP_LISTING_CUSTODY=1` · εξαίρεση αρχείου: `// custody-exempt: <λόγος>`
 * (ο λόγος είναι **ΥΠΟΧΡΕΩΤΙΚΟΣ**, πρότυπο CHECK 3.35).
 */
const fs = require('node:fs');
const path = require('node:path');
const { stripComments } = require('./lib/i18n-namespace-extract');

const REPO_ROOT = path.join(__dirname, '..');
const SSOT = 'src/lib/owner-property/listing-custody.ts';
const RED = '\x1b[0;31m';
const GREEN = '\x1b[0;32m';
const YELLOW = '\x1b[1;33m';
const DIM = '\x1b[2m';
const NC = '\x1b[0m';

/** Τα δύο πεδία που ΟΡΙΖΟΥΝ τον χώρο — η ίδια λίστα που κατέχει το `custodyOf`. */
const CUSTODY_FIELDS = ['authorUserId', 'authorCompanyId'];
/** Οι εξαγωγές του SSoT: αν τις καλείς, ρωτάς τη σωστή αυθεντία. */
const SSOT_CALLS = /\b(custodyOf|mayAdminister|isPersonalCustody)\s*\(/;
/** Η συλλογή που ΕΧΕΙ θεματοφυλακή. Άλλος πόρος, άλλη ερώτηση. */
const OWNER_COLLECTION = /OWNER_PROPERTIES|owner_properties/;
/**
 * `// custody-exempt: <λόγος>` — ο λόγος **ΥΠΟΧΡΕΩΤΙΚΟΣ** (πρότυπο CHECK 3.35).
 *
 * 🔴 Η πρώτη γραφή ήταν `\s*\S+`, και το `\s` **περιλαμβάνει τη νέα γραμμή**:
 * ένα κενό `custody-exempt:` δανειζόταν την πρώτη λέξη της **επόμενης** γραμμής και
 * περνούσε — δηλαδή ο «υποχρεωτικός λόγος» ήταν στην πράξη **προαιρετικός**, δηλαδή
 * παράκαμψη με άλλο όνομα. Το έπιασε η άγκυρα `Κ8`, όχι η ανάγνωση.
 */
const EXEMPT = /custody-exempt:[ \t]*\S+/;

/**
 * Κάθε σύγκριση ενός πεδίου χώρου, **με τον αντίπαλο τελεστέο της**.
 *
 * 🔴 ΓΕΝΝΗΘΗΚΕ ΜΟΝΙΜΩΣ ΠΡΑΣΙΝΗ, ΚΑΙ ΤΟ ΕΠΙΑΣΕ Η ΛΟΓΙΣΤΙΚΗ. Η πρώτη γραφή έχτιζε το
 * pattern σε **template literal**: εκεί η JavaScript καταναλώνει το backslash-b ως
 * backspace και το backslash-s ως σκέτο `s` **πριν** το δει η RegExp ⇒ η πύλη ανέφερε
 * «0 παραβιάσεις» — αλλά και **0 SSoT**, που είναι αδύνατο.
 *
 * ⚠️ Γι΄ αυτό το κατάστιχο τυπώνει **και τους κάδους που ΔΕΝ μπλοκάρουν**: ένα «0»
 * δίπλα σε άλλο «0» που ξέρεις ότι πρέπει να είναι 1 είναι ο μόνος τρόπος να
 * ξεχωρίσεις «καθαρό» από «δεν κοίταξα». Χωρίς τη λογιστική, αυτή η πύλη θα είχε
 * προσγειωθεί πράσινη και ανενεργή.
 *
 * 🔴 ΚΡΙΝΕΤΑΙ Η ΣΥΓΚΡΙΣΗ, ΟΧΙ Η ΓΡΑΜΜΗ. Η πρώτη γραφή ρωτούσε «περιέχει η γραμμή
 * σύγκριση με null;» — και το `api/demand/competition/route.ts:90` γράφει
 * `if (demand === undefined || demand.authorUserId !== ctx.uid)`, δηλαδή **και τα
 * δύο στην ίδια γραμμή** ⇒ ταξινομήθηκε «έλεγχος κενού» και η πραγματική απόφαση
 * εξουσιοδότησης έγινε **αόρατη**. Είναι η ίδια κλάση σφάλματος που ονομάζει το
 * CHECK 3.35 («ΜΗΝ βάλεις κριτήριο επιπέδου **αρχείου**»), μια βαθμίδα πιο κάτω.
 *
 * @returns {string[]} οι αντίπαλοι τελεστέοι — `'null'` σημαίνει έλεγχος κενού
 */
function comparisonsOf(field, text) {
  const re = new RegExp(
    '\\b' + field + '\\b\\s*[!=]==\\s*(' + '[A-Za-z0-9_.?\\[\\]]+' + ')'
    + '|(' + '[A-Za-z0-9_.?\\[\\]]+' + ')\\s*[!=]==\\s*[A-Za-z0-9_.?\\[\\]]*\\b' + field + '\\b',
    'g',
  );
  const out = [];
  let m;
  while ((m = re.exec(text)) !== null) out.push(m[1] !== undefined ? m[1] : m[2]);
  return out;
}

/** Έχει το αρχείο έστω ΜΙΑ σύγκριση χώρου που ΔΕΝ είναι έλεγχος κενού; */
const isDecision = (operand) => operand !== 'null' && operand !== 'undefined';

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.next', 'dist'].includes(entry.name)) continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Η ΤΑΞΙΝΟΜΗΣΗ — ΜΙΑ κατάσταση ανά αρχείο, ΠΟΤΕ σιωπηλή απόρριψη.
 *
 * ⚠️ Η ΣΕΙΡΑ ΕΙΝΑΙ ΣΥΜΒΟΛΑΙΟ: το SSoT κρίνεται πρώτο (είναι η αυθεντία, όχι παράβαση),
 * μετά η εξαίρεση, μετά τα test, και **τελευταία** η παράβαση — ώστε ένα αρχείο να μη
 * μετρηθεί σε δύο κάδους και το άθροισμα να κλείνει.
 */
function classify(rel, raw) {
  // ⚡ ΠΡΟΦΙΛΤΡΟ ΚΕΙΜΕΝΟΥ, ΜΕΤΡΗΜΕΝΟ: χωρίς αυτό η πύλη κόστιζε **21,5s** (stripComments
  // σε ~14.000 αρχεία) — ζώνη `SKIP_`, δηλαδή πύλη ανενεργή στην πράξη (μάθημα 3.52).
  // Είναι ασφαλές γιατί το `stripComments` **αφαιρεί** κείμενο, δεν προσθέτει: αρχείο που
  // δεν αναφέρει καθόλου πεδίο χώρου δεν μπορεί να αποκτήσει σύγκριση αφού κοπούν σχόλια.
  if (!CUSTODY_FIELDS.some((f) => raw.includes(f))) return { state: 'no-comparison' };
  const code = stripComments(raw);
  const operands = CUSTODY_FIELDS.flatMap((f) => comparisonsOf(f, code));
  if (operands.length === 0) return { state: 'no-comparison' };
  if (rel === SSOT) return { state: 'ssot' };
  if (EXEMPT.test(raw)) return { state: 'exempt' };
  if (/\.(test|spec)\.tsx?$/.test(rel)) return { state: 'fixture' };
  // 🔑 «ΥΠΑΡΧΕΙ ΤΙΜΗ;» ΔΕΝ ΕΙΝΑΙ «ΕΠΙΤΡΕΠΕΤΑΙ;». Το `authorUserId === null` του
  // `useOwnerPropertyMedia` ρωτά αν ο χρήστης έχει καν ταυτότητα — καμία σχέση με
  // θεματοφυλακή. Ήταν το ΜΟΝΟ εύρημα της πρώτης γραφής, δηλαδή **100% ψευδώς
  // θετικά**· και δεν πετιέται σιωπηλά αλλά **ονομάζεται**, γιατί ένα αρχείο που
  // εξαφανίζεται από τη λογιστική είναι αρχείο που κανείς δεν ξαναρωτά.
  if (!operands.some(isDecision)) return { state: 'null-guard' };
  if (!OWNER_COLLECTION.test(code)) return { state: 'other-resource' };
  if (SSOT_CALLS.test(code)) return { state: 'delegates' };
  return { state: 'second-authority' };
}

/**
 * ΤΟ ΚΑΤΑΣΤΙΧΟ — κάθε αρχείο σε ΕΝΑΝ κάδο, και το άθροισμα ΠΡΕΠΕΙ να κλείνει.
 *
 * 🔴 ΕΞΗΧΘΗ ΕΠΕΙΔΗ ΜΕΤΑΛΛΑΞΗ ΒΓΗΚΕ ΠΡΑΣΙΝΗ. Όσο η λογιστική ζούσε μέσα στη `main`,
 * καμία άγκυρα δεν την ασκούσε: σβήνοντας το `throw` η σουίτα έμενε **πράσινη**.
 * Ένα άθροισμα που κανείς δεν ελέγχει είναι ακριβώς το «0 = κανείς δεν κοίταξε»,
 * μόνο που εδώ θα το γράφαμε **μέσα στο όργανο που το κυνηγά**.
 *
 * @param {Array<{rel: string, raw: string}>} entries
 *
 * ⚠️ ΟΙ ΔΥΟ ΦΡΟΥΡΟΙ ΕΙΝΑΙ BELT-AND-SUSPENDERS ΚΑΙ ΑΛΛΗΛΟΚΑΛΥΠΤΟΝΤΑΙ ΕΠΙΤΗΔΕΣ:
 * σβήνοντας μόνο το «άγνωστη κατάσταση», το άθροισμα δεν κλείνει και πυροδοτεί ο
 * δεύτερος· σβήνοντας μόνο το άθροισμα, πυροδοτεί ο πρώτος. Γι΄ αυτό η άγκυρα
 * μεταλλάσσει **και τους δύο μαζί** — μια μετάλλαξη που την πιάνει ο εφεδρικός
 * φρουρός δεν αποδεικνύει τίποτα για τον κύριο.
 *
 * @param {(rel: string, raw: string) => {state: string}} [classifyFn] ραφή δοκιμής
 */
function tally(entries, classifyFn = classify) {
  const ledger = {
    'second-authority': [], ssot: [], delegates: [],
    exempt: [], fixture: [], 'null-guard': [], 'other-resource': [], 'no-comparison': [],
  };
  for (const { rel, raw } of entries) {
    const { state } = classifyFn(rel, raw);
    if (!(state in ledger)) throw new Error(`CHECK 3.56 — άγνωστη κατάσταση: ${state}`);
    ledger[state].push(rel);
  }
  const counted = Object.values(ledger).reduce((n, list) => n + list.length, 0);
  if (counted !== entries.length) {
    throw new Error(`CHECK 3.56 — η λογιστική δεν κλείνει: ${counted} ≠ ${entries.length}`);
  }
  return ledger;
}
function main() {
  if (process.env.SKIP_LISTING_CUSTODY === '1') {
    console.log(`${YELLOW}  ⏭ CHECK 3.56 παραλείφθηκε (SKIP_LISTING_CUSTODY=1)${NC}`);
    return 0;
  }

  const files = walk(path.join(REPO_ROOT, 'src'));
  const ledger = tally(files.map((file) => ({
    rel: path.relative(REPO_ROOT, file).split(path.sep).join('/'),
    raw: fs.readFileSync(file, 'utf8'),
  })));

  const offenders = ledger['second-authority'];
  // ⚠️ Τυπώνεται ΚΑΙ ΣΤΟ ΜΗΔΕΝ: ένα «0» που δεν φαίνεται διαβάζεται ως «δεν κοίταξα».
  console.log(
    `${DIM}  CHECK 3.56 — θεματοφυλακή: ${offenders.length} δεύτερη αυθεντία · `
    + `${ledger.ssot.length} SSoT · ${ledger.delegates.length} αναθέτουν · `
    + `${ledger.exempt.length} εξαιρέσεις · ${ledger['null-guard'].length} έλεγχος κενού · `
    + `${ledger['other-resource'].length} άλλος πόρος · ${ledger.fixture.length} fixture${NC}`,
  );

  if (offenders.length === 0) {
    console.log(`${GREEN}  ✅ CHECK 3.56 — καμία απόφαση θεματοφυλακής έξω από το SSoT${NC}`);
    return 0;
  }

  console.log(`${RED}  🚫 CHECK 3.56 — ${offenders.length} αρχείο(α) αποφασίζουν θεματοφυλακή μόνα τους:${NC}`);
  for (const rel of offenders) console.log(`${YELLOW}     ${rel}${NC}`);
  console.log(`${DIM}     Θεραπεία: mayAdminister(custodyOf(property), { uid, companyId })${NC}`);
  console.log(`${DIM}     ή, αν είναι σκόπιμο: // custody-exempt: <λόγος>${NC}`);
  return 1;
}

if (require.main === module) process.exit(main());
module.exports = { classify, tally, SSOT };
