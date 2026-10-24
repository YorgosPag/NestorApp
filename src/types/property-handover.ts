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
 * ⛔ **Οι τιμές του κύκλου ζωής είναι μόνο όσες παράγει σήμερα κώδικας** (Φ-Α). Το `withdrawn` γεννήθηκε **μαζί**
 * με την πράξη που το γράφει (Φ-Δ.5, `handover-withdrawal-plan.ts`) — τιμή που κανείς δεν παράγει θα ήταν νεκρή.
 * 🔑 **Η πρόοδος της αντιγραφής ΔΕΝ είναι κύκλος ζωής** (Φ-Γ1): το `lifecycle` λέει τη **νομική** κατάσταση της πώλησης
 * (κολλώδες `ready`), το `fileDelivery` την **τεχνική** πρόοδο — που ξαναγίνεται `delivering` σε κάθε συμπλήρωση (Δ5).
 * Δύο άξονες σε ένα enum θα έκαναν το «ολοκληρώθηκε η πώληση;» να εξαρτάται από το αν τελείωσε η αντιγραφή.
 *
 * **Layering**: leaf — τύποι, καμία εξάρτηση από Firestore ή React.
 */

import type {
  HandoverDispositionBasis,
  HandoverFileDecisionDisposition,
  HandoverFileDecisionOffer,
} from './property-handover-file-decision';
import type { PropertyHandoverProtocolPointer } from './property-handover-protocol';

/**
 * - `awaiting-completion` — η πώληση **δεσμεύτηκε** (κράτηση · πώληση)· η παράδοση **οφείλεται** όταν ολοκληρωθεί.
 * - `ready` — η πώληση **ολοκληρώθηκε** (οριστικό συμβόλαιο)· ο φάκελος οφείλεται τώρα. **Κολλώδες**: η
 *   συμφιλίωση δεν το γυρίζει ποτέ πίσω — ακύρωση μετά την ολοκλήρωση την κρίνει άνθρωπος (ADR-916 Ο4).
 * - `cancelled` — η δέσμευση έπεσε **πριν** την ολοκλήρωση (ακύρωση · ο ιδιοκτήτης αφαιρέθηκε). Ξανανοίγει
 *   αν η ίδια επαφή ξαναγίνει αγοραστής του ίδιου ακινήτου — ίδιο έγγραφο, ίδια ταυτότητα.
 * - `withdrawn` — Φ-Δ.5 (Δ8): το γραφείο **ανακάλεσε** ολοκληρωμένη παράδοση της οποίας η πώληση δεν ισχύει πια.
 *   **Τερματικό** (DocuSign void): η συμφιλίωση δεν το αλλάζει ποτέ· ό,τι παραδόθηκε **μένει** στον αγοραστή.
 */
export const PROPERTY_HANDOVER_LIFECYCLES = ['awaiting-completion', 'ready', 'cancelled', 'withdrawn'] as const;

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

// =============================================================================
// Φ-Δ.5 — Η ΑΝΑΚΛΗΣΗ ΤΗΣ ΠΑΡΑΔΟΣΗΣ (ADR-916 Δ8 · Ο4)
// =============================================================================

/**
 * Τι απέγινε το email ανάκλησης προς τον αγοραστή.
 * - `pending` — η ανάκληση γράφτηκε, το email δεν δοκιμάστηκε ακόμη (πτώση ανάμεσα σε commit και αποστολή ⇒ το δίχτυ το βλέπει)
 * - `accepted` — ο πάροχος το δέχτηκε (⚠️ όχι «παραδόθηκε»)
 * - `failed` — ο πάροχος αρνήθηκε ή ο λογαριασμός δεν διαβάστηκε — ξαναδοκιμάζεται ως το όριο
 * - `no-address` — ο λογαριασμός του αγοραστή δεν υπάρχει πια ή δεν έχει email — σήμα στο γραφείο, όχι επανάληψη
 */
export const PROPERTY_HANDOVER_WITHDRAWAL_NOTICE_DELIVERIES = ['pending', 'accepted', 'failed', 'no-address'] as const;

export type PropertyHandoverWithdrawalNoticeDelivery = (typeof PROPERTY_HANDOVER_WITHDRAWAL_NOTICE_DELIVERIES)[number];

export interface PropertyHandoverWithdrawalNotice {
  readonly delivery: PropertyHandoverWithdrawalNoticeDelivery;
  /** Πόσες αποστολές έγιναν — φραγμένο (`HANDOVER_WITHDRAWAL_NOTICE_CAP`). */
  readonly attempts: number;
}

/** **Η ανάκληση** — γράφεται **μία** φορά, στην ίδια συναλλαγή με τη μετάβαση `withdrawn`. */
export interface PropertyHandoverWithdrawal {
  /** 🔒 Η αιτιολογία του γραφείου — μόνο για το γραφείο (Δ10): ποτέ στο email, ποτέ στον φάκελο του αγοραστή. */
  readonly reason: string;
  readonly withdrawnBy: string;
  readonly withdrawnAt: string;
  /** `null` ⇒ ο αγοραστής δεν είχε αποδεχτεί (δεν έχει φάκελο· ο σύνδεσμός του απλώς πεθαίνει). */
  readonly notice: PropertyHandoverWithdrawalNotice | null;
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
  /** Φ-Δ.5 — `null` εκτός αν `lifecycle === 'withdrawn'`. Το γράφει μόνο ο ένας γραφέας της παράδοσης. */
  readonly withdrawal: PropertyHandoverWithdrawal | null;
  /** ISO — `nowISO()`. */
  readonly createdAt: string;
  readonly updatedAt: string;
}

// =============================================================================
// ΠΡΟΕΠΙΣΚΟΠΗΣΗ — «τι θα παραδοθεί» (ADR-916 §5.1, πόρτα `GET /api/properties/[id]/handover`)
// =============================================================================

/** Η ταυτότητα ενός αρχείου του συνόλου — ό,τι ξέρει το σύνολο **χωρίς** να διαβάσει το καθολικό. */
export interface PropertyHandoverSetFileIdentity {
  readonly fileId: string;
  readonly displayName: string;
  /** Ποια οντότητα το κατέχει — το ακίνητο ή ένα παρακολούθημά του. */
  readonly entityType: string;
  readonly entityId: string;
  /** Φ-Δ.4 — **γιατί** είναι εκεί που είναι: ο κανόνας της κρίσης που απάντησε πρώτος. */
  readonly basis: HandoverDispositionBasis;
  /** Φ-Δ.4 — η απόφαση του γραφείου (🔒 χωρίς uid· η αιτιολογία μένει στο γραφείο, η πόρτα είναι μόνο δική του). */
  readonly decision: PropertyHandoverPreviewFileDecision | null;
  readonly confidential: boolean;
}

export interface PropertyHandoverPreviewFileDecision {
  readonly disposition: HandoverFileDecisionDisposition;
  readonly reason: string;
  readonly decidedAt: string;
}

/** Ένα αρχείο της προεπισκόπησης — **μόνο** όσα χρειάζεται η λίστα του γραφείου. */
export interface PropertyHandoverPreviewFile extends PropertyHandoverSetFileIdentity {
  /** Υπάρχει ήδη στο καθολικό κάποιας παράδοσης — ό,τι παραδόθηκε μένει (Δ5). */
  readonly delivered: boolean;
  /** Φ-Δ.4 — τι μπορεί να αποφασίσει το γραφείο, από την **ίδια** κρίση με την πόρτα. */
  readonly offer: HandoverFileDecisionOffer;
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
  'withdrawn',
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
export const HANDOVER_OFFICE_SIGNALS = [
  'invitation-expiring',
  'files-awaiting-review',
  /** Φ-Δ.5 — το email ανάκλησης δεν θα φτάσει χωρίς άνθρωπο (όριο · λογαριασμός χωρίς email). */
  'withdrawal-notice-undelivered',
  /** Φ-Δ.5 — η επαφή είναι ξανά αγοραστής ανακλημένης παράδοσης: η επαναφορά είναι ρητή πράξη (Ο21), όχι αυτόματη. */
  'buyer-again',
] as const;

export type HandoverOfficeSignal = (typeof HANDOVER_OFFICE_SIGNALS)[number];

/** Τα βήματα της παράδοσης — **ανεξάρτητα**: η ολοκλήρωση μπορεί να προηγηθεί της αποδοχής (πρόσκληση «completion»). */
export const HANDOVER_OFFICE_STEPS = ['invitation', 'acceptance', 'completion', 'files', 'protocol'] as const;

export type HandoverOfficeStep = (typeof HANDOVER_OFFICE_STEPS)[number];

export const HANDOVER_OFFICE_STEP_STATES = ['done', 'current', 'blocked', 'pending'] as const;

export type HandoverOfficeStepState = (typeof HANDOVER_OFFICE_STEP_STATES)[number];

/**
 * **Φ-Δ.3 (Ο9) — μπορεί το γραφείο να στείλει νέα πρόσκληση;** Η ΙΔΙΑ τιμή κρίνει το κουμπί της καρτέλας **και** την πόρτα
 * (`handoverInvitationRenewalOfferOf`) — η οθόνη δεν μπορεί να υποσχεθεί πράξη που ο διακομιστής θα αρνηθεί.
 * - `renew` — η πρόσκληση έληξε χωρίς απάντηση
 * - `renew-after-decline` — ο αγοραστής αρνήθηκε: νέα **μόνο** με ρητή επιβεβαίωση (DocuSign: declined = τερματικό)
 */
export const HANDOVER_INVITATION_RENEWAL_OFFERS = ['none', 'renew', 'renew-after-decline'] as const;

export type HandoverInvitationRenewalOffer = (typeof HANDOVER_INVITATION_RENEWAL_OFFERS)[number];

/**
 * Γιατί η πόρτα **δεν** έστειλε νέα πρόσκληση — κλειστό λεξιλόγιο, το διαβάζει άνθρωπος.
 * - `not-renewable` — δεν οφείλεται (ενεργή · αποδεκτή · ακυρωμένη): η οθόνη είναι μπαγιάτικη
 * - `declined-unconfirmed` — ο αγοραστής αρνήθηκε και η επιβεβαίωση έλειπε
 * - `no-address` — η επαφή δεν έχει πια email
 * - `awaiting-configuration` — λείπει το μυστικό των συνδέσμων (ADR-916 §5.6)
 * - `handover-unknown` — η παράδοση δεν ανήκει σε αυτό το ακίνητο
 */
export const HANDOVER_INVITATION_RENEWAL_REFUSALS = [
  'not-renewable',
  'declined-unconfirmed',
  'no-address',
  'awaiting-configuration',
  'handover-unknown',
] as const;

export type HandoverInvitationRenewalRefusal = (typeof HANDOVER_INVITATION_RENEWAL_REFUSALS)[number];

/** Ο διακριτής του σώματος άρνησης της πόρτας «Νέα πρόσκληση» — ο πελάτης τον ελέγχει **πριν** από τον λόγο. */
export const HANDOVER_INVITATION_RENEWAL_REFUSED = 'HANDOVER_INVITATION_RENEWAL_REFUSED';

/** Το συμβόλαιο της πόρτας `POST /api/properties/[id]/handover/invitation` — 🔒 ποτέ email, ποτέ token. */
export type HandoverInvitationRenewalResponse =
  | { readonly status: 'renewed' }
  | { readonly error: typeof HANDOVER_INVITATION_RENEWAL_REFUSED; readonly reason: HandoverInvitationRenewalRefusal }
  | { readonly error: 'RENEWAL_UNAVAILABLE' };

/**
 * **Φ-Δ.5 (Δ8) — μπορεί το γραφείο να ανακαλέσει την παράδοση;** Η ΙΔΙΑ τιμή κρίνει το κουμπί **και** την πόρτα
 * (`handoverWithdrawalOfferOf`). `withdraw` μόνο όταν η μηχανή επιβεβαιώνει την αντίφαση (Ο4 · `sale-reverted`).
 */
export const HANDOVER_WITHDRAWAL_OFFERS = ['none', 'withdraw'] as const;

export type HandoverWithdrawalOffer = (typeof HANDOVER_WITHDRAWAL_OFFERS)[number];

/**
 * Γιατί η πόρτα **δεν** ανακάλεσε — κλειστό λεξιλόγιο, το διαβάζει άνθρωπος.
 * - `not-withdrawable` — η πώληση ισχύει ή η παράδοση δεν είναι ολοκληρωμένη: η οθόνη είναι μπαγιάτικη
 * - `handover-unknown` — η παράδοση δεν ανήκει σε αυτό το ακίνητο
 */
export const HANDOVER_WITHDRAWAL_REFUSALS = ['not-withdrawable', 'handover-unknown'] as const;

export type HandoverWithdrawalRefusal = (typeof HANDOVER_WITHDRAWAL_REFUSALS)[number];

/** Ο διακριτής του σώματος άρνησης της πόρτας «Ανάκληση παράδοσης». */
export const HANDOVER_WITHDRAWAL_REFUSED = 'HANDOVER_WITHDRAWAL_REFUSED';

/** Ό,τι στέλνει η οθόνη — την επιβεβαίωση του μη αναστρέψιμου την προσθέτει ρητά ο client. */
export interface HandoverWithdrawalRequest {
  readonly handoverId: string;
  readonly reason: string;
}

/** Το συμβόλαιο της πόρτας `POST /api/properties/[id]/handover/withdrawal` — 🔒 ποτέ αιτιολογία, ποτέ uid. */
export type HandoverWithdrawalResponse =
  | { readonly status: 'withdrawn' | 'unchanged' }
  | { readonly error: typeof HANDOVER_WITHDRAWAL_REFUSED; readonly reason: HandoverWithdrawalRefusal }
  | { readonly error: 'WITHDRAWAL_UNAVAILABLE' };

/** Η κρίση για **μία** παράδοση. */
export interface HandoverOfficeStatus {
  readonly move: HandoverOfficeMove;
  readonly reason: HandoverOfficeReason;
  readonly signals: readonly HandoverOfficeSignal[];
  readonly steps: Readonly<Record<HandoverOfficeStep, HandoverOfficeStepState>>;
  /** Φ-Δ.3 — το κουμπί «Νέα πρόσκληση» (από την **ίδια** κρίση με την πόρτα). */
  readonly renewal: HandoverInvitationRenewalOffer;
  /** Φ-Δ.5 — το κουμπί «Ανάκληση παράδοσης» (από την **ίδια** κρίση με την πόρτα). */
  readonly withdrawal: HandoverWithdrawalOffer;
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
