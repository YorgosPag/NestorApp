#!/usr/bin/env node
/**
 * CHECK 3.74 — **ΤΑ ΣΥΝΟΡΑ ΑΝΑΓΝΩΣΗΣ** (ADR-839 §8 · ADR-842 · ADR-841 · ADR-864 · ADR-862).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * Η ΕΡΩΤΗΣΗ: «διαβάζει κάποιος αποθηκευμένο έγγραφο ΧΩΡΙΣ να περάσει από το σύνορό του;»
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
 * ⚠️ **Το Κ2 γίνεται ΑΚΟΜΑ πιο σημαντικό με πολλές γραμμές**: ένα σύνορο χωρίς
 * καταναλωτές δίνει **πράσινο Κ1 επειδή κανείς δεν διαβάζει**, και με πολλά σύνορα η
 * σιωπή του ενός θα κρυβόταν πίσω από την υγεία των άλλων.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 2026-09-16 — Η ΜΗΧΑΝΗ ΕΓΙΝΕ **AST**, ΚΑΙ ΜΕ ΤΟ ΙΔΙΟ ΚΟΣΤΟΣ (ADR-862 Φ0 Β9)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η **πέμπτη** γραμμή (`FileRecord`) έφερε τον λογαριασμό της σάρωσης κειμένου:
 * `\bas FileRecord\b` καταγγέλλει **6** αρχεία, εκ των οποίων **ΕΝΑ** μόνο ισχυρίζεται
 * *«αυτό το αποθηκευμένο έγγραφο ΕΙΝΑΙ FileRecord»*. Τα άλλα πέντε είναι
 * `FileRecord[]` · `FileRecord['status']` · `FileRecord & { entityLabel? }` — δηλαδή
 * **εκφράσεις τύπου ΓΙΑ** το `FileRecord`, ποτέ ισχυρισμός για έγγραφο. **83% ψευδώς
 * θετικά**, οκτώ φορές πάνω από τον πήχη ≤10%.
 *
 * ⛔ **Απορρίφθηκαν με μετρημένο λόγο** (και ΜΗΝ ξαναπροταθούν):
 *   - *«καθάρισε τα 5»* — θεραπεύει το **δείγμα**, ακριβώς ό,τι απαγορεύει το ίδιο
 *     το μήνυμα αυτής της πύλης.
 *   - **`withConverter`** (η επίσημη λύση της Google στο `data() as X`) — ο τρίτος
 *     καταναλωτής τρέχει σε **Admin SDK**, άλλη βιβλιοθήκη, άλλος τύπος converter
 *     ⇒ θα κάλυπτε 2 στα 3 και θα άφηνε **δεύτερο κριτή** (ADR-749).
 *   - **`@typescript-eslint/no-unsafe-type-assertion`** — σωστή ερώτηση, αλλά απαιτεί
 *     type information ⇒ ταχύτητα type-check, ακριβώς ό,τι αρνείται ο **N.17**.
 *
 * ✅ **Η λύση: διφασική.** Φθηνό πέρασμα κειμένου ως **προ-φίλτρο** (ίδιο κόστος με
 * πριν) → `ts.createSourceFile` **μόνο** στα ελάχιστα αρχεία που χτύπησαν. Ακρίβεια
 * AST στο κόστος σάρωσης κειμένου.
 *
 * 🎁 **Σβήνει κώδικα αντί να προσθέτει**: το `stripComments()` και η «διπλή ανάγνωση
 * για σωστό αριθμό γραμμής» υπήρχαν **μόνο** επειδή η μηχανή ήταν κείμενο. Στο AST τα
 * σχόλια είναι **δομικά αόρατα** και ο αριθμός γραμμής **ακριβής εξ ορισμού**.
 *
 * 🔑 **ΚΑΙ ΤΟ Κ2 ΚΕΡΔΙΣΕ**: μετρά πλέον **δηλώσεις εισαγωγής** (`ImportDeclaration` /
 * `ExportDeclaration`), όχι κείμενο — δηλαδή μια **σχολιασμένη** εισαγωγή έπαψε να
 * μετράει ως καταναλωτής. Ο παρονομαστής έγινε ειλικρινέστερος, όχι χαλαρότερος.
 *
 * ⚡ **ΕΝΑ πέρασμα, όχι 2×N.** Η παλιά μορφή διάβαζε **κάθε** αρχείο μία φορά ανά
 * κριτήριο **ανά γραμμή** — με 6 γραμμές, **12** πλήρεις σαρώσεις του `src/`. Τώρα:
 * μία ανάγνωση ανά αρχείο, μία (προαιρετική) ανάλυση. ⚠️ Και είναι **Η ΙΔΙΑ** μηχανή
 * που εκτελούν οι άγκυρες — τα `measureK1`/`measureK2` είναι λεπτά περιτυλίγματα του
 * {@link scanFiles}, ποτέ δεύτερη υλοποίηση (ADR-749).
 *
 * Escape: `SKIP_LISTING_READ_BOUNDARY=1` (δικαιολόγησέ το στον Giorgio).
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

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
 *
 * ⚠️ Το προαιρετικό `claims: 'document'` **στενεύει** τη γραμμή — δες {@link isOffence}.
 * Κάθε χρήση του είναι **δηλωμένη έκπτωση**, ποτέ σιωπηλή.
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
  {
    // 🔴 ADR-841 Α21.1 — Η ΤΡΙΤΗ ΓΡΑΜΜΗ, ΚΑΙ ΤΟ ΣΥΝΟΡΟ ΥΠΗΡΧΕ ΗΔΗ ΑΦΥΛΑΚΤΟ.
    //
    // Το `showcase-read.ts` είναι **υποδειγματικός** θεματοφύλακας από τη Φ6-Β:
    // `readShowcase` + `toStoredShowcase` στο ΙΔΙΟ αρχείο («οι δύο κατευθύνσεις
    // είναι μία σύμβαση»), με **γραμμένη μετανάστευση** παλιού εγγράφου (σκέτο
    // `gemiNumber` → credential). Δηλαδή η δουλειά είχε γίνει — αλλά **τίποτα δεν
    // εμπόδιζε τον επόμενο** να γράψει ωμό `snap.data() as PublicShowcase`, που
    // το ίδιο το header εκείνου του αρχείου λέει ότι υπήρχε σε **τρία** σημεία.
    //
    // 🔑 Και το διακύβευμα είναι **ταυτόσημο** με τη βλάβη της 31/08 που γέννησε
    // αυτή την πύλη: το `agency_profiles` το διαβάζει **ανώνυμος** επισκέπτης
    // (`firestore.rules:1079` → `allow read: if true`), οπότε ένα πεδίο που λείπει
    // από παλιό αποθηκευμένο έγγραφο βγαίνει **λευκή σελίδα σε δημόσια οθόνη**.
    adr: 'ADR-827 §9 · ADR-841 Α21.1',
    typeName: 'PublicShowcase',
    custodian: 'src/lib/agency/showcase-read.ts',
    module: 'showcase-read',
    remedy: '«readShowcase(raw, companyId)»',
  },
  {
    // 🔴 ADR-864 Α15 — Η ΤΕΤΑΡΤΗ ΓΡΑΜΜΗ, ΚΑΙ ΤΗ ΓΕΝΝΗΣΕ ΤΥΦΛΟ ΣΗΜΕΙΟ **ΑΥΤΗΣ** ΤΗΣ ΠΥΛΗΣ.
    //
    // Το Κ1 ψάχνει κατά λέξη `as <TypeName>` — και η μηχανή ανάγνωσης των «δικών μου»
    // (`services/realtime/hooks/useOwnedDocuments.ts`) έγραφε **`as T`**, γενικό. Δηλαδή
    // η πύλη ήταν πράσινη επειδή **δεν μπορούσε να δει την πόρτα**, όχι επειδή ήταν
    // κλειστή: το σχήμα «0 = κανείς δεν κοίταξε», μέσα στην ίδια την πύλη που το
    // κυνηγά. Μετρημένο τίμημα στην παραγωγή (2026-09-16): **7 στις 7** καταχωρήσεις
    // τύπωναν ωμό κλειδί, η οθόνη έλεγε «κλειστή διάθεση» για δημόσια αγγελία, και η
    // επιβεβαίωση πριν το στένεμα κοινού **έπαψε να ρωτά**.
    //
    // 🔑 Η θεραπεία του **γενικού** δεν είναι regex — είναι **τύπος**: το
    // `OwnedCollectionSpec<T>` απαιτεί πλέον `fromDocument`. Αυτή η γραμμή φυλάει το
    // **υπόλοιπο** της κλάσης: ωμό `as PropertyDemand` οπουδήποτε αλλού στο repo.
    adr: 'ADR-864 Α15',
    typeName: 'PropertyDemand',
    custodian: 'src/lib/demand/property-demand-from-document.ts',
    module: 'property-demand-from-document',
    remedy: '«readStoredDemand(raw, id)» ή «propertyDemandFromDocument(raw, id)»',
  },
  {
    // 🔴 ADR-862 Φ0 Β1 — Η ΠΕΜΠΤΗ ΓΡΑΜΜΗ, ΚΑΙ Η ΠΡΩΤΗ ΠΟΥ ΦΥΛΑΕΙ **ΟΡΑΤΟΤΗΤΑ**, ΟΧΙ ΟΘΟΝΗ.
    //
    // Τα τέσσερα προηγούμενα σύνορα φυλάνε **οθόνη**: πεδίο που λείπει ⇒ λευκή σελίδα.
    // Εδώ πεδίο που λείπει δίνει **ΟΡΑΤΟΤΗΤΑ**:
    //     `cdeState === undefined` διαβασμένο ως `'WIP'`       ⇒ κρύβει εγκεκριμένο σχέδιο
    //     `cdeState === undefined` διαβασμένο ως `'PUBLISHED'` ⇒ δείχνει ημιτελή μελέτη
    //                                                            στο **συνεργείο**
    // Το ωμό `as FileRecord` επιτρέπει **και τα δύο**.
    //
    // ⚠️ **ΔΗΛΩΜΕΝΗ ΕΚΠΤΩΣΗ — αυτή η γραμμή είναι ΣΤΕΝΟΤΕΡΗ από τις άλλες τέσσερις.**
    // Το `claims: 'document'` εξαιρεί τον ισχυρισμό πάνω σε **κατασκευή**
    // (`{ … } as unknown as FileRecord`), γιατί εκεί ο μεταγλωττιστής είδε τα πεδία
    // **ένα προς ένα** — δεν είναι **ανάγνωση** αποθηκευμένου εγγράφου, που είναι η
    // ερώτηση αυτής της πύλης. Μετρημένο κόστος της εξαίρεσης: **2** σημεία
    // (`DxfPreview.tsx:49`, `useFloorplanFiles.ts:179`), και τα δύο κατασκευές για
    // προεπισκόπηση. Κόστος του να ΜΗΝ υπάρχει: δύο ψευδώς θετικά σε μπλοκάρουσα
    // πύλη ⇒ διδάσκει να την παρακάμπτουν.
    adr: 'ADR-862 Φ0 Β1',
    typeName: 'FileRecord',
    custodian: 'src/lib/files/file-record-read.ts',
    module: 'file-record-read',
    claims: 'document',
    remedy:
      '«readFileRecord(raw, fileId)» για ΜΕΤΑΛΛΑΞΗ (fail-closed) ή ' +
      '«normalizeFileRecord(raw, fileId)» για ΛΙΣΤΕΣ (καμία αλλαγή ορατότητας)',
  },
  {
    // 🔴 ADR-862 Φ0 Β7 — Η ΕΚΤΗ ΓΡΑΜΜΗ: **η ομάδα ΕΙΝΑΙ εξουσιοδότηση**.
    //
    // Το `ProjectMember` δεν είναι έγγραφο προβολής: απαντά *«τίνος είναι αυτό;»* και
    // *«τι επιτρέπεται;»*. Ωμό `as ProjectMember` υπόσχεται `PermissionId[]` για πίνακα
    // που ήρθε από τη βάση χωρίς κανέναν έλεγχο — δηλαδή **εξουσιοδότηση που κανείς
    // δεν υπέγραψε**.
    //
    // ✅ Μπαίνει με **Κ1 = 0 χωρίς καμία εργασία** (μετρημένο 2026-09-16: οι μόνες δύο
    // εμφανίσεις είναι **σχόλιο** μέσα στον ίδιο τον θεματοφύλακα και μία άγκυρα).
    // Γραμμή που μπαίνει καθαρή δεν είναι διακοσμητική — είναι **κλείδωμα**: από εδώ
    // και πέρα η επόμενη εμφάνιση κοκκινίζει στο `git add`.
    adr: 'ADR-862 Φ0 Β7',
    typeName: 'ProjectMember',
    custodian: 'src/lib/auth/project-member-read.ts',
    module: 'project-member-read',
    remedy: '«readProjectMember(query)» ή «normalizeProjectMember(…)»',
  },
  // ADR-835 §20 — το ημερολόγιο καταλύματος. ΑΥΣΤΗΡΟ σύνορο: ό,τι δεν διαβάζεται ΔΕΝ
  // μπορεί να γίνει «ελεύθερο» — ωμό `as StayBooking` θα έβαζε στον κριτή διάστημα που
  // δεν ελέγχθηκε, δηλαδή σιωπηλό overbooking (§6.4).
  {
    adr: 'ADR-835 §20',
    typeName: 'StayBooking',
    custodian: 'src/lib/stay/stay-calendar-from-document.ts',
    module: 'stay-calendar-from-document',
    remedy: '«stayBookingFromDocument(raw, id)»',
  },
  {
    adr: 'ADR-835 §20',
    typeName: 'StayBlock',
    custodian: 'src/lib/stay/stay-calendar-from-document.ts',
    module: 'stay-calendar-from-document',
    remedy: '«stayBlockFromDocument(raw, id)»',
  },
  {
    adr: 'ADR-835 §20',
    typeName: 'StayCalendarHead',
    custodian: 'src/lib/stay/stay-calendar-from-document.ts',
    module: 'stay-calendar-from-document',
    remedy: '«stayCalendarHeadFromDocument(raw, propertyId)»',
  },
  {
    adr: 'ADR-835 §21',
    typeName: 'StayCalendarMonth',
    custodian: 'src/lib/stay/stay-calendar-from-document.ts',
    module: 'stay-calendar-from-document',
    remedy: '«stayCalendarMonthFromDocument(raw, id)»',
  },
];

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

// ---------------------------------------------------------------------------
// Η ΜΗΧΑΝΗ — ΦΑΣΗ Α: ΦΘΗΝΟ ΠΡΟ-ΦΙΛΤΡΟ ΚΕΙΜΕΝΟΥ
// ---------------------------------------------------------------------------

/**
 * Το κείμενο που **μπορεί** να περιέχει ισχυρισμό προς `typeName`.
 *
 * ⚠️ Δεν αποφασίζει — **φιλτράρει**. Ο ισχυρισμός μέσα σε σχόλιο περνά από εδώ και
 * πέφτει στη Φάση Β, όπου τα σχόλια είναι δομικά αόρατα.
 */
const assertionOf = (typeName) => new RegExp(`\\bas\\s+${typeName}\\b`);

/** Το κείμενο που **μπορεί** να δηλώνει εισαγωγή του θεματοφύλακα. */
const importOf = (module) => new RegExp(`from\\s+['"][^'"]*${module}['"]`);

// ---------------------------------------------------------------------------
// Η ΜΗΧΑΝΗ — ΦΑΣΗ Β: AST
// ---------------------------------------------------------------------------

/**
 * ⚠️ **Το `ScriptKind` ΔΕΝ είναι λεπτομέρεια.** Χωρίς `TSX` σε αρχείο `.tsx` ο
 * αναλυτής διαβάζει το `<Foo>` ως **ισχυρισμό τύπου** και το δέντρο βγαίνει άλλο —
 * δηλαδή η πύλη θα έκρινε κώδικα που δεν υπάρχει.
 */
const scriptKindOf = (rel) => (rel.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);

/**
 * Ξετυλίγει τα **εμφωλευμένα** `as` για να φανεί *τι* ισχυρίζεται ο ισχυρισμός:
 * στο `{…} as unknown as FileRecord` το ζητούμενο είναι το object literal, όχι το
 * ενδιάμεσο `unknown`.
 */
function assertedExpression(node) {
  let inner = node.expression;
  while (ts.isAsExpression(inner)) inner = inner.expression;
  return inner;
}

/**
 * **Όλοι** οι ισχυρισμοί και **όλες** οι εισαγωγές ενός αρχείου, με μία ανάλυση.
 *
 * 🔑 Ουδέτερο ως προς τα σύνορα επίτηδες: το ποιο σύνορο ενδιαφέρεται το κρίνει ο
 * {@link isOffence}. Έτσι ένα αρχείο αναλύεται **μία φορά** όσες γραμμές κι αν έχει ο
 * πίνακας.
 */
function readAssertionsAndImports(rel, source) {
  const sf = ts.createSourceFile(rel, source, ts.ScriptTarget.Latest, true, scriptKindOf(rel));
  const assertions = [];
  const imports = [];

  function visit(node) {
    if (
      ts.isAsExpression(node) &&
      // 🔑 **ΚΡΙΤΗΡΙΟ 1 — ΣΚΕΤΗ ΑΝΑΦΟΡΑ ΤΥΠΟΥ, ΚΑΜΙΑ ΑΠΟΔΥΝΑΜΩΣΗ.**
      //    `X[]` (ArrayType) · `X['f']` (IndexedAccess) · `X & {…}` (Intersection) ·
      //    `Foo.X` (QualifiedName) είναι **εκφράσεις τύπου ΓΙΑ** το X — ποτέ
      //    ισχυρισμός «αυτό το αποθηκευμένο έγγραφο **είναι** X».
      ts.isTypeReferenceNode(node.type) &&
      ts.isIdentifier(node.type.typeName)
    ) {
      assertions.push({
        typeName: node.type.typeName.text,
        line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
        constructed: ts.isObjectLiteralExpression(assertedExpression(node)),
      });
    }
    // Το `export { x } from '…'` μετράει όσο και το `import` — και τα δύο δηλώνουν
    // ότι κάποιος **ζητά** τον θεματοφύλακα.
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      imports.push(node.moduleSpecifier.text);
    }
    ts.forEachChild(node, visit);
  }

  visit(sf);
  return { assertions, imports };
}

/**
 * «Είναι **αυτός** ο ισχυρισμός παράβαση **αυτού** του συνόρου;»
 *
 * ⚠️ Το `claims: 'document'` είναι **δηλωμένη έκπτωση** (δες τη γραμμή `FileRecord`):
 * κατασκευή που ο μεταγλωττιστής είδε πεδίο-πεδίο **δεν είναι ανάγνωση**.
 */
function isOffence(assertion, boundary) {
  if (assertion.typeName !== boundary.typeName) return false;
  if (boundary.claims === 'document' && assertion.constructed) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Η ΜΙΑ ΣΑΡΩΣΗ — Κ1 ΚΑΙ Κ2 ΜΑΖΙ, ΕΝΑ ΠΕΡΑΣΜΑ
// ---------------------------------------------------------------------------

/**
 * **Η μηχανή.** Ένα πέρασμα στα αρχεία· ανάλυση AST **μόνο** όπου χτύπησε το προ-φίλτρο.
 *
 * @returns {Map<string, {k1: {file: string, line: number}[], consumers: string[]}>}
 *          κλειδί = `typeName` της γραμμής.
 */
function scanFiles(files, root = PROJECT_ROOT, boundaries = BOUNDARIES) {
  const lanes = boundaries.map((boundary) => ({
    boundary,
    assertion: assertionOf(boundary.typeName),
    imported: importOf(boundary.module),
    result: { k1: [], consumers: [] },
  }));
  const byType = new Map(lanes.map((lane) => [lane.boundary.typeName, lane.result]));

  for (const rel of files) {
    if (isExempt(rel)) continue;

    const source = fs.readFileSync(path.join(root, rel), 'utf8');
    const interested = lanes.filter(
      (lane) =>
        rel !== lane.boundary.custodian &&
        (lane.assertion.test(source) || lane.imported.test(source))
    );
    if (interested.length === 0) continue;

    const { assertions, imports } = readAssertionsAndImports(rel, source);

    for (const lane of interested) {
      for (const assertion of assertions) {
        if (isOffence(assertion, lane.boundary)) {
          lane.result.k1.push({ file: rel, line: assertion.line });
        }
      }
      if (imports.some((specifier) => specifier.endsWith(lane.boundary.module))) {
        lane.result.consumers.push(rel);
      }
    }
  }

  return byType;
}

// ---------------------------------------------------------------------------
// Κ1 — ο ισχυρισμός ζει σε ΕΝΑ σπίτι
// Κ2 — ο παρονομαστής: το σύνορο έχει καταναλωτές
//
// ⚠️ **ΛΕΠΤΑ ΠΕΡΙΤΥΛΙΓΜΑΤΑ, ΟΧΙ ΔΕΥΤΕΡΗ ΥΛΟΠΟΙΗΣΗ.** Οι άγκυρες τα καλούν — άρα
//    δοκιμάζουν **αυτό που τρέχει** στην παραγωγή. Δεύτερη μηχανή «για τα tests»
//    είναι ακριβώς ο δεύτερος κριτής που το ADR-749 τιμωρεί.
// ---------------------------------------------------------------------------

function measureK1(files, root = PROJECT_ROOT, boundary = BOUNDARIES[0]) {
  return scanFiles(files, root, [boundary]).get(boundary.typeName).k1;
}

/**
 * Ποιοι **παραγωγικοί** καταναλωτές ζητούν τη μετάφραση.
 *
 * Επιστρέφει τη λίστα (όχι απλώς πλήθος) ώστε η αναφορά να λέει **ποιοι** — μια
 * πύλη που λέει μόνο «0» αφήνει τον άνθρωπο να ψάχνει τι έσπασε.
 */
function measureK2(files, root = PROJECT_ROOT, boundary = BOUNDARIES[0]) {
  return scanFiles(files, root, [boundary]).get(boundary.typeName).consumers;
}

// ---------------------------------------------------------------------------

function main() {
  if (process.env.SKIP_LISTING_READ_BOUNDARY === '1') {
    console.log(`${DIM}  ⏭️  CHECK 3.74 — παρακάμφθηκε (SKIP_LISTING_READ_BOUNDARY=1)${NC}`);
    return 0;
  }

  const files = collectSourceFiles(SRC);
  const missing = BOUNDARIES.filter(
    (boundary) => !fs.existsSync(path.join(PROJECT_ROOT, boundary.custodian))
  );
  for (const boundary of missing) {
    console.error(`${RED}❌ CHECK 3.74 — λείπει το ίδιο το σύνορο: ${boundary.custodian}${NC}`);
  }

  const present = BOUNDARIES.filter((boundary) => !missing.includes(boundary));
  const measured = scanFiles(files, PROJECT_ROOT, present);
  let failed = missing.length > 0;

  for (const boundary of present) {
    const { k1, consumers } = measured.get(boundary.typeName);

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
  scanFiles,
  measureK1,
  measureK2,
  collectSourceFiles,
  BOUNDARIES,
  CUSTODIAN,
  CUSTODIAN_MODULE,
};
