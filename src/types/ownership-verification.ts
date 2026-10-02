/**
 * @module types/ownership-verification
 * @description **Η ΕΠΑΛΗΘΕΥΣΗ ΚΑΤΟΧΗΣ** (ADR-900 §3.8) — ένα έγγραφο ανά προσπάθεια (`ovr_*`).
 *
 * Ο ιδιοκτήτης ανεβάζει το **ΠΚΑ** (Πιστοποιητικό Κτηματογραφούμενου Ακινήτου) του Κτηματολογίου. Ο
 * διακομιστής ελέγχει τη σφραγίδα (PAdES), διαβάζει ΚΑΕΚ και δικαιούχους, και ο **ένας** κριτής
 * (`lib/ownership/verification-verdict.ts`) αποφασίζει: αυτόματη επαλήθευση ή **ουρά ελέγχου**
 * από άνθρωπο — σχήμα Zillow «Claim ownership» / «Don't see your name?».
 *
 * 🔑 **Δεν είναι πεδίο της αγγελίας.** Το `owner-property-projection.ts` αρνείται ρητά να βάλει
 * `verifiedAt` στη **δήλωση** («ισχυρισμός που κανείς δεν έκανε»). Η απόδειξη ζει **εδώ**, ως
 * χωριστή, ελέγξιμη πράξη με ίχνος — και ο **ένας** αναγνώστης της είναι το
 * `services/ownership/verified-ownership.reader.ts`.
 *
 * ⛔ Server μόνο (`firestore.rules`: read:false + write:false).
 */

/** Ο κύκλος ζωής. Κλειστό σύνολο. */
export const OWNERSHIP_VERIFICATION_STATUSES = [
  'pending-review',
  'verified',
  'rejected',
  'superseded',
  'revoked',
] as const;

export type OwnershipVerificationStatus = (typeof OWNERSHIP_VERIFICATION_STATUSES)[number];

/**
 * **Γιατί δεν εγκρίθηκε αυτόματα** — κλειστό σύνολο, ένας λόγος ανά αποτυχημένο κριτήριο. Η ουρά
 * τα δείχνει στον άνθρωπο που κρίνει· ο ιδιοκτήτης βλέπει τη δική του διατύπωση ανά λόγο.
 */
export const OWNERSHIP_REVIEW_REASONS = [
  /** Η σφραγίδα λείπει, είναι άκυρη ή το έγγραφο άλλαξε μετά την υπογραφή. */
  'seal-invalid',
  /** Η σφραγίδα είναι γνήσια, αλλά ο υπογράφων δεν είναι (ακόμη) επιβεβαιωμένος ως το Κτηματολόγιο. */
  'issuer-unconfirmed',
  /** Το ΠΚΑ είναι παλαιότερο από το όριο φρεσκάδας. */
  'stale-certificate',
  /** Δεν βρέθηκε (ή βρέθηκαν πολλοί) ΚΑΕΚ στο έγγραφο. */
  'kaek-unreadable',
  /** Δεν βρέθηκαν δικαιούχοι στο έγγραφο. */
  'beneficiaries-unreadable',
  /** Το ΠΚΑ δεν αναγράφει ΑΦΜ, άρα ο δεσμός με τον λογαριασμό δεν κρίνεται αυτόματα. */
  'tax-id-absent',
  /** Κανένας δικαιούχος με τον ΑΦΜ του λογαριασμού. */
  'tax-id-mismatch',
  /** Ο δικαιούχος με τον ίδιο ΑΦΜ έχει άλλο όνομα από αυτό που δηλώθηκε. */
  'name-mismatch',
  /** Ο ΚΑΕΚ είναι ήδη επαληθευμένος σε ΑΛΛΟ λογαριασμό. */
  'kaek-claimed-elsewhere',
  /** Ο ΑΦΜ είναι ήδη δεμένος σε ΑΛΛΟ λογαριασμό. */
  'tax-id-claimed-elsewhere',
] as const;

export type OwnershipReviewReason = (typeof OWNERSHIP_REVIEW_REASONS)[number];

/** Ό,τι κρατάμε από τη σφραγίδα — **όχι** το πιστοποιητικό ολόκληρο. */
export interface OwnershipSealSummary {
  readonly kind: 'valid' | 'invalid';
  /** Κλειστός λόγος του `pdf-seal` όταν `invalid`. */
  readonly reason: string | null;
  /** Το `organizationIdentifier`/CN του υπογράφοντος, για τον άνθρωπο της ουράς. */
  readonly signer: string | null;
  /** Η ώρα υπογραφής (χρονοσήμανση αν υπάρχει, αλλιώς δηλωμένη), ISO. */
  readonly signedAt: string | null;
  /** Ο υπογράφων αντιστοιχεί σε επιβεβαιωμένη ταυτότητα του μητρώου εμπιστοσύνης. */
  readonly issuerConfirmed: boolean;
}

/** Ο ΑΦΜ **δεν** αποθηκεύεται: HMAC για σύγκριση + τα 3 τελευταία ψηφία για τον άνθρωπο. */
export interface ProtectedTaxId {
  readonly hmac: string;
  readonly last3: string;
}

export interface OwnershipVerification {
  /** `ovr_*` */
  readonly id: string;
  /** Ο άνθρωπος που ισχυρίζεται — άξονας μισθωτή (CHECK 3.35). */
  readonly uid: string;
  /** Η αγγελία/δήλωση του ιδιοκτήτη (`ownp_*`) που ζητά την απόδειξη. */
  readonly ownerPropertyId: string;
  /** Κανονική μορφή (`lib/geo/kaek.ts`) — `null` όταν δεν διαβάστηκε. */
  readonly kaek: string | null;
  /** Το αρχείο του ΠΚΑ στον φάκελο ακινήτου + το αποτύπωμά του τη στιγμή του ελέγχου. */
  readonly evidence: { readonly fileId: string; readonly digest: string };
  readonly seal: OwnershipSealSummary;
  /** Ό,τι δήλωσε ο άνθρωπος — ο ΑΦΜ προστατευμένος. */
  readonly claimant: { readonly legalName: string; readonly taxId: ProtectedTaxId };
  readonly status: OwnershipVerificationStatus;
  /** Κενό ⇔ αυτόματη επαλήθευση. */
  readonly reasons: ReadonlyArray<OwnershipReviewReason>;
  readonly createdAt: string;
  /** Πότε πήρε την τρέχουσα κατάσταση. */
  readonly decidedAt: string | null;
  /** `'system'` για αυτόματη κρίση, αλλιώς uid του ανθρώπου της ουράς. */
  readonly decidedBy: string | null;
  /** Σημείωση του ανθρώπου της ουράς (π.χ. λόγος απόρριψης). */
  readonly reviewNote: string | null;
}

/** Ό,τι φεύγει προς τον ιδιοκτήτη — κλειστό σχήμα, χωρίς HMAC, χωρίς δικαιούχους. */
export interface OwnershipVerificationView {
  readonly id: string;
  readonly status: OwnershipVerificationStatus;
  readonly reasons: ReadonlyArray<OwnershipReviewReason>;
  readonly kaek: string | null;
  readonly createdAt: string;
  readonly decidedAt: string | null;
}
