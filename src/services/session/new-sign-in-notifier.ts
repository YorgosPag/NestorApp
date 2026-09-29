import 'server-only';

/**
 * @fileoverview **«ΝΕΑ ΣΥΝΔΕΣΗ ΣΤΟΝ ΛΟΓΑΡΙΑΣΜΟ ΣΑΣ»** — ADR-894 §10 Β3.
 * @related services/session/sign-in-novelty (ο κριτής) · services/session/session-server.service (ο καλών) ·
 *   server/notifications/notification-orchestrator (ο αγωγός)
 * @module services/session/new-sign-in-notifier
 *
 * 🔑 **Κανένα νέο κανάλι**: το συμβάν `security.newDeviceLogin` ήταν ήδη δηλωμένο (`notification-events.ts`,
 * **υποχρεωτικό**) με γραμμή στις ρυθμίσεις — αλλά **κανείς δεν το έστελνε**. Υποχρεωτικό ⇒ κουδούνι πάντα και
 * email αμέσως (`decideEmailDelivery`: «ένα κρίσιμο μήνυμα δεν σιωπά από ρύθμιση άνεσης») — Google/GitHub.
 * 🔑 **Χώρος = ο ΠΡΟΣΩΠΙΚΟΣ** του ανθρώπου (ίδιο με `announceMemberExit`): η ασφάλεια του λογαριασμού δεν ανήκει
 * σε γραφείο.
 * 🔑 **Ταυτότητα = άνθρωπος + εγγραφή** (`new-sign-in:{uid}:{sessionId}`) ⇒ επανάληψη δεν ξαναστέλνει.
 * ⚠️ **Ποτέ μπλοκάρον, ποτέ δεν ρίχνει**: η σύνδεση έγινε· μια ειδοποίηση που αποτυγχάνει γράφεται στο log.
 * ⛔ Καμία IP στο κείμενο — πόλη/χώρα από τη **δική μας** επίλυση, όπως στη λίστα συσκευών.
 */

import { Timestamp } from 'firebase-admin/firestore';

import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import {
  getCurrentEnvironment,
  NOTIFICATION_ENTITY_TYPES,
  NOTIFICATION_EVENT_TYPES,
  SOURCE_SERVICES,
} from '@/config/notification-events';
import { createBundleTranslate } from '@/i18n/bundle-translate';
import elShared from '@/i18n/locales/el/common-shared.json';
import { getErrorMessage } from '@/lib/error-utils';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { createModuleLogger } from '@/lib/telemetry';
import { dispatchNotification } from '@/server/notifications/notification-orchestrator';
import { personalWorkspace, workspaceTenantId } from '@/types/workspace-membership';

import { SESSION_RETENTION_DAYS } from './session-helpers';
import { assessSignInNovelty, signInFactsOf, type SignInNoveltyReason } from './sign-in-novelty';
import type { SessionDeviceInfo, SessionLocation } from './session.types';

const logger = createModuleLogger('new-sign-in-notifier');

const DAY_MS = 24 * 60 * 60 * 1000;

/** Η εφεδρεία (και το email) βγαίνει από το locale — μία διατύπωση για κουδούνι και email. */
const elSharedT = createBundleTranslate({ 'common-shared': elShared }, 'common-shared');

export interface NewSignInCandidate {
  readonly uid: string;
  readonly sessionId: string;
  readonly deviceInfo: SessionDeviceInfo;
  readonly location: SessionLocation;
  readonly now: Date;
}

/** Γλωσσικά ουδέτερο («Thessaloniki, GR»): η παράμετρος ταξιδεύει ίδια σε κάθε γλώσσα του παραλήπτη. */
function placeOf(location: SessionLocation): string | null {
  if (location.precision === 'none' || !location.countryCode) return null;
  return location.city ? `${location.city}, ${location.countryCode}` : location.countryCode;
}

/** Οι εγγραφές των τελευταίων 90 ημερών, **εκτός** από τη νέα — ερώτημα εύρους+ταξινόμησης στο ίδιο πεδίο. */
async function recentHistory(uid: string, sessionId: string, now: Date) {
  const since = Timestamp.fromMillis(now.getTime() - SESSION_RETENTION_DAYS * DAY_MS);
  const snap = await getAdminFirestore()
    .collection(COLLECTIONS.USERS).doc(uid).collection(SUBCOLLECTIONS.USER_SESSIONS)
    .where('timestamps.lastActiveAt', '>=', since)
    .orderBy('timestamps.lastActiveAt', 'desc')
    .get();
  return snap.docs.filter((doc) => doc.id !== sessionId).map((doc) => signInFactsOf(doc.data()));
}

async function dispatchNewSignIn(candidate: NewSignInCandidate, reasons: readonly SignInNoveltyReason[]): Promise<void> {
  const place = placeOf(candidate.location);
  const params = { device: `${candidate.deviceInfo.browser} · ${candidate.deviceInfo.os}`, ...(place ? { place } : {}) };
  const bodyKey = place ? 'newSignIn.body' : 'newSignIn.bodyNoPlace';
  const workspace = personalWorkspace(candidate.uid);
  await dispatchNotification({
    eventType: NOTIFICATION_EVENT_TYPES.SECURITY_NEW_DEVICE_LOGIN,
    recipientId: candidate.uid,
    tenantId: workspaceTenantId(workspace),
    workspace,
    title: elSharedT('newSignIn.title', params),
    titleKey: 'newSignIn.title',
    titleParams: params,
    body: elSharedT(bodyKey, params),
    bodyKey,
    bodyParams: params,
    eventId: `new-sign-in:${candidate.uid}:${candidate.sessionId}`,
    entityId: candidate.sessionId,
    entityType: NOTIFICATION_ENTITY_TYPES.USER,
    reasons,
    source: { service: SOURCE_SERVICES.SECURITY, feature: 'new-sign-in', env: getCurrentEnvironment() },
  });
}

/** Μετά τη γέννηση μιας εγγραφής: αν η σύνδεση είναι νέα για τον λογαριασμό, ο άνθρωπος το μαθαίνει. */
export async function alertOnNovelSignIn(candidate: NewSignInCandidate): Promise<SignInNoveltyReason[]> {
  try {
    const history = await recentHistory(candidate.uid, candidate.sessionId, candidate.now);
    const reasons = assessSignInNovelty(
      signInFactsOf({ location: candidate.location, deviceInfo: candidate.deviceInfo }),
      history,
    );
    if (reasons.length > 0) await dispatchNewSignIn(candidate, reasons);
    return reasons;
  } catch (error: unknown) {
    logger.error('Η ειδοποίηση νέας σύνδεσης δεν στάλθηκε', { uid: candidate.uid, error: getErrorMessage(error) });
    return [];
  }
}
