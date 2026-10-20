/**
 * @fileoverview **ΤΟ ΣΥΝΟΡΟ ΑΝΑΓΝΩΣΗΣ ΤΗΣ ΠΑΡΑΔΟΣΗΣ** — έγγραφο Firestore → `PropertyHandover`, ή `null`.
 * @related ADR-916 §5.2 · ADR-839 / ADR-842 §7.6.12 (σύνορα ανάγνωσης) · CHECK 3.74
 * @module lib/property-handover/property-handover-from-document
 *
 * 🔑 **Κάθε ανάγνωση αποθηκευμένης παράδοσης περνά από εδώ** — ο γραφέας συμφιλίωσης και η πόρτα
 * προεπισκόπησης. Το CHECK 3.74 απαγορεύει ωμό `as PropertyHandover` οπουδήποτε αλλού.
 *
 * ⚠️ **Πεδίο προς πεδίο, κανένας ισχυρισμός τύπου.** Τη γράφει **μόνο** ο διακομιστής ⇒ έγγραφο χωρίς
 * κάτοχο, ακίνητο, παραλήπτη ή γνωστό κύκλο ζωής **δεν** είναι παράδοση (`null`), όχι «ελλιπής παράδοση».
 * Η ταυτότητα έρχεται **από έξω** και νικά (ίδιο συμβόλαιο με `propertyDossierFromDocument`).
 *
 * **Layering**: leaf — καθαρή συνάρτηση, κανένα Firestore SDK.
 */

import {
  PROPERTY_HANDOVER_COMPLETION_SOURCES,
  PROPERTY_HANDOVER_FILE_DELIVERY_STATES,
  PROPERTY_HANDOVER_INVITATION_DELIVERIES,
  PROPERTY_HANDOVER_INVITATION_OCCASIONS,
  PROPERTY_HANDOVER_LIFECYCLES,
  type PropertyHandover,
  type PropertyHandoverCompletion,
  type PropertyHandoverCompletionSource,
  type PropertyHandoverFileDelivery,
  type PropertyHandoverFileDeliveryState,
  type PropertyHandoverFileDeliverySummary,
  type PropertyHandoverInvitationDelivery,
  type PropertyHandoverInvitationLink,
  type PropertyHandoverInvitationOccasion,
  type PropertyHandoverLifecycle,
  type PropertyHandoverRecipient,
} from '@/types/property-handover';

const nonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '';

const isLifecycle = (value: unknown): value is PropertyHandoverLifecycle =>
  (PROPERTY_HANDOVER_LIFECYCLES as readonly unknown[]).includes(value);

const isCompletionSource = (value: unknown): value is PropertyHandoverCompletionSource =>
  (PROPERTY_HANDOVER_COMPLETION_SOURCES as readonly unknown[]).includes(value);

function completionOf(raw: unknown): PropertyHandoverCompletion | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { source, at } = raw as Record<string, unknown>;
  return isCompletionSource(source) && nonEmptyString(at) ? { source, at } : null;
}

const isOccasion = (value: unknown): value is PropertyHandoverInvitationOccasion =>
  (PROPERTY_HANDOVER_INVITATION_OCCASIONS as readonly unknown[]).includes(value);

const isDelivery = (value: unknown): value is PropertyHandoverInvitationDelivery =>
  (PROPERTY_HANDOVER_INVITATION_DELIVERIES as readonly unknown[]).includes(value);

const stringOrNull = (value: unknown): string | null => (nonEmptyString(value) ? value : null);

function recipientOf(raw: unknown): PropertyHandoverRecipient | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { userId, acceptedAt, dossierId } = raw as Record<string, unknown>;
  return nonEmptyString(userId) && nonEmptyString(acceptedAt) && nonEmptyString(dossierId)
    ? { userId, acceptedAt, dossierId }
    : null;
}

/**
 * Το κάτοπτρο της πρόσκλησης. ⚠️ Αδιάβαστο ⇒ `null` («δεν έχει κριθεί»), που ο γραφέας ξανακρίνει: στη χειρότερη
 * περίπτωση φεύγει **νέα** πρόσκληση και η παλιά ανακαλείται ατομικά (supersede) — ποτέ δύο ζωντανοί σύνδεσμοι.
 */
function invitationOf(raw: unknown): PropertyHandoverInvitationLink | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const link = raw as Record<string, unknown>;
  if (link.status === 'no-address') return nonEmptyString(link.checkedAt) ? { status: 'no-address', checkedAt: link.checkedAt } : null;
  if (link.status !== 'issued') return null;
  const { invitationId, inviteeEmail, occasion, issuedAt, expiresAt, delivery, deliveryAttempts } = link;
  if (!nonEmptyString(invitationId) || !nonEmptyString(inviteeEmail) || !isOccasion(occasion)) return null;
  if (!nonEmptyString(issuedAt) || !nonEmptyString(expiresAt) || !isDelivery(delivery)) return null;
  if (typeof deliveryAttempts !== 'number' || !Number.isInteger(deliveryAttempts) || deliveryAttempts < 0) return null;
  return {
    status: 'issued', invitationId, inviteeEmail, occasion, issuedAt, expiresAt, delivery, deliveryAttempts,
    remindedAt: stringOrNull(link.remindedAt),
    declinedAt: stringOrNull(link.declinedAt),
  };
}

const isFileDeliveryState = (value: unknown): value is PropertyHandoverFileDeliveryState =>
  (PROPERTY_HANDOVER_FILE_DELIVERY_STATES as readonly unknown[]).includes(value);

const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0;

/**
 * **Η όψη της προόδου που βλέπει ο αγοραστής** (Φ-Γ1) — η ΜΙΑ ανάγνωσή της: την καλεί και ο αναγνώστης του φακέλου για
 * την προβολή `origin.fileDelivery`. Αδιάβαστη ⇒ `null` («δεν ξεκίνησε»), ποτέ ψεύτικο «0 από 0».
 */
export function fileDeliverySummaryOf(raw: unknown): PropertyHandoverFileDeliverySummary | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { state, delivered, total } = raw as Record<string, unknown>;
  return isFileDeliveryState(state) && isCount(delivered) && isCount(total) ? { state, delivered, total } : null;
}

/**
 * Η πρόοδος της αντιγραφής (Φ-Γ1). ⚠️ Αδιάβαστη ⇒ `null` («δεν έχει ξεκινήσει»): ο εκτελεστής ξαναμετρά από το
 * καθολικό και τα ντετερμινιστικά αντίγραφα — στη χειρότερη περίπτωση ξανακοιτά αρχεία που ήδη υπάρχουν, ποτέ δεύτερο.
 */
function fileDeliveryOf(raw: unknown): PropertyHandoverFileDelivery | null {
  const summary = fileDeliverySummaryOf(raw);
  if (summary === null) return null;
  const stored = raw as Record<string, unknown>;
  const { awaitingReview, bytes, startedAt } = stored;
  if (!isCount(awaitingReview) || !isCount(bytes) || !nonEmptyString(startedAt)) return null;
  return {
    ...summary, awaitingReview, bytes, startedAt,
    digest: stringOrNull(stored.digest),
    completedAt: stringOrNull(stored.completedAt),
    lastError: stringOrNull(stored.lastError),
  };
}

/** **Διαβάζει ένα αποθηκευμένο έγγραφο ως παράδοση.** `null` ⇒ «αυτό δεν είναι παράδοση». */
export function propertyHandoverFromDocument(raw: unknown, id: string): PropertyHandover | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const stored = raw as Record<string, unknown>;

  const { companyId, propertyId, recipientContactId, lifecycle, createdAt, updatedAt } = stored;
  if (!nonEmptyString(companyId) || !nonEmptyString(propertyId) || !nonEmptyString(recipientContactId)) return null;
  if (!isLifecycle(lifecycle) || !nonEmptyString(createdAt) || !nonEmptyString(updatedAt)) return null;

  return {
    id,
    companyId,
    propertyId,
    recipientContactId,
    lifecycle,
    completion: completionOf(stored.completion),
    // Φ-Β — τα έγγραφα της Φ-Α δεν τα έχουν: η απουσία είναι η δηλωμένη ουδέτερη τιμή (`null`), ποτέ εφεύρεση.
    recipient: recipientOf(stored.recipient),
    invitation: invitationOf(stored.invitation),
    fileDelivery: fileDeliveryOf(stored.fileDelivery),
    createdAt,
    updatedAt,
  };
}
