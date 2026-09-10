/**
 * =============================================================================
 * ΕΠΑΝΑΛΗΨΗ ΜΙΑΣ ΕΙΔΟΠΟΙΗΣΗΣ, ΜΕΣΑ ΑΠΟ ΤΟΝ ΙΔΙΟ ΑΓΩΓΟ — ADR-849 Α4
 * =============================================================================
 *
 * «Ξαναστείλε αυτή την ειδοποίηση σαν καινούργια» — για **ζωντανό** τεστ του email
 * (σύνδεσμοι · RFC 8058 · σύνοψη) χωρίς να περιμένουμε πραγματικό συμβάν αγοράς.
 *
 * 🔑 **Καθαρό**: έγγραφο ειδοποίησης → `DispatchRequest`. Καμία Firestore, κανένα δίκτυο.
 * Η εκτέλεση ζει στο `scripts/notifications/replay-notification.ts` και περνά από το
 * `dispatchNotification` — **ποτέ** δεύτερος renderer, δεύτερος φάκελος ή εγγραφή ουράς
 * με το χέρι. Ό,τι δοκιμάζεται είναι ό,τι τρέχει.
 *
 * ⚠️ **Τέσσερις εγγυήσεις — καμία δεν είναι σχόλιο, όλες έχουν άγκυρα:**
 * 1. **Ίδιος παραλήπτης** με το πρωτότυπο — το αίτημα δεν δέχεται άλλον.
 * 2. **Ίδιο περιεχόμενο** (τίτλος · κλειδί i18n · ενέργειες) — κανένα κείμενο γραμμένο εδώ.
 * 3. **Ιδεμποτές**: `eventId = <αρχικό>:replay:<ετικέτα>` ⇒ ίδια ετικέτα δύο φορές =
 *    «διπλότυπο» στο ατομικό `create()` του orchestrator, όχι δεύτερο email.
 * 4. **Κανένας υποχρεωτικός τύπος** (ασφάλεια): μια «επανάληψη» του «ο λογαριασμός σας
 *    παραβιάστηκε» θα ήταν ψεύτικος συναγερμός — και παρακάμπτει κάθε ρύθμιση.
 *
 * @module server/notifications/notification-replay
 * @see ADR-849 §6γ
 */

import {
  EVENT_CATEGORY_MAP,
  NOTIFICATION_ENTITY_TYPES,
  NOTIFICATION_SEVERITIES,
  SOURCE_SERVICES,
  getCurrentEnvironment,
  isNotificationEventType,
} from '@/config/notification-events';
import type { DispatchRequest } from '@/server/notifications/notification-orchestrator';

/** Η ετικέτα μιας επανάληψης: μικρά λατινικά, ψηφία, παύλες — γίνεται μέρος ταυτότητας. */
const REPLAY_TAG = /^[a-z0-9][a-z0-9-]{0,39}$/;

/** Γιατί ένα έγγραφο δεν επαναλαμβάνεται. **Κλειστό σύνολο**, ποτέ ελεύθερο κείμενο. */
export type ReplayRejection =
  | 'missing-recipient'
  | 'unknown-event-type'
  | 'mandatory-type'
  | 'missing-tenant'
  | 'missing-title'
  | 'missing-event-id'
  | 'invalid-source';

/** Μια ειδοποίηση έτοιμη για επανάληψη — όλα όσα χρειάζεται το αίτημα, εκτός από το `eventId`. */
export interface ReplaySource {
  readonly notificationId: string;
  readonly recipientId: string;
  readonly originalEventId: string;
  readonly request: Omit<DispatchRequest, 'eventId'>;
}

export type ReplayParse =
  | { readonly ok: true; readonly source: ReplaySource }
  | { readonly ok: false; readonly notificationId: string; readonly reason: ReplayRejection };

type Fields = Readonly<Record<string, unknown>>;
type Action = NonNullable<DispatchRequest['actions']>[number];

function fieldsOf(value: unknown): Fields {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Fields) : {};
}

function textOf(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

function stringRecordOf(value: unknown): Record<string, string> | undefined {
  const entries = Object.entries(fieldsOf(value)).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string',
  );
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function actionsOf(value: unknown): Action[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const actions = value.map(fieldsOf).flatMap((raw): Action[] => {
    const id = textOf(raw.id);
    const label = textOf(raw.label);
    if (!id || !label) return [];
    const url = textOf(raw.url);
    return [{ id, label, ...(url ? { url } : {}), ...(raw.destructive === true ? { destructive: true } : {}) }];
  });
  return actions.length > 0 ? actions : undefined;
}

/** Τα προαιρετικά του αιτήματος — **μόνο** όσα υπάρχουν (η Firestore απορρίπτει `undefined`). */
function optionalContentOf(doc: Fields, meta: Fields): Partial<DispatchRequest> {
  const body = textOf(doc.body);
  const severity = oneOf(doc.severity, Object.values(NOTIFICATION_SEVERITIES));
  const entityId = textOf(meta.entityId);
  const entityType = oneOf(meta.entityType, Object.values(NOTIFICATION_ENTITY_TYPES));
  const actions = actionsOf(doc.actions);
  const titleKey = textOf(doc.titleKey);
  const titleParams = stringRecordOf(doc.titleParams);
  return {
    ...(body ? { body } : {}),
    ...(severity ? { severity } : {}),
    ...(entityId ? { entityId } : {}),
    ...(entityType ? { entityType } : {}),
    ...(actions ? { actions } : {}),
    ...(titleKey ? { titleKey, ...(titleParams ? { titleParams } : {}) } : {}),
  };
}

/**
 * **Έγγραφο ειδοποίησης → πηγή επανάληψης**, ή ο λόγος που δεν γίνεται.
 *
 * ⚠️ Αμυντικά: το έγγραφο έρχεται από τη βάση, όχι από τον μεταγλωττιστή. Κάθε κλειστό
 * σύνολο (τύπος · υπηρεσία · σοβαρότητα · οντότητα) ελέγχεται έναντι του **SSoT** του.
 */
export function parseReplaySource(notificationId: string, data: unknown): ReplayParse {
  const doc = fieldsOf(data);
  const meta = fieldsOf(doc.meta);
  const origin = fieldsOf(doc.source);
  const reject = (reason: ReplayRejection): ReplayParse => ({ ok: false, notificationId, reason });

  const recipientId = textOf(doc.userId);
  if (!recipientId) return reject('missing-recipient');
  const eventType = meta.eventType;
  if (!isNotificationEventType(eventType)) return reject('unknown-event-type');
  if (EVENT_CATEGORY_MAP[eventType].isMandatory) return reject('mandatory-type');
  const tenantId = textOf(doc.tenantId);
  if (!tenantId) return reject('missing-tenant');
  const title = textOf(doc.title);
  if (!title) return reject('missing-title');
  const originalEventId = textOf(meta.eventId);
  if (!originalEventId) return reject('missing-event-id');
  const service = oneOf(origin.service, Object.values(SOURCE_SERVICES));
  if (!service) return reject('invalid-source');

  const feature = textOf(origin.feature);
  const request: Omit<DispatchRequest, 'eventId'> = {
    eventType,
    recipientId,
    tenantId,
    title,
    source: { service, ...(feature ? { feature } : {}), env: getCurrentEnvironment() },
    ...optionalContentOf(doc, meta),
  };
  return { ok: true, source: { notificationId, recipientId, originalEventId, request } };
}

/** Είναι αυτή έγκυρη ετικέτα επανάληψης; */
export function isReplayTag(tag: string): boolean {
  return REPLAY_TAG.test(tag);
}

/** Η ταυτότητα του γεγονότος της επανάληψης — ντετερμινιστική, άρα ιδεμποτής. */
export function replayEventId(originalEventId: string, tag: string): string {
  // Αναλλοίωτο για τον προγραμματιστή (το CLI ελέγχει πρώτα) — όχι κείμενο οθόνης (N.11).
  if (!isReplayTag(tag)) throw new Error(`Invalid replay tag: "${tag}"`);
  return `${originalEventId}:replay:${tag}`;
}

/** Το αίτημα προς το `dispatchNotification` — **ο ίδιος** παραλήπτης, νέα ταυτότητα γεγονότος. */
export function toReplayRequest(source: ReplaySource, tag: string): DispatchRequest {
  return { ...source.request, eventId: replayEventId(source.originalEventId, tag) };
}

/** Ο **ένας** παραλήπτης όλων των πηγών — `null` αν είναι περισσότεροι (ή καμία πηγή). */
export function replayRecipientOf(sources: readonly ReplaySource[]): string | null {
  const recipients = new Set(sources.map((source) => source.recipientId));
  return recipients.size === 1 ? [...recipients][0] : null;
}
