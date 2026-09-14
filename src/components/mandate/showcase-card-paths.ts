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

// =============================================================================
// Α21.18 — Η ΕΠΙΒΕΒΑΙΩΣΗ EMAIL: μία σελίδα, δύο είσοδοι από το email, μία πόρτα απόφασης
// =============================================================================

/** Ο ιδιοκτήτης πατά «Αποστολή επιβεβαίωσης» (συνδεδεμένος). */
export const EMAIL_CONFIRMATION_ISSUE_PATH = '/api/agency-profile/card/email-confirmations';

function emailConfirmationPage(token: string): string {
  return `/card-email/${encodeURIComponent(token)}`;
}

/** Ο σύνδεσμος «Επιβεβαίωση» του email — η σελίδα **δείχνει**, δεν αποφασίζει. */
export function emailConfirmationPagePath(token: string): string {
  return emailConfirmationPage(token);
}

/** Ο σύνδεσμος «Δεν το ζήτησα εγώ» — ίδια σελίδα, με την άρνηση προεπιλεγμένη. */
export function emailDisownPagePath(token: string): string {
  return `${emailConfirmationPage(token)}?answer=disown`;
}

/** Το κουμπί της σελίδας — η **μόνη** πόρτα που γράφει. */
export function emailConfirmationDecisionPath(token: string): string {
  return `/api/showcase-email-confirmations/${encodeURIComponent(token)}`;
}
