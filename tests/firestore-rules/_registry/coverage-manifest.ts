/**
 * Firestore Rules Test Coverage — SSoT Manifest
 *
 * Single source of truth for *which* (collection × persona × operation)
 * cells must be exercised by the rules unit test suite. CHECK 3.16 reads
 * this file, walks firestore.rules, and blocks commits where the manifest
 * and the test files or the rules file have drifted.
 *
 * See ADR-298 §3.2 and §3.4.
 *
 * Contract:
 *   - Every top-level `match /xxx/{id}` block in firestore.rules MUST be
 *     either (a) present in FIRESTORE_RULES_COVERAGE with a matching test
 *     file, or (b) explicitly listed in FIRESTORE_RULES_PENDING.
 *   - Every FIRESTORE_RULES_COVERAGE entry MUST have a test file at its
 *     `testFile` path with a `COVERAGE` export matching this manifest.
 *   - Every matrix cell MUST have a matching `describe('<persona> × <op>')`
 *     block in the corresponding test file.
 *
 * Zero-tolerance: CHECK 3.16 is not a ratchet. The pending list exists only
 * to stage the Phase B/C migration of ~90 legacy collections.
 *
 * @module tests/firestore-rules/_registry/coverage-manifest
 * @since 2026-04-11 (ADR-298 Phase A)
 */

import type { Exemption } from './coverage-completeness';
import { overrideDefinition } from './coverage-completeness';
import type { Operation, Outcome, Reason } from './operations';
import type { Persona } from './personas';
import {
  adminWriteOnlyMatrix,
  attendanceEventMatrix,
  cell,
  crmDirectMatrix,
  immutableMatrix,
  publicWorldMatrix,
  roleDualMatrix,
  tenantDirectMatrix,
  tenantStateMachineMatrix,
} from './coverage-matrices';
import {
  accountingSettingsMatrix,
  accountingSingletonMatrix,
  accountingSystemCalcMatrix,
  denyAllMatrix,
  fiscalPeriodMatrix,
} from './coverage-matrices-accounting';
import {
  countersMatrix,
  systemAdminGlobalMatrix,
  systemGlobalMatrix,
  tasksMatrix,
} from './coverage-matrices-system';
import {
  bimAuthoringMatrix,
  bimPresentationMatrix,
  blockLibraryMatrix,
  cadFilesMatrix,
  fileApprovalsMatrix,
  fileAuditLogMatrix,
  fileCommentsMatrix,
  fileSharesMatrix,
  fileTenantFullMatrix,
  legacyFloorplanMatrix,
  photoSharesMatrix,
  textTemplateMatrix,
} from './coverage-matrices-dxf';
import {
  boqCategoriesMatrix,
  brokerageMatrix,
  commissionRecordsMatrix,
  ownershipTablesMatrix,
} from './coverage-matrices-boq';
import {
  authorOwnedMatrix,
  serverWrittenAuthorOwnedMatrix,
  personalFileMatrix,
  companiesMatrix,
  ownerOnlyMatrix,
  usersMatrix,
} from './coverage-matrices-users';
import {
  auditLogMatrix,
  contactRelationshipsMatrix,
  contactLinksMatrix,
  titleBlockBindingsMatrix,
  employmentRecordsMatrix,
  notificationsMatrix,
  searchDocumentsMatrix,
  voiceCommandsMatrix,
} from './coverage-matrices-specialized';
import {
  networkServerOnlyMatrix,
  networkThreadMatrix,
} from './coverage-matrices-network';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Architectural classification of a rules block. */
export type RulesPattern =
  | 'tenant_direct'        // companyId field lives on the document
  | 'tenant_crossdoc'      // companyId resolved via parent document lookup
  | 'tenant_dual_path'     // reads accept EITHER direct companyId OR crossdoc projectId
  | 'immutable'            // append-only audit trail, update/delete deny
  | 'admin_write_only'     // tenant-scoped reads, all client writes denied (Admin SDK only)
  | 'tenant_state_machine' // tenant-scoped + state-machine-gated writes (files lifecycle)
  | 'ownership'            // ownerId == request.auth.uid
  | 'system_global'        // read-only for every authenticated user
  | 'public_world'         // ADR-777 επίπεδο Α — read για ΟΛΟΥΣ (και ανώνυμο)· κάθε εγγραφή πελάτη deny.
                           // ⚠️ ΔΕΝ είναι `system_global`: εκείνο απαιτεί ΠΙΣΤΟΠΟΙΗΣΗ. Εδώ ο ανώνυμος
                           // ΠΡΕΠΕΙ να διαβάζει — ο επισκέπτης που ψάχνει στον χάρτη δεν έχει λογαριασμό.
  | 'role_dual'            // user-created vs system-generated split
  | 'field_allowlist'      // update restricted to a set of allowed fields
  | 'deny_all'             // allow read,write: if false — no client access (Admin SDK only)
  | 'tenant_admin_write'   // tenant-scoped reads, writes restricted to company_admin / super_admin
  | 'bim_authoring'        // ADR-657 AUTHORING tier — read+write = internal-user-of-company; external_user denied all
  | 'bim_presentation'     // ADR-657 PRESENTATION tier — read tenant-wide (incl. external_user); write = internal-user-of-company
  | 'audience_gated';      // ADR-867 §4.2 — η ανάγνωση κρίνεται από ΥΠΟΣΥΛΛΟΓΗ ΑΚΡΟΑΤΗΡΙΟΥ
                           // (`exists(.../network_audience/{uid}) && until == null`), ΟΧΙ από πεδίο
                           // του εγγράφου. ⚠️ ΔΕΝ είναι `ownership` (οι αναγνώστες είναι ΠΟΛΛΟΙ και
                           // ΑΛΛΑΖΟΥΝ) ούτε `tenant_direct` (οι δύο πλευρές είναι σε ΔΙΑΦΟΡΕΤΙΚΟΥΣ
                           // χώρους — ένα `belongsToCompany` θα άνοιγε το νήμα σε ΟΛΟ το γραφείο,
                           // ρητά απαγορευμένο από το ADR-834 §5 Β (γ) ①).

/** One (persona × operation) cell of a collection's coverage matrix. */
export interface CoverageCell {
  readonly persona: Persona;
  readonly operation: Operation;
  readonly outcome: Outcome;
  /** Optional failure reason — enables assert-on-intent, not just assert-on-outcome. */
  readonly reason?: Reason;
}

/** Full coverage declaration for a single top-level collection. */
export interface CollectionCoverage {
  /** Physical collection name — must match `match /<name>/{id}` in firestore.rules. */
  readonly collection: string;
  readonly pattern: RulesPattern;
  /** Expected matrix (deny- and allow-cells, in any order). */
  readonly matrix: readonly CoverageCell[];
  /**
   * Κελιά που **ομολογούνται ως ανοιχτά**, με λόγο / ιδιοκτήτη / ημερομηνία
   * επανεξέτασης. Το `matrix.length + exemptions.length` είναι **πάντα 35** —
   * το επιβάλλει η `defineMatrix()` σε χρόνο φόρτωσης και το ρωτά η CHECK 3.16
   * (Validation G). Δες `coverage-completeness.ts`.
   *
   * ⚠️ **ΜΗΝ το γεμίσεις με το χέρι σε μια εγγραφή.** Οι εξαιρέσεις έρχονται
   * μαζί με το πρότυπο (`...tenantDirectMatrix()`), γιατί το κενό ήταν **ανά
   * πρότυπο**, όχι ανά συλλογή: **μετρημένο 2026-09-08** — και τα 14 `deny_all`
   * ήταν στο 15/35, και τα 18 `role_dual` στο 25/35, και τα 9
   * `bim_presentation` στο 35/35. Μια συλλογή που **ξέρει** ένα κελί το δηλώνει
   * με `overrideDefinition()`, και η εξαίρεση φεύγει **μόνη της**.
   */
  readonly exemptions: readonly Exemption[];
  /** Path to the test file, relative to repo root. */
  readonly testFile: string;
  /** For `tenant_crossdoc` and field_allowlist patterns — parent docs that must be seeded first. */
  readonly seedDependencies?: readonly string[];

  // -------------------------------------------------------------------------
  // ⛔ ΕΔΩ ΖΟΥΣΕ ΤΟ `rulesRange` — ΑΦΑΙΡΕΘΗΚΕ, ΚΑΙ ΜΗΝ ΤΟ ΞΑΝΑΒΑΛΕΙΣ
  // -------------------------------------------------------------------------
  //
  // 🔴 **Ήταν εύρος γραμμών του `firestore.rules` που ΚΑΝΕΙΣ δεν συνέκρινε ποτέ.** Το
  //    CHECK 3.16 το διάβαζε με AST και το πετούσε· η αντιστοίχιση γίνεται —και γινόταν
  //    πάντα— κατά **ΤΑΥΤΟΤΗΤΑ** (`collection` ↔ `match /<collection>/`).
  //
  // 📊 **Μετρημένο 2026-09-08**: **122 από τις 124** εγγραφές έδειχναν σε λάθος γραμμή,
  //    με αποκλίσεις ως **+44** — το **98%**. Διορθώθηκαν όλες με το χέρι, και θα είχαν
  //    ξαναπαλιώσει με την **πρώτη** γραμμή που θα έμπαινε πάνω τους.
  //
  // 🔴 **ΤΟ ΙΔΙΟ ΕΙΧΕ ΗΔΗ ΣΥΜΒΕΙ ΔΙΠΛΑ, ΚΑΙ ΕΙΧΕ ΚΡΙΘΕΙ** *(ADR-657 §3.3, storage)*:
  //    *«κάθε γραμμή που προστίθεται ΠΑΝΩ από ένα block ξεκάρφωνε σιωπηλά όλα τα
  //    επόμενα — έσπασε ήδη στο `964fd03e`»*. Εκεί η θεραπεία ήταν `// @pathId:`
  //    annotation: **η ταυτότητα ταξιδεύει με τον κώδικα**.
  //
  // 🏆 **ΚΑΙ ΕΙΝΑΙ Η ΠΡΑΚΤΙΚΗ ΤΩΝ ΜΕΓΑΛΩΝ, ΕΠΑΛΗΘΕΥΜΕΝΗ**: το **PHPStan baseline**
  //    δηλώνει ρητά *«No line numbers»* ως συνειδητή απόφαση, και το **ESLint bulk
  //    suppressions** (v9.24+) αποθηκεύει `{αρχείο: {κανόνας: {count}}}` — **καμία
  //    γραμμή**. Και τα δύο για τον ίδιο λόγο: οι γραμμές αλλάζουν, οι ταυτότητες όχι.
  //
  // ⇒ **Ο δείκτης δεν χάθηκε — έγινε ΠΑΡΑΓΟΜΕΝΟΣ**, άρα πάντα σωστός:
  //    `node scripts/check-firestore-rules-test-coverage.js --all --map`
}

// ---------------------------------------------------------------------------
// The registry
// ---------------------------------------------------------------------------
//
// Matrix builders (tenantDirectMatrix, immutableMatrix, etc.) and the cell /
// overrideDefinition lives in `./coverage-completeness`. The split keeps this
// module focused on *what is covered* (the registry) while the matrix
// module owns *what a pattern looks like*. Extracted 2026-04-11 when this
// file outgrew the 500-line Google SRP limit — see ADR-298 §8 Phase B.1.

/**
 * Collections with complete test coverage.
 *
 * Phase A ships 6 entries. Phase B/C move collections from
 * `FIRESTORE_RULES_PENDING` into this array incrementally.
 */
export const FIRESTORE_RULES_COVERAGE: readonly CollectionCoverage[] = [
  {
    // ADR-777 Α1 — Η ΓΗ. Το μόνο πράγμα που κρατά θέση, κοινό σε όλους.
    collection: 'public_lands',
    pattern: 'public_world',
    testFile: 'tests/firestore-rules/suites/public-lands.rules.test.ts',
    ...publicWorldMatrix(),
  },
  {
    // ADR-777 Α11 — «Το κτίριο του κόσμου». Μία ταυτότητα ανά φυσικό κτίριο.
    collection: 'public_buildings',
    pattern: 'public_world',
    testFile: 'tests/firestore-rules/suites/public-buildings.rules.test.ts',
    ...publicWorldMatrix(),
  },
  {
    // ADR-777 Α3/Α5/Α20 — Η ΠΡΟΒΟΛΗ της αγγελίας προς τον κόσμο.
    //
    // ⚠️ Ίδιο ΣΧΗΜΑ κανόνα με το `public_world` (read: true / write: false), αλλά
    // ΔΙΑΦΟΡΕΤΙΚΗ κατηγορία στο `tenant-config.ts` (`published-projection`): η γη
    // υπάρχει ακόμη κι αν σβήσουν όλοι οι λογαριασμοί· η αγγελία σβήνει μαζί με την
    // απόσυρσή της. Ο πίνακας είναι ο ίδιος επειδή το **ερώτημα ασφαλείας** είναι το
    // ίδιο — όχι επειδή τα δύο πράγματα είναι το ίδιο.
    collection: 'public_listings',
    pattern: 'public_world',
    testFile: 'tests/firestore-rules/suites/public-listings.rules.test.ts',
    ...publicWorldMatrix(),
  },
  {
    // ADR-827 §9 — Η ΒΙΤΡΙΝΑ ΤΟΥ ΓΡΑΦΕΙΟΥ. **Ίδιος πίνακας με το `public_listings`,
    // ΔΙΑΦΟΡΕΤΙΚΟ ερώτημα ασφαλείας** — και η διαφορά είναι ο λόγος που υπάρχει
    // ξεχωριστή σουίτα αντί για δεύτερη γραμμή δίπλα στην προηγούμενη.
    //
    // 🔴 Εκεί το ερώτημα είναι *«διαρρέει ταυτότητα ΠΕΛΑΤΗ;»*. Εδώ η ταυτότητα του
    // **οργανισμού** ΕΙΝΑΙ το περιεχόμενο — άρα το ερώτημα αντιστρέφεται:
    // *«μπορεί η σάρωση να μάθει γραφείο που ΔΕΝ δημοσιεύτηκε;»*. Ένας πίνακας
    // personas απαντά **και στα δύο** «ο ανώνυμος διαβάζει», δηλαδή θα ήταν πράσινος
    // πάνω και στις δύο διαρροές. Γι' αυτό η σουίτα προσθέτει άγκυρα **πληθυσμού**
    // (opt-in) και άγκυρα **σχήματος** (καμία αμοιβή, κανένα κανάλι, κανένα πρόσωπο).
    collection: 'agency_profiles',
    pattern: 'public_world',
    testFile: 'tests/firestore-rules/suites/agency-profiles.rules.test.ts',
    ...publicWorldMatrix(),
  },
  {
    // ADR-827 §8.7 — ΤΟ ΑΙΤΗΜΑ ΑΝΑΘΕΣΗΣ. **Το ακριβώς αντίθετο της παραπάνω.**
    //
    // 🔴 `denyAllMatrix` — και το κελί που έχει σημασία είναι ΤΟΥ ΠΑΡΑΛΗΠΤΗ: το
    // γραφείο στο οποίο απευθύνεται το αίτημα **δεν** το διαβάζει. Δεν είναι
    // αυστηρότητα· είναι ότι το έγγραφο περιέχει `requestedByUserId` και το Firestore
    // δεν φιλτράρει πεδία στην ανάγνωση (§8.2). Το γραφείο παίρνει
    // `MandateRequestForAgency`, σχήμα **χωρίς πεδίο ταυτότητας**.
    //
    // ⚠️ Ούτε ο ίδιος ο ιδιώτης διαβάζει: η οθόνη του ρωτά «τι έχει φτάσει;», και η
    // απάντηση (`disclosedTo`) οφείλει να τρέχει στην ΙΔΙΑ πλευρά με τον συνθέτη της
    // προβολής — αλλιώς δύο πηγές που μπορούν να διαφωνήσουν (§8.6).
    collection: 'mandate_requests',
    pattern: 'deny_all',
    testFile: 'tests/firestore-rules/suites/mandate-requests.rules.test.ts',
    ...denyAllMatrix(),
  },
  {
    // 🏆 ADR-841 §7 Α21.12 — Η ΠΡΟΕΛΕΥΣΗ ΤΟΥ ΣΗΜΑΤΟΣ. **Τέταρτο `deny_all` της
    // οικογένειας, ΤΕΤΑΡΤΟΣ λόγος** — και δεν είναι ούτε ιδιωτικότητα προσώπου
    // (`mreq`), ούτε αυθεντία γραφέα (`fcon`), ούτε μυστικό εξαργύρωσης (`fcinv`).
    //
    // 🔴 ΕΙΝΑΙ ΤΟ ΜΟΝΟ ΕΓΓΡΑΦΟ ΠΟΥ ΚΡΑΤΑ **ΤΗΝ ΕΣΩΤΕΡΙΚΗ ΔΟΜΗ ΑΠΟΘΗΚΕΥΣΗΣ ΜΑΣ**:
    // `companies/{id}/entities/{fileId}/…`. Το `showcase-mark-custody` το δηλώνει
    // γραπτώς — *«το `privateStoragePath` δεν επιστρέφει ΠΟΤΕ, και δεν επιτρέπεται να
    // επιστρέψει: θα έδειχνε την εσωτερική δομή αποθήκευσης σε κάθε ανώνυμο επισκέπτη»*.
    // Ανάγνωση εδώ ανατρέπει **την ίδια απόφαση από την πίσω πόρτα**.
    //
    // ⚠️ ΚΑΙ Η ΓΡΑΦΗ ΚΛΕΙΣΤΗ, με **δικό της** λόγο: το μονοπάτι είναι η απόδειξη
    // προέλευσης που διαβάζει η μαζική επαναδημοσίευση. Πελάτης που το γράφει θα
    // έδειχνε σε **ξένο** αρχείο και θα το δημοσίευε ως σήμα του στην επόμενη σάρωση —
    // δηλαδή ο φρουρός `markSourceForCompany` θα παρακάμπτονταν **αναδρομικά**, χωρίς
    // κανένα αίτημα να έχει περάσει ποτέ από αυτόν.
    //
    // ⚠️ Η άγκυρα που **δεν** είναι πίνακας personas ζει στη σουίτα: ο πειρασμός εδώ
    // είναι ο **ιδιοκτησιακός** *(«μα είναι το ΔΙΚΟ του σήμα!»)*, και ο `denyAllMatrix`
    // θα περνούσε χωρίς σπαρμένο έγγραφο του **ίδιου** μισθωτή.
    collection: 'showcase_mark_sources',
    pattern: 'deny_all',
    testFile: 'tests/firestore-rules/suites/showcase-mark-sources.rules.test.ts',
    ...denyAllMatrix(),
  },
  {
    // ADR-841 §7 Α21.16 — ΤΑ ΚΑΝΑΛΙΑ ΤΗΣ ΚΑΡΤΑΣ. Ίδιο ζεύγος με το `showcase_mark_sources`,
    // ίδιος πειρασμός *(«μα είναι τα ΔΙΚΑ του τηλέφωνα!»)* — γι' αυτό η σουίτα σπέρνει
    // έγγραφο του **ίδιου** μισθωτή. Ο λόγος του `deny_all`: το `agency_profiles` κατεβαίνει
    // ολόκληρο σε κάθε ανώνυμο, οπότε τα κανάλια ζουν εδώ και φεύγουν μόνο από τον διακομιστή,
    // ένα κατάστημα τη φορά, με όριο ρυθμού.
    collection: 'showcase_card_channels',
    pattern: 'deny_all',
    testFile: 'tests/firestore-rules/suites/showcase-card-channels.rules.test.ts',
    ...denyAllMatrix(),
  },
  {
    // ADR-841 §7 Α21.18 — ΤΑ ΑΙΤΗΜΑΤΑ ΕΠΙΒΕΒΑΙΩΣΗΣ EMAIL ΤΗΣ ΚΑΡΤΑΣ. Κρατούν διεύθυνση + nonce
    // συνδέσμου· ο πειρασμός είναι ο ιδιοκτήτης να «δει την κατάσταση» απευθείας ή να γράψει
    // `redeemed` μόνος του. Η σουίτα σπέρνει αίτημα του **ίδιου** μισθωτή.
    collection: 'showcase_email_confirmations',
    pattern: 'deny_all',
    testFile: 'tests/firestore-rules/suites/showcase-email-confirmations.rules.test.ts',
    ...denyAllMatrix(),
  },
  {
    // ADR-841 §7 Α21.21 Φάση Β — ΟΙ ΕΡΩΤΗΣΕΙΣ ΑΡΓΙΩΝ. Κρατούν `nonce` συνδέσμων· ο πειρασμός είναι ο
    // διαχειριστής να «δει» ή να «απαντήσει» απευθείας. Η σουίτα σπέρνει ερώτηση του **ίδιου** μισθωτή.
    collection: 'holiday_hours_questions',
    pattern: 'deny_all',
    testFile: 'tests/firestore-rules/suites/holiday-hours-questions.rules.test.ts',
    ...denyAllMatrix(),
  },
  {
    // ADR-841 §7 Α21.20 — ΤΟ ΗΜΕΡΟΛΟΓΙΟ ΣΥΜΒΑΝΤΩΝ ΠΑΡΑΔΟΣΗΣ. Διευθύνσεις όλης της πλατφόρμας· ο πειρασμός
    // είναι πελάτης να **γράψει** ψεύτικο bounce και να σβήσει ξένο σήμα. Η σουίτα σπέρνει συμβάν.
    collection: 'email_delivery_events',
    pattern: 'deny_all',
    testFile: 'tests/firestore-rules/suites/email-delivery-events.rules.test.ts',
    ...denyAllMatrix(),
  },
  {
    // ADR-841 §7 Α21.20 — ΚΑΤΑΣΤΑΣΗ ΑΝΑ ΔΙΕΥΘΥΝΣΗ. Γεγονός του κόσμου, όχι μισθωτή· γράφει μόνο το webhook.
    collection: 'email_recipient_standing',
    pattern: 'deny_all',
    testFile: 'tests/firestore-rules/suites/email-recipient-standing.rules.test.ts',
    ...denyAllMatrix(),
  },
  {
    // ADR-841 §7 Α23 — ΤΙ ΑΠΑΝΤΗΣΕ ΤΟ ΓΕΜΗ. Ο πειρασμός εδώ είναι ο πιο επικίνδυνος της
    // οικογένειας: ο ιδιοκτήτης να **γράψει** μόνος του την απάντηση της αρχής, δηλαδή σήμα
    // «επαληθευμένη από ΓΕΜΗ» χωρίς ερώτηση. Η σουίτα σπέρνει έγγραφο του **ίδιου** μισθωτή.
    collection: 'company_registry_records',
    pattern: 'deny_all',
    testFile: 'tests/firestore-rules/suites/company-registry-records.rules.test.ts',
    ...denyAllMatrix(),
  },
  {
    // ADR-843 — Η ΠΡΑΞΗ ΤΗΣ ΠΡΩΤΗΣ ΕΠΑΦΗΣ. **Ίδιο ζεύγος με το `mandate_requests`
    // από πάνω, ΑΝΤΙΣΤΡΟΦΟΣ λόγος** — και η αντιστροφή είναι το πράγμα που πρέπει
    // να διαβαστεί, γιατί αλλιώς μοιάζει με αντιγραφή.
    //
    // Εκεί κρύβαμε το πρόσωπο. Εδώ η **αποκάλυψη είναι ο σκοπός** — και ο κανόνας
    // παραμένει `deny_all` για **τρεις** ανεξάρτητους λόγους:
    //
    // 1. Το ωμό έγγραφο λέει **περισσότερα από την πράξη**: `demandId` (κλειδί προς
    //    το επίπεδο Β) και `matchReason`. Το Firestore δεν φιλτράρει πεδία.
    // 2. Η αποκάλυψη **υπολογίζεται** (`disclosedToOfferer`), και οφείλει να τρέχει
    //    στην ίδια πλευρά με τον συνθέτη — αλλιώς δύο πηγές για το «τι είδε ο άλλος»,
    //    που στο ΠΕ6/Κ10 λέγεται **ψευδής διαβεβαίωση**.
    // 3. 🔴 Ο λόγος που **δεν** έχει το `mreq`: η **ΧΩΡΗΤΙΚΟΤΗΤΑ** (ΠΕ5). Το όριο
    //    κρίνεται μετρώντας τις υπάρχουσες· πελάτης που γράφει θα έγραφε την ενδέκατη
    //    **παράλληλα** με τη δέκατη. Κανόνας δεν μετρά έγγραφα — άρα ο γραφέας
    //    πρέπει να είναι **ένας**, στον διακομιστή.
    //
    // ⚠️ Η άγκυρα που **δεν** είναι πίνακας personas ζει στη σουίτα: ο `denyAllMatrix`
    // αρνείται σε όλους, άρα το κελί του παραλήπτη περνά **ούτως ή άλλως**. Χωρίς
    // σπαρμένο έγγραφο που **απευθύνεται** στον δοκιμαζόμενο, το «λογικό» χαλάρωμα
    // *«μα ο ιδιοκτήτης πρέπει να δει ποιος τον πλησίασε!»* **δεν θα κοκκίνιζε**.
    collection: 'first_contacts',
    pattern: 'deny_all',
    testFile: 'tests/firestore-rules/suites/first-contacts.rules.test.ts',
    ...denyAllMatrix(),
  },
  {
    // ADR-844 — Η ΠΡΟΣΚΛΗΣΗ. **Τρίτο `deny_all` της οικογένειας, ΤΡΙΤΟΣ λόγος** — και
    // αυτός δεν είναι ούτε ιδιωτικότητα (`mreq`) ούτε αυθεντία γραφέα (`fcon`).
    //
    // 🔴 ΕΙΝΑΙ ΤΟ ΜΟΝΟ ΕΓΓΡΑΦΟ ΤΗΣ ΤΡΙΑΔΑΣ ΠΟΥ ΚΡΑΤΑ **ΜΥΣΤΙΚΟ**: το `codeHash` του
    // εξαψήφιου κωδικού και το `nonce` του συνδέσμου. Μια ανάγνωση δεν διαρρέει απλώς
    // δεδομένα — δίνει το **υλικό εξαργύρωσης ΞΕΝΗΣ πρόσκλησης**, δηλαδή τη δυνατότητα
    // να σταλεί μήνυμα στο όνομα άλλου ανθρώπου. Και μια **γραφή** μηδενίζει το
    // `attempts`, που είναι ο μόνος φρουρός ωμής βίας ανά **στόχο** (το rate limit είναι
    // ανά IP, και η IP αλλάζει).
    //
    // ⚠️ Ο άνθρωπος εδώ **ΔΕΝ ΕΧΕΙ ΑΚΟΜΗ ΛΟΓΑΡΙΑΣΜΟ** — γι' αυτό το έγγραφο δεν έχει
    // `uid` και ο μόνος «λογικός» πειρασμός χαλάρωσης είναι ο **εταιρικός**. Η άγκυρα
    // που τον εκτελεί ζει στη σουίτα, γιατί ο `denyAllMatrix` θα περνούσε χωρίς αυτήν.
    collection: 'first_contact_invitations',
    pattern: 'deny_all',
    testFile: 'tests/firestore-rules/suites/first-contact-invitations.rules.test.ts',
    ...denyAllMatrix(),
  },
  {
    // ADR-844 §13.8 — ΤΟ ΗΜΕΡΟΛΟΓΙΟ ΤΗΣ ΔΙΕΚΔΙΚΗΣΗΣ. **Τέταρτο `deny_all`, τέταρτος λόγος**:
    // όχι ιδιωτικότητα, όχι αυθεντία γραφέα, όχι μυστικό — **ΕΠΙΛΟΓΗ ΤΑΥΤΟΤΗΤΑΣ**. Το
    // έγγραφο λέει «το επόμενο uid αυτού του email είναι Χ». Όποιος το γράφει διαλέγει
    // ποιος λογαριασμός θα πάρει ξένο γραμματοκιβώτιο.
    collection: 'auth_reprovision_journal',
    pattern: 'deny_all',
    testFile: 'tests/firestore-rules/suites/auth-reprovision-journal.rules.test.ts',
    ...denyAllMatrix(),
  },
  {
    // ADR-660 §6 — ΤΟ ΑΙΤΗΜΑ ΕΝΤΑΞΗΣ. `deny_all` με λόγο **αυτο-έγκριση**: ο αιτών που
    // γράφει `status: 'approved'` στο δικό του αίτημα θα έμπαινε σε ξένο χώρο χωρίς
    // κανέναν να ρωτηθεί. Η λίστα και η κατάσταση περνούν από διαδρομές διακομιστή.
    collection: 'workspace_access_requests',
    pattern: 'deny_all',
    testFile: 'tests/firestore-rules/suites/workspace-access-requests.rules.test.ts',
    ...denyAllMatrix(),
  },
  {
    // ADR-853 §7 — Η ΠΡΟΣΚΛΗΣΗ ΣΕ ΧΩΡΟ. **Πέμπτο `deny_all`, και ο λόγος είναι ΔΙΠΛΟΣ.**
    //
    // 🔴 (α) ΜΥΣΤΙΚΟ, όπως το `first_contact_invitations`: το `nonceHash` είναι το μισό του
    // υπογεγραμμένου συνδέσμου. Ανάγνωση ⇒ υλικό εξαργύρωσης ΞΕΝΗΣ πρόσκλησης.
    //
    // 🔴 (β) ΑΝΤΙΣΤΡΟΦΗ ΚΑΤΕΥΘΥΝΣΗ από το `workspace_access_requests` ακριβώς από πάνω:
    // εκείνο πάει από τον ΑΝΘΡΩΠΟ στον χώρο, αυτό από τον ΧΩΡΟ στον άνθρωπο. Γι' αυτό ο
    // κίνδυνος της γραφής δεν είναι η αυτο-έγκριση αλλά η **αυτο-πρόσκληση**: πελάτης που
    // γράφει εδώ διαλέγει μόνος του χώρο ΚΑΙ ρόλο, παρακάμπτοντας το ταβάνι (Ρ1) και τον
    // αποκλεισμό του `super_admin` (Ρ2) που κρίνει ο διακομιστής στην έκδοση.
    //
    // ⚠️ Ο `denyAllMatrix` περνά **ούτως ή άλλως** αν κανένα σπαρμένο έγγραφο δεν αφορά τον
    // δοκιμαζόμενο — γι' αυτό οι άγκυρες της σουίτας σπέρνουν πρόσκληση που αφορά ΑΚΡΙΒΩΣ
    // την εταιρεία και το email του persona που υποδυόμαστε.
    collection: 'workspace_invitations',
    pattern: 'deny_all',
    testFile: 'tests/firestore-rules/suites/workspace-invitations.rules.test.ts',
    ...denyAllMatrix(),
  },
  {
    // ADR-777 Α9 — Η ΖΗΤΗΣΗ. **Το αντίθετο των τριών από πάνω.**
    //
    // 🔴 Οι τρεις προηγούμενες εγγραφές λένε `read: if true`. Αυτή είναι η μόνη
    // συλλογή του ADR-777 που **κανείς** δεν διαβάζει πέρα από τον κάτοχό της —
    // ούτε ο `super_admin`. Το SPEC-777A §14.2 ονομάζει ρητά τις «ζητήσεις» στο
    // επίπεδο Β («αυστηρά ιδιωτικό»), και το SPEC-777B §12.7(α) απαιτεί «καμία
    // διαδρομή που να το κάνει εργαλείο πίεσης».
    //
    // ⚠️ Πρότυπο `ownership`, αλλά ΟΧΙ `ownerOnlyMatrix`: εκεί ο κάτοχος είναι το
    // **docId**· εδώ είναι **πεδίο**. Τρία κελιά αντιστρέφονται — βλ.
    // `authorOwnedMatrix`.
    collection: 'property_demands',
    pattern: 'ownership',
    testFile: 'tests/firestore-rules/suites/property-demands.rules.test.ts',
    ...authorOwnedMatrix(),
  },
  {
    // ADR-777 Α14 — Η ΠΡΟΣΦΟΡΑ ΤΟΥ ΙΔΙΩΤΗ. **Το κάτοπτρο της ζήτησης στην ΑΝΑΓΝΩΣΗ,
    // το αντίθετό της στη ΓΡΑΦΗ** — και οι δύο διαφορές είναι αποφάσεις.
    //
    // 🔴 Η ζήτηση γράφεται από τον ΠΕΛΑΤΗ (δεν έχει δημόσιο παράγωγο). Αυτή έχει: το
    // `public_listings` λέει `allow write: if false` για κάθε πελάτη, οπότε αν ο
    // πελάτης έγραφε εδώ και ΜΕΤΑ καλούσε τον διακομιστή για δημοσίευση, θα υπήρχε
    // παράθυρο όπου το έγγραφο υπάρχει και η προβολή όχι. Με μία πράξη διακομιστή,
    // το «κάθε καταχώρηση έχει συνεπή προβολή» γίνεται ιδιότητα της διαδρομής γραφής.
    //
    // ⚠️ Άρα: `authorOwnedMatrix` (ίδιο ερώτημα ανάγνωσης) με **create + update
    // αντεστραμμένα σε deny για ΟΛΟΥΣ** — συμπεριλαμβανομένου του ίδιου του κατόχου.
    // Ο `super_admin` ΔΕΝ εξαιρείται από την ανάγνωση, ίδιος λόγος με τη ζήτηση: το
    // έγγραφο κουβαλά τη διεύθυνση του σπιτιού ενός ανθρώπου.
    collection: 'owner_properties',
    pattern: 'ownership',
    testFile: 'tests/firestore-rules/suites/owner-properties.rules.test.ts',
    ...serverWrittenAuthorOwnedMatrix(),
  },
  // ADR-835 §20 (Στάδιο Α) — ΤΟ ΗΜΕΡΟΛΟΓΙΟ ΚΑΤΑΛΥΜΑΤΟΣ. Ίδιο σύνορο με την αγγελία: ο
  // συντάκτης διαβάζει, κανείς δεν γράφει από τον πελάτη (ο κριτής κατάληψης τρέχει μόνο
  // στη συναλλαγή του διακομιστή). Τρίτος–πέμπτος καταναλωτής της ίδιας μήτρας.
  {
    collection: 'stay_calendars',
    pattern: 'ownership',
    testFile: 'tests/firestore-rules/suites/stay-calendars.rules.test.ts',
    ...serverWrittenAuthorOwnedMatrix(),
  },
  {
    collection: 'stay_blocks',
    pattern: 'ownership',
    testFile: 'tests/firestore-rules/suites/stay-blocks.rules.test.ts',
    ...serverWrittenAuthorOwnedMatrix(),
  },
  {
    collection: 'stay_bookings',
    pattern: 'ownership',
    testFile: 'tests/firestore-rules/suites/stay-bookings.rules.test.ts',
    ...serverWrittenAuthorOwnedMatrix(),
  },
  // ADR-835 §21 (Στάδιο Β) — κανόνες ανά ημερομηνία. Έκτος καταναλωτής της ίδιας μήτρας:
  // μια τιμή ή ένα CTA γραμμένο από τον πελάτη θα άλλαζε τι απαντά η μηχανή χωρίς κεφαλή.
  {
    collection: 'stay_calendar_months',
    pattern: 'ownership',
    testFile: 'tests/firestore-rules/suites/stay-calendar-months.rules.test.ts',
    ...serverWrittenAuthorOwnedMatrix(),
  },
  {
    // 💬 ADR-867 §4.3 (Β4) — **Η ΟΜΑΔΑ ΤΗΣ ΠΡΑΞΗΣ**: ποιος του γραφείου απαντά.
    //
    // 🔴 Η συλλογή γεννήθηκε στο Β3 **χωρίς κανόνα** — δηλαδή έκλεινε από την προεπιλογή
    // `default-deny`. Ήταν **σωστή συμπεριφορά με αδήλωτη πρόθεση**: κανείς δεν μπορούσε
    // να πει αν το «κλειστό» ήταν απόφαση ή παράλειψη, και η CHECK 3.16 **δεν** μπορεί να
    // δει συλλογή χωρίς `match`. Το Β4 το γράφει ρητά — μαζί με τη μήτρα που το εκτελεί.
    collection: 'network_act_teams',
    pattern: 'deny_all',
    testFile: 'tests/firestore-rules/suites/network-act-teams.rules.test.ts',
    ...networkServerOnlyMatrix(),
  },
  {
    // 🔒 ADR-867 §4.1 (Β4β) — **ΤΟ ΒΙΒΛΙΟ ΤΩΝ ΑΝΑΚΛΗΣΕΩΝ**: το κείμενο που ο άνθρωπος
    // πήρε πίσω. **Δεύτερος** καταναλωτής του ίδιου προτύπου, και ο λόγος είναι ο ίδιος
    // με της ομάδας: ό,τι διαβάζεται από πελάτη **παύει να είναι ανάκληση**.
    //
    // 🔴 ΤΟ ΚΕΛΙ ΠΟΥ ΜΕΤΡΑΕΙ ΕΙΝΑΙ ΤΟ `same_tenant_user × read → deny`: ο **ίδιος ο
    // αποστολέας** δεν διαβάζει τα λόγια που ανακάλεσε. Ένα «μα είναι δικά του» θα ήταν
    // ο ίδιος πειρασμός με το `showcase_mark_sources` — και η ίδια απάντηση: το Firestore
    // δεν μπορεί να ξεχωρίσει «ο δικός του» από «ο δικός μου» χωρίς να ανοίξει τη διαδρομή.
    collection: 'network_message_retractions',
    pattern: 'deny_all',
    testFile: 'tests/firestore-rules/suites/network-message-retractions.rules.test.ts',
    ...networkServerOnlyMatrix(),
  },
  {
    // 💬 ADR-867 §4.1/§4.2 (Β4) — **ΤΟ ΝΗΜΑ**. Η **μόνη** συλλογή του αρχείου που κρίνει
    // την ανάγνωση από **υποσυλλογή**, και το `pattern` το λέει: `audience_gated`.
    //
    // 🔑 Η υποσυλλογή μηνυμάτων (`network_messages`) και η υποσυλλογή ακροατηρίου
    // (`network_audience`) ζουν **μέσα** σε αυτό το `match` — άρα καλύπτονται από **αυτή**
    // την εγγραφή, όπως το `bim_comments/replies`. Τις εκτελεί η σουίτα με δικές τους
    // άγκυρες (Α4/Α5/Α7), γιατί ο πίνακας των 35 μιλά μόνο για το γονικό έγγραφο.
    collection: 'network_threads',
    pattern: 'audience_gated',
    testFile: 'tests/firestore-rules/suites/network-threads.rules.test.ts',
    ...networkThreadMatrix(),
  },
  {
    // 🔴 ADR-835 §22 (Στάδιο Γ) — ΤΑ ΚΑΝΑΛΙΑ. **Η μόνη της οικογένειας που είναι
    // `deny_all`, και ο λόγος είναι το ΠΕΡΙΕΧΟΜΕΝΟ, όχι η αυστηρότητα**: το URL ενός
    // feed **ΕΙΝΑΙ διαπιστευτήριο** — ο σύνδεσμος `.ics` της Airbnb δίνει σε όποιον τον
    // έχει ολόκληρο το ημερολόγιο του οικοδεσπότη εκεί.
    //
    // ⚠️ Ο πειρασμός εδώ είναι **ιδιοκτησιακός**, ίδιος με το `showcase_mark_sources`:
    // *«μα είναι ο ΔΙΚΟΣ του σύνδεσμος»*. Και η απάντηση είναι η ίδια: το Firestore δεν
    // φιλτράρει πεδία σε ανάγνωση εγγράφου, άρα «να δει την κατάστασή του» σημαίνει «να
    // κατεβάσει το URL». Η οθόνη παίρνει **προβολή** (host + βαθμίδα) από τον διακομιστή.
    collection: 'stay_channels',
    pattern: 'deny_all',
    testFile: 'tests/firestore-rules/suites/stay-channels.rules.test.ts',
    ...denyAllMatrix(),
  },
  {
    collection: 'projects',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/projects.rules.test.ts',
    ...tenantDirectMatrix(),
  },
  {
    // ADR-759 Φ2 — «Στοιχεία Τοπογραφικού». tenant_direct, with two departures
    // spelled out below rather than inherited silently.
    collection: 'survey_records',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/survey-records.rules.test.ts',
    ...overrideDefinition(tenantDirectMatrix(), [
      // (1) A plain tenant user authors and edits survey records — that is the
      // whole point of the card — but may NOT destroy one. A survey record is
      // evidence other data was adopted from; deletion is an admin act.
      cell('same_tenant_user', 'create', 'allow'),
      cell('same_tenant_user', 'update', 'allow'),
      cell('same_tenant_user', 'delete', 'deny', 'insufficient_role'),
      // (2) Cross-tenant is closed on every operation, not just the ones the
      // canonical matrix happens to list.
      cell('cross_tenant_admin', 'create', 'deny', 'cross_tenant'),
      cell('cross_tenant_admin', 'delete', 'deny', 'cross_tenant'),
      cell('anonymous', 'create', 'deny', 'missing_claim'),
      cell('anonymous', 'update', 'deny', 'missing_claim'),
      cell('anonymous', 'delete', 'deny', 'missing_claim'),
    ]),
    seedDependencies: ['projects'],
  },
  {
    collection: 'buildings',
    pattern: 'admin_write_only',
    testFile: 'tests/firestore-rules/suites/buildings.rules.test.ts',
    ...adminWriteOnlyMatrix(),
    seedDependencies: ['projects'],
  },
  {
    collection: 'contacts',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/contacts.rules.test.ts',
    ...tenantDirectMatrix(),
  },
  {
    collection: 'files',
    pattern: 'tenant_state_machine',
    testFile: 'tests/firestore-rules/suites/files.rules.test.ts',
    ...tenantStateMachineMatrix(),
  },
  {
    // ADR-866 §5.2 — τα αρχεία που ανήκουν σε ΑΝΘΡΩΠΟ: ίδιο `FileRecord`, διαμέρισμα με κάτοχο
    // `userId`. Διαβάζει/γράφει/σβήνει ΜΟΝΟ ο κάτοχος — ΟΥΤΕ super admin (Google Drive «Ο Δίσκος
    // μου» · Figma Drafts). Διαμέρισμα και όχι κλάδος στο `files`, γιατί οι κανόνες δεν φιλτράρουν.
    collection: 'files_personal',
    pattern: 'ownership',
    testFile: 'tests/firestore-rules/suites/files-personal.rules.test.ts',
    ...personalFileMatrix(),
  },
  {
    collection: 'entity_audit_trail',
    pattern: 'immutable',
    testFile: 'tests/firestore-rules/suites/entity-audit-trail.rules.test.ts',
    ...immutableMatrix(),
  },
  {
    // ADR-864 Φ1β — το ΠΡΟΣΩΠΙΚΟ βιβλίο του ίδιου συστήματος ιστορικού (ADR-195). Διαβάζει
    // ΜΟΝΟ ο κάτοχος (`userId == auth.uid`) — ΟΥΤΕ admin εταιρείας ΟΥΤΕ super admin, ίδια
    // ορατότητα με την αγγελία. Γράφει ΜΟΝΟ ο διακομιστής (EntityAuditService). Ξεχωριστό
    // διαμέρισμα και όχι κλάδος στο `entity_audit_trail`, γιατί οι κανόνες δεν φιλτράρουν.
    collection: 'entity_audit_trail_personal',
    pattern: 'ownership',
    testFile: 'tests/firestore-rules/suites/entity-audit-trail-personal.rules.test.ts',
    ...serverWrittenAuthorOwnedMatrix(),
  },
  {
    // ADR-332 §3.7 Phase 9 — geocoding correction telemetry.
    // Tenant-scoped reads (any authenticated user of the correction's company),
    // every client write denies. Writes go through Admin SDK in the
    // address-corrections-telemetry service.
    collection: 'address_corrections_log',
    pattern: 'admin_write_only',
    testFile: 'tests/firestore-rules/suites/address-corrections-log.rules.test.ts',
    ...adminWriteOnlyMatrix(),
  },
  {
    collection: 'attendance_events',
    pattern: 'tenant_dual_path',
    testFile: 'tests/firestore-rules/suites/attendance-events.rules.test.ts',
    ...attendanceEventMatrix(),
    // Dual-path reads can resolve via parent project, so we seed a project
    // for the crossdoc regression block. The canonical matrix doc carries
    // its own companyId and resolves via the direct path.
    seedDependencies: ['projects'],
  },
  {
    collection: 'attendance_qr_tokens',
    pattern: 'admin_write_only',
    testFile: 'tests/firestore-rules/suites/attendance-qr-tokens.rules.test.ts',
    // QR tokens are admin-write-only: reads are tenant-scoped (dual path
    // like attendance_events), every client write denies. This matches the
    // canonical `adminWriteOnlyMatrix()` shape exactly. The dual read path
    // is exercised in the suite via a targeted crossdoc regression block.
    ...adminWriteOnlyMatrix(),
    seedDependencies: ['projects'],
  },
  {
    collection: 'messages',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/messages.rules.test.ts',
    // The messages create rule (firestore.rules:1758) requires
    // `request.resource.data.companyId == getUserCompanyId()` and does NOT
    // include an `isSuperAdminOnly()` OR-leg — super admin therefore cannot
    // create messages from client context (Admin SDK bypass is the sanctioned
    // path). Override the canonical cell to reflect this.
    ...overrideDefinition(tenantDirectMatrix(), [
      cell('super_admin', 'create', 'deny', 'server_only'),
    ]),
  },
  // ── ADR-298 Phase B.3 — CRM core tenant_direct (2026-04-13) ─────────────
  {
    collection: 'leads',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/leads.rules.test.ts',
    // Create rule has no isSuperAdminOnly() short-circuit — super_admin denied.
    // Seed doc carries createdBy = same_tenant_user.uid for update/delete leg.
    ...crmDirectMatrix(),
  },
  {
    collection: 'opportunities',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/opportunities.rules.test.ts',
    ...crmDirectMatrix(),
  },
  {
    collection: 'activities',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/activities.rules.test.ts',
    ...crmDirectMatrix(),
  },
  // ── ADR-298 Phase B.6 — compliance tenant_direct (2026-04-13) ───────────
  {
    collection: 'obligations',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/obligations.rules.test.ts',
    // Read: isSuperAdminOnly() || companyId direct || projectId crossdoc || legacy createdBy.
    // Create has no isSuperAdminOnly() short-circuit — super_admin denied (cross_tenant).
    // Update/delete: createdBy==uid || isCompanyAdminOfCompany || isSuperAdminOnly().
    // Seed doc carries createdBy=same_tenant_user.uid for uid-match update/delete leg.
    ...crmDirectMatrix(),
  },
  {
    collection: 'obligation_transmittals',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/obligation-transmittals.rules.test.ts',
    // Simpler read: isSuperAdminOnly() || companyId direct (no crossdoc, no legacy).
    // Create: no isSuperAdminOnly() short-circuit — super_admin denied (cross_tenant).
    // Update: strict companyId immutability (no optional hasAny guard).
    // Update/delete: createdBy==uid || isCompanyAdminOfCompany || isSuperAdminOnly().
    ...crmDirectMatrix(),
  },
  {
    collection: 'obligation_templates',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/obligation-templates.rules.test.ts',
    // Read: isSuperAdminOnly() || companyId direct || legacy createdBy (no crossdoc).
    // Create: no isSuperAdminOnly() short-circuit — super_admin denied (cross_tenant).
    // Update/delete: createdBy==uid || isCompanyAdminOfCompany || isSuperAdminOnly().
    // Update: optional companyId immutability guard (!hasAny || unchanged).
    ...crmDirectMatrix(),
  },
  // ── ADR-298 Phase B.5 — messaging tenant_direct (2026-04-13) ─────────────
  {
    collection: 'conversations',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/conversations.rules.test.ts',
    // Create rule requires isValidConversationData (channel + status enum) and
    // has no isSuperAdminOnly short-circuit — super_admin denied (cross_tenant).
    // same_tenant_user has full CRUD: create via companyId match, update/delete
    // via createdBy==uid path. Identical delta shape to crmDirectMatrix().
    ...crmDirectMatrix(),
  },
  {
    collection: 'external_identities',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/external-identities.rules.test.ts',
    // No isValidConversationData on create/update. Same CRUD pattern as CRM
    // collections: super_admin denied on create (no isSuperAdminOnly short-circuit),
    // same_tenant_user full CRUD via companyId/createdBy paths.
    ...crmDirectMatrix(),
  },
  // ── ADR-298 Phase B.4 — property hierarchy admin_write_only (2026-04-13) ─
  {
    collection: 'floors',
    pattern: 'admin_write_only',
    testFile: 'tests/firestore-rules/suites/floors.rules.test.ts',
    ...adminWriteOnlyMatrix(),
    seedDependencies: ['projects', 'buildings'],
  },
  {
    collection: 'properties',
    pattern: 'admin_write_only',
    testFile: 'tests/firestore-rules/suites/properties.rules.test.ts',
    // Delta from canonical admin_write_only: update is allowed for super_admin
    // (isSuperAdminOnly bypass) and for company admins of the project's company
    // (isCompanyAdminOfProject + isAllowedPropertyFieldUpdate + propertyStructuralFieldsUnchanged).
    // Client create/delete remain server-only.
    ...overrideDefinition(adminWriteOnlyMatrix(), [
      cell('super_admin', 'update', 'allow'),
      cell('same_tenant_admin', 'update', 'allow'),
      cell('same_tenant_user', 'update', 'deny', 'insufficient_role'),
    ]),
    seedDependencies: ['projects'],
  },
  {
    collection: 'storage_units',
    pattern: 'admin_write_only',
    testFile: 'tests/firestore-rules/suites/storage-units.rules.test.ts',
    ...adminWriteOnlyMatrix(),
    seedDependencies: ['projects', 'buildings'],
  },
  {
    collection: 'parking_spots',
    pattern: 'admin_write_only',
    testFile: 'tests/firestore-rules/suites/parking-spots.rules.test.ts',
    ...adminWriteOnlyMatrix(),
    seedDependencies: ['projects', 'buildings'],
  },
  // ── ADR-298 Phase C.1 — remaining accounting (2026-04-13) ───────────────
  // Pattern A: standard role_dual (canCreateAccounting with createdBy==uid)
  {
    collection: 'accounting_bank_transactions',
    pattern: 'role_dual',
    testFile: 'tests/firestore-rules/suites/accounting-bank-transactions.rules.test.ts',
    ...roleDualMatrix(),
  },
  {
    collection: 'accounting_bank_accounts',
    pattern: 'role_dual',
    testFile: 'tests/firestore-rules/suites/accounting-bank-accounts.rules.test.ts',
    ...roleDualMatrix(),
  },
  {
    collection: 'accounting_fixed_assets',
    pattern: 'role_dual',
    testFile: 'tests/firestore-rules/suites/accounting-fixed-assets.rules.test.ts',
    ...roleDualMatrix(),
  },
  {
    collection: 'accounting_depreciation_records',
    pattern: 'role_dual',
    testFile: 'tests/firestore-rules/suites/accounting-depreciation-records.rules.test.ts',
    ...roleDualMatrix(),
  },
  {
    collection: 'accounting_expense_documents',
    pattern: 'role_dual',
    testFile: 'tests/firestore-rules/suites/accounting-expense-documents.rules.test.ts',
    ...roleDualMatrix(),
  },
  {
    collection: 'accounting_import_batches',
    pattern: 'role_dual',
    testFile: 'tests/firestore-rules/suites/accounting-import-batches.rules.test.ts',
    ...roleDualMatrix(),
  },
  {
    collection: 'accounting_tax_installments',
    pattern: 'role_dual',
    testFile: 'tests/firestore-rules/suites/accounting-tax-installments.rules.test.ts',
    ...roleDualMatrix(),
  },
  {
    collection: 'accounting_apy_certificates',
    pattern: 'role_dual',
    testFile: 'tests/firestore-rules/suites/accounting-apy-certificates.rules.test.ts',
    ...roleDualMatrix(),
  },
  {
    collection: 'accounting_custom_categories',
    pattern: 'role_dual',
    testFile: 'tests/firestore-rules/suites/accounting-custom-categories.rules.test.ts',
    ...roleDualMatrix(),
  },
  {
    collection: 'accounting_matching_rules',
    pattern: 'role_dual',
    testFile: 'tests/firestore-rules/suites/accounting-matching-rules.rules.test.ts',
    ...roleDualMatrix(),
  },
  {
    collection: 'accounting_efka_payments',
    pattern: 'role_dual',
    testFile: 'tests/firestore-rules/suites/accounting-efka-payments.rules.test.ts',
    ...roleDualMatrix(),
  },
  // Pattern C: fiscal periods — Q8 SAP state-machine
  {
    collection: 'accounting_fiscal_periods',
    pattern: 'role_dual',
    testFile: 'tests/firestore-rules/suites/accounting-fiscal-periods.rules.test.ts',
    // Fiscal period matrix: admin-only create, internal-user update with
    // state-machine guard, delete forbidden (business invariant).
    // See `fiscalPeriodMatrix()` in coverage-matrices.ts for full rationale.
    ...fiscalPeriodMatrix(),
  },
  // Pattern D: settings singletons — admin-only write, internal-user read
  {
    collection: 'accounting_settings',
    pattern: 'role_dual',
    testFile: 'tests/firestore-rules/suites/accounting-settings.rules.test.ts',
    // ADR-841 §7 Α23 Γ3β — client-write allowlist on top of Pattern D.
    ...accountingSettingsMatrix(),
  },
  {
    collection: 'accounting_efka_config',
    pattern: 'role_dual',
    testFile: 'tests/firestore-rules/suites/accounting-efka-config.rules.test.ts',
    ...accountingSingletonMatrix(),
  },
  // Pattern E: server-only — deny all client access
  {
    collection: 'accounting_invoice_counters',
    pattern: 'deny_all',
    testFile: 'tests/firestore-rules/suites/accounting-invoice-counters.rules.test.ts',
    // `allow read, write: if false` — no client reads or writes at all.
    // Stronger than `immutable` (which allows tenant-scoped reads).
    ...denyAllMatrix(),
  },
  // Pattern F: system-calculated — no createdBy, admin-delete
  {
    collection: 'accounting_customer_balances',
    pattern: 'role_dual',
    testFile: 'tests/firestore-rules/suites/accounting-customer-balances.rules.test.ts',
    ...accountingSystemCalcMatrix(),
  },
  // ── ADR-298 Phase B.2 — accounting ΚΦΔ (2026-04-13) ─────────────────────
  {
    collection: 'accounting_invoices',
    pattern: 'role_dual',
    testFile: 'tests/firestore-rules/suites/accounting-invoices.rules.test.ts',
    ...roleDualMatrix(),
  },
  {
    collection: 'accounting_journal_entries',
    pattern: 'role_dual',
    testFile: 'tests/firestore-rules/suites/accounting-journal-entries.rules.test.ts',
    ...roleDualMatrix(),
  },
  {
    collection: 'accounting_audit_log',
    pattern: 'role_dual',
    testFile: 'tests/firestore-rules/suites/accounting-audit-log.rules.test.ts',
    // Q7 ΚΦΔ compliance: update/delete are `if false` — immutable for all personas.
    // Read + create follow the standard role_dual shape (canReadAccounting /
    // canCreateAccountingSystem + userId==uid; no isSuperAdminOnly short-circuit).
    ...overrideDefinition(roleDualMatrix(), [
      cell('super_admin', 'update', 'deny', 'immutable'),
      cell('same_tenant_admin', 'update', 'deny', 'immutable'),
      cell('same_tenant_user', 'update', 'deny', 'immutable'),
      cell('cross_tenant_admin', 'update', 'deny', 'immutable'),
      cell('anonymous', 'update', 'deny', 'immutable'),
      cell('super_admin', 'delete', 'deny', 'immutable'),
      cell('same_tenant_admin', 'delete', 'deny', 'immutable'),
      cell('same_tenant_user', 'delete', 'deny', 'immutable'),
      cell('cross_tenant_admin', 'delete', 'deny', 'immutable'),
      cell('anonymous', 'delete', 'deny', 'immutable'),
    ]),
  },
  // ── ADR-298 Phase C.5 — System-global (2026-04-13) ───────────────────────
  {
    collection: 'config',
    pattern: 'system_global',
    testFile: 'tests/firestore-rules/suites/config.rules.test.ts',
    ...systemGlobalMatrix(),
  },
  {
    collection: 'email_domain_policies',
    pattern: 'system_global',
    testFile: 'tests/firestore-rules/suites/email-domain-policies.rules.test.ts',
    ...systemGlobalMatrix(),
  },
  {
    collection: 'country_security_policies',
    pattern: 'system_global',
    testFile: 'tests/firestore-rules/suites/country-security-policies.rules.test.ts',
    ...systemGlobalMatrix(),
  },
  {
    collection: 'bot_configs',
    pattern: 'system_global',
    testFile: 'tests/firestore-rules/suites/bot-configs.rules.test.ts',
    ...systemGlobalMatrix(),
  },
  {
    collection: 'system',
    pattern: 'system_global',
    testFile: 'tests/firestore-rules/suites/system.rules.test.ts',
    // isCompanyAdmin() read (role-only, not tenant-bound), write=false
    ...systemAdminGlobalMatrix(),
  },
  {
    collection: 'navigation_companies',
    pattern: 'admin_write_only',
    testFile: 'tests/firestore-rules/suites/navigation-companies.rules.test.ts',
    ...adminWriteOnlyMatrix(),
  },
  {
    collection: 'appointments',
    pattern: 'admin_write_only',
    testFile: 'tests/firestore-rules/suites/appointments.rules.test.ts',
    ...adminWriteOnlyMatrix(),
  },
  {
    collection: 'counters',
    pattern: 'system_global',
    testFile: 'tests/firestore-rules/suites/counters.rules.test.ts',
    // isAuthenticated() read+write — global increment counters
    ...countersMatrix(),
  },
  {
    collection: 'analytics',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/analytics.rules.test.ts',
    // Create: companyId==getUserCompanyId() only, no isSuperAdminOnly() — super_admin denied
    ...crmDirectMatrix(),
  },
  {
    collection: 'communications',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/communications.rules.test.ts',
    // Create: companyId==getUserCompanyId() only, no isSuperAdminOnly() — super_admin denied
    ...crmDirectMatrix(),
  },
  {
    collection: 'tasks',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/tasks.rules.test.ts',
    // Create: isSuperAdminOnly() OR-leg present → super_admin allowed (delta from crmDirectMatrix)
    // Seed doc: createdBy=assignedTo=same_tenant_user.uid for update/delete paths
    ...tasksMatrix(),
  },
  // ── ADR-298 Phase C.2 — DXF / CAD / Floorplan collections (2026-04-14) ──────
  // ── ADR-657 — legacy floorplan containers → PRESENTATION tier ─────────────
  // All 5 now use the legacy helper trio (canReadLegacyFloorplan /
  // canCreateLegacyFloorplan / canWriteLegacyFloorplan) + delete gated on
  // isBimWriter(). Read tenant-wide (incl. external_user); write internal-only,
  // NO ownership grant. Same canonical cells as bimPresentationMatrix().
  {
    collection: 'project_floorplans',
    pattern: 'bim_presentation',
    testFile: 'tests/firestore-rules/suites/project-floorplans.rules.test.ts',
    ...legacyFloorplanMatrix(),
  },
  {
    collection: 'building_floorplans',
    pattern: 'bim_presentation',
    testFile: 'tests/firestore-rules/suites/building-floorplans.rules.test.ts',
    ...legacyFloorplanMatrix(),
  },
  {
    collection: 'floor_floorplans',
    pattern: 'bim_presentation',
    testFile: 'tests/firestore-rules/suites/floor-floorplans.rules.test.ts',
    // ADR-657 removed the cross-tenant dev-fallback read leg; canReadLegacyFloorplan()
    // no-companyId leg now requires createdBy == uid. Canonical seed carries companyId.
    ...legacyFloorplanMatrix(),
  },
  {
    collection: 'unit_floorplans',
    pattern: 'bim_presentation',
    testFile: 'tests/firestore-rules/suites/unit-floorplans.rules.test.ts',
    ...legacyFloorplanMatrix(),
  },
  {
    collection: 'floorplans',
    pattern: 'bim_presentation',
    testFile: 'tests/firestore-rules/suites/floorplans.rules.test.ts',
    ...legacyFloorplanMatrix(),
  },
  {
    collection: 'dxf_overlay_levels',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/dxf_overlay_levels.rules.test.ts',
    // Items subcollection not tracked (nested subcollection — excluded from manifest).
    ...fileTenantFullMatrix(),
  },
  {
    collection: 'layers',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/layers.rules.test.ts',
    ...crmDirectMatrix(),
  },
  {
    collection: 'layer_groups',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/layer-groups.rules.test.ts',
    ...crmDirectMatrix(),
  },
  {
    collection: 'admin_building_templates',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/admin-building-templates.rules.test.ts',
    // Legacy fallback on read for !companyId docs (creator-only) — not exercised
    // by canonical matrix (seed doc carries companyId).
    ...crmDirectMatrix(),
  },
  {
    collection: 'cad_files',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/cad-files.rules.test.ts',
    // Permissive write: create/update require only isAuthenticated() + fileName.
    // No companyId gate on write → cross_tenant_admin CAN create/update.
    // Read/delete: tenant-scoped (isSuperAdminOnly || belongsToCompany || legacy createdBy).
    ...cadFilesMatrix(),
  },
  // ── ADR-298 Phase C.3 — File management collections (2026-04-14) ──────────
  {
    collection: 'file_audit_log',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/file-audit-log.rules.test.ts',
    // Read gate: belongsToCompany only — NO isSuperAdminOnly bypass (super_admin denied).
    // Create allows super_admin (isSuperAdminOnly on create rule).
    // Update/delete: if false — immutable audit trail.
    // Note: pattern is 'tenant_direct' (not 'immutable') to avoid the Bug #1 shape
    // check which requires isSuperAdminOnly as first read leg — this collection
    // deliberately excludes super_admin from reads by design.
    ...fileAuditLogMatrix(),
  },
  {
    collection: 'file_shares',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/file-shares.rules.test.ts',
    // Read: if true — public (anonymous allowed for share token validation pages).
    // Delete: createdBy==uid only — super_admin and admin denied.
    ...fileSharesMatrix(),
  },
  {
    collection: 'photo_shares',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/photo-shares.rules.test.ts',
    // Update: if false — immutable CRM share history records.
    // Delete: isSuperAdminOnly() only.
    ...photoSharesMatrix(),
  },
  {
    collection: 'file_comments',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/file-comments.rules.test.ts',
    // Read gate: belongsToCompany (no isSuperAdminOnly bypass) → super_admin denied.
    // Update: any same-tenant member (authorId must be preserved).
    // Delete: author only (authorId == request.auth.uid). Seed: authorId=same_tenant_user.uid.
    ...fileCommentsMatrix(),
  },
  {
    collection: 'file_approvals',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/file-approvals.rules.test.ts',
    // Delete: if false — approval records are immutable business artifacts.
    ...fileApprovalsMatrix(),
  },
  {
    collection: 'document_templates',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/document-templates.rules.test.ts',
    // Full CRUD: isSuperAdminOnly || (companyId && belongsToCompany).
    // same_tenant_user has all operations (not just admin).
    ...fileTenantFullMatrix(),
  },
  {
    collection: 'file_webhooks',
    pattern: 'deny_all',
    testFile: 'tests/firestore-rules/suites/file-webhooks.rules.test.ts',
    // allow read, write: if false — Admin SDK only. Same shape as accounting_invoice_counters.
    ...denyAllMatrix(),
  },
  {
    collection: 'file_folders',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/file-folders.rules.test.ts',
    // Full CRUD: isSuperAdminOnly || (companyId && belongsToCompany).
    ...fileTenantFullMatrix(),
  },
  // ── ADR-298 Phase C.4 — BoQ / Commissions / Ownership collections (2026-04-14) ──
  {
    collection: 'boq_items',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/boq-items.rules.test.ts',
    // Full CRUD: isSuperAdminOnly || belongsToCompany(companyId).
    // Delete gated on status in ['draft', 'submitted'] — seed with status='draft'.
    // Update immutable: buildingId, projectId, companyId must not change.
    ...fileTenantFullMatrix(),
  },
  {
    collection: 'boq_categories',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/boq-categories.rules.test.ts',
    // Read-only: `allow create, update, delete: if false` — reserved for future admin UI.
    // Reads: isSuperAdminOnly || (companyId && belongsToCompany) || !companyId (system defaults).
    ...boqCategoriesMatrix(),
  },
  {
    collection: 'brokerage_agreements',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/brokerage-agreements.rules.test.ts',
    // Delete: createdBy==uid || isSuperAdminOnly (NO isCompanyAdminOfCompany).
    // same_tenant_admin can update (isCompanyAdminOfCompany) but NOT delete.
    // Seed doc: createdBy=same_tenant_user.uid.
    ...brokerageMatrix(),
  },
  {
    collection: 'commission_records',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/commission-records.rules.test.ts',
    // Delete: isSuperAdminOnly ONLY. No createdBy leg — super_admin is the only
    // persona allowed to permanently delete a commission record.
    // Update: createdBy==uid || isCompanyAdminOfCompany || isSuperAdminOnly.
    ...commissionRecordsMatrix(),
  },
  {
    collection: 'ownership_tables',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/ownership-tables.rules.test.ts',
    // Delete: isSuperAdminOnly ONLY. Update: belongsToCompany (not createdBy).
    // Nested revisions subcollection excluded from top-level CHECK 3.16 scope.
    ...ownershipTablesMatrix(),
  },
  // ── ADR-298 Phase C.6 — ownership-based users / companies / workspaces (2026-04-14) ──
  {
    collection: 'companies',
    pattern: 'ownership',
    testFile: 'tests/firestore-rules/suites/companies.rules.test.ts',
    // Read: isSuperAdminOnly() || getUserCompanyId() == companyId (path variable, not field).
    // Write: if false — Admin SDK only (ADR-252 FR-C3).
    // List: same-tenant personas denied (path-var rule, unrestricted queries blocked).
    // Nested audit_logs subcollection is covered by this parent block.
    ...companiesMatrix(),
  },
  {
    collection: 'security_roles',
    pattern: 'system_global',
    testFile: 'tests/firestore-rules/suites/security-roles.rules.test.ts',
    // Read: isAuthenticated() — global, no tenant isolation (critical for login).
    // Write: if false — Admin SDK only.
    ...systemGlobalMatrix(),
  },
  {
    collection: 'users',
    pattern: 'ownership',
    testFile: 'tests/firestore-rules/suites/users.rules.test.ts',
    // Read: uid==userId || (companyId && belongsToCompany) || isSuperAdminOnly (SPEC-259B).
    // Create/update: uid==userId || (companyId && isCompanyAdminOfCompany).
    // Delete: if false — user docs never client-deleted.
    // Nested sessions subcollection is covered by this parent block.
    ...usersMatrix(),
  },
  {
    collection: 'user_2fa_settings',
    pattern: 'ownership',
    testFile: 'tests/firestore-rules/suites/user-2fa-settings.rules.test.ts',
    // Pure ownership: allow read, write: if isOwner(userId) = request.auth.uid == userId.
    // List + create: deny for all (path-var rule; harness fresh-docId constraint).
    // Own-uid create exercised in suite's dedicated regression block.
    ...ownerOnlyMatrix(),
  },
  {
    collection: 'user_notification_settings',
    pattern: 'ownership',
    testFile: 'tests/firestore-rules/suites/user-notification-settings.rules.test.ts',
    // Pure ownership: allow read, write: if isOwner(userId) = request.auth.uid == userId.
    // List + create: deny for all (path-var rule; harness fresh-docId constraint).
    // Own-uid create exercised in suite's dedicated regression block.
    ...ownerOnlyMatrix(),
  },
  {
    collection: 'workspaces',
    pattern: 'admin_write_only',
    testFile: 'tests/firestore-rules/suites/workspaces.rules.test.ts',
    // Read: isSuperAdminOnly() || (companyId && belongsToCompany) (PR-1B, SPEC-259B).
    // Write: if false — Admin SDK only.
    ...adminWriteOnlyMatrix(),
  },
  {
    collection: 'teams',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/teams.rules.test.ts',
    // Create: companyId==getUserCompanyId() — no isSuperAdminOnly() short-circuit.
    // Update/delete: createdBy==uid || isCompanyAdminOfCompany || isSuperAdminOnly.
    // Seed doc carries createdBy=same_tenant_user.uid.
    ...crmDirectMatrix(),
  },
  {
    collection: 'positions',
    pattern: 'system_global',
    testFile: 'tests/firestore-rules/suites/positions.rules.test.ts',
    // Read: isAuthenticated() — global, no tenant isolation.
    // Write: if false — Admin SDK only.
    ...systemGlobalMatrix(),
  },
  // ── ADR-298 Phase C.7 — specialized collections (2026-04-14) ─────────────
  {
    collection: 'contact_relationships',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/contact-relationships.rules.test.ts',
    // Create: isAuthenticated() + required fields only — NO companyId gate.
    // Update/delete: createdBy==uid || isSuperAdminOnly. same_tenant_admin denied.
    // Seed: createdBy=same_tenant_user.uid, companyId=SAME_TENANT_COMPANY_ID.
    ...contactRelationshipsMatrix(),
  },
  {
    collection: 'contact_links',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/contact-links.rules.test.ts',
    // ADR-745 (2026-08-01): no longer shares contactRelationshipsMatrix(). The
    // pattern was declared `tenant_direct` while the tenant field was never
    // written — nominally tenant-scoped, structurally unreachable. Now real:
    // tenant-gated read/create/update/delete, creator-bound create.
    ...contactLinksMatrix(),
  },
  {
    collection: 'title_block_bindings',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/title-block-bindings.rules.test.ts',
    // ADR-745 Φ3β (2026-08-05): per-cell provenance. Same tenant discipline as
    // contact_links, with two deliberate departures pinned by their own cells —
    // company-wide update (a colleague may supersede) and super-admin-only delete
    // (provenance is superseded, never erased).
    ...titleBlockBindingsMatrix(),
  },
  {
    collection: 'relationships',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/relationships.rules.test.ts',
    // Create: companyId==getUserCompanyId() — no isSuperAdminOnly shortcut.
    // Update/delete: createdBy==uid || isCompanyAdminOfCompany || isSuperAdminOnly.
    // Seed: createdBy=same_tenant_user.uid.
    ...crmDirectMatrix(),
  },
  {
    collection: 'relationship_audit',
    pattern: 'system_global',
    testFile: 'tests/firestore-rules/suites/relationship-audit.rules.test.ts',
    // Read: isAuthenticated() — any authenticated, no tenant isolation.
    // Write: if false — Admin SDK only.
    ...systemGlobalMatrix(),
  },
  {
    collection: 'employment_records',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/employment-records.rules.test.ts',
    // Read: tenant-scoped (companyId OR crossdoc projectId). Write: open authenticated
    // create/update (no companyId gate). Delete: if false.
    ...employmentRecordsMatrix(),
  },
  {
    collection: 'notifications',
    pattern: 'ownership',
    testFile: 'tests/firestore-rules/suites/notifications.rules.test.ts',
    // Read: userId==auth.uid — owner only. Update: owner + isValidNotificationUpdate.
    // Create/delete: if false — server-only.
    ...notificationsMatrix(),
  },
  {
    collection: 'audit_logs',
    pattern: 'system_global',
    testFile: 'tests/firestore-rules/suites/audit-logs.rules.test.ts',
    // Top-level audit_logs (NOT the companies/{id}/audit_logs subcollection).
    // Read: isAuthenticated() — global, no tenant isolation. Write: if false.
    ...systemGlobalMatrix(),
  },
  {
    collection: 'system_audit_logs',
    pattern: 'system_global',
    testFile: 'tests/firestore-rules/suites/system-audit-logs.rules.test.ts',
    // Read: isAuthenticated() — global, no tenant isolation. Write: if false.
    ...systemGlobalMatrix(),
  },
  {
    collection: 'audit_log',
    pattern: 'system_global',
    testFile: 'tests/firestore-rules/suites/audit-log.rules.test.ts',
    // Cloud Functions purge trail. Read: isSuperAdminOnly() only. Write: if false.
    // Pattern system_global (not immutable) — Bug #1 check only applies to immutable.
    ...auditLogMatrix(),
  },
  {
    collection: 'search_documents',
    pattern: 'admin_write_only',
    testFile: 'tests/firestore-rules/suites/search-documents.rules.test.ts',
    // Read: isSuperAdminOnly() || belongsToCompany(tenantId) — uses tenantId field.
    // Write: if false — Cloud Functions / Admin SDK. Seed uses tenantId (not companyId).
    ...searchDocumentsMatrix(),
  },
  {
    collection: 'voice_commands',
    pattern: 'ownership',
    testFile: 'tests/firestore-rules/suites/voice-commands.rules.test.ts',
    // Read: userId==auth.uid — owner only. All writes: if false — server-only.
    ...voiceCommandsMatrix(),
  },
  {
    // ADR-340 Phase 7 — raster background per κάτοψη ορόφου.
    // Reads: any same-tenant authenticated user. Writes: super_admin / company_admin
    // / internal_user (Q9). Immutables enforced (D6): companyId, floorId, fileId,
    // providerId, naturalBounds, createdBy.
    // ADR-657 PRESENTATION tier — role gate shared with the BIM entity blocks
    // (read tenant-wide incl. external_user; write internal-only). The bespoke
    // payload validators (_overlayWriteValid, naturalBounds/scale) stay in the
    // rule body; only the role gate is expressed by the matrix.
    collection: 'floorplan_backgrounds',
    pattern: 'bim_presentation',
    testFile: 'tests/firestore-rules/suites/floorplan-backgrounds.rules.test.ts',
    ...bimPresentationMatrix(),
  },
  {
    // ADR-340 Phase 7 — polygon overlays FK→floorplan_backgrounds.
    // ADR-657 PRESENTATION tier — same role gate as floorplan_backgrounds.
    collection: 'floorplan_overlays',
    pattern: 'bim_presentation',
    testFile: 'tests/firestore-rules/suites/floorplan-overlays.rules.test.ts',
    ...bimPresentationMatrix(),
  },
  {
    // ADR-650/657 — per-floor topographic survey definition (1 doc/floorplan).
    // ADR-657 moved this from PRESENTATION-shaped (external_user read ALLOW, the
    // old bug) to AUTHORING: read+write require internal-user-of-company, so
    // external_user is denied ALL FIVE ops. Same rule body (canReadBimAuthoring /
    // canCreateBimEntity / canUpdateBimEntity / canDeleteBimEntity) as
    // floorplan_grid_guides / floorplan_foundations, which graduate onto the
    // shared bimAuthoringMatrix() below.
    collection: 'floorplan_topo_surfaces',
    pattern: 'bim_authoring',
    testFile: 'tests/firestore-rules/suites/floorplan-topo-surfaces.rules.test.ts',
    ...bimAuthoringMatrix(),
  },
  // ── ADR-657 — BIM tier canary suites (one per rule-shape variant) ─────────
  {
    // PRESENTATION — read client-side on /properties (ADR-370). Canary that
    // proves external_user × read = ALLOW (the /properties render path).
    collection: 'floorplan_walls',
    pattern: 'bim_presentation',
    testFile: 'tests/firestore-rules/suites/floorplan-walls.rules.test.ts',
    ...bimPresentationMatrix(),
  },
  {
    // PRESENTATION — kind+params create variant + G24 soft-lock anti-spoof.
    collection: 'floorplan_stairs',
    pattern: 'bim_presentation',
    testFile: 'tests/firestore-rules/suites/floorplan-stairs.rules.test.ts',
    ...bimPresentationMatrix(),
  },
  {
    // AUTHORING — 'guides' create variant (grid_guides). Graduated off PENDING.
    collection: 'floorplan_grid_guides',
    pattern: 'bim_authoring',
    testFile: 'tests/firestore-rules/suites/floorplan-grid-guides.rules.test.ts',
    ...bimAuthoringMatrix(),
  },
  {
    // AUTHORING — 'kind+params' create variant (foundations). Graduated off PENDING.
    collection: 'floorplan_foundations',
    pattern: 'bim_authoring',
    testFile: 'tests/firestore-rules/suites/floorplan-foundations.rules.test.ts',
    ...bimAuthoringMatrix(),
  },
  {
    // AUTHORING — 'data' create variant (flat DXF hatch fills).
    collection: 'floorplan_hatches',
    pattern: 'bim_authoring',
    testFile: 'tests/firestore-rules/suites/floorplan-hatches.rules.test.ts',
    ...bimAuthoringMatrix(),
  },
  {
    // AUTHORING — 'category+kind+params' create variant (2D symbol library).
    collection: 'floorplan_symbols',
    pattern: 'bim_authoring',
    testFile: 'tests/firestore-rules/suites/floorplan-symbols.rules.test.ts',
    ...bimAuthoringMatrix(),
  },
  {
    // AUTHORING — 'params'-only create variant (geometry-less MEP system).
    collection: 'floorplan_mep_systems',
    pattern: 'bim_authoring',
    testFile: 'tests/firestore-rules/suites/floorplan-mep-systems.rules.test.ts',
    ...bimAuthoringMatrix(),
  },
  {
    // ADR-344 Phase 7.E — DXF Text Engine user-authored text templates.
    // Read: any same-tenant authenticated user. Write: company_admin / super_admin only.
    // companyId immutable on update. Graduated from FIRESTORE_RULES_PENDING (Phase 7.E).
    collection: 'text_templates',
    pattern: 'tenant_admin_write',
    testFile: 'tests/firestore-rules/suites/text_templates.rules.test.ts',
    ...textTemplateMatrix(),
  },
  {
    // ADR-344 Phase 6.F — DXF Text Engine company-uploaded custom fonts.
    // Identical rule shape to text_templates: read = any tenant member,
    // write = company_admin / super_admin only. companyId immutable on update.
    // Graduated from FIRESTORE_RULES_PENDING (Phase 6.F).
    collection: 'company_fonts',
    pattern: 'tenant_admin_write',
    testFile: 'tests/firestore-rules/suites/company_fonts.rules.test.ts',
    ...textTemplateMatrix(),
  },
  {
    // ADR-344 Phase 8 — DXF Text Engine per-company custom dictionary entries.
    // Identical rule shape to text_templates / company_fonts: read = any tenant
    // member, write = company_admin / super_admin only. companyId immutable on
    // update. Defense-in-depth — the canonical writer is the
    // /api/dxf/custom-dictionary route (Admin SDK + audit + Zod).
    collection: 'text_custom_dictionary',
    pattern: 'tenant_admin_write',
    testFile: 'tests/firestore-rules/suites/text_custom_dictionary.rules.test.ts',
    ...textTemplateMatrix(),
  },
  {
    // ADR-652 (M2/M3/M4) — 2D DXF block content library (furniture / sanitary / …).
    // Bespoke matrix: `user` scope is PRIVATE inside the tenant (only its creator
    // reads it — not even a company admin), while `system` scope is world-readable
    // seed-only content. The hardening block of the suite additionally pins the
    // two rules that carry the security weight: a client may never CREATE a
    // `system` block, and may never SELF-PROMOTE an existing block into `system`
    // (the M3 hole — it would publish private content to every tenant).
    collection: 'block_library',
    pattern: 'tenant_direct',
    testFile: 'tests/firestore-rules/suites/block-library.rules.test.ts',
    ...blockLibraryMatrix(),
  },
  {
    // ADR-655 — ο διακόπτης διανομής των asset packs: `asset_pack_config/{packId}.status`.
    // Pattern E (deny_all): ούτε ΑΝΑΓΝΩΣΗ από client. Δεν είναι υπερβολή — αν ο client
    // διάβαζε την κατάσταση, θα μάθαινε ποια πακέτα υπάρχουν και πώς διανέμονται, και θα
    // μπορούσε να ανιχνεύσει πότε γυρίζει ο διακόπτης. Η πύλη το διαβάζει με Admin SDK.
    // Το suite κλειδώνει ότι ΚΑΙ ο super_admin παίρνει deny από client context.
    collection: 'asset_pack_config',
    pattern: 'deny_all',
    testFile: 'tests/firestore-rules/suites/asset-pack-config.rules.test.ts',
    ...denyAllMatrix(),
  },
  // ─── OAUTH 2.1 AUTHORIZATION SERVER (ADR-738) ─────────────────────────────
  // Πέντε συλλογές, ένα σχήμα: `allow read, write: if false`. Κρατούν
  // διαπιστευτήρια (SHA-256 tokens, PKCE challenges, authorization codes), άρα
  // η ΑΝΑΓΝΩΣΗ είναι εξίσου επικίνδυνη με την εγγραφή — γι' αυτό `deny_all`
  // και όχι `admin_write_only`. Ο `denyAllMatrix()` ζει στο
  // coverage-matrices-accounting.ts για ιστορικούς λόγους· είναι builder του
  // PATTERN, όχι του domain — μην τον αντιγράψεις εδώ.
  {
    collection: 'oauth_clients',
    pattern: 'deny_all',
    testFile: 'tests/firestore-rules/suites/oauth-clients.rules.test.ts',
    ...denyAllMatrix(),
  },
  {
    collection: 'oauth_auth_requests',
    pattern: 'deny_all',
    testFile: 'tests/firestore-rules/suites/oauth-auth-requests.rules.test.ts',
    ...denyAllMatrix(),
  },
  {
    collection: 'oauth_codes',
    pattern: 'deny_all',
    testFile: 'tests/firestore-rules/suites/oauth-codes.rules.test.ts',
    ...denyAllMatrix(),
  },
  {
    collection: 'oauth_tokens',
    pattern: 'deny_all',
    testFile: 'tests/firestore-rules/suites/oauth-tokens.rules.test.ts',
    ...denyAllMatrix(),
  },
  {
    collection: 'oauth_consents',
    pattern: 'deny_all',
    testFile: 'tests/firestore-rules/suites/oauth-consents.rules.test.ts',
    ...denyAllMatrix(),
  },
  // ─── ΧΡΟΝΟΠΡΟΓΡΑΜΜΑΤΙΣΜΟΣ (ADR-740) ───────────────────────────────────────
  // Το `deny_all` εδώ δεν προστατεύει δεδομένα — προστατεύει το **ρολόι**. Το
  // έγγραφο κρατά `leaseExpiresAt`· όποιος το γράψει παρατείνει ένα lease επ'
  // αόριστον και ο dispatcher προσπερνά σιωπηλά την εργασία. Το αποτέλεσμα είναι
  // «τα αντίγραφα ασφαλείας σταμάτησαν» χωρίς καμία άλλη συλλογή να αλλάξει και
  // χωρίς κανένα σφάλμα — ακριβώς το σχήμα της τρίμηνης σιωπής που γέννησε το
  // ADR-740. Γι' αυτό ρητή άρνηση και ΟΧΙ εμπιστοσύνη στο default-deny.
  {
    collection: 'cron_job_state',
    pattern: 'deny_all',
    testFile: 'tests/firestore-rules/suites/cron-job-state.rules.test.ts',
    ...denyAllMatrix(),
  },
  {
    collection: 'workspace_aliases',
    pattern: 'deny_all',
    testFile: 'tests/firestore-rules/suites/workspace-aliases.rules.test.ts',
    ...denyAllMatrix(),
  },
  // ─── ΠΑΓΩΜΕΝΑ ΑΠΟΔΕΙΚΤΙΚΑ ΕΝΤΟΛΗΣ (ADR-864 §20 · §21) ─────────────────────
  // Το `deny_all` προστατεύει τη **διατήρηση**: όποιος γράφει εδώ μικραίνει το
  // `retainUntil` ή αίρει νομική δέσμευση, και ο cron σβήνει αποδεικτικό που ο
  // νόμος απαιτεί. Η ανάγνωση κρίνεται μόνο στον διακομιστή (κριτής σχέσης + ίχνος).
  {
    collection: 'mandate_evidence',
    pattern: 'deny_all',
    testFile: 'tests/firestore-rules/suites/mandate-evidence.rules.test.ts',
    ...denyAllMatrix(),
  },
] as const;

/**
 * Collections that exist in firestore.rules but are not yet in the matrix.
 *
 * CHECK 3.16 tolerates pending entries but blocks any collection that is in
 * NEITHER list. Boy Scout rule: when you touch a pending collection, move
 * it into FIRESTORE_RULES_COVERAGE with full matrix and delete it from here.
 *
 * Auto-generated 2026-04-11 from `grep -nE '^    match /[a-zA-Z_]+/\{' firestore.rules`
 * minus the 6 entries in FIRESTORE_RULES_COVERAGE above. Nested subcollections
 * (e.g. `companies/{id}/audit_logs/{logId}`) are excluded — they are covered
 * by their parent block.
 */
export const FIRESTORE_RULES_PENDING: readonly string[] = [
  // — Contacts / relationships — (all moved to COVERAGE in ADR-298 Phase C.7, 2026-04-14)
  // contact_relationships → moved to COVERAGE (ADR-298 Phase C.7, 2026-04-14)
  // contact_links         → moved to COVERAGE (ADR-298 Phase C.7, 2026-04-14)
  // relationships         → moved to COVERAGE (ADR-298 Phase C.7, 2026-04-14)
  // relationship_audit    → moved to COVERAGE (ADR-298 Phase C.7, 2026-04-14)
  // — Attendance / HR —
  // attendance_events + attendance_qr_tokens moved to COVERAGE (ADR-298 Phase B.1, 2026-04-11)
  // employment_records    → moved to COVERAGE (ADR-298 Phase C.7, 2026-04-14)
  // — Files / CAD — (all moved to COVERAGE in ADR-298 Phase C.2+C.3, 2026-04-14)
  // cad_files            → moved to COVERAGE (ADR-298 Phase C.2, 2026-04-14)
  // file_shares          → moved to COVERAGE (ADR-298 Phase C.3, 2026-04-14)
  // photo_shares         → moved to COVERAGE (ADR-298 Phase C.3, 2026-04-14)
  // file_comments        → moved to COVERAGE (ADR-298 Phase C.3, 2026-04-14)
  // file_approvals       → moved to COVERAGE (ADR-298 Phase C.3, 2026-04-14)
  // document_templates   → moved to COVERAGE (ADR-298 Phase C.3, 2026-04-14)
  // file_webhooks        → moved to COVERAGE (ADR-298 Phase C.3, 2026-04-14)
  // file_folders         → moved to COVERAGE (ADR-298 Phase C.3, 2026-04-14)
  // file_audit_log       → moved to COVERAGE (ADR-298 Phase C.3, 2026-04-14)
  // — Companies / users / workspaces — (all moved to COVERAGE in ADR-298 Phase C.6, 2026-04-14)
  // companies                  → moved to COVERAGE (ADR-298 Phase C.6, 2026-04-14)
  // security_roles             → moved to COVERAGE (ADR-298 Phase C.6, 2026-04-14)
  // users                      → moved to COVERAGE (ADR-298 Phase C.6, 2026-04-14)
  // user_notification_settings → moved to COVERAGE (ADR-298 Phase C.6, 2026-04-14)
  // user_2fa_settings          → moved to COVERAGE (ADR-298 Phase C.6, 2026-04-14)
  // workspaces                 → moved to COVERAGE (ADR-298 Phase C.6, 2026-04-14)
  // teams                      → moved to COVERAGE (ADR-298 Phase C.6, 2026-04-14)
  // positions                  → moved to COVERAGE (ADR-298 Phase C.6, 2026-04-14)
  // — Building / property hierarchy —
  // floors, properties, storage_units, parking_spots → moved to COVERAGE (ADR-298 Phase B.4, 2026-04-13)
  // project_floorplans     → moved to COVERAGE (ADR-298 Phase C.2, 2026-04-14)
  // building_floorplans    → moved to COVERAGE (ADR-298 Phase C.2, 2026-04-14)
  // floor_floorplans       → moved to COVERAGE (ADR-298 Phase C.2, 2026-04-14)
  // unit_floorplans        → moved to COVERAGE (ADR-298 Phase C.2, 2026-04-14)
  // floorplans             → moved to COVERAGE (ADR-298 Phase C.2, 2026-04-14)
  // admin_building_templates → moved to COVERAGE (ADR-298 Phase C.2, 2026-04-14)
  // — DXF / CAD overlays —
  // dxf_overlay_levels → moved to COVERAGE (ADR-298 Phase C.2, 2026-04-14; renamed from dxfOverlayLevels 2026-04-16)
  // layers           → moved to COVERAGE (ADR-298 Phase C.2, 2026-04-14)
  // layer_groups     → moved to COVERAGE (ADR-298 Phase C.2, 2026-04-14)
  // — DXF Viewer levels (post-rename underscore collections, 2026-04-16) —
  'dxf_viewer_levels',    // lines 3097-3117 — tenant read + bootstrap create
  'dxf_viewer_view_templates',   // lines 3474-3511 — ADR-375 Phase B.3 BIM render-settings presets
  'dxf_viewer_pen_tables',       // lines 3519-3534 — ADR-375 Phase C.1 per-company pen table singleton
  'dxf_dimension_styles',        // ADR-362 Phase F4 — per-company custom DIMSTYLE + isDefault pointer (view_templates rule shape)
  // — Sharing (ADR-312 Phase 2 Property Showcase + ADR-315 Unified Sharing) —
  // TODO(ADR-298 Phase D): write full matrix for shares + share_dispatches
  'shares',               // lines 2428-2447 — ADR-312/315 unified sharing link tokens
  'share_dispatches',     // lines 2454-2463 — ADR-312/315 share dispatch events
  // dxf_overlay_levels → moved to COVERAGE (renamed from camelCase, 2026-04-16)
  // — Navigation / notifications / tasks —
  // navigation_companies → moved to COVERAGE (ADR-298 Phase C.5, 2026-04-13)
  // notifications        → moved to COVERAGE (ADR-298 Phase C.7, 2026-04-14)
  // tasks        → moved to COVERAGE (ADR-298 Phase C.5, 2026-04-13)
  // appointments → moved to COVERAGE (ADR-298 Phase C.5, 2026-04-13)
  // — CRM —
  // communications → moved to COVERAGE (ADR-298 Phase C.5, 2026-04-13)
  // leads, opportunities, activities → moved to COVERAGE (ADR-298 Phase B.3, 2026-04-13)
  // conversations, external_identities → moved to COVERAGE (ADR-298 Phase B.5, 2026-04-13)
  // — System / config —
  // system              → moved to COVERAGE (ADR-298 Phase C.5, 2026-04-13)
  // config              → moved to COVERAGE (ADR-298 Phase C.5, 2026-04-13)
  // email_domain_policies     → moved to COVERAGE (ADR-298 Phase C.5, 2026-04-13)
  // country_security_policies → moved to COVERAGE (ADR-298 Phase C.5, 2026-04-13)
  // counters → moved to COVERAGE (ADR-298 Phase C.5, 2026-04-13)
  // analytics → moved to COVERAGE (ADR-298 Phase C.5, 2026-04-13)
  // bot_configs → moved to COVERAGE (ADR-298 Phase C.5, 2026-04-13)
  // — Obligations / compliance —
  // obligations, obligation_transmittals, obligation_templates → moved to COVERAGE (ADR-298 Phase B.6, 2026-04-13)
  // — Audit / search / voice — (all moved to COVERAGE in ADR-298 Phase C.7, 2026-04-14)
  // audit_logs        → moved to COVERAGE (ADR-298 Phase C.7, 2026-04-14)
  // system_audit_logs → moved to COVERAGE (ADR-298 Phase C.7, 2026-04-14)
  // audit_log         → moved to COVERAGE (ADR-298 Phase C.7, 2026-04-14)
  // search_documents  → moved to COVERAGE (ADR-298 Phase C.7, 2026-04-14)
  // voice_commands    → moved to COVERAGE (ADR-298 Phase C.7, 2026-04-14)
  // — BoQ / commissions / ownership —
  // boq_items            → moved to COVERAGE (ADR-298 Phase C.4, 2026-04-14)
  // boq_categories       → moved to COVERAGE (ADR-298 Phase C.4, 2026-04-14)
  // brokerage_agreements → moved to COVERAGE (ADR-298 Phase C.4, 2026-04-14)
  // commission_records   → moved to COVERAGE (ADR-298 Phase C.4, 2026-04-14)
  // ownership_tables     → moved to COVERAGE (ADR-298 Phase C.4, 2026-04-14)
  // — Accounting (sole proprietor subapp) —
  // accounting_journal_entries      → moved to COVERAGE (ADR-298 Phase B.2, 2026-04-13)
  // accounting_invoices             → moved to COVERAGE (ADR-298 Phase B.2, 2026-04-13)
  // accounting_audit_log            → moved to COVERAGE (ADR-298 Phase B.2, 2026-04-13)
  // accounting_bank_transactions    → moved to COVERAGE (ADR-298 Phase C.1, 2026-04-13)
  // accounting_bank_accounts        → moved to COVERAGE (ADR-298 Phase C.1, 2026-04-13)
  // accounting_fixed_assets         → moved to COVERAGE (ADR-298 Phase C.1, 2026-04-13)
  // accounting_depreciation_records → moved to COVERAGE (ADR-298 Phase C.1, 2026-04-13)
  // accounting_expense_documents    → moved to COVERAGE (ADR-298 Phase C.1, 2026-04-13)
  // accounting_import_batches       → moved to COVERAGE (ADR-298 Phase C.1, 2026-04-13)
  // accounting_tax_installments     → moved to COVERAGE (ADR-298 Phase C.1, 2026-04-13)
  // accounting_apy_certificates     → moved to COVERAGE (ADR-298 Phase C.1, 2026-04-13)
  // accounting_custom_categories    → moved to COVERAGE (ADR-298 Phase C.1, 2026-04-13)
  // accounting_matching_rules       → moved to COVERAGE (ADR-298 Phase C.1, 2026-04-13)
  // accounting_efka_payments        → moved to COVERAGE (ADR-298 Phase C.1, 2026-04-13)
  // accounting_fiscal_periods       → moved to COVERAGE (ADR-298 Phase C.1, 2026-04-13)
  // accounting_settings             → moved to COVERAGE (ADR-298 Phase C.1, 2026-04-13)
  // accounting_efka_config          → moved to COVERAGE (ADR-298 Phase C.1, 2026-04-13)
  // accounting_invoice_counters     → moved to COVERAGE (ADR-298 Phase C.1, 2026-04-13)
  // accounting_customer_balances    → moved to COVERAGE (ADR-298 Phase C.1, 2026-04-13)
  // — Quotes / RFQ / Vendor Portal (ADR-327 P1a, 2026-04-25) —
  // TODO(ADR-298 Phase E): write full matrix for quotes + rfqs
  'rfqs',                   // Admin SDK writes only; read: auth + companyId
  'quotes',                 // Admin SDK writes only; vendor portal path in P3
  'quote_counters',         // Admin SDK only — no client access
  'vendor_invites',         // Admin SDK writes only; read: auth + companyId
  'vendor_invite_tokens',   // Admin SDK only — no client access
  'trades',                 // read: isAuthenticated(); write: Admin SDK only
  // — Multi-Vendor (ADR-327 §17 Q28-Q32 step b, 2026-04-29) —
  // Sub-collection rfqs/{id}/lines parses as 'rfqs' (already pending).
  // Full matrix lands in step (c) once services exist to drive seeding.
  'sourcing_events',        // Admin SDK writes only; read: auth + companyId
  // — Material Catalog (ADR-330 Phase 2, 2026-05-03) —
  'materials',              // lines 3403-3411 — tenant read + admin write
  // — Framework Agreements (ADR-330 Phase 5, 2026-05-04) —
  'framework_agreements',   // tenant read + admin write
  // — UserSettings SSoT (2026-05-08) —
  'user_preferences',       // lines 1458-1485 — ownership + tenant isolation, schemaVersion floor
  // company_fonts  → moved to COVERAGE (ADR-344 Phase 6.F, 2026-05-11)
  // text_templates → moved to COVERAGE (ADR-344 Phase 7.E, 2026-05-11)
  // — DXF Stair Tool (ADR-358 Phase 8, 2026-05-17) —
  // floorplan_stairs → moved to COVERAGE (ADR-657 canary, bim_presentation, 2026-07-15)
  // — DXF Layer State Templates (ADR-358 §5.9 Q12 Phase 13B, 2026-05-17) —
  'dxf_layer_state_templates',  // lines 4154-4192 — tenant-scoped CRUD; full matrix in Phase 13B.X
  'dxf_template_categories',    // lines 4209-4236 — tenant-scoped read + admin write; full matrix in Phase 13B.X
  // — BIM Drawing Mode (ADR-363 Phase 0, 2026-05-17) —
  // floorplan_walls → moved to COVERAGE (ADR-657 canary, bim_presentation, 2026-07-15)
  'floorplan_openings',         // lines 3560-3582 — tenant-scoped CRUD; full matrix in ADR-363 Phase 1.X
  'floorplan_slabs',            // lines 3584-3606 — tenant-scoped CRUD; full matrix in ADR-363 Phase 1.X
  'floorplan_slab_openings',    // lines 3608-3630 — tenant-scoped CRUD; full matrix in ADR-363 Phase 1.X
  'floorplan_columns',          // lines 3632-3654 — tenant-scoped CRUD; full matrix in ADR-363 Phase 1.X
  'floorplan_beams',            // lines 3656-3678 — tenant-scoped CRUD; full matrix in ADR-363 Phase 1.X
  // floorplan_foundations → moved to COVERAGE (ADR-657 canary, bim_authoring 'kind+params', 2026-07-15)
  // floorplan_grid_guides → moved to COVERAGE (ADR-657 canary, bim_authoring 'guides', 2026-07-15)
  'floorplan_mep_fixtures',     // ADR-406 — tenant-scoped CRUD (mirror columns/beams); full matrix with the BIM batch
  'floorplan_railings',         // ADR-407 — tenant-scoped CRUD (mirror mep_fixtures); full matrix with the BIM batch
  // floorplan_mep_systems → moved to COVERAGE (ADR-657 canary, bim_authoring 'params', 2026-07-15)
  'floorplan_electrical_panels', // ADR-408 Φ3 — tenant-scoped CRUD (mirror mep_fixtures); full matrix with the BIM batch
  'floorplan_furniture',        // ADR-410 — tenant-scoped CRUD (mirror mep_fixtures); full matrix with the BIM batch
  'floorplan_imported_meshes',  // ADR-683 Φ3β — tenant-scoped CRUD (exact mirror of furniture); full matrix with the BIM batch
  'floorplan_generic_solids',   // ADR-684 — tenant-scoped CRUD (exact mirror of imported_meshes); full matrix with the BIM batch
  'floorplan_mep_segments',     // ADR-408 Φ8 — tenant-scoped CRUD (duct/pipe linear element, mirror mep_fixtures); full matrix with the BIM batch
  'floorplan_mep_fittings',     // ADR-408 Φ11 — tenant-scoped CRUD (auto pipe fittings, mirror mep_segments); full matrix with the BIM batch
  'floorplan_mep_manifolds',    // ADR-408 Φ12 — tenant-scoped CRUD (plumbing manifold / συλλέκτης, mirror electrical_panels); full matrix with the BIM batch
  'floorplan_mep_radiators',    // ADR-408 Εύρος Β — tenant-scoped CRUD (heating radiator / καλοριφέρ, mirror mep_manifolds); full matrix with the BIM batch
  // floorplan_symbols → moved to COVERAGE (ADR-657 canary, bim_authoring 'category+kind+params', 2026-07-15)
  'bim_presets',                // lines 3680-3702 — tenant-scoped CRUD; full matrix in ADR-363 Phase 1.X
  'bim_materials',              // lines 3704-3723 — tenant-scoped CRUD; full matrix in ADR-363 Phase 1.X
  'bim_settings',               // lines 3725-3737 — tenant-scoped CRUD; full matrix in ADR-363 Phase 1.X
  // — BIM 3D Preferences (ADR-366 Phase 4.3, 2026-05-21) —
  'bim_3d_preferences',         // lines 3744-3762 — owner-only (docId == b3dpref_${auth.uid}); full matrix later
  // — BIM 3D Dimensions (ADR-366 Phase 9 C.3, 2026-05-22) —
  'bim_dimensions_3d',          // lines 3770-3821 — tenant-scoped CRUD (companyId+projectId immutable, mode/unit/precision validation); full matrix later
  // — Construction Alerts (ADR-266 §5.8 Phase D.3, 2026-05-21) —
  'construction_alerts',        // tenant-scoped read + server-only create + dismiss-only update; full matrix later
  // — BIM 3D Comments (ADR-373 Phase 2.3, 2026-05-24) —
  'bim_comments',               // lines 3829-3918 — tenant-scoped CRUD; full matrix later
  // — ISO 19650 Enrichment (ADR-373 Phase 2.4, 2026-05-24) —
  'iso19650_enrichment_slots',  // lines 3920-3927 — token bucket (Admin SDK only); full matrix later
  'iso19650_cost_log',          // lines 3934-3941 — audit log (Admin SDK only); full matrix later
  // — BIM 3D Performance Diagnostics (ADR-366 Phase 7 Group B.5, 2026-05-24) —
  'performance_diagnostics',    // lines 4653-4675 — public (unauthenticated) write for performance telemetry; full matrix later
  // — BIM 3D Anonymous Telemetry (ADR-366 §C.7.Q3, 2026-05-24) —
  'bim_performance_telemetry',  // super-admin-only read + deny-all-client writes (server-only Admin SDK via /api/telemetry/bim-performance); full matrix later
  // — BIM 3D Animations (ADR-366 C.1, 2026-05-25) —
  'bim_animations',             // lines 3926-4034 — tenant-scoped CRUD; full matrix later
  // — BIM MEP Boiler (ADR-408 Εύρος Β2, 2026-06-06) —
  'floorplan_mep_boilers',      // lines 3999-4021 — tenant-scoped CRUD (heating boiler / λέβητας, mirror mep_manifolds); full matrix with the BIM batch
  // — BIM MEP Underfloor (ADR-408 Εύρος Β3, 2026-06-08) —
  'floorplan_mep_underfloors',  // area-based underfloor radiant heating loops (ενδοδαπέδια, mirror mep_boilers); full matrix with the BIM batch
  // — BIM Floor Finish (ADR-419, 2026-06-06) —
  'floorplan_floor_finishes',   // lines 4100-4120 — tenant-scoped CRUD (per-room floor finish, mirror floorplan_walls); full matrix with the BIM batch
  // — BIM Thermal Spaces (ADR-422, 2026-06-08) —
  'floorplan_thermal_spaces',   // analytical thermal spaces per room (IfcSpace, mirror floorplan_floor_finishes); full matrix with the BIM batch
  // — BIM Space Separators (ADR-437, 2026-06-10) —
  'floorplan_space_separators', // room/space separator lines (IfcVirtualElement, mirror floorplan_thermal_spaces); full matrix with the BIM batch
  // — BIM MEP Water Heater / DHW (ADR-408, 2026-06-08) —
  'floorplan_mep_water_heaters', // lines 4025-4047 — tenant-scoped CRUD (DHW water heater / θερμοσίφωνας, mirror mep_boilers); full matrix with the BIM batch
  // — BIM Hatch Fills (ADR-507, 2026-06-21) —
  // floorplan_hatches → moved to COVERAGE (ADR-657 canary, bim_authoring 'data', 2026-07-15)
  // — BIM Wall Finish per Room/Face (ADR-511, 2026-06-21) —
  'floorplan_wall_coverings',   // lines 4226-4246 — tenant-scoped CRUD (IfcCovering wall finish per room/face, mirror floorplan_floor_finishes; payload is `params`); full matrix with the BIM batch
  // — BIM Roof Persistence (ADR-417, 2026-06-22) —
  'floorplan_roofs',            // lines 3747-3769 — tenant-scoped CRUD (BIM roof persistence, mirror floorplan_hatches; payload is `data`); full matrix with the BIM batch
] as const;

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

export function findCoverage(collection: string): CollectionCoverage | undefined {
  return FIRESTORE_RULES_COVERAGE.find((c) => c.collection === collection);
}

export function isPending(collection: string): boolean {
  return FIRESTORE_RULES_PENDING.includes(collection);
}

export function isTrackedCollection(collection: string): boolean {
  return findCoverage(collection) !== undefined || isPending(collection);
}
