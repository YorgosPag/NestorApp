/**
 * @fileoverview **Η ΠΑΡΑΔΟΣΗ ΦΑΚΕΛΟΥ ΑΠΟ ΠΩΛΗΣΗ** — ένας αγοραστής, ένα ακίνητο, μία παράδοση (ADR-916 §5.2).
 * @related ADR-916 · ADR-866 (ο φάκελος που παραλαμβάνει) · ADR-244 (οι ιδιοκτήτες)
 * @module types/property-handover
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΙ ΕΙΝΑΙ — ΚΑΙ ΤΙ ΔΕΝ ΕΙΝΑΙ
 * ────────────────────────────────────────────────────────────────────────────
 * Η **υπόσχεση** του γραφείου προς **έναν** ιδιοκτήτη: «ο φάκελος του σπιτιού σου θα είναι δικός σου».
 * **Δεν** είναι ο φάκελος (ADR-866 — ζει στη θεματοφυλακή του αγοραστή) και **δεν** κρατά αρχεία.
 *
 * ⚠️ **Εταιρικό έγγραφο** (`companyId`): ο αγοραστής **δεν** το διαβάζει ποτέ (ADR-916 Δ10) — κρατά τη
 * σχέση του γραφείου με **όλους** τους ιδιοκτήτες.
 *
 * ⛔ **Οι τιμές του κύκλου ζωής είναι μόνο όσες παράγει σήμερα κώδικας** (Φ-Α). Το `delivering`/`delivered`
 * γεννιούνται με τη μηχανή παράδοσης (Φ-Γ), το `withdrawn` με την πράξη ανάκλησης (Φ-Δ) — τιμή που κανείς
 * δεν παράγει θα ήταν νεκρή (ίδιο δόγμα με το `PROPERTY_DOSSIER_LIFECYCLES`).
 *
 * **Layering**: leaf — τύποι, καμία εξάρτηση από Firestore ή React.
 */

/**
 * - `awaiting-completion` — η πώληση **δεσμεύτηκε** (κράτηση · πώληση)· η παράδοση **οφείλεται** όταν ολοκληρωθεί.
 * - `ready` — η πώληση **ολοκληρώθηκε** (οριστικό συμβόλαιο)· ο φάκελος οφείλεται τώρα. **Κολλώδες**: η
 *   συμφιλίωση δεν το γυρίζει ποτέ πίσω — ακύρωση μετά την ολοκλήρωση την κρίνει άνθρωπος (ADR-916 Ο4).
 * - `cancelled` — η δέσμευση έπεσε **πριν** την ολοκλήρωση (ακύρωση · ο ιδιοκτήτης αφαιρέθηκε). Ξανανοίγει
 *   αν η ίδια επαφή ξαναγίνει αγοραστής του ίδιου ακινήτου — ίδιο έγγραφο, ίδια ταυτότητα.
 */
export const PROPERTY_HANDOVER_LIFECYCLES = ['awaiting-completion', 'ready', 'cancelled'] as const;

export type PropertyHandoverLifecycle = (typeof PROPERTY_HANDOVER_LIFECYCLES)[number];

/** Από πού ήρθε η ολοκλήρωση — Φ-Α: μόνο το οριστικό· η πράξη γραφείου μπαίνει με την οθόνη (Φ-Δ). */
export const PROPERTY_HANDOVER_COMPLETION_SOURCES = ['final-contract'] as const;

export type PropertyHandoverCompletionSource = (typeof PROPERTY_HANDOVER_COMPLETION_SOURCES)[number];

export interface PropertyHandoverCompletion {
  readonly source: PropertyHandoverCompletionSource;
  /** ISO — η στιγμή που η συμφιλίωση **είδε** την ολοκλήρωση. */
  readonly at: string;
}

/** Η παράδοση, όπως αποθηκεύεται στο `property_handovers/{phov_*}`. */
export interface PropertyHandover {
  /** Ντετερμινιστικό `phov_*` από `(propertyId, recipientContactId)` — `propertyHandoverIdOf`. */
  readonly id: string;
  /** Ο μισθωτής-πωλητής — το πεδίο απομόνωσης (ADR-214) και το βιβλίο ιστορικού. */
  readonly companyId: string;
  readonly propertyId: string;
  /** Ο ιδιοκτήτης-παραλήπτης — επαφή του CRM (`commercial.owners[].contactId`). */
  readonly recipientContactId: string;
  readonly lifecycle: PropertyHandoverLifecycle;
  /** `null` μέχρι την ολοκλήρωση· γράφεται **μία** φορά. */
  readonly completion: PropertyHandoverCompletion | null;
  /** ISO — `nowISO()`. */
  readonly createdAt: string;
  readonly updatedAt: string;
}

// =============================================================================
// ΠΡΟΕΠΙΣΚΟΠΗΣΗ — «τι θα παραδοθεί» (ADR-916 §5.1, πόρτα `GET /api/properties/[id]/handover`)
// =============================================================================

/** Ένα αρχείο της προεπισκόπησης — **μόνο** όσα χρειάζεται η λίστα του γραφείου. */
export interface PropertyHandoverPreviewFile {
  readonly fileId: string;
  readonly displayName: string;
  /** Ποια οντότητα το κατέχει — το ακίνητο ή ένα παρακολούθημά του. */
  readonly entityType: string;
  readonly entityId: string;
}

/** Η απάντηση της πόρτας προεπισκόπησης — ό,τι δεν είναι επιλέξιμο (κάδος · πρόχειρο · παλιά έκδοση) λείπει. */
export interface PropertyHandoverPreview {
  readonly handovers: readonly PropertyHandover[];
  readonly files: {
    readonly deliver: readonly PropertyHandoverPreviewFile[];
    /** Χρειάζεται απόφαση γραφείου — **ούτε** φεύγει αυτόματα **ούτε** χάνεται σιωπηλά. */
    readonly review: readonly PropertyHandoverPreviewFile[];
    readonly internal: readonly PropertyHandoverPreviewFile[];
  };
}
