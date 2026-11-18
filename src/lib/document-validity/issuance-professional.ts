/**
 * @fileoverview ADR-945 Δ4 — **ποιος είναι ο επαγγελματίας** μιας ανάθεσης έκδοσης: η ΜΙΑ ένωση και οι κρίσεις της.
 * @related issuance-assignment.ts (ο μειωτής) · services/document-registry/issuance-assignment-schema.ts (το σύνορο του δίσκου)
 * @module lib/document-validity/issuance-professional
 *
 * 🔑 **Δύο είδη, ποτέ δύο πεδία.** Το γραφείο διαλέγει από το **βιβλίο επαφών** του (`contact`)· ο ιδιώτης διαλέγει από
 *    τον κατάλογο `/pro`, όπου κάθε κάρτα είναι **βιτρίνα χώρου** (`agency_profiles/{companyId}`) — `workspace`.
 *    Πρότυπο Upwork Agency Contracts: το συμβόλαιο γίνεται με τον **οργανισμό**· το μέλος που υπογράφει δένεται όταν
 *    απαντήσει (ADR-945 Φ3). Μέχρι το ADR-945 η ταυτότητα ήταν σκέτο `professionalContactId`: τα παλιά έγγραφα
 *    διαβάζονται ως `contact` στο σύνορο του δίσκου — καμία μετανάστευση.
 * ⛔ **Μη γράψεις δίπλα δεύτερο `professionalContactId`.** Δύο πεδία για το ίδιο πρόσωπο αποκλίνουν· ρώτα
 *    {@link professionalContactIdOf}.
 *
 * **Layering**: leaf — καθαροί τύποι και συναρτήσεις, μηδέν I/O.
 */

export const ISSUANCE_PROFESSIONAL_KINDS = ['contact', 'workspace'] as const;
export type IssuanceProfessionalKind = (typeof ISSUANCE_PROFESSIONAL_KINDS)[number];

export type IssuanceProfessional =
  /** Επαφή του βιβλίου του κατόχου (γραφείο) — ξένη επαφή ≡ ανύπαρκτη (ADR-742). */
  | { readonly kind: 'contact'; readonly contactId: string }
  /** Βιτρίνα χώρου επαγγελματία από τον κατάλογο `/pro` — το `companyId` του **επαγγελματία**, όχι του κατόχου. */
  | { readonly kind: 'workspace'; readonly companyId: string };

/** Η επαφή του επαγγελματία — `null` όταν ο επαγγελματίας είναι βιτρίνα (δεν ζει σε βιβλίο επαφών). */
export function professionalContactIdOf(professional: IssuanceProfessional): string | null {
  return professional.kind === 'contact' ? professional.contactId : null;
}

/**
 * Σταθερό κλειδί — ταυτότητα προσφοράς και σύγκριση. Το πρόθεμα είναι **το νόημα**: επαφή και βιτρίνα με το ίδιο
 * αναγνωριστικό δεν συμπίπτουν ποτέ (ίδιο δόγμα με το `user:` του `upkeepDeclarationIdOf`).
 */
export function professionalKeyOf(professional: IssuanceProfessional): string {
  return professional.kind === 'contact' ? `contact:${professional.contactId}` : `workspace:${professional.companyId}`;
}

/**
 * Η τιμή που **ονομάζει** τον επαγγελματία στους πίνακες ονομάτων και στο ιστορικό: για επαφή το σκέτο `contactId`
 * (αμετάβλητο από το §27 — το ήδη γραμμένο ιστορικό διαβάζεται ίδιο), για βιτρίνα το κλειδί με πρόθεμα.
 */
export function professionalReferenceOf(professional: IssuanceProfessional): string {
  return professional.kind === 'contact' ? professional.contactId : professionalKeyOf(professional);
}

export function sameProfessional(a: IssuanceProfessional, b: IssuanceProfessional): boolean {
  return professionalKeyOf(a) === professionalKeyOf(b);
}
