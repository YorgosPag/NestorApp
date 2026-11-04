/**
 * =============================================================================
 * SSoT: Τα είδη «χώρου κτιρίου» και τι ΜΠΟΡΕΙ να κάνει το καθένα (ADR-931)
 * =============================================================================
 *
 * Ο route SSoT (`createSpaceEntityRoutes`, ADR-696) εξυπηρετεί θέσεις, αποθήκες και
 * κοινόχρηστους χώρους με **ένα** pipeline. Η διαφορά τους δεν είναι σημαία ανά βήμα αλλά
 * **μία** νομική ιδιότητα:
 *
 * `transferable` — μεταβιβάζεται αυτοτελώς ή ως παρακολούθημα μονάδας;
 *   - θέση / αποθήκη: **ναι** ⇒ εμπορικά πεδία, allocation code στα `linkedSpaces`,
 *     φρουρός παρακολουθήματος, εμφάνιση στην κάτοψη ορόφου των αγγελιών.
 *   - κοινόχρηστος: **όχι** (ΑΚ 1117) ⇒ τίποτα από τα παραπάνω.
 *
 * Ένας νέος βηματισμός του pipeline ρωτά **αυτή** την ιδιότητα — ποτέ το όνομα του είδους.
 *
 * @module lib/spaces/space-entity-kinds
 */

export const SPACE_ENTITY_CAPABILITIES = {
  parking: { transferable: true },
  storage: { transferable: true },
  common_space: { transferable: false },
} as const satisfies Readonly<Record<string, { readonly transferable: boolean }>>;

export type SpaceEntityKind = keyof typeof SPACE_ENTITY_CAPABILITIES;

/** Τα είδη που μεταβιβάζονται — παράγεται από τον πίνακα, δεν γράφεται με το χέρι. */
export type TransferableSpaceKind = {
  [K in SpaceEntityKind]: (typeof SPACE_ENTITY_CAPABILITIES)[K]['transferable'] extends true ? K : never;
}[SpaceEntityKind];

export function isTransferableSpaceKind(kind: SpaceEntityKind): kind is TransferableSpaceKind {
  return SPACE_ENTITY_CAPABILITIES[kind].transferable;
}
