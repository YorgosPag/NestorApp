/**
 * @fileoverview ADR-915 §45 Φ2 — **οι λέξεις και η όψη της προθεσμίας παράδοσης**: βαθμίδα καθυστέρησης (εικονίδιο +
 *   σήμα + λέξη — ποτέ μόνο χρώμα, CHECK 3.41) · προέλευση της προθεσμίας · διάλογος ορισμού/αλλαγής.
 * @related lib/document-validity/issuance-delivery-due.ts (οι ρίζες) · RegistryIssuanceDelivery.tsx · RegistryRowAction.tsx ·
 *   components/shared/due-countdown-look.ts (η όψη της βαθμίδας — χωρίς κείμενα, ADR-915 §45.19)
 * @module components/document-registry/issuance-delivery-labels
 *
 * 🔑 **`Record<Ρίζα, …>`** (CHECK 3.73): νέα βαθμίδα ή προέλευση δεν μεταγλωττίζεται χωρίς λέξη και όψη.
 * ⚠️ Κυριολεκτικά κλειδιά (template σε σταθερά module): ο γεννήτορας του route slice τα **λύνει** στατικά.
 */

import type { IssuanceDueSource, IssuanceLatenessTier } from '@/lib/document-validity/issuance-delivery-due';

const K = 'document-registry:issuance.delivery.';

export const DELIVERY_KEYS = {
  until: `${K}until`,
  line: `${K}line`,
  missesSigning: `${K}missesSigning`,
  missesSigningShort: `${K}missesSigningShort`,
  scheduledLine: `${K}scheduledLine`,
  rescheduledLine: `${K}rescheduledLine`,
  quoteDays: `${K}quoteDays`,
  ifApprovedToday: `${K}ifApprovedToday`,
  setTrigger: `${K}setTrigger`,
  changeTrigger: `${K}changeTrigger`,
  title: `${K}title`,
  descriptionSet: `${K}descriptionSet`,
  descriptionChange: `${K}descriptionChange`,
  dateLabel: `${K}dateLabel`,
  reasonLabel: `${K}reasonLabel`,
  reasonRequired: `${K}reasonRequired`,
  submit: `${K}submit`,
} as const;

/** §45.20 Φ6γ — το εκκρεμές αίτημα νέας ημερομηνίας του επαγγελματία: αποδοχή (προσυμπληρωμένη) ή απόρριψη. */
export const DELIVERY_CHANGE_KEYS = {
  requested: `${K}change.requested`,
  reason: `${K}change.reason`,
  accept: `${K}change.accept`,
  acceptDescription: `${K}change.acceptDescription`,
  decline: `${K}change.decline`,
  declineTitle: `${K}change.declineTitle`,
  declineDescription: `${K}change.declineDescription`,
  declineSubmit: `${K}change.declineSubmit`,
  /** Η αιτιολογία του επαγγελματία ως **υπόδειξη** στη φόρμα αποδοχής — ποτέ προσυμπληρωμένη ως δική του γραφείου. */
  requesterReason: `${K}change.requesterReason`,
  /** Το ίχνος της απόρριψης στο πάνελ του γραφείου (η αποδοχή φαίνεται ήδη στο ιστορικό καταχωρίσεων). */
  declinedLine: `${K}change.declinedLine`,
} as const;

/** Η λέξη κάθε βαθμίδας — οι αριθμητικές παίρνουν `{count}` με πληθυντικό ICU. */
export const DELIVERY_TIER_KEYS: Readonly<Record<IssuanceLatenessTier, string>> = {
  overdue: `${K}tier.overdue`,
  'due-today': `${K}tier.due-today`,
  'due-soon': `${K}tier.due-soon`,
  'on-track': `${K}tier.on-track`,
  'no-due-date': `${K}tier.no-due-date`,
};

/** §45 Φ3 — το κουμπί «Υπενθύμιση» και η γραμμή «τελευταία / επόμενη». */
export const DELIVERY_REMINDER_KEYS = {
  button: `${K}reminder.button`,
  sending: `${K}reminder.sending`,
  sent: `${K}reminder.sent`,
  sentUndelivered: `${K}reminder.sentUndelivered`,
  last: `${K}reminder.last`,
  none: `${K}reminder.none`,
  next: `${K}reminder.next`,
} as const;

/** Κωδικός άρνησης της πόρτας (`DELIVERY_REMINDER_REFUSAL_STATUS`) → μήνυμα· άγνωστος ⇒ `generic`. */
export const DELIVERY_REMINDER_REFUSAL_KEYS: Readonly<Record<string, string>> = {
  NOT_FOUND: `${K}reminder.refusals.NOT_FOUND`,
  NOT_ACCEPTED: `${K}reminder.refusals.NOT_ACCEPTED`,
  NO_EMAIL: `${K}reminder.refusals.NO_EMAIL`,
  TOO_SOON: `${K}reminder.refusals.TOO_SOON`,
  REMINDER_LIMIT: `${K}reminder.refusals.REMINDER_LIMIT`,
  generic: `${K}reminder.refusals.generic`,
};

/**
 * Από πού ήρθε η τρέχουσα προθεσμία. `null` ⇒ **καμία** γραμμή προέλευσης: η αλλαγή με αιτιολογία έχει ΕΝΑΝ ιδιοκτήτη,
 * το ιστορικό καταχωρίσεων («Προθεσμία … — άλλαξε στις …: …»). Μια δεύτερη γραμμή «Άλλαξε: …» την έλεγε δύο φορές
 * (ζωντανή επαλήθευση §45.20, 16/11/2026).
 */
export const DELIVERY_SOURCE_KEYS: Readonly<Record<IssuanceDueSource, string | null>> = {
  quote: `${K}source.quote`,
  office: `${K}source.office`,
  rescheduled: null,
};
