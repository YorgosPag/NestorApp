/**
 * @module config/trust/pdf-seal-trust
 * @description **Το μητρώο εμπιστοσύνης των σφραγίδων PDF** (ADR-900 §3.8) — ποιους παρόχους
 * εμπιστευόμαστε, και ποιος υπογράφων είναι ο φορέας που περιμένουμε.
 *
 * 🔑 **Κλειστό, με λόγο ανά γραμμή.** Ίδιο συμβόλαιο με το μητρώο πηγών υποβάθρου (CHECK 3.95): ό,τι
 * δεν είναι γραμμένο εδώ **δεν** εμπιστεύεται. Η ρίζα εμπιστοσύνης του eIDAS είναι η **Λίστα
 * Εμπιστοσύνης της ΕΕ** (LOTL → εθνική TSL της ΕΕΤΤ)· εδώ καρφώνουμε **μόνο** όσα χρειαζόμαστε,
 * όπως το Adobe AATL καρφώνει υποσύνολο — όχι ολόκληρη τη λίστα.
 *
 * ⚠️ **ΚΕΝΟ ΕΠΙΤΗΔΕΣ μέχρι το πρώτο πραγματικό ΠΚΑ** (ADR-900 §3.8 · §8). Ποια ρίζα (ΑΠΕΔ; HARICA;)
 * και ποιο `organizationIdentifier` φέρει η σφραγίδα του Κτηματολογίου **δεν** επιβεβαιώθηκε σε
 * έγγραφο. Μια μαντεψιά εδώ θα ήταν αυτόματη έγκριση πάνω σε υπόθεση. Όσο είναι κενό, κάθε
 * σφραγίδα κρίνεται `issuer-unconfirmed` ⇒ **ουρά ελέγχου** — ο άνθρωπος βλέπει τον υπογράφοντα
 * και κρίνει. Η ενεργοποίηση της αυτόματης έγκρισης = **μία** γραμμή σε κάθε πίνακα, με πηγή.
 */

export interface TrustAnchor {
  /** Ανθρώπινο όνομα (π.χ. «HARICA Qualified … Root CA 2021»). */
  readonly name: string;
  /** Το πιστοποιητικό της ρίζας (PEM) — δημόσιο δεδομένο, από την εθνική TSL. */
  readonly pem: string;
  /** Από πού επαληθεύτηκε (URL της TSL / ημερομηνία). */
  readonly source: string;
  readonly why: string;
}

export interface ExpectedSigner {
  /** Ο φορέας, για τον άνθρωπο της ουράς. */
  readonly label: string;
  /** eIDAS `organizationIdentifier` (OID 2.5.4.97) — η σταθερή ταυτότητα, ποτέ το CN (αλλάζει ανά ανανέωση). */
  readonly organizationIdentifiers: ReadonlyArray<string>;
  readonly source: string;
  readonly why: string;
}

/** Ρίζες παρόχων υπηρεσιών εμπιστοσύνης που δεχόμαστε. */
export const PDF_SEAL_TRUST_ANCHORS: ReadonlyArray<TrustAnchor> = [];

/** Ο αναμενόμενος υπογράφων ανά είδος εγγράφου. */
export const PDF_SEAL_EXPECTED_SIGNERS: Readonly<Record<'ktimatologio-pka', ExpectedSigner>> = {
  'ktimatologio-pka': {
    label: 'Ελληνικό Κτηματολόγιο',
    organizationIdentifiers: [],
    source: 'εκκρεμεί — πρώτο πραγματικό ΠΚΑ (ADR-900 §8)',
    why:
      'Το ΠΚΑ φέρει εγκεκριμένη ηλεκτρονική σφραγίδα ΤΟΥ ΦΟΡΕΑ. Μια γνήσια σφραγίδα άλλου φορέα ' +
      'αποδεικνύει ότι το έγγραφο είναι γνήσιο, όχι ότι το εξέδωσε το Κτηματολόγιο.',
  },
};

/** Είναι αυτός ο υπογράφων ο αναμενόμενος φορέας; Κενό μητρώο ⇒ **ποτέ**. */
export function isExpectedSigner(
  kind: keyof typeof PDF_SEAL_EXPECTED_SIGNERS,
  organizationIdentifier: string | null,
): boolean {
  if (organizationIdentifier === null) return false;
  return PDF_SEAL_EXPECTED_SIGNERS[kind].organizationIdentifiers.includes(organizationIdentifier);
}
