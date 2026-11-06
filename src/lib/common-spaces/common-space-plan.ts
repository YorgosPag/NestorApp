/**
 * Ανήκει ένας κοινόχρηστος χώρος σε μια κάτοψη ορόφου; (καθαρό, ADR-931 §6 Β1)
 *
 * Η **ΜΙΑ** κρίση για τον επιλογέα σύνδεσης του DXF viewer **και** για τον φρουρό του server (ίδια ερώτηση,
 * ίδια απάντηση — ο πελάτης δεν προσφέρει ό,τι ο server θα αρνιόταν):
 * - χώρος ορόφου ⇒ μόνο στη δική του κάτοψη·
 * - χώρος χωρίς όροφο (κλιμακοστάσιο, ανελκυστήρας — εκτείνεται σε όλο το κτίριο) ⇒ σε κάθε κάτοψη του κτιρίου·
 * - κάτοψη χωρίς όροφο (επίπεδο που δεν δέθηκε ακόμη) ⇒ κανένας περιορισμός ορόφου.
 *
 * Το «ίδιο κτίριο» κρίνεται χωριστά (ο πελάτης φιλτράρει ήδη ανά κτίριο· ο server διαβάζει το έγγραφο ορόφου).
 *
 * @module lib/common-spaces/common-space-plan
 */

export function isCommonSpaceOnPlan(
  space: Readonly<{ floorId?: string | null }>,
  planFloorId: string | null | undefined,
): boolean {
  const spaceFloorId = typeof space.floorId === 'string' && space.floorId !== '' ? space.floorId : undefined;
  return planFloorId == null || spaceFloorId === undefined || spaceFloorId === planFloorId;
}
