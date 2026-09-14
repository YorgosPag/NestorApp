/**
 * @fileoverview **Οι διευθύνσεις των ανώνυμων πορτών καναλιών** — το πρόθεμα γραμμένο μία φορά (ADR-841 §7 Α21.16 · Α21.17).
 * @related app/api/pro/[companyId]/locations/[locationId]/{channels,vcard}/route.ts
 * @module components/mandate/showcase-card-paths
 *
 * 🔑 **`encodeURIComponent` και στα δύο τμήματα**: οι ταυτότητες ταξιδεύουν στη διαδρομή. Δύο χειρόγραφες γραφές
 * (εμφάνιση + επαφή) θα μπορούσαν να αποκλίνουν — η μία να κωδικοποιεί, η άλλη όχι — σε ένα μόνο κατάστημα.
 *
 * **Layering**: leaf — χωρίς `'use client'`, χωρίς React.
 */

type LocationDoor = 'channels' | 'vcard';

function locationDoorPath(companyId: string, locationId: string, door: LocationDoor): string {
  return `/api/pro/${encodeURIComponent(companyId)}/locations/${encodeURIComponent(locationId)}/${door}`;
}

/** «Εμφάνιση τηλεφώνου/email». */
export function channelRevealPath(companyId: string, locationId: string): string {
  return locationDoorPath(companyId, locationId, 'channels');
}

/** «Αποθήκευση επαφής» — η vCard του καταστήματος. */
export function locationVCardPath(companyId: string, locationId: string): string {
  return locationDoorPath(companyId, locationId, 'vcard');
}
