/**
 * ΤΟ ΜΗΤΡΩΟ «ΠΟΡΤΕΣ ΑΡΧΕΙΟΥ-ΥΛΙΚΟΥ» — **μία** αλήθεια (ADR-845 §7.17 Α6, κλάση Ο-35)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΙ ΑΠΑΝΤΑ
 * ─────────────────────────────────────────────────────────────────────────────
 * *«Ποιος μπορεί να αλλάξει τι βλέπει το κοινό σε μια αγγελία — και ξαναπροβάλλει;»*
 *
 * 🔴 **ΤΟ ΓΕΓΟΝΟΣ** (μετρημένο ζωντανά 2026-10-08): `classification: public → internal` άφηνε τη
 * φωτογραφία στην αγγελία και το `.webp` της με HTTP 200 στο δημόσιο ράφι. Οι Α1–Α3γ έκαναν
 * **κάθε γνωστή** πόρτα να ξαναπροβάλλει· τίποτα δεν εμπόδιζε την **επόμενη** να το ξεχάσει.
 *
 * 🔑 **ΔΥΟ ΕΡΩΤΗΜΑΤΑ, ΠΟΤΕ ΕΝΑ ΜΕ «Ή»**:
 * - **Κ5** — *«καλεί γραφέα του κατηγορήματος;»* ⇒ οφείλει γραμμή εδώ, και αν δηλώνει
 *   `refresh` οφείλει να **καλεί** βοηθό επαναπροβολής.
 * - **Κ6** — *«γράφει πεδίο του κατηγορήματος ΜΕ ΤΟ ΧΕΡΙ;»* ⇒ οφείλει γραμμή εδώ.
 *
 * ⛔ **ΤΙ ΑΠΟΡΡΙΦΘΗΚΕ, ΜΕΤΡΗΜΕΝΟ**: κριτήριο *«όποιος γράφει στη `files`»*. Η συλλογή πιάνεται
 * από **τέσσερις** δρόμους (`COLLECTIONS.FILES` 59 αρχεία · `FILE_COLLECTION[…]` 17 ·
 * `fileResource` 16 · `doc.ref` από ερώτημα), οι περισσότεροι **αναγνώστες**· και οι τρεις
 * γραφείς της Ο-35 δεν γράφουν **καν** το όνομα της συλλογής — παίρνουν έτοιμο `ref`. Τέτοιο
 * κριτήριο θα ήταν ή τυφλό στους σημαντικούς ή ~85 χειρόγραφοι λόγοι.
 *
 * @module scripts/lib/listing-model-custody/material-doors-contract
 */

/**
 * **Οι γραφείς του κατηγορήματος δημοσίευσης.** Κριτήριο ένταξης, μετρήσιμο: *η συνάρτηση
 * γράφει πεδίο του `LISTING_FILE_PUBLICATION_FIELDS` σε υπάρχον αρχείο*.
 */
const PUBLICATION_WRITERS = Object.freeze({
  writeFileClassification:
    'Α1 — η διαβάθμιση. `public ⇄ internal` είναι ο φρουρός #1 της δημοσίευσης: όποιος την ' +
    'αλλάξει χωρίς επαναπροβολή αφήνει στο κοινό φωτογραφία που η εταιρεία απέσυρε.',
  writeFileTrashState:
    'Α2 — ο κάδος. Αρχείο στον κάδο δεν είναι παραδοτέο· χωρίς επαναπροβολή η αγγελία δείχνει ' +
    'υλικό που ο άνθρωπος έσβησε.',
  writeFileArchiveState:
    'Α3 — η αρχειοθέτηση. Αρχειοθέτηση = απόσυρση, επαναφορά = επαναδημοσίευση.',
  transitionContainer:
    'Α3 — οι πράξεις δοχείου (ISO 19650). Η αντικατάσταση αρχειοθετεί την κεφαλή και γεννά ' +
    'διάδοχο· το κατηγόρημα ρωτά και τα δύο.',
  promoteVersion:
    'Α3 — η προώθηση έκδοσης. Αλλάζει ποιο αρχείο είναι το τρέχον, πιθανώς σε ΑΛΛΟ ακίνητο.',
});

/**
 * **Οι βοηθοί επαναπροβολής** — το πέρασμα από οποιονδήποτε **μετρά** ως κάλυψη.
 *
 * ⚠️ Το `runFileBatch` είναι εδώ επίτηδες: η επαναπροβολή είναι **μέσα** του, οπότε μια πόρτα
 * δέσμης δεν καλεί ποτέ η ίδια το `refreshListingsAfterFileChanges`.
 */
const REFRESH_HELPERS = Object.freeze({
  refreshListingsAfterFileChanges:
    'Ο ΕΝΑΣ βοηθός: μία επαναπροβολή ανά ακίνητο, για όσα αρχεία άλλαξαν.',
  refreshListingAfterMediaChange:
    'Η ίδια επαναπροβολή για ΕΝΑ ακίνητο — όταν αλλάζει η δήλωση, όχι αρχείο.',
  refreshListingsOfFloor:
    'Η ίδια επαναπροβολή για τις δημοσιευμένες μονάδες ΕΝΟΣ ορόφου — όταν αλλάζει η δήλωση κάτοψης ορόφου (ADR-907 §11.7).',
  runFileBatch:
    'Ο σκελετός δέσμης (διαβάθμιση · κάδος · αρχειοθέτηση): κρίνει, τρέχει, ξαναπροβάλλει.',
  publishPropertyMaterial:
    'Ο κορμός δημοσίευσης υλικού από το σχέδιο (μοντέλο · παραγόμενη κάτοψη, ADR-909 Β1): γράφει, ' +
    'αρχειοθετεί τους προκατόχους και ξαναπροβάλλει ΤΕΛΕΥΤΑΙΟ. Όπως το `runFileBatch`, η επαναπροβολή είναι ΜΕΣΑ του.',
});

/**
 * **Το σήμα του Κ6** — τρεις όροι **μαζί**, σε γραμμές που εκτελούνται.
 *
 * 🔶 **ΤΡΙΑ από τα δεκατρία πεδία, επίτηδες**: τα μόνα που δεν είναι κοινές λέξεις. Τα `status` ·
 * `category` · `isDeleted` υπάρχουν σε δεκάδες άσχετες συλλογές· μετρημένο, το `classification:`
 * **σκέτο** πιάνει 68 αρχεία, τα περισσότερα στο BIM του dxf-viewer. Με τους τρεις όρους: **6**.
 */
const HAND_WRITE = Object.freeze({
  field: /(?:^|[{,(\s])(classification|lifecycleState|publicationIdentity)\s*:(?!:)/,
  road: /COLLECTIONS\.FILES\b|FILE_COLLECTION\[|\bfileResource\b|\bFileRecord\b/,
  verb: /\.update\(|\.set\(|\bupdateDoc\(|\bsetDoc\(|\bversionedWrite\b/,
});

/** Οι δύο νόμιμες απαντήσεις μιας πόρτας. */
const DOOR_COVER = Object.freeze({ REFRESH: 'refresh', EXEMPT: 'exempt' });

const SUPERSESSION_REASON =
  'ΕΣΩΤΕΡΙΚΟ ΒΗΜΑ του κορμού `publishPropertyMaterial`: αρχειοθετεί τους προκατόχους μέσα στην ίδια αίτηση, και ' +
  'ο κορμός ξαναπροβάλλει ΜΙΑ φορά στο τέλος. Δεύτερη κλήση εδώ θα έψηνε το ράφι δύο φορές.';

const CONTACT_FILES_REASON =
  'Γράφει ΜΟΝΟ αρχεία επαφής (`entityType == contact` στο ίδιο το ερώτημα). Η αγγελία παράγεται ' +
  'από αρχεία ΑΚΙΝΗΤΟΥ· κανένα αρχείο επαφής δεν φτάνει στο κοινό, άρα δεν υπάρχει τι να ξαναπροβληθεί.';

/**
 * **Το κλειστό μητρώο.** Διαδρομές POSIX, σχετικές με τη ρίζα· **υποχρεωτικός λόγος** ≥40
 * χαρακτήρων ανά εγγραφή *(δήλωση χωρίς λόγο είναι παράκαμψη με άλλο όνομα)*.
 *
 * ⚠️ Τα αρχεία που **ορίζουν** γραφέα ή βοηθό δεν γράφονται εδώ: κρίνονται οι **καλούντες** τους.
 * ⛔ Ο browser δεν είναι εδώ και δεν μπορεί να είναι: δεν έχει πώς να ξαναπροβάλει. Τον κλείνει η
 *    Α4 (κανόνες). Τα **προσωπικά** αρχεία (`files_personal`) μένουν στον πελάτη **επίτηδες** —
 *    δεν ανήκουν σε εταιρεία, άρα ποτέ σε αγγελία.
 */
const MATERIAL_DOORS = Object.freeze({
  'src/app/api/files/classification/route.ts': {
    cover: DOOR_COVER.REFRESH,
    reason: 'Α1 — η πόρτα της διαβάθμισης. Περνά από το `runFileBatch`, που ξαναπροβάλλει μία φορά ανά ακίνητο.',
  },
  'src/app/api/files/trash/route.ts': {
    cover: DOOR_COVER.REFRESH,
    reason: 'Α2 — η ΜΙΑ πόρτα του κάδου των εταιρικών αρχείων (και των σχεδίων DXF). Περνά από το `runFileBatch`.',
  },
  'src/app/api/files/archive/route.ts': {
    cover: DOOR_COVER.REFRESH,
    reason: 'Α3 — η πόρτα της αρχειοθέτησης. Περνά από το `runFileBatch`, ο τρίτος καλών του ίδιου σκελετού.',
  },
  'src/app/api/files/[fileId]/cde/route.ts': {
    cover: DOOR_COVER.REFRESH,
    reason: 'Α3 — οι πράξεις δοχείου. Ξαναπροβάλλει στο επίπεδο της route, μετά από ΚΑΘΕ πράξη που έγινε.',
  },
  'src/app/api/files/[fileId]/versions/promote/route.ts': {
    cover: DOOR_COVER.REFRESH,
    reason: 'Α3 — η προώθηση έκδοσης. Ξαναπροβάλλει το ακίνητο της πηγής ΚΑΙ της κεφαλής, που μπορεί να διαφέρουν.',
  },
  'src/app/api/files/gdpr-delete/route.ts': {
    cover: DOOR_COVER.REFRESH,
    reason: 'Α3 — η διαγραφή ΓΚΠΔ. Τα bytes σβήνονται και η εγγραφή γίνεται `purged`· ξαναπροβάλλει αμέσως μετά.',
  },
  'src/app/api/properties/[id]/model/route.ts': {
    cover: DOOR_COVER.REFRESH,
    reason: 'ADR-845 §7.16 — το ανέβασμα μοντέλου. Η πρώτη πόρτα της κλάσης· περνά από τον κορμό `publishPropertyMaterial`.',
  },
  'src/app/api/properties/[id]/floorplan/route.ts': {
    cover: DOOR_COVER.REFRESH,
    reason:
      'ADR-909 Β1 — η δημοσίευση κάτοψης από το σχέδιο. Γεννά δημόσιο αρχείο και αρχειοθετεί την προηγούμενη ' +
      'παραγόμενη του ίδιου επιπέδου· περνά από τον κορμό `publishPropertyMaterial`, που ξαναπροβάλλει στο τέλος.',
  },
  'src/app/api/properties/[id]/listing-media/route.ts': {
    cover: DOOR_COVER.REFRESH,
    reason: 'Α5β — «ξαναφτιάξε την αγγελία από το τρέχον υλικό». Δεν γράφει αρχείο· ΕΙΝΑΙ η επαναπροβολή κατά παραγγελία.',
  },
  'src/app/api/floors/[floorId]/floor-plate/route.ts': {
    cover: DOOR_COVER.REFRESH,
    reason:
      'ADR-907 §11.7 — η υπογραφή και η άρση της δήλωσης κάτοψης ορόφου. Δεν γράφει αρχείο· γράφει στον ΟΡΟΦΟ, και η ' +
      'κάτοψη είναι υλικό κάθε αγγελίας του. Ξαναπροβάλλει ΤΕΛΕΥΤΑΙΟ, μέσω του `refreshListingsOfFloor`.',
  },
  'src/app/api/properties/[id]/_shared/material-supersession.ts': {
    cover: DOOR_COVER.EXEMPT,
    reason: SUPERSESSION_REASON,
  },
  'src/app/api/cad-files/dual-write-to-files.ts': {
    cover: DOOR_COVER.EXEMPT,
    reason:
      'Γράφει `lifecycleState: active` ΜΟΝΟ στη ΓΕΝΝΗΣΗ της εγγραφής (`isCreate`) και ποτέ `classification`: ' +
      'αρχείο που μόλις γεννήθηκε δεν είναι `public`, άρα η αγγελία δεν αλλάζει. Η αποθήκευση δεν ανασταίνει από τον κάδο (Α2).',
  },
  'src/app/api/contacts/[contactId]/route.ts': { cover: DOOR_COVER.EXEMPT, reason: CONTACT_FILES_REASON },
  'src/app/api/contacts/[contactId]/restore/route.ts': { cover: DOOR_COVER.EXEMPT, reason: CONTACT_FILES_REASON },
  'src/app/api/quotes/scan/quote-file-record-writer.ts': {
    cover: DOOR_COVER.EXEMPT,
    reason:
      'ΓΕΝΝΗΣΗ εγγραφής για σάρωση προσφοράς (`entityType` προσφοράς, χωρίς `classification`). ' +
      'Δεν αγγίζει υπάρχον αρχείο και δεν ανήκει σε ακίνητο — καμία αγγελία δεν το διαβάζει.',
  },
  'src/services/file-record/file-purge-helpers.ts': {
    cover: DOOR_COVER.EXEMPT,
    reason:
      'Η ΟΡΙΣΤΙΚΗ διαγραφή. Φτάνει εδώ μόνο αρχείο ΗΔΗ εκτός κοινού: του κάδου μετά τη διατήρηση (cron) ή ' +
      '`pending`/`failed` (εργαλείο AI). Ο κάδος ξαναπρόβαλε όταν μπήκε· το `purged` δεν αλλάζει τίποτα ορατό.',
  },
});

/** Οι καταστάσεις των πορτών — **κλειστό σύνολο, fail-closed**. */
const DOOR_STATES = Object.freeze({
  /** ⛔ Κ5 — καλεί γραφέα ή βοηθό και δεν είναι στο μητρώο. */
  UNREGISTERED_DOOR: 'unregistered-door',
  /** ⛔ Κ6 — γράφει πεδίο του κατηγορήματος με το χέρι και δεν είναι στο μητρώο. */
  UNREGISTERED_WRITER: 'unregistered-writer',
  /** ⛔ Κ5 — δηλώνει `refresh` και δεν καλεί πια κανέναν βοηθό. */
  DOOR_WITHOUT_REFRESH: 'door-without-refresh',
  /** ✅ Δηλωμένη, ξαναπροβάλλει. */
  DOOR: 'door',
  /** ✅ Δηλωμένη εξαίρεση, με λόγο. */
  EXEMPT_DOOR: 'exempt-door',
  /** ✅ Ορίζει γραφέα ή βοηθό — κρίνονται οι καλούντες του. */
  DOOR_DEFINER: 'door-definer',
  /** Δεν αγγίζει το κατηγόρημα — ο μεγάλος πληθυσμός. */
  NOT_A_DOOR: 'not-a-door',
});

/** Οι καταστάσεις **του ίδιου του μητρώου** — ξεχωριστό κατάστιχο (πρότυπο Κ1′). */
const REGISTRY_STATES = Object.freeze({
  /** ⛔ Εγγραφή που δεν αντιστοιχεί πια σε πόρτα: το μητρώο σάπισε σιωπηλά. */
  ORPHAN_DOOR: 'orphan-door',
  /** ⛔ Εγγραφή χωρίς ουσιαστικό λόγο, ή με άγνωστη κάλυψη. */
  REASONLESS_DOOR: 'reasonless-door',
  /** ⛔ Γραφέας ή βοηθός χωρίς κανέναν καλούντα εκτός δοκιμών — νεκρός μηχανισμός. */
  ORPHAN_DOOR_SYMBOL: 'orphan-door-symbol',
  /** ✅ Κάθε εγγραφή ζει, έχει λόγο, και κάθε σύμβολο έχει καλούντα. */
  REGISTRY_HEALTHY: 'registry-healthy',
});

module.exports = {
  DOOR_COVER,
  DOOR_STATES,
  HAND_WRITE,
  MATERIAL_DOORS,
  PUBLICATION_WRITERS,
  REFRESH_HELPERS,
  REGISTRY_STATES,
};
