/**
 * level-view-kind — τι ΟΨΗ είναι ένα επίπεδο του DXF viewer (ADR-914 §2.4 · §2.17).
 *
 * Ένας όροφος έχει πολλές όψεις: το επίπεδο του ορόφου και μία κάτοψη ανά ακίνητό του
 * (ADR-914 §2.13). Όλες κουβαλούν το **ίδιο** `floorId` — είναι το κλειδί εμβέλειας των BIM
 * οντοτήτων (ADR-420) — άρα το `floorId ==` **δεν** απαντά «ποια είναι η κάτοψη του ορόφου;».
 *
 * Το κριτήριο ζει εδώ, έξω από το subapp, γιατί το ρωτούν και ο viewer (provisioner, καρτέλες
 * ορόφων) και ο διακομιστής (wipe αντικατάστασης): δύο αντίγραφα θα διαφωνούσαν σιωπηλά, και
 * η διαφωνία εδώ σημαίνει οριστική διαγραφή ξένου σχεδίου.
 *
 * @module lib/dxf-viewer/level-view-kind
 * @see docs/centralized-systems/reference/adrs/ADR-914-open-create-entry.md
 */

/** Η κάτοψη ενός **ακινήτου** — δική της όψη πάνω στον όροφό της, όχι ο όροφος. */
export function isPropertyViewLevel(level: { readonly propertyId?: string | null }): boolean {
  return typeof level.propertyId === 'string' && level.propertyId.length > 0;
}
