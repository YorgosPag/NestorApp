/**
 * @fileoverview **ΤΟ ΓΡΑΜΜΑΤΟΚΙΒΩΤΙΟ ΔΕΝ ΥΠΑΡΧΕΙ ΠΙΑ — ΤΟ ΣΗΜΑ ΦΕΥΓΕΙ** (ADR-841 §7 Α21.20).
 * @related server/comms/email-delivery/mailbox-absent-consumers.ts (ο καλών) ·
 *   services/mandate/showcase-email-confirmation-store.ts (τα δύο μισά) ·
 *   lib/agency/showcase-email-confirmation-rules.ts (`withoutConfirmationBefore`)
 * @module services/mandate/showcase-email-return.service
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΠΡΟΒΛΗΜΑ — ΔΗΜΟΣΙΟΣ ΙΣΧΥΡΙΣΜΟΣ ΠΟΥ ΠΑΥΕΙ ΝΑ ΙΣΧΥΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η Α21.18 δίνει «Email επιβεβαιωμένο · Σεπ 2026» μετά από κλικ. Αν το γραμματοκιβώτιο καταργηθεί, το
 * σήμα θα έλεγε «λαμβάνει» σε κάθε επισκέπτη — ακριβώς το ψέμα που απαγορεύει η Α9.2. Το DSA άρθ. 30
 * λέει ότι «επαρκείς ενδείξεις» ανακρίβειας απαιτούν αίτημα διόρθωσης **χωρίς καθυστέρηση**.
 *
 * 🏆 **ΠΡΑΚΤΙΚΗ ΜΕΓΑΛΩΝ, ΚΑΙ ΠΟΥ ΤΟΥΣ ΞΕΠΕΡΝΑΜΕ**: το GitHub ακυρώνει την επαλήθευση σε bounce· το
 * Salesforce βάζει σημαία που φεύγει **μόνο χειροκίνητα**. Εδώ φεύγει **μόνο** επιβεβαίωση **παλαιότερη**
 * από την απόδειξη — μια νέα επιβεβαίωση την αντικαθιστά χωρίς κανένα «καθάρισμα».
 *
 * 🔑 **ΣΕΙΡΑ**: πρώτα η **αλήθεια** (συναλλαγή, ιδεμποτενής), μετά η **ειδοποίηση** (δευτερεύουσα,
 * ιδεμποτενής με `eventId`). Αποτυχία ειδοποίησης **δεν** κρατά το σήμα δημόσιο — η οθόνη της κάρτας
 * δείχνει ούτως ή άλλως «Επέστρεψε οριστικά» από το ημερολόγιο.
 *
 * ⚠️ **SERVER-ONLY** — Admin SDK.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { getCurrentEnvironment, NOTIFICATION_EVENT_TYPES, SOURCE_SERVICES } from '@/config/notification-events';
import { carryConfirmations, withoutConfirmationBefore } from '@/lib/agency/showcase-email-confirmation-rules';
import { normaliseChannelEmail } from '@/lib/contact/channel-email';
import { AGENCY_SHOWCASE_CARD_ROUTE } from '@/lib/mandate/mandate-routes';
import { viewDestination, type NotificationDestination } from '@/lib/notifications/notification-destination';
import { createModuleLogger } from '@/lib/telemetry';
import { dispatchNotification } from '@/server/notifications/notification-orchestrator';
import { orgWorkspace } from '@/types/workspace-membership';

import {
  readCardWithEmail,
  writeLocationConfirmations,
  type ShowcaseEmailAddress,
} from './showcase-email-confirmation-store';

const logger = createModuleLogger('showcase-email-return');

/** Η απόδειξη που φέρνει το ημερολόγιο συμβάντων. */
export interface ShowcaseEmailAbsence {
  readonly email: string;
  readonly evidenceAt: string;
  readonly evidenceEventId: string;
}

interface ConfirmedStore extends ShowcaseEmailAddress {
  readonly requestedByUid: string;
  readonly confirmedAt: string;
}

export interface ShowcaseEmailReturnOutcome {
  /** Σε πόσα καταστήματα αφαιρέθηκε **τώρα** σήμα. */
  readonly revoked: number;
}

/** Ο προορισμός της ειδοποίησης — η κάρτα, στον χώρο του γραφείου. Εξάγεται για τον ανιχνευτή απόκλισης. */
export function cardEmailReturnedDestination(companyId: string): NotificationDestination {
  return viewDestination(AGENCY_SHOWCASE_CARD_ROUTE, orgWorkspace(companyId));
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

/** Ένα αποθηκευμένο αίτημα → κατάστημα με επιβεβαίωση **πριν** την απόδειξη — ή `null`. */
function storeOf(data: unknown, email: string, evidence: number): ConfirmedStore | null {
  const raw = (typeof data === 'object' && data !== null ? data : {}) as Record<string, unknown>;
  const companyId = text(raw.companyId);
  const locationId = text(raw.locationId);
  const requestedByUid = text(raw.requestedByUid);
  const confirmedAt = text(raw.settledAt);
  if (companyId === null || locationId === null || requestedByUid === null || confirmedAt === null) return null;
  const confirmed = Date.parse(confirmedAt);
  if (!Number.isFinite(confirmed) || confirmed >= evidence) return null;
  return { companyId, locationId, email, requestedByUid, confirmedAt };
}

/** **Ποια καταστήματα επιβεβαίωσαν αυτή τη διεύθυνση πριν πεθάνει** — ένα ανά (γραφείο, κατάστημα), το νεότερο. */
async function confirmedStoresOf(adminDb: AdminFirestore, email: string, evidenceAt: string): Promise<ConfirmedStore[]> {
  const evidence = Date.parse(evidenceAt);
  if (!Number.isFinite(evidence)) return [];
  // tenant-scope-exempt: η ύπαρξη ενός γραμματοκιβωτίου είναι γεγονός του κόσμου, όχι ενός μισθωτή — ένα
  //   hard bounce αφορά ΚΑΘΕ γραφείο που δημοσιεύει τη διεύθυνση. Καλείται ΜΟΝΟ από το υπογεγραμμένο webhook
  //   συμβάντων (καμία ταυτότητα χρήστη), και κάθε εγγραφή που ακολουθεί γίνεται ανά `companyId`.
  const snapshot = await adminDb
    .collection(COLLECTIONS.SHOWCASE_EMAIL_CONFIRMATIONS)
    .where('email', '==', email)
    .where('state', '==', 'confirmed')
    .get();
  const latest = new Map<string, ConfirmedStore>();
  for (const doc of snapshot.docs) {
    const store = storeOf(doc.data(), email, evidence);
    if (store === null) continue;
    const key = `${store.companyId}/${store.locationId}`;
    const seen = latest.get(key);
    if (seen === undefined || Date.parse(store.confirmedAt) > Date.parse(seen.confirmedAt)) latest.set(key, store);
  }
  return [...latest.values()];
}

/** **Μία συναλλαγή ανά κατάστημα.** `true` = αφαιρέθηκε σήμα **τώρα**· επανάληψη ⇒ `false`. */
async function revokeAt(adminDb: AdminFirestore, store: ConfirmedStore, evidenceAt: string): Promise<boolean> {
  return adminDb.runTransaction(async (tx): Promise<boolean> => {
    const card = await readCardWithEmail(adminDb, store, tx);
    if (card === null) return false;
    const current = card.channels.emailConfirmations;
    const next = withoutConfirmationBefore(current, store.email, evidenceAt);
    if (carryConfirmations(next, [store.email]).length === carryConfirmations(current, [store.email]).length) return false;
    writeLocationConfirmations(adminDb, tx, store, card, next);
    return true;
  });
}

/** **Ο επαγγελματίας μαθαίνει.** Δευτερεύον: αποτυχία καταγράφεται, δεν πετά. */
async function announceReturn(store: ConfirmedStore, absence: ShowcaseEmailAbsence): Promise<void> {
  try {
    const result = await dispatchNotification({
      eventType: NOTIFICATION_EVENT_TYPES.PROPERTIES_CARD_EMAIL_RETURNED,
      recipientId: store.requestedByUid,
      tenantId: store.companyId,
      // ⚠️ Το `title` είναι το ΘΕΜΑ ΤΟΥ EMAIL· η αλήθεια είναι το `titleKey` (ίδιο δηλωμένο κενό με
      //    το `mandate-decision-notifier`: κανένας αποδότης i18n στον διακομιστή — ADR-777 §8.22 #2).
      title: `Το email ${store.email} της κάρτας σας επέστρεψε — το σήμα «Email επιβεβαιωμένο» αφαιρέθηκε`,
      titleKey: 'cardEmailReturned.title',
      titleParams: { email: store.email },
      eventId: `card-email-returned:${store.companyId}:${store.locationId}:${absence.evidenceEventId}`,
      // 🔑 Η οντότητα είναι το ΓΡΑΦΕΙΟ: από αυτήν ο ανιχνευτής απόκλισης ξαναχτίζει τον προορισμό.
      entityId: store.companyId,
      ...cardEmailReturnedDestination(store.companyId),
      source: { service: SOURCE_SERVICES.PROPERTIES, feature: 'card-email-returned', env: getCurrentEnvironment() },
    });
    if (!result.success && !result.skipped) logger.warn('[CARD-EMAIL] Η ειδοποίηση επιστροφής δεν γράφτηκε', { reason: result.reason });
  } catch (error) {
    logger.error('[CARD-EMAIL] Η ειδοποίηση επιστροφής απέτυχε', { error: error instanceof Error ? error.message : String(error) });
  }
}

/**
 * **Το γραμματοκιβώτιο αποδείχθηκε ανύπαρκτο** — κάθε σήμα που στηριζόταν σε παλαιότερη επιβεβαίωση φεύγει.
 *
 * Ιδεμποτενές: δεύτερη κλήση με την ίδια απόδειξη ⇒ `revoked: 0`, καμία εγγραφή, καμία ειδοποίηση.
 * **Πετά** σε βλάβη βάσης — το webhook απαντά 5xx και ο πάροχος ξαναστέλνει.
 */
export async function revokeShowcaseEmailConfirmations(
  adminDb: AdminFirestore,
  absence: ShowcaseEmailAbsence,
): Promise<ShowcaseEmailReturnOutcome> {
  const email = normaliseChannelEmail(absence.email);
  const stores = await confirmedStoresOf(adminDb, email, absence.evidenceAt);
  let revoked = 0;
  for (const store of stores) {
    if (!(await revokeAt(adminDb, store, absence.evidenceAt))) continue;
    revoked += 1;
    await announceReturn(store, absence);
  }
  if (revoked > 0) logger.info('[CARD-EMAIL] Σήμα αφαιρέθηκε μετά από hard bounce', { revoked, evidenceEventId: absence.evidenceEventId });
  return { revoked };
}
