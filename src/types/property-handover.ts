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
 * ⛔ **Οι τιμές του κύκλου ζωής είναι μόνο όσες παράγει σήμερα κώδικας** (Φ-Α). Το `withdrawn` γεννιέται με την
 * πράξη ανάκλησης (Φ-Δ) — τιμή που κανείς δεν παράγει θα ήταν νεκρή (ίδιο δόγμα με το `PROPERTY_DOSSIER_LIFECYCLES`).
 * 🔑 **Η πρόοδος της αντιγραφής ΔΕΝ είναι κύκλος ζωής** (Φ-Γ1): το `lifecycle` λέει τη **νομική** κατάσταση της πώλησης
 * (κολλώδες `ready`), το `fileDelivery` την **τεχνική** πρόοδο — που ξαναγίνεται `delivering` σε κάθε συμπλήρωση (Δ5).
 * Δύο άξονες σε ένα enum θα έκαναν το «ολοκληρώθηκε η πώληση;» να εξαρτάται από το αν τελείωσε η αντιγραφή.
 *
 * **Layering**: leaf — τύποι, καμία εξάρτηση από Firestore ή React.
 */

import type { PropertyHandoverProtocolPointer } from './property-handover-protocol';

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

// =============================================================================
// Φ-Β — Ο ΠΑΡΑΛΗΠΤΗΣ ΚΑΙ Η ΠΡΟΣΚΛΗΣΗ ΤΟΥ (ADR-916 Δ7)
// =============================================================================

/**
 * **Ο λογαριασμός που αποδέχτηκε** — γράφεται **μία** φορά, στην **ίδια** συναλλαγή με το `pending → accepted` της
 * πρόσκλησης (ADR-853 §20: ένα κλικ ⇒ ένα αποτέλεσμα). Ο αγοραστής **ονομάστηκε από τον πωλητή** (επαφή) και
 * **επιβεβαιώθηκε από το γραμματοκιβώτιό του** (email του Auth ίδιο με της πρόσκλησης) — ποτέ «διεκδίκηση» (Zillow).
 */
export interface PropertyHandoverRecipient {
  readonly userId: string;
  readonly acceptedAt: string;
  /** Ο φάκελος (ADR-866) που γεννήθηκε στην αποδοχή — ο προορισμός της αντιγραφής (Φ-Γ). */
  readonly dossierId: string;
}

/** Γιατί εκδόθηκε **αυτή** η πρόσκληση — αλλάζει το κείμενο του email, όχι την κλειδαριά. */
export const PROPERTY_HANDOVER_INVITATION_OCCASIONS = ['reservation', 'completion'] as const;

export type PropertyHandoverInvitationOccasion = (typeof PROPERTY_HANDOVER_INVITATION_OCCASIONS)[number];

/**
 * Τι απέγινε το **τελευταίο** email — το λεξιλόγιο του κοινού αποστολέα (`InvitationNoticeOutcome`) **συν** το `pending`
 * («γράφτηκε η πρόσκληση, το email δεν δοκιμάστηκε ακόμη»: πτώση ανάμεσα σε commit και αποστολή ⇒ το δίχτυ το βλέπει).
 */
export const PROPERTY_HANDOVER_INVITATION_DELIVERIES = ['pending', 'accepted', 'unaddressable', 'failed'] as const;

export type PropertyHandoverInvitationDelivery = (typeof PROPERTY_HANDOVER_INVITATION_DELIVERIES)[number];

/**
 * **Το κάτοπτρο της πρόσκλησης πάνω στην παράδοση** — ό,τι χρειάζεται ο γραφέας για να αποφασίσει **χωρίς** δεύτερο
 * ερώτημα (εκδόθηκε; σε ποιο email; έφυγε; απάντησε;) και ό,τι θα δείξει η καρτέλα «Παράδοση» του γραφείου (Φ-Δ).
 * Η πρόσκληση **η ίδια** (nonce · token) ζει στο `property_handover_invitations` και **δεν** τη διαβάζει κανένας πελάτης.
 *
 * - `no-address` — ο αγοραστής **δεν έχει email** στην επαφή του: σήμα στο γραφείο, **όχι** σιωπηλή αποτυχία.
 * - `issued` — εκδόθηκε· η κατάσταση της απάντησης φαίνεται εδώ (`declinedAt`) ή στο {@link PropertyHandover.recipient}.
 */
export type PropertyHandoverInvitationLink =
  | { readonly status: 'no-address'; readonly checkedAt: string }
  | {
      readonly status: 'issued';
      readonly invitationId: string;
      /** Κανονικοποιημένο — σύγκριση με το **τρέχον** email της επαφής: άλλαξε ⇒ νέα πρόσκληση (supersede). */
      readonly inviteeEmail: string;
      readonly occasion: PropertyHandoverInvitationOccasion;
      readonly issuedAt: string;
      readonly expiresAt: string;
      readonly delivery: PropertyHandoverInvitationDelivery;
      /** Πόσα email στάλθηκαν για **αυτή** την πρόσκληση (πρώτο · επανάληψη · υπενθύμιση) — φραγμένο. */
      readonly deliveryAttempts: number;
      readonly remindedAt: string | null;
      /** Ο αγοραστής πάτησε «Δεν το θέλω» — **καμία** αυτόματη νέα πρόσκληση στο ίδιο email (σεβασμός, όχι spam). */
      readonly declinedAt: string | null;
    };

// =============================================================================
// Φ-Γ1 — Η ΠΑΡΑΔΟΣΗ ΤΩΝ ΑΡΧΕΙΩΝ (ADR-916 Δ2 · Δ5 · Π2)
// =============================================================================

/**
 * - `pending` — οφείλεται (ολοκληρωμένη πώληση + αποδεκτή πρόσκληση) και δεν έχει ξεκινήσει.
 * - `delivering` — μέρος έχει παραδοθεί· η επόμενη εκτέλεση συνεχίζει από όπου σταμάτησε.
 * - `delivered` — κάθε παραδοτέο αρχείο έχει αντίγραφο. Νέο παραδοτέο (Δ5) ⇒ ξανά `delivering`.
 */
export const PROPERTY_HANDOVER_FILE_DELIVERY_STATES = ['pending', 'delivering', 'delivered'] as const;

export type PropertyHandoverFileDeliveryState = (typeof PROPERTY_HANDOVER_FILE_DELIVERY_STATES)[number];

/** Όσα βλέπει ο **αγοραστής** — προβάλλονται στον φάκελό του (Δ10: ποτέ η ίδια η παράδοση). */
export interface PropertyHandoverFileDeliverySummary {
  readonly state: PropertyHandoverFileDeliveryState;
  /** Αρχεία με αντίγραφο στον φάκελο (γραμμές καθολικού). */
  readonly delivered: number;
  /** Όσα **οφείλονται** σήμερα — παραδοτέα (`deliver`) **και** όσα έχουν ήδη παραδοθεί. */
  readonly total: number;
}

/** Η πρόοδος, όπως τη γράφει ο **ένας** γραφέας της παράδοσης μετά από κάθε εκτέλεση του εκτελεστή. */
export interface PropertyHandoverFileDelivery extends PropertyHandoverFileDeliverySummary {
  /** Δ3 — αρχεία που περιμένουν απόφαση γραφείου· **δεν** παραδίδονται σιωπηλά, και ο αριθμός τους δεν χάνεται. */
  readonly awaitingReview: number;
  readonly bytes: number;
  /**
   * Αποτύπωμα v2 (ADR-916 §5.10): sha256 πάνω στην ετικέτα σχήματος + τις **ταξινομημένες** γραμμές του καθολικού
   * (`πηγή|αντίγραφο|sha256|μέγεθος`) — απόδειξη αλλοίωσης κάθε byte (Π1 θα τη σφραγίσει). `null` ⇒ τίποτα δεν παραδόθηκε
   * **ή** κάποια γραμμή περιμένει κατακερματισμό.
   */
  readonly digest: string | null;
  readonly startedAt: string;
  /** Πότε έγινε **τελευταία** φορά `delivered` — `null` όσο εκκρεμεί. */
  readonly completedAt: string | null;
  /** Η αιτία της τελευταίας αποτυχίας **αρχείου** (το επόμενο ξαναδοκιμάζεται). */
  readonly lastError: string | null;
  /**
   * Φ-Γ2 Σ4 (Ο13) — γραμμές που **δεν αποδεικνύονται**: ούτε το αντίγραφο ούτε η γενιά-πηγή κρατούν πια τα bytes που
   * παραδόθηκαν. Όσο > 0 το αποτύπωμα μένει `null` και **κανένα** Πρωτόκολλο δεν εκδίδεται (BagIt: έγκυρο = πλήρες **και**
   * επαληθευμένο). Ονομασμένο, όχι κείμενο σφάλματος: είναι απόφαση γραφείου (Ο13β), όχι βλάβη που ξαναδοκιμάζεται.
   */
  readonly unverifiable: number;
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
  /** `null` μέχρι την αποδοχή της πρόσκλησης (Φ-Β)· γράφεται **μία** φορά. */
  readonly recipient: PropertyHandoverRecipient | null;
  /** `null` ⇒ δεν έχει κριθεί ακόμη πρόσκληση (π.χ. ακυρωμένη πριν φύγει, ή έγγραφο της Φ-Α). */
  readonly invitation: PropertyHandoverInvitationLink | null;
  /** Φ-Γ1 — `null` μέχρι την πρώτη εκτέλεση του εκτελεστή. Το «οφείλεται;» το λέει το `fileDeliveryStateOf`. */
  readonly fileDelivery: PropertyHandoverFileDelivery | null;
  /** Φ-Γ2 Σ4 — το **τελευταίο** σφραγισμένο Πρωτόκολλο· `null` μέχρι το πρώτο. Το γράφει μόνο ο γραφέας του πρωτοκόλλου. */
  readonly protocol: PropertyHandoverProtocolPointer | null;
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

// =============================================================================
// Φ-Δ — Η ΟΨΗ ΤΟΥ ΓΡΑΦΕΙΟΥ: «ποιος οφείλει την επόμενη κίνηση, και γιατί;» (ADR-916 §5.15)
// =============================================================================

/**
 * **Ποιος κινείται τώρα** — ο άξονας που λείπει από τις λίστες κατάστασης (DocuSign «Action Required / Waiting for Others»
 * είναι **φίλτρα**· εδώ είναι **κρίση**, η ίδια για την καρτέλα, τη γκαλερί και κάθε μελλοντική λίστα).
 * - `office` — αποφασίζει το γραφείο (email που λείπει · άρνηση · λήξη · γραμμή χωρίς απόδειξη · ακυρωμένη πώληση)
 * - `buyer` — περιμένουμε την απάντηση του αγοραστή
 * - `sale` — περιμένουμε την ολοκλήρωση της πώλησης (οριστικό συμβόλαιο)
 * - `system` — η μηχανή συνεχίζει μόνη της (αποστολή · αντιγραφή · σφράγιση) ή περιμένει ρύθμιση πλατφόρμας
 * - `none` — τίποτα δεν οφείλεται (σφραγίστηκε · ακυρώθηκε)
 */
export const HANDOVER_OFFICE_MOVES = ['office', 'buyer', 'sale', 'system', 'none'] as const;

export type HandoverOfficeMove = (typeof HANDOVER_OFFICE_MOVES)[number];

/** **Γιατί** — ένας λόγος ανά παράδοση, με σειρά προτεραιότητας στην κρίση (`handoverOfficeStatusOf`). */
export const HANDOVER_OFFICE_REASONS = [
  'cancelled',
  'sale-reverted',
  'invitation-not-issued',
  'no-address',
  'invitation-undeliverable',
  'invitation-retrying',
  'declined',
  'invitation-expired',
  'awaiting-buyer',
  'awaiting-completion',
  'delivery-queued',
  'delivering',
  'unverifiable-rows',
  'digest-pending',
  'awaiting-seal-configuration',
  'protocol-due',
  'sealed',
] as const;

export type HandoverOfficeReason = (typeof HANDOVER_OFFICE_REASONS)[number];

/** Σήματα που **συνυπάρχουν** με τον λόγο — δεν αλλάζουν ποιος κινείται, αλλά ο άνθρωπος πρέπει να τα δει. */
export const HANDOVER_OFFICE_SIGNALS = ['invitation-expiring', 'files-awaiting-review'] as const;

export type HandoverOfficeSignal = (typeof HANDOVER_OFFICE_SIGNALS)[number];

/** Τα βήματα της παράδοσης — **ανεξάρτητα**: η ολοκλήρωση μπορεί να προηγηθεί της αποδοχής (πρόσκληση «completion»). */
export const HANDOVER_OFFICE_STEPS = ['invitation', 'acceptance', 'completion', 'files', 'protocol'] as const;

export type HandoverOfficeStep = (typeof HANDOVER_OFFICE_STEPS)[number];

export const HANDOVER_OFFICE_STEP_STATES = ['done', 'current', 'blocked', 'pending'] as const;

export type HandoverOfficeStepState = (typeof HANDOVER_OFFICE_STEP_STATES)[number];

/** Η κρίση για **μία** παράδοση. */
export interface HandoverOfficeStatus {
  readonly move: HandoverOfficeMove;
  readonly reason: HandoverOfficeReason;
  readonly signals: readonly HandoverOfficeSignal[];
  readonly steps: Readonly<Record<HandoverOfficeStep, HandoverOfficeStepState>>;
}

/** Μία παράδοση στην καρτέλα του γραφείου — η αποθηκευμένη, το όνομα του αγοραστή (μόνο όνομα) και η κρίση. */
export interface PropertyHandoverOfficeEntry {
  readonly handover: PropertyHandover;
  /** Ονοματεπώνυμο της επαφής του **ίδιου** μισθωτή — ποτέ email · τηλέφωνο · ΑΦΜ. `null` ⇒ η επαφή δεν διαβάζεται. */
  readonly recipientName: string | null;
  readonly status: HandoverOfficeStatus;
}

/** Η απάντηση της πόρτας προεπισκόπησης — ό,τι δεν είναι επιλέξιμο (κάδος · πρόχειρο · παλιά έκδοση) λείπει. */
export interface PropertyHandoverPreview {
  readonly handovers: readonly PropertyHandoverOfficeEntry[];
  /** Έχει ρυθμιστεί ο πάροχος σφραγίδας; — **μόνο** η απάντηση, ποτέ τα ονόματα των μεταβλητών που λείπουν. */
  readonly seal: { readonly configured: boolean };
  readonly files: {
    readonly deliver: readonly PropertyHandoverPreviewFile[];
    /** Χρειάζεται απόφαση γραφείου — **ούτε** φεύγει αυτόματα **ούτε** χάνεται σιωπηλά. */
    readonly review: readonly PropertyHandoverPreviewFile[];
    readonly internal: readonly PropertyHandoverPreviewFile[];
  };
}
