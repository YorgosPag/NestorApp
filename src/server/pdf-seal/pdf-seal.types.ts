/**
 * @module server/pdf-seal/pdf-seal.types
 * @description **Το συμβόλαιο του ελεγκτή σφραγίδας PDF (PAdES)** — ADR-900 §3.8.
 *
 * Ο ελεγκτής απαντά **τρία χωριστά** ερωτήματα, γιατί τα συγχέουν όλοι:
 *
 * | Ερώτημα | Πεδίο | Τι σημαίνει το «όχι» |
 * |---|---|---|
 * | Είναι το έγγραφο **αναλλοίωτο** και η υπογραφή **μαθηματικά** σωστή; | `kind` | πλαστό / αλλοιωμένο ⇒ `invalid` |
 * | Ανεβαίνει η αλυσίδα σε **ρίζα που εμπιστευόμαστε**; | `chainTrusted` | γνήσιο, αλλά από άγνωστο πάροχο |
 * | Είναι ο υπογράφων **αυτός που περιμένουμε** (Κτηματολόγιο); | `signer` → μητρώο | γνήσιο, αλλά άλλου φορέα |
 *
 * 🔑 Μόνο το πρώτο κάνει το έγγραφο `invalid`. Τα άλλα δύο είναι **ταυτότητα εκδότη**, που ο καλών
 * κρίνει απέναντι στο μητρώο (`config/trust/pdf-seal-trust.ts`) — ίδια διάκριση με το Adobe
 * («Signature is valid» ≠ «Signer's identity is valid») και το EU DSS (INDETERMINATE ≠ FAILED).
 */

/** Γιατί το έγγραφο **δεν** είναι αναλλοίωτο/έγκυρο. Κλειστό σύνολο. */
export const PDF_SEAL_FAILURES = [
  /** Κανένα πεδίο υπογραφής (`/ByteRange` + `/Contents`). */
  'no-signature',
  /** Το `/ByteRange` δεν διαβάζεται ή δεν συμφωνεί με το αρχείο. */
  'byte-range-malformed',
  /** Το `/ByteRange` αφήνει bytes **έξω** από την υπογραφή (προσθήκες μετά την υπογραφή). */
  'byte-range-incomplete',
  /** Το `/Contents` δεν είναι έγκυρο CMS `SignedData`. */
  'malformed-cms',
  /** Αλγόριθμος που δεν υποστηρίζουμε (π.χ. SHA-1) — άρνηση, ποτέ «περνάει». */
  'unsupported-algorithm',
  /** Το `messageDigest` δεν ταιριάζει με τα υπογεγραμμένα bytes ⇒ αλλοίωση. */
  'digest-mismatch',
  /** Η κρυπτογραφική υπογραφή δεν επαληθεύεται με το πιστοποιητικό του υπογράφοντος. */
  'signature-invalid',
  /** Το πιστοποιητικό του υπογράφοντος δεν ίσχυε τη στιγμή της υπογραφής. */
  'certificate-not-valid-at-signing',
] as const;

export type PdfSealFailure = (typeof PDF_SEAL_FAILURES)[number];

/** Η ταυτότητα του υπογράφοντος όπως τη δηλώνει το πιστοποιητικό του. */
export interface PdfSealSigner {
  readonly commonName: string | null;
  readonly organization: string | null;
  /** eIDAS `organizationIdentifier` (OID 2.5.4.97), π.χ. `VATEL-…` — η σταθερή ταυτότητα φορέα. */
  readonly organizationIdentifier: string | null;
  /** SHA-256 του πιστοποιητικού (hex) — για pinning στο μητρώο. */
  readonly certificateSha256: string;
}

export type PdfSealVerdict =
  | {
      readonly kind: 'valid';
      readonly signer: PdfSealSigner;
      /** Ώρα υπογραφής, ISO: από χρονοσήμανση RFC 3161 αν υπάρχει, αλλιώς το δηλωμένο `signingTime`. */
      readonly signedAt: string | null;
      /** Υπάρχει χρονοσήμανση (η ώρα είναι μαρτυρία τρίτου, όχι δήλωση του υπογράφοντος). */
      readonly timestamped: boolean;
      /** Η αλυσίδα ανεβαίνει σε ρίζα του μητρώου εμπιστοσύνης. */
      readonly chainTrusted: boolean;
    }
  | { readonly kind: 'invalid'; readonly reason: PdfSealFailure };

/** Η θύρα — η υπηρεσία εξαρτάται από **αυτό**, όχι από τη βιβλιοθήκη (δοκιμάσιμη με διπλό). */
export type PdfSealVerifier = (pdf: Uint8Array) => Promise<PdfSealVerdict>;
