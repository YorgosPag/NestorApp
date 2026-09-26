import 'server-only';

/**
 * @fileoverview **ΑΙΤΗΜΑ ΘΕΑΣΗΣ — ΠΟΙΟΣ ΜΑΘΑΙΝΕΙ ΤΙ** (ADR-884 Φ0.13 · Κ3β).
 * @related `services/stay-calendar/stay-booking-notifier.service.ts` (το ΠΡΟΤΥΠΟ: αίτημα προς οικοδεσπότη ·
 *   απάντηση προς επισκέπτη) · `server/notifications/notification-orchestrator.ts` (ο ΕΝΑΣ αγωγός)
 * @module server/spatial-tour/tour-access-notifier
 *
 * 🏆 **Πρότυπο Google Drive «Request access»**: ο υπεύθυνος μαθαίνει **αμέσως** ποιος ζήτησε· ο αιτών μαθαίνει την
 * απάντηση — **και** την έγκριση **και** την απόρριψη. Δύο ακροατήρια ⇒ δύο γεγονότα ⇒ δύο διακόπτες στις
 * ρυθμίσεις (ίδιο μάθημα με `mandateRequestAnswered` / `stayRequestAnswered`).
 *
 * 🔑 **Ένας αγωγός για όλα** (`dispatchNotification`): ειδοποίηση στην εφαρμογή **και** email, σεβόμενα τις
 * ρυθμίσεις του παραλήπτη, με ιδεμποτία. Κανένα χειρόγραφο email δίπλα του.
 *
 * 🔑 **Ιδεμποτία κατά ΜΕΤΑΒΑΣΗ** (μάθημα του `mandate-request-notifier`): `eventId` = αίτημα + αριθμός υποβολής +
 * μετάβαση. Το ίδιο αίτημα δεν κρίνεται δεύτερη φορά (CAS `pending`), άρα η σύγκρουση κλειδιού είναι δομικά αδύνατη.
 *
 * 🔑 **Ποτέ δεν πετά**: η πράξη έχει ήδη γραφτεί· η ειδοποίηση είναι ενημέρωση, όχι μέρος της.
 */

import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import {
  getCurrentEnvironment,
  NOTIFICATION_ENTITY_TYPES,
  NOTIFICATION_EVENT_TYPES,
  SOURCE_SERVICES,
} from '@/config/notification-events';
import { formatOperatorDate } from '@/lib/operator-time-format';
import { listingNoticeTitle } from '@/lib/listings/listing-notice-title';
import { viewDestination, type NotificationDestination } from '@/lib/notifications/notification-destination';
import { custodyOf, custodyWorkspace } from '@/lib/owner-property/listing-custody';
import { ownerPropertyFromDocument } from '@/lib/owner-property/owner-property-from-document';
import { tourManageHref, tourViewHref } from '@/lib/spatial-tour/tour-routes';
import { createModuleLogger } from '@/lib/telemetry';
import { dispatchNotification } from '@/server/notifications/notification-orchestrator';
import type { TourSubject } from '@/types/spatial-tour';
import { orgWorkspace, personalWorkspace, workspaceTenantId, type WorkspaceRef } from '@/types/workspace-membership';

const logger = createModuleLogger('tour-access-notifier');

/** Η γλώσσα του θέματος — ελληνικά, όπως όλα τα θέματα email του διακομιστή (ADR-777 §8.22). */
const EMAIL_LOCALE = 'el';

/** Ο υπεύθυνος της ρίζας — **ποιος** ειδοποιείται και **σε ποιον χώρο** ανοίγει η ειδοποίηση. */
interface TourHost {
  readonly userId: string;
  readonly workspace: WorkspaceRef;
  readonly fallbackTitle: string | undefined;
}

/**
 * **Πού οδηγεί το «νέο αίτημα»** (ADR-849 §6δ): στο πάνελ περιήγησης του υπευθύνου, στον χώρο της θεματοφυλακής —
 * γραφείο ⇒ η καρτέλα του ακινήτου· ιδιώτης ⇒ η σελίδα περιήγησης της καταχώρησής του. Εξάγεται ώστε ο ανιχνευτής
 * απόκλισης να ρωτά **αυτόν** τον κανόνα.
 */
export function tourAccessReceivedDestination(subject: TourSubject, workspace: WorkspaceRef): NotificationDestination {
  return viewDestination(tourManageHref(subject), workspace);
}

/** **Πού οδηγεί η απάντηση**: στη σελίδα θέασης — η πύλη λέει τι βλέπει (εγκρίθηκε · απορρίφθηκε · ξανά). */
export function tourAccessAnsweredDestination(listingId: string, requesterUid: string): NotificationDestination {
  return viewDestination(tourViewHref(listingId), personalWorkspace(requesterUid));
}

/** Ο υπεύθυνος — ιδιώτης: ο συντάκτης· γραφείο: όποιος καταχώρησε το ακίνητο (ίδιο με `mandate-decision-notifier`). */
export async function readTourHost(db: Firestore, subject: TourSubject): Promise<TourHost | null> {
  if (subject.kind === 'owner-property') {
    const snap = await db.collection(COLLECTIONS.OWNER_PROPERTIES).doc(subject.id).get();
    const property = ownerPropertyFromDocument(snap.data(), subject.id);
    return property === null
      ? null
      : { userId: property.authorUserId, workspace: custodyWorkspace(custodyOf(property)), fallbackTitle: property.title };
  }
  const data = (await db.collection(COLLECTIONS.PROPERTIES).doc(subject.id).get()).data();
  const createdBy: unknown = data?.createdBy;
  const companyId: unknown = data?.companyId;
  if (typeof createdBy !== 'string' || createdBy === '' || typeof companyId !== 'string' || companyId === '') return null;
  return { userId: createdBy, workspace: orgWorkspace(companyId), fallbackTitle: typeof data?.name === 'string' ? data.name : undefined };
}

/** **«Ο Χ ζήτησε να δει την περιήγηση»** — προς τον υπεύθυνο. */
export async function announceTourAccessRequested(
  db: Firestore,
  input: { readonly subject: TourSubject; readonly requestId: string; readonly requestCount: number; readonly requesterName: string },
): Promise<void> {
  try {
    const host = await readTourHost(db, input.subject);
    if (host === null) return;
    const title = await listingNoticeTitle(db, input.subject.id, host.fallbackTitle);
    await dispatchNotification({
      eventType: NOTIFICATION_EVENT_TYPES.PROPERTIES_TOUR_ACCESS_REQUESTED,
      recipientId: host.userId,
      tenantId: workspaceTenantId(host.workspace),
      title: `Αίτημα θέασης περιήγησης για «${title}» από ${input.requesterName}`,
      titleKey: 'tourAccessRequested.title',
      titleParams: { title, who: input.requesterName },
      eventId: `tour-access:${input.requestId}:${input.requestCount}:request`,
      entityId: input.subject.id,
      entityType: NOTIFICATION_ENTITY_TYPES.PROPERTY,
      ...tourAccessReceivedDestination(input.subject, host.workspace),
      source: { service: SOURCE_SERVICES.PROPERTIES, feature: 'tour-access', env: getCurrentEnvironment() },
    });
  } catch (error) {
    logger.error('Η ειδοποίηση νέου αιτήματος θέασης δεν στάλθηκε', {
      requestId: input.requestId, error: error instanceof Error ? error.message : String(error),
    });
  }
}

/** **«Εγκρίθηκε έως … / Δεν εγκρίθηκε»** — προς τον αιτούντα. */
export async function announceTourAccessAnswered(
  db: Firestore,
  input: {
    readonly subject: TourSubject;
    readonly requestId: string;
    readonly requestCount: number;
    readonly requesterUid: string;
    readonly decision: 'approved' | 'declined';
    readonly expiresAt: string | null;
  },
): Promise<void> {
  try {
    const title = await listingNoticeTitle(db, input.subject.id);
    const until = input.expiresAt === null ? '' : formatOperatorDate(input.expiresAt, EMAIL_LOCALE);
    const approved = input.decision === 'approved';
    await dispatchNotification({
      eventType: NOTIFICATION_EVENT_TYPES.PROPERTIES_TOUR_ACCESS_ANSWERED,
      recipientId: input.requesterUid,
      // 🔑 Ο αιτών είναι ο μισθωτής του εαυτού του — ίδιο ιδίωμα με `mandate-request-notifier`.
      tenantId: input.requesterUid,
      title: approved
        ? `Μπορείτε να δείτε την περιήγηση του «${title}» έως ${until}`
        : `Το αίτημα θέασης για «${title}» δεν εγκρίθηκε`,
      titleKey: approved ? 'tourAccessAnswered.approvedTitle' : 'tourAccessAnswered.declinedTitle',
      titleParams: { title, until },
      eventId: `tour-access:${input.requestId}:${input.requestCount}:pending>${input.decision}`,
      entityId: input.subject.id,
      entityType: NOTIFICATION_ENTITY_TYPES.PROPERTY,
      ...tourAccessAnsweredDestination(input.subject.id, input.requesterUid),
      source: { service: SOURCE_SERVICES.PROPERTIES, feature: 'tour-access', env: getCurrentEnvironment() },
    });
  } catch (error) {
    logger.error('Η ειδοποίηση απάντησης αιτήματος θέασης δεν στάλθηκε', {
      requestId: input.requestId, error: error instanceof Error ? error.message : String(error),
    });
  }
}
