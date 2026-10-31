/**
 * =============================================================================
 * ΤΟ ΛΕΞΙΛΟΓΙΟ ΤΟΥ ΕΚΔΟΤΗ ΚΑΤΑΛΟΓΟΥ (ADR-923 §5.6 · §5.6.1) — ΕΝΑ ΣΗΜΕΙΟ
 * =============================================================================
 *
 * Κλειστά σύνολα που διαβάζουν zod, επικύρωση, οθόνη και προσαρμογέας μηχανής:
 *
 * | Σύνολο | Τιμές | Γιατί κλειστό |
 * |---|---|---|
 * | προφίλ εξόδου | `print` · `screen` | δύο **χωριστές** αποδόσεις: το Typst αρνείται PDF/A με CMYK (§5.6) |
 * | εύρος | `all` · `categories` · `selection` | ό,τι μπορεί να διαβάσει ντετερμινιστικά ο διακομιστής |
 * | πρότυπα | εξώφυλλο … οπισθόφυλλο | κάθε πρότυπο είναι κώδικας **και** αρχείο Typst |
 *
 * @module subapps/catalog/publishing/publication-vocabulary
 */

export const PUBLICATION_OUTPUT_PROFILES = ['print', 'screen'] as const;
export type PublicationOutputProfile = (typeof PUBLICATION_OUTPUT_PROFILES)[number];

export const PUBLICATION_SCOPE_KINDS = ['all', 'categories', 'selection'] as const;
export type PublicationScopeKind = (typeof PUBLICATION_SCOPE_KINDS)[number];

/** Τα προαιρετικά πρότυπα. Η σελίδα οικογένειας και το πλέγμα είναι το σώμα: δεν απενεργοποιούνται. */
export const PUBLICATION_OPTIONAL_TEMPLATES = ['cover', 'toc', 'chapterDivider', 'codeIndex', 'backCover'] as const;
export type PublicationOptionalTemplate = (typeof PUBLICATION_OPTIONAL_TEMPLATES)[number];

export const PUBLICATION_TEMPLATES = [...PUBLICATION_OPTIONAL_TEMPLATES, 'family', 'grid'] as const;
export type PublicationTemplate = (typeof PUBLICATION_TEMPLATES)[number];

/** Πώς φαίνεται μια ομάδα ιδιοτήτων: `band` = ζώνη πλάτους πίνακα · `rail` = στήλη με rowspan (η μορφή του MFP). */
export const TABLE_GROUP_STYLES = ['band', 'rail'] as const;
export type TableGroupStyle = (typeof TABLE_GROUP_STYLES)[number];

export const PUBLICATION_PAPER_SIZES = ['a4'] as const;
export type PublicationPaperSize = (typeof PUBLICATION_PAPER_SIZES)[number];

/** Τα όρια του εκδότη — ένας αριθμός για zod και οθόνη. */
export const PUBLICATION_LIMITS = {
  maxSelectionEntries: 2000,
  maxCategories: 500,
  /** Ανώτερο όριο στηλών τιμών ανά μπλοκ — πάνω από αυτό το κελί δεν διαβάζεται τυπωμένο, όσο στενό κι αν είναι το κείμενο. */
  maxValueColumnsPerBlock: 14,
  minValueColumnsPerBlock: 2,
  /** Γραμμές ανά τμήμα ομάδας `rail`: 20 γραμμές δύο σειρών ≈ 160 mm, άρα το αδιαίρετο κελί χωρά πάντα σε σελίδα A4. */
  maxRailRowsPerSegment: 20,
  maxFooterNoteLength: 200,
} as const;

/**
 * Η έκδοση του **σχήματος απόδοσης**: οποιαδήποτε αλλαγή στα πρότυπα, στο μοντέλο διάταξης ή στον προσαρμογέα
 * αλλάζει τα bytes ⇒ ανεβαίνει ο αριθμός ⇒ νέο κλειδί ιδεμποτίας, άρα νέο αρχείο (ποτέ σιωπηλά παλιό PDF).
 */
export const PUBLICATION_RENDER_SCHEMA_VERSION = 2;
