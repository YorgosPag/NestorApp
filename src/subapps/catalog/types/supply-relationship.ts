/**
 * **Η σχέση προμήθειας** (ADR-923 §5.12 Σ1–Σ7): η αποδεκτή πράξη που δένει έναν προμηθευτή με έναν αγοραστή.
 *
 * 🔑 **Έγγραφο ΔΥΟ πλευρών, έξω από το `catalog_*`.** Ο κατάλογος γράφεται **μόνο** από τον ιδιοκτήτη του, με δικό του
 *    `AuthContext`. Η σχέση όμως τη γράφουν και οι δύο πλευρές (αποδοχή · αίτημα · ανάκληση), άρα δεν είναι εγγραφή του
 *    ενός χώρου. Το `companyId` είναι ο **προμηθευτής** (εκεί ζει το κλειδί μισθωτή), το `buyerCompanyId` ο αγοραστής.
 * 🔑 **Ένα έγγραφο ανά ζεύγος**, με ντετερμινιστικό id: οι δύο πόρτες καταλήγουν στο ίδιο έγγραφο, δομικά.
 *
 * ```
 *            ┌── αίτημα (σύνδεσμος/QR) ──► requested ──έγκριση──► active
 *  (τίποτα) ─┤                                 └──απόρριψη──► declined
 *            └── αποδοχή πρόσκλησης ─────────────────────────► active ──ανάκληση (οποιαδήποτε πλευρά)──► revoked
 * ```
 * Από `declined`/`revoked` η σχέση ξαναζεί **μόνο** με νέα πράξη (πρόσκληση ή αίτημα), στο ίδιο έγγραφο.
 *
 * @module subapps/catalog/types/supply-relationship
 */

export const SUPPLY_RELATIONSHIP_STATES = ['requested', 'active', 'declined', 'revoked'] as const;
export type SupplyRelationshipState = (typeof SUPPLY_RELATIONSHIP_STATES)[number];

export const SUPPLY_RELATIONSHIP_SIDES = ['supplier', 'buyer'] as const;
export type SupplyRelationshipSide = (typeof SUPPLY_RELATIONSHIP_SIDES)[number];

/** Από ποια πόρτα γεννήθηκε: πρόσκληση από επαφή (α) · αίτημα από σύνδεσμο/QR (β). */
export const SUPPLY_RELATIONSHIP_ORIGINS = ['invitation', 'link'] as const;
export type SupplyRelationshipOrigin = (typeof SUPPLY_RELATIONSHIP_ORIGINS)[number];

/** Οι δύο άκρες: ποιος προμηθεύει ποιον. Η σειρά είναι ταυτότητα, όχι σύμβαση. */
export interface SupplyRelationshipEnds {
  readonly supplierCompanyId: string;
  readonly buyerCompanyId: string;
}

export interface SupplyRelationship {
  readonly id: string;
  /** Ο προμηθευτής. */
  readonly companyId: string;
  readonly buyerCompanyId: string;
  readonly state: SupplyRelationshipState;
  readonly origin: SupplyRelationshipOrigin;
  /**
   * 🔴 Η επαφή **του προμηθευτή** που είναι αυτός ο αγοραστής (Σ6). Χωρίς αυτήν, ο συνεργάτης με συνθήκη σε επαφή θα
   * έβλεπε σιωπηλά λιανική. `null` ⇒ αίτημα που εγκρίθηκε χωρίς επαφή: ο αγοραστής κρίνεται μόνο ως χώρος.
   */
  readonly supplierContactId: string | null;
  /** Ο αριθμός πελάτη στο σύστημα του προμηθευτή (Buildxact `ExternalRef`). Αυτοδήλωση: τον κρίνει ο προμηθευτής. */
  readonly customerRef: string | null;
  /** Πόσες φορές ζητήθηκε από την τελευταία ενεργοποίηση: το όριο κόβει το επαναλαμβανόμενο αίτημα (Coupa: 3). */
  readonly requestCount: number;
  readonly requestedByUid: string | null;
  readonly requestedAt: string | null;
  /** 🔑 Ο άνθρωπος του αγοραστή που αποδέχτηκε: το πρόσωπο της ακμής δικτύου (ADR-834 · Σ1). */
  readonly acceptedByUid: string | null;
  readonly acceptedAt: string | null;
  /** Ο άνθρωπος του προμηθευτή που ενέκρινε αίτημα. Στην πρόσκληση η έγκριση είναι η ίδια η έκδοσή της. */
  readonly approvedByUid: string | null;
  readonly approvedAt: string | null;
  readonly endedBySide: SupplyRelationshipSide | null;
  readonly endedByUid: string | null;
  readonly endedAt: string | null;
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly updatedBy: string;
}

/** Οι ονομασμένες αρνήσεις του κριτή. Κάθε λόγος στέλνει τον άνθρωπο σε άλλη ενέργεια. */
export const SUPPLY_RELATIONSHIP_REFUSALS = [
  /** Υπάρχει ήδη ενεργή σχέση, με άλλη επαφή ή μέσω αιτήματος. */
  'already-connected',
  /** Το όριο αιτημάτων εξαντλήθηκε: η επόμενη κίνηση ανήκει στον προμηθευτή. */
  'request-limit',
  /** Η πράξη προϋποθέτει εκκρεμές αίτημα, και δεν υπάρχει. */
  'not-requested',
] as const;
export type SupplyRelationshipRefusal = (typeof SUPPLY_RELATIONSHIP_REFUSALS)[number];

/** Όσα αιτήματα χωρούν ανάμεσα σε δύο ενεργοποιήσεις (Coupa: ως 3 επαναποστολές). */
export const SUPPLY_REQUEST_LIMIT = 3;
