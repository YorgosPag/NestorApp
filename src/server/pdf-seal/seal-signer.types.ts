/**
 * @module server/pdf-seal/seal-signer.types
 * @description **Το συμβόλαιο του παραγωγού σφραγίδας PDF** (ADR-918) — θύρες και κλειστό λεξιλόγιο αποτελεσμάτων.
 *
 * 🔑 **Το κλειδί δεν το βλέπουμε ποτέ.** Η μηχανή εξαρτάται από **δύο θύρες**, όχι από πάροχο:
 *
 * | Θύρα | Τι κάνει | Παραγωγή | Tests |
 * |---|---|---|---|
 * | `SealSigner` | δίνει αλυσίδα, υπογράφει **μια σύνοψη** | CSC API v2 (ETSI TS 119 432) σε QTSP | κλειδί WebCrypto |
 * | `TimestampAuthority` | χρονοσημαίνει την **υπογραφή** (RFC 3161) | TSA του παρόχου | συνθετική TSA |
 *
 * Ίδιο σχήμα με DocuSign/Adobe Sign: το έγγραφο δεν φεύγει ποτέ προς τον πάροχο — φεύγει **μόνο** η σύνοψη των
 * υπογεγραμμένων ιδιοτήτων (CSC `signatures/signHash`), το κλειδί ζει σε HSM/QSCD του παρόχου.
 */

import type { PdfSealFailure, PdfSealVerdict } from './pdf-seal.types';

/** Αλγόριθμος υπογραφής της θύρας — κλειστό σύνολο: RSA PKCS#1 v1.5 ή ECDSA, πάντα με SHA-256. */
export type SealSignatureAlgorithm = 'rsa-pkcs1-sha256' | 'ecdsa-sha256';

/** Γιατί δεν βγήκε σφραγισμένο PDF. Κλειστό σύνολο — κάθε αποτυχία έχει όνομα, καμία δεν «περνά». */
export const SEAL_FAILURES = [
  /** Το εισερχόμενο PDF δεν διαβάζεται από το pdf-lib. */
  'pdf-unreadable',
  /** Το εισερχόμενο PDF έχει ήδη υπογραφή — σφραγίζουμε μόνο ό,τι εκδίδουμε εμείς, από την αρχή. */
  'pdf-already-signed',
  /** Η υπογραφή + χρονοσήμανση δεν χωρά στο σταθερό κενό `/Contents`. */
  'contents-overflow',
  /** Ο υπογράφων δεν απάντησε (δίκτυο, προθεσμία, 5xx, 429). Παροδικό. */
  'signer-unavailable',
  /** Ο υπογράφων αρνήθηκε (401/403/4xx, απάντηση άκυρη). Θέλει άνθρωπο. */
  'signer-rejected',
  /** Η αλυσίδα του παρόχου λείπει ή δεν διαβάζεται. */
  'certificate-unreadable',
  /** Κλειδί που δεν υποστηρίζουμε (π.χ. RSA-PSS, Ed25519). */
  'unsupported-key-algorithm',
  /** Η TSA δεν απάντησε. Παροδικό. */
  'timestamp-unavailable',
  /** Η TSA απάντησε με άρνηση (`status` ≠ granted) ή άκυρο σώμα. */
  'timestamp-rejected',
  /** Το token της TSA δεν δένει με **αυτή** την υπογραφή (imprint · nonce · υπογραφή TSA · ώρα). */
  'timestamp-mismatch',
  /** Ο υποχρεωτικός αυτοέλεγχος (ADR-902 `verifyPdfSeal`) δεν βγήκε `valid` + `timestamped` + ίδιος υπογράφων. */
  'self-check-failed',
] as const;

export type SealFailure = (typeof SEAL_FAILURES)[number];

/** Η θύρα υπογράφοντα. Υλοποιήσεις: CSC v2 (παραγωγή) · WebCrypto (tests). */
export interface SealSigner {
  /** Η αλυσίδα σε DER, **φύλλο πρώτο**. */
  certificateChain(): Promise<SealSignerResult<readonly Uint8Array[]>>;
  /** Υπογράφει **μια σύνοψη SHA-256** (32 bytes) με τον αλγόριθμο του κλειδιού. */
  signDigest(digest: Uint8Array, algorithm: SealSignatureAlgorithm): Promise<SealSignerResult<Uint8Array>>;
}

export type SealSignerResult<T> =
  | { readonly kind: 'ok'; readonly value: T }
  | { readonly kind: 'failed'; readonly reason: Extract<SealFailure, 'signer-unavailable' | 'signer-rejected'>; readonly detail: string };

/** Η θύρα χρονοσήμανσης: δέχεται τα bytes της **υπογραφής**, επιστρέφει το token (`ContentInfo` DER). */
export type TimestampAuthority = (signatureValue: Uint8Array) => Promise<TimestampOutcome>;

export type TimestampOutcome =
  | { readonly kind: 'ok'; readonly token: Uint8Array; readonly genTime: Date }
  | {
      readonly kind: 'failed';
      readonly reason: Extract<SealFailure, 'timestamp-unavailable' | 'timestamp-rejected' | 'timestamp-mismatch'>;
      readonly detail: string;
    };

/** Ό,τι γράφεται στο λεξικό υπογραφής — ορατό στο πάνελ υπογραφών του Adobe. Το κείμενο το δίνει ο καλών (i18n). */
export interface SealPresentation {
  readonly reason: string;
  readonly location: string;
}

export type SealOutcome =
  | { readonly kind: 'sealed'; readonly pdf: Uint8Array; readonly verdict: Extract<PdfSealVerdict, { kind: 'valid' }> }
  | {
      readonly kind: 'failed';
      readonly reason: SealFailure;
      readonly detail: string;
      /** Μόνο για `self-check-failed`: τι είπε ο ελεγκτής. */
      readonly verdictReason?: PdfSealFailure;
    }
  /** Δεν υπάρχει ρύθμιση παρόχου — **κανένα** PDF, ποτέ ασφράγιστο. Ένα σήμα ανά εκτέλεση (ADR-918 §5). */
  | { readonly kind: 'awaiting-seal-configuration'; readonly missing: readonly string[] };
