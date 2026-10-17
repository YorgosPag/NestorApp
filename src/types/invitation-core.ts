/**
 * @fileoverview **Ο ΚΟΙΝΟΣ ΠΥΡΗΝΑΣ ΤΗΣ ΠΡΟΣΚΛΗΣΗΣ** — ό,τι είναι ίδιο σε **κάθε** είδος πρόσκλησης.
 * @related ADR-853 §20 (εξαγωγή πυρήνα) · ADR-884 Φ0.5 (πρόσκληση φωτογράφου) · server/invitations/*
 * @module types/invitation-core
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΥΠΑΡΧΕΙ — ΓΕΝΙΚΕΥΣΗ, ΟΧΙ ΑΝΤΙΓΡΑΦΟ
 * ────────────────────────────────────────────────────────────────────────────
 * Η πρόσκληση χώρου (ADR-853) είχε ήδη όλη τη μηχανή· η πρόσκληση φωτογράφου (ADR-884) χρειαζόταν την
 * **ίδια**. Ό,τι δεν εξαρτάται από το **τι δίνει** η αποδοχή (ιδιότητα μέλους · άδεια λήψης) ζει εδώ, και
 * κάθε είδος το **επεκτείνει** με τα δικά του πεδία. Οι τιμές και η σειρά είναι αυτές που είχε πάντα το
 * ADR-853 — οι οθόνες του χώρου διαβάζουν τα ίδια ονόματα.
 *
 * **Layering**: leaf — καθαροί τύποι. Κανένα Firestore, κανένα ρολόι, κανένα React (το εισάγουν και οθόνες).
 */

// =============================================================================
// 1. Η ΚΑΤΑΣΤΑΣΗ — AIP-216, output-only
// =============================================================================

/**
 * ```
 * pending ──accept──► accepted
 *    │ ├──decline──► declined
 *    │ ├──revoke───► revoked      (και: αντικαταστάθηκε από νεότερη προς τον ίδιο άνθρωπο)
 *    │ └──(χρόνος)─► expired
 * ```
 * ⛔ Καμία γενική ενημέρωση δεν αγγίζει το `state` — μόνο ονομασμένες πράξεις, **μόνο** πάνω σε `pending`.
 */
export const INVITATION_STATES = ['pending', 'accepted', 'declined', 'revoked', 'expired'] as const;

export type InvitationState = (typeof INVITATION_STATES)[number];

export function isInvitationState(value: unknown): value is InvitationState {
  return typeof value === 'string' && (INVITATION_STATES as readonly string[]).includes(value);
}

/**
 * **Ανάγνωση αποθηκευμένης κατάστασης — fail-closed προς `expired`.** Ένα αδιάβαστο έγγραφο ως `pending`
 * θα έδινε ό,τι υπόσχεται η πρόσκληση από έγγραφο που δεν καταλάβαμε· ως `expired` κοστίζει μία επαναποστολή.
 */
export function readStoredInvitationState(value: unknown): InvitationState {
  return isInvitationState(value) ? value : 'expired';
}

// =============================================================================
// 2. ΟΙ ΚΟΙΝΕΣ ΑΡΝΗΣΕΙΣ — ονομασμένες, γιατί τις διαβάζει άνθρωπος
// =============================================================================

/** Οι αρνήσεις που μπορεί να δώσει **κάθε** πρόσκληση· κάθε είδος προσθέτει τις δικές του **μετά**. */
export const CORE_INVITATION_REFUSALS = [
  /** Η υπογραφή δεν στέκει, ή το κείμενο δεν είναι σύνδεσμός μας. */
  'link-invalid',
  /** Σύνδεσμός μας, υπογεγραμμένος από **άλλο κλειδί** (άλλο περιβάλλον ή μυστικό που άλλαξε) — όχι πλαστός. */
  'link-foreign',
  /** Ο σύνδεσμος είναι έγκυρος αλλά το έγγραφο δεν βρίσκεται. */
  'invitation-unknown',
  /** ⚠️ Κρίνεται **δύο φορές**: στο token **και** στο έγγραφο (ο χρόνος ζει σε δύο μέρη). */
  'expired',
  /** **Επιτυχία στο παρελθόν**, όχι αποτυχία τώρα. */
  'already-used',
  /** Ανακλήθηκε, ή αντικαταστάθηκε από νεότερη. */
  'revoked',
  /** 🔴 Ο συνδεδεμένος άνθρωπος **δεν είναι** ο παραλήπτης — εδώ σπάει το προωθημένο email. */
  'wrong-recipient',
] as const;

export type InvitationCoreRefusal = (typeof CORE_INVITATION_REFUSALS)[number];

// =============================================================================
// 3. ΤΟ ΕΓΓΡΑΦΟ — τα κοινά πεδία
// =============================================================================

/** Τα πεδία που έχει **κάθε** πρόσκληση. ⛔ Κανένα δεν φτάνει ωμό σε πελάτη (`read: false` στους κανόνες). */
export interface InvitationRecordCore {
  /** Από το `enterprise-id.service`, **ποτέ** χειρόγραφο (N.6). */
  readonly id: string;
  /** Ο παραλήπτης, κανονικοποιημένος (`normaliseChannelEmail`) — κλειδί ιδεμποτησίας **και** δέσμευση παραλήπτη. */
  readonly inviteeEmail: string;
  readonly invitedByUid: string;
  /** **ΜΟΝΟ** το `sha256` του nonce — διαρροή της βάσης δεν δίνει χρησιμοποιήσιμη πρόσκληση. */
  readonly nonceHash: string;
  /**
   * ADR-915 §31 — τα `sha256` των συνδέσμων που **επανεκδόθηκαν** για την **ίδια** πρόσκληση (υπενθύμιση). Ο ωμός σύνδεσμος
   * δεν αποθηκεύεται ποτέ, άρα μια υπενθύμιση φέρνει νέο· ο σύνδεσμος του πρώτου email **συνεχίζει** να δουλεύει (DocuSign).
   * Μίας χρήσης **αθροιστικά**: η πρόσκληση κλείνει στην πρώτη απάντηση, από όποιον σύνδεσμο κι αν ήρθε. Λείπει ⇒ κανένας.
   */
  readonly reissuedNonceHashes?: readonly string[];
  readonly state: InvitationState;
  readonly createdAt: string;
  readonly expiresAt: string;
  /** Πότε ανοίχτηκε ο σύνδεσμος — ⚠️ **ένδειξη, όχι απόδειξη** (οι πελάτες email προ-φορτώνουν). */
  readonly openedAt: string | null;
  /** Πότε έπαψε να είναι `pending`. */
  readonly resolvedAt: string | null;
  /** Ποιος την έκλεισε· `null` όταν την έκλεισε ο χρόνος. */
  readonly resolvedByUid: string | null;
  /** Πότε **αυτή** η πρόσκληση επιβεβαίωσε το email του λογαριασμού (ADR-853 §15). */
  readonly mailboxProvenAt: string | null;
}

/**
 * Το έγγραφο **όπως διαβάζεται** — η κατάσταση είναι `string`, γιατί κανείς δεν την επιβάλλει στο Firestore.
 * ⚠️ Προαιρετικό `mailboxProvenAt`: οι προσκλήσεις χώρου πριν το §15 (2026-09-21) δεν το έχουν.
 */
export type InvitationDocumentCore = Omit<InvitationRecordCore, 'state' | 'mailboxProvenAt'> & {
  readonly state: string;
  readonly mailboxProvenAt?: string | null;
};

/**
 * **Ο κωδικός πρόσβασης ενός συνδέσμου χωρίς λογαριασμό** (ADR-915 §29) — δεύτερος παράγοντας σε δεύτερο κανάλι.
 * Αποθηκεύεται **μόνο** το HMAC (με το μυστικό του είδους, δεμένο στο `invitationId`) και ο μετρητής αποτυχιών.
 * Ο πυρήνας που τον κρίνει: `server/invitations/invitation-access-code.ts`.
 */
export const ACCESS_CODE_CHANNELS = ['office-relay'] as const;
export type AccessCodeChannel = (typeof ACCESS_CODE_CHANNELS)[number];

export interface StoredAccessCode {
  readonly verifier: string;
  /** Από πού τον μαθαίνει ο άνθρωπος — σήμερα το γραφείο τηλεφωνικά (DocuSign «Access Code»). */
  readonly channel: AccessCodeChannel;
  readonly failures: number;
  /** Πότε κλείδωσε (5ο λάθος) — μόνιμο για αυτή την πρόσκληση· το γραφείο ξαναστέλνει. */
  readonly lockedAt: string | null;
}
