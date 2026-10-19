/**
 * @fileoverview **Η πολιτική της πρόσκλησης του αγοραστή** — ζωή συνδέσμου, υπενθύμιση, όριο αποστολών (ADR-916 Φ-Β).
 * @related ADR-916 Δ7 · ADR-853 §5 (προεπιλογή 7 ημερών) · ADR-915 §31 (υπενθύμιση = νέος σύνδεσμος, ίδια πρόσκληση)
 * @module config/property-handover-invitation-policy
 *
 * 🔑 **Γιατί 30 ημέρες και όχι οι 7 του πυρήνα**: ο πυρήνας μετρά για **επαγγελματίες** που περιμένουν την πρόσκληση
 * (GitHub · Autodesk 7). Ο αγοραστής κατοικίας **δεν** την περιμένει — έρχεται εβδομάδες μετά την κράτηση, σε
 * γραμματοκιβώτιο που ανοίγει σπάνια (το DocuSign αφήνει 120 ημέρες σε φακέλους προς ιδιώτες). Μία υπενθύμιση την
 * 7η ημέρα, με **νέο** σύνδεσμο της **ίδιας** πρόσκλησης· ο πρώτος σύνδεσμος συνεχίζει να δουλεύει.
 *
 * **Layering**: leaf — σταθερές και καθαρές συναρτήσεις· ο χρόνος **δίνεται**.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Πόσο ζει ένας σύνδεσμος πρόσκλησης αγοραστή. */
export const HANDOVER_INVITATION_LIFETIME_DAYS = 30;

/** Μετά από πόσες ημέρες χωρίς απάντηση φεύγει η **μία** υπενθύμιση. */
export const HANDOVER_INVITATION_REMIND_AFTER_DAYS = 7;

/**
 * Πόσα email το πολύ για **μία** πρόσκληση (πρώτο + επαναλήψεις αποτυχίας + υπενθύμιση). Ίσο με το όριο επανέκδοσης
 * συνδέσμων του πυρήνα: κάθε email μετά το πρώτο φέρει **νέο** σύνδεσμο, άρα δεν μπορεί να υπάρξουν περισσότερα.
 */
export const HANDOVER_INVITATION_DELIVERY_CAP = 4;

/** Η λήξη μιας πρόσκλησης που εκδίδεται **τώρα** — σε χιλιοστά. */
export function handoverInvitationExpiryMs(nowValue: string): number {
  return Date.parse(nowValue) + HANDOVER_INVITATION_LIFETIME_DAYS * DAY_MS;
}

/** Οφείλεται υπενθύμιση; — από τη στιγμή της **έκδοσης**, όχι της τελευταίας αποστολής. */
export function isHandoverInvitationReminderDue(issuedAt: string, nowValue: string): boolean {
  return Date.parse(issuedAt) + HANDOVER_INVITATION_REMIND_AFTER_DAYS * DAY_MS <= Date.parse(nowValue);
}
