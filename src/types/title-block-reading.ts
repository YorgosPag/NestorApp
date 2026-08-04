/**
 * @fileoverview Το συμβόλαιο ανάγνωσης πινακίδας — η έξοδος του Λ1 (ADR-745 §6.1).
 *
 * **Δεν αποθηκεύεται** — είναι πρόταση. Ό,τι μπαίνει εδώ έχει διαβαστεί από το σχέδιο και
 * τίποτα δεν έχει επιβεβαιωθεί. Η σύνδεση με οντότητες της βάσης είναι δουλειά του Λ2 και
 * περνά **πάντα** από άνθρωπο (ADR-745 §5.1: η πινακίδα δεν είναι ποτέ SSoT).
 *
 * ## Γιατί ζει εδώ και όχι δίπλα στον αναγνώστη (ADR-745 Φ3β, Δ2)
 *
 * Ο Λ1 ζει στο `src/subapps/dxf-viewer/text-engine/title-block/reading/`, που το root
 * `tsconfig.json` **εξαιρεί**. Ο Λ2 όμως ζει έξω από το subapp — υποχρεωτικά, γιατί το SSoT
 * ταιριάσματος επαφών είναι `'server-only'` + Admin SDK. Αν το συμβόλαιο έμενε μέσα στο
 * subapp, η εξάρτηση Λ2→Λ1 θα υπήρχε αλλά θα ήταν **τυφλή στον έλεγχο τύπων**: κάθε απόκλιση
 * ανάμεσα στο τι παράγει ο αναγνώστης και στο τι διαβάζει ο resolver θα περνούσε αθέατη.
 *
 * Άρα προήχθη εδώ, και ο αναγνώστης **επανεξάγει** — ώστε οι καταναλωτές του να μη γνωρίζουν
 * τη μετακόμιση. Ίδιο πρότυπο με τη Φ2, όπου τα `normalizeForLabelMatch`/`splitIntoWords`
 * προήχθησαν στο `@/utils/greek-text` για τον ίδιο λόγο (ADR-745 §6.4).
 *
 * 🔴 **Δύο ορισμοί του ίδιου τύπου θα ήταν το χειρότερο αποτέλεσμα**: ο ένας θα ενημερωνόταν
 * και ο άλλος όχι, και τίποτα δεν θα το έλεγε. Ένα σπίτι, μία αλήθεια.
 *
 * @see ADR-745 §6.1 — TitleBlockReading
 * @see ADR-745 §6.3 — TitleBlockFieldKey
 */

// ── Λεξιλόγιο πεδίων (SSoT) ───────────────────────────────────────────────────

/**
 * Τα κανονικά κλειδιά πεδίου.
 *
 * Τα `drawnBy` / `signature` **δεν** ήταν στην πρώτη γραφή του ADR. Μπήκαν από μέτρηση:
 * το `ΣΥΝΤΑΞΗ` και το `ΥΠΟΓΡΑΦΗ` του G753 κάθονται σχεδόν στο **ίδιο y**, οπότε αν το
 * δεύτερο δεν αναγνωριζόταν ως **ετικέτα**, θα διαβαζόταν ως η **τιμή** του πρώτου.
 * Η παράλειψη ενός κλειδιού δεν αφήνει απλώς ένα πεδίο κενό — **μολύνει το διπλανό**.
 */
export const TITLE_BLOCK_FIELD_KEYS = [
  'employer',
  'projectTitle',
  'location',
  'designers',
  'studyType',
  'drawingType',
  'drawingNumber',
  'scale',
  'studyDate',
  'drawnBy',
  'signature',
] as const;

export type TitleBlockFieldKey = (typeof TITLE_BLOCK_FIELD_KEYS)[number];

// ── Η είσοδος του αναγνώστη ───────────────────────────────────────────────────

/** Το κελί όπως το παραδίδει η εισαγωγή DXF — ήδη αποκωδικοποιημένο σε κείμενο. */
export interface TitleBlockSourceCell {
  /** Λαβή DXF (κωδ. 5) — η ταυτότητα του κελιού και η ιχνηλασιμότητά του. */
  readonly handle: string;
  readonly x: number;
  readonly y: number;
  /** Ονομαστικό ύψος κειμένου (κωδ. 40). */
  readonly height: number;
  /** Ωμό MTEXT, με τους κωδικούς μορφοποίησης ΑΘΙΚΤΟΥΣ. */
  readonly raw: string;
}

// ── Η έξοδος του αναγνώστη ────────────────────────────────────────────────────

/** Πώς προέκυψε η αντιστοίχιση ετικέτα→τιμή. */
export type TitleBlockMatchKind = 'same-cell' | 'row-alignment' | 'column-alignment';

/** Μία αναγνωσμένη τιμή με την προέλευσή της. */
export interface TitleBlockField {
  readonly key: TitleBlockFieldKey;
  /** Η τιμή μετά το ξεγύμνωμα των κωδικών MTEXT — **χωρίς** καμία άλλη «διόρθωση». */
  readonly rawValue: string;
  /** Σε ποιο MTEXT βρέθηκε η **τιμή** (ίδιο με το `labelHandle` στο `same-cell`). */
  readonly sourceHandle: string;
  /** Σε ποιο MTEXT βρέθηκε η **ετικέτα** — το overlay πρέπει να καλύψει και τα δύο. */
  readonly labelHandle: string;
  /** Θέση εισαγωγής του κελιού της τιμής (WCS). */
  readonly at: { readonly x: number; readonly y: number };
  readonly matchedBy: TitleBlockMatchKind;
}

/** Ένα πρόσωπο όπως το δηλώνει η τυπογραφική ιεραρχία του κελιού μελετητών. */
export interface TitleBlockPerson {
  readonly displayName: string;
  readonly professionText: string;
  readonly phones: readonly string[];
  readonly emails: readonly string[];
  readonly websites: readonly string[];
  readonly officeSeat?: string;
}

/** Μία πινακίδα. Ένα layer μπορεί να δώσει περισσότερες από μία (§2.3 Παγίδα Δ). */
export interface TitleBlockReading {
  readonly layerName: string;
  /**
   * Περίγραμμα από τα **σημεία εισαγωγής** των κελιών.
   *
   * Δεν είναι η έκταση του μελανιού: ο κωδ. 41 του MTEXT είναι το πλάτος **αναδίπλωσης**
   * (μετρημένα 20,772 / 36,7 / 44,7 για κελιά με πολύ μικρότερο κείμενο), οπότε δεν κάνει
   * για περίγραμμα. Όποιος χρειαστεί ακριβές bbox θα το ζητήσει από τον renderer.
   */
  readonly bbox: {
    readonly minX: number;
    readonly minY: number;
    readonly maxX: number;
    readonly maxY: number;
  };
  readonly fields: readonly TitleBlockField[];
  readonly people: readonly TitleBlockPerson[];
  /** Ό,τι δεν αναγνωρίστηκε — **ποτέ** δεν πετιέται σιωπηλά (ADR-745 §8 κανόνας 3). */
  readonly unparsed: readonly string[];
}
