/**
 * Το **λεξιλόγιο** του αγωγού εισαγωγής (ADR-923 §5.5.1) — κλειστά σύνολα, μία δήλωση, και τα όρια της ανάγνωσης PDF.
 * @module subapps/catalog/vocabulary/catalog-import
 */

/** Από πού έρχονται τα δεδομένα. Νέα πηγή (§18 σύνδεσμος · ETIM xChange, Φάση 7) = νέα γραμμή εδώ και προσαρμογέας προς `ExtractedGroup`. */
export const IMPORT_SOURCE_KINDS = ['delimited', 'spreadsheet', 'pdf', 'etimXchange'] as const;
export type ImportSourceKind = (typeof IMPORT_SOURCE_KINDS)[number];

/** Πηγή με πίνακα, άρα με προφίλ στηλών. Το PDF έχει σελίδες, και το xChange δικό του σχήμα. */
export const isTableImportSource = (kind: ImportSourceKind): boolean => kind === 'delimited' || kind === 'spreadsheet';

/** `attributes` = μοντέλα/SKU · `priceLines` = «μόνο τιμές»: δεν αγγίζει τίποτα εκτός από γραμμές τιμοκαταλόγου (§5.4). */
export const IMPORT_PURPOSES = ['attributes', 'priceLines'] as const;
export type ImportPurpose = (typeof IMPORT_PURPOSES)[number];

/**
 * Ποιοι σκοποί **παρτίδας** διαβάζονται από κάθε πηγή. Το PDF δίνει μόνο ιδιότητες (η ανάγνωση σελίδας ζητά οικογένεια)· η τιμή της
 * **ίδιας** ανάγνωσης πάει σε δεύτερη πρόταση `priceLines`, όταν η παρτίδα δηλώνει πρόχειρη έκδοση (§5.5.2 Β4). Το xChange φέρνει
 * και τιμές (`TradeItem.Pricing`, §23.2 K4γ).
 */
export const IMPORT_SOURCE_PURPOSES: Readonly<Record<ImportSourceKind, readonly ImportPurpose[]>> = {
  delimited: IMPORT_PURPOSES,
  spreadsheet: IMPORT_PURPOSES,
  pdf: ['attributes'],
  etimXchange: IMPORT_PURPOSES,
};

/**
 * Ο κύκλος ζωής της παρτίδας: `reviewing` όσο υπάρχουν προτάσεις σε εκκρεμότητα · `closed` μόλις κριθούν όλες και δεν μένει
 * αποτυχημένη σελίδα (`settleImportBatch`) · `discarded` με ρητή πράξη, από οποιοδήποτε σημείο.
 */
export const IMPORT_BATCH_STATUSES = ['awaitingFile', 'mapping', 'extracting', 'reviewing', 'closed', 'discarded'] as const;
export type ImportBatchStatus = (typeof IMPORT_BATCH_STATUSES)[number];

export const IMPORT_PROPOSAL_STATUSES = ['pending', 'applied', 'rejected'] as const;
export type ImportProposalStatus = (typeof IMPORT_PROPOSAL_STATUSES)[number];

/** Διαφορά ανά πεδίο απέναντι στα ζωντανά (§5.5). */
export const IMPORT_FIELD_STATUSES = ['new', 'changed', 'unchanged', 'conflict'] as const;
export type ImportFieldStatus = (typeof IMPORT_FIELD_STATUSES)[number];

/** `pending` = θέλει ρητή απόφαση ανθρώπου· όσο υπάρχει, η έγκριση αρνείται. */
export const IMPORT_FIELD_DECISIONS = ['accept', 'reject', 'pending'] as const;
export type ImportFieldDecision = (typeof IMPORT_FIELD_DECISIONS)[number];

/**
 * **Ποιος** πήρε την απόφαση (§5.5.2 Α1): ο κανόνας (`defaultDecisionOf`) ή ο άνθρωπος. Τη γράφει μόνο ο διακομιστής, ώστε η
 * «αυτόματη αποδοχή» να είναι δηλωμένη και όχι συμπέρασμα της οθόνης.
 */
export const IMPORT_DECISION_SOURCES = ['rule', 'human'] as const;
export type ImportDecisionSource = (typeof IMPORT_DECISION_SOURCES)[number];

export const IMPORT_ROW_ACTIONS = ['create', 'update'] as const;
export type ImportRowAction = (typeof IMPORT_ROW_ACTIONS)[number];

export const IMPORT_PRICE_FIELDS = ['netPrice', 'priceQuantity', 'unitCode', 'discountGroup'] as const;
export type ImportPriceField = (typeof IMPORT_PRICE_FIELDS)[number];

/**
 * Ευρήματα που υπάρχουν **μόνο** στην εισαγωγή. Χωριστό σύνολο από το `CATALOG_ISSUE_CODES`, με δικό του namespace
 * (`catalog-import`): εκείνο φορτώνεται σε κάθε σελίδα καταλόγου, και τα μηνύματα αυτά δεν έχουν δουλειά εκεί.
 */
export const IMPORT_ISSUE_CODES = [
  'misaligned',
  'sharedDisagrees',
  'levelUnsupported',
  'modelCodeMissing',
  'skuUnknown',
  'priceIncomplete',
  /** Ποσό με περισσότερα δεκαδικά απ' όσα κρατά το νόμισμα: η στρογγύλευση θα άλλαζε την τιμή (§23.2 K4γ). */
  'priceAmountPrecision',
  /** Η μονάδα της γραμμής τιμής δεν είναι στο μητρώο μονάδων: ωμό κείμενο στη γραμμή θα ήταν τιμή ανά άγνωστη μονάδα. */
  'priceUnitUnknown',
  /** Μέγεθος με μετρούμενη ιδιότητα χωρίς διαβασμένη μονάδα: η προεπιλογή της ιδιότητας θα ήταν μαντεψιά (σφάλμα ×1000). */
  'measurementUnitMissing',
  /** Η μονάδα που δήλωσε το μοντέλο δεν επιβεβαιώνεται από το κείμενο της σελίδας. */
  'unitUnconfirmed',
  /** Δύο τιμές για την ίδια ιδιότητα που δεν συμφωνούν: κανένας κανόνας δεν διαλέγει σιωπηλά. */
  'attributeRepeated',
  /** Οι ετικέτες δομής του PDF και η γεωμετρία του πίνακα λένε άλλα κελιά. */
  'tableStructureDisputed',
  /**
   * «Δεν εφαρμόζεται» πάνω σε ιδιότητα με ζωντανή τιμή (§23.2 K4): η έγκριση θα **έσβηνε** την τιμή (τιμή και λόγος απουσίας
   * δεν συνυπάρχουν). Ποτέ σιωπηλά — απόφαση ανθρώπου.
   */
  'noValueReplacesValue',
  /**
   * «Άγνωστο» πάνω σε ιδιότητα με ζωντανή τιμή: ο προμηθευτής δεν μπορεί να τη δώσει **τώρα** (ETIM UN), ο κατάλογος την ξέρει.
   * Η τιμή μένει· το πεδίο φαίνεται, απορριμμένο.
   */
  'unknownKeepsValue',
  /** Το κείμενο του κελιού δεν είναι λόγος απουσίας (`notApplicable` · `unknown`). */
  'noValueReasonUnreadable',
  /**
   * Ο κωδικός της γραμμής και το GTIN της δείχνουν σε **διαφορετικά** SKU του καταλόγου (ADR-934 Σ1γ Δ3). Κανένα κλειδί δεν
   * κερδίζει σιωπηλά: η γραμμή δεν εγκρίνεται μέχρι να διορθωθεί η πηγή.
   */
  'identityKeysDisagree',
  /**
   * Γραμμή τιμής της **ίδιας** ανάγνωσης για SKU που γεννά η πρόταση ιδιοτήτων του ίδιου πίνακα (§5.5.2 Β4 Δ4–Δ5): η ταυτότητα έρχεται
   * από εκείνη. Πρώτα εγκρίνονται οι ιδιότητες, μετά η τιμή βρίσκει το SKU της· ποτέ σιωπηλή απώλεια της γραμμής.
   */
  'awaitsAttributes',
] as const;
export type ImportIssueCode = (typeof IMPORT_ISSUE_CODES)[number];

/** Ίδιο μέγεθος τυπωμένο σε δύο μονάδες (W και Btu/h): συμφωνούν μέχρι τη στρογγυλοποίηση του προμηθευτή. */
export const IMPORT_UNIT_AGREEMENT_TOLERANCE = 0.01;

/** Παρτίδα που τελείωσε δεν ξανανοίγει με το ίδιο κλειδί: το νέο ανέβασμα είναι νέα εκτέλεση. */
export const IMPORT_FINISHED_BATCH_STATUSES: readonly ImportBatchStatus[] = ['closed', 'discarded'];

/** Πόσες εκτελέσεις του ίδιου αρχείου και στόχου εξετάζονται πριν την άρνηση (φραγμένη ανάγνωση μέσα σε συναλλαγή). */
export const IMPORT_MAX_RUNS = 25;

/** Η εκτίμηση πριν από την πρώτη μέτρηση: ~$0,10 για 2 σελίδες στη δοκιμή της παραγωγής (§5.5.1). Μετά μετρά η πραγματική χρήση. */
export const IMPORT_PAGE_ESTIMATED_COST_USD = 0.05;

/** Κάτω από αυτή τη βεβαιότητα το πεδίο θέλει ρητή απόφαση (~92 % ανά πεδίο = ποτέ αυτόματη αποδοχή, §21.4). */
export const IMPORT_REVIEW_CONFIDENCE = 0.85;

/** Το ταβάνι βεβαιότητας τιμής που η AI **δεν** μπόρεσε να δείξει στο κείμενο της σελίδας: η αυτοεκτίμησή της δεν μετρά. */
export const IMPORT_UNVERIFIED_CONFIDENCE_CAP = 0.6;

/** Όριο σελίδων ανά παρτίδα PDF: ένα κεφάλαιο, όχι ολόκληρος κατάλογος (κόστος ~$0,024/σελίδα, §21.3). */
export const IMPORT_MAX_PAGES_PER_BATCH = 60;

/** Ανάλυση της εικόνας προς το μοντέλο: η τιμή που μετρήθηκε στη Φάση 0 (§21.3). */
export const IMPORT_PAGE_DPI = 150;

/** Πόσο μεγάλο αρχείο δέχεται η εισαγωγή (ο κατάλογος Aries: 138 MB). */
export const IMPORT_MAX_FILE_BYTES = 200 * 1024 * 1024;

/** Γραμμές ανά πρόταση στη ροή τιμών: ένα τμήμα = μία συναλλαγή. */
export const IMPORT_PRICE_LINES_PER_PROPOSAL = 200;

/** Παραλλαγές ανά πρόταση: το έγγραφό της μένει πολύ κάτω από το 1 MiB, με άγκυρες ανά πεδίο. */
export const IMPORT_ROWS_PER_PROPOSAL = 200;

/**
 * Γιατί μια απόφαση γραμμής **δεν** ξαναερμήνευσε τη σελίδα (§5.5.2 Β3 Γ4). Καμία δεν οδηγεί σε πληρωμένη κλήση: ο άνθρωπος ξέρει
 * τον λόγο και αποφασίζει ο ίδιος για νέα ανάγνωση.
 */
export const IMPORT_LINE_REFUSALS = [
  /** Δεν φυλάχτηκε επιτυχής απάντηση αντιστοίχισης για τη σελίδα. */
  'readingMissing',
  /** Οι προτάσεις της σελίδας βγήκαν από ανάγνωση με όραση: δεν υπάρχει αντιστοίχιση γραμμών να διορθωθεί. */
  'readingVision',
  /** Η φυλαγμένη απάντηση κόπηκε στο όριο αποθήκευσης. */
  'readingClipped',
  /** Η ανασύνθεση του πίνακα από το PDF διαφέρει από εκείνη που είδε το μοντέλο. */
  'tablesDrifted',
  /** Η πρόταση του πίνακα εγκρίθηκε ή απορρίφθηκε: δεν αλλάζει πια. */
  'proposalClosed',
  /** Η γραμμή ή η ιδιότητα δεν υπάρχει στον πίνακα ή στην οικογένεια. */
  'lineUnknown',
  /** Γραμμή τιμής (§5.5.2 Β4) σε παρτίδα χωρίς πρόχειρη έκδοση τιμοκαταλόγου: δεν υπάρχει πού να πάει η τιμή. */
  'priceTargetMissing',
  /** Ο πίνακας έχει ήδη γραμμή τιμής: δύο τιμές για το ίδιο SKU δεν διαλέγονται σιωπηλά. */
  'priceLineTaken',
] as const;
export type ImportLineRefusal = (typeof IMPORT_LINE_REFUSALS)[number];

/**
 * **Έκδοση παραγωγής** όσων γεννά από μια σελίδα η ερμηνεία πινάκων (`readPageTables`: προτάσεις · πίνακες απέξω · γραμμές χωρίς
 * πεδίο) — §5.5.2 Β3.1. Τα παράγωγα **αποθηκεύονται** στην παρτίδα· όταν αλλάζει ο παραγωγός, η παλιά σελίδα θα έμενε σιωπηλά
 * μπαγιάτικη. Όπως το Revit αναβαθμίζει αρχείο στο άνοιγμα, η σελίδα με σφραγίδα μικρότερη από αυτή ξαναχτίζεται από τη φυλαγμένη
 * ανάγνωση, χωρίς AI ($0).
 * ⚠️ **Ανέβασέ το** όταν αλλάζει ό,τι γράφει το `readPageTables` σε προτάσεις ή «απέξω». Απούσα σφραγίδα ≡ 1 (πριν το Β3: γραμμές
 *    χωρίς `regions`).
 */
export const IMPORT_PAGE_DERIVATION = 2;

/** Πού δένεται νέα ιδιότητα από γραμμή: κοινή στο μοντέλο, ή ανά τελικό κωδικό (το τελευταίο επίπεδο του σχήματος). */
export const IMPORT_LINE_BIND_LEVELS = ['shared', 'leaf'] as const;
export type ImportLineBindLevel = (typeof IMPORT_LINE_BIND_LEVELS)[number];

/** Αποφάσεις γραμμής ανά παρτίδα: 60 σελίδες × λίγες γραμμές χωρίς πεδίο, πολύ κάτω από το 1 MiB του εγγράφου. */
export const IMPORT_MAX_LINE_OVERRIDES = 600;

/**
 * Διαφορετικές αποφάσεις που κρατά το ιστορικό **ενός** κλειδιού μνήμης (§5.5.2 Β5). Δύο ήδη σημαίνουν σύγκρουση· πέρα από το όριο
 * φεύγει η λιγότερο στηριγμένη, ώστε το έγγραφο να μη μεγαλώνει χωρίς τέλος.
 */
export const IMPORT_LABEL_MEMORY_MAX_DECISIONS = 8;

/**
 * Πόσες ετικέτες δείχνει η λίστα μνήμης ενός προμηθευτή (§5.5.2 Β5.2). Πάνω από αυτό η λίστα λέει **ρητά** ότι κόπηκε (`truncated`),
 * ποτέ σιωπηλά· το ίδιο νούμερο διαβάζουν ο διακομιστής (όριο ερωτήματος) και η οθόνη (κείμενο).
 */
export const IMPORT_LABEL_MEMORY_LIST_LIMIT = 500;

/**
 * Πόσες αναγνώσεις δικαιούται μια σελίδα, σε όλες τις διαδρομές μαζί (§5.5.1). Το ίδιο όριο φράζει και τα ids των φυλαγμένων
 * απαντήσεων (`importPageReadingKey`): η ξαναερμηνεία (§5.5.2 Β3) τα βρίσκει όλα χωρίς ερώτημα.
 */
export const IMPORT_PAGE_READ_ATTEMPTS = 2;
