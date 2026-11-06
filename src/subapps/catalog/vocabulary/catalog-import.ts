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
