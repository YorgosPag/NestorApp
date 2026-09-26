import 'server-only';

/**
 * =============================================================================
 * SHARE OPEN NOTICE — «ο αποστολέας μαθαίνει ότι άνοιξε ο σύνδεσμός του» (ADR-884 §9.1 Α3′)
 * =============================================================================
 *
 * **Ποιο είδος ειδοποιεί** το λέει η πολιτική (`SHARE_KIND_LINK_POLICY.openNotice` — ΕΝΑ σημείο δήλωσης)· **πότε**
 * το λέει η συσκευή (`share-device.ts`: πρώτο άνοιγμα · νέα συσκευή)· **πώς** το λέει ο αναγγελέας του είδους,
 * γιατί μόνο αυτός ξέρει ποιος είναι ο χώρος και πού οδηγεί η ειδοποίηση.
 *
 * ⚠️ Είδος με `openNotice: true` **χωρίς** αναγγελέα = υπόσχεση που δεν τηρείται — η άγκυρα
 * `share-open-notice.test.ts` αρνείται να μεταγλωττιστεί η απόκλιση σιωπηλά (`OPEN_NOTICE_KINDS`).
 *
 * 🔑 **Ποτέ δεν πετά**: η σελίδα του επισκέπτη δεν χαλά επειδή απέτυχε η ειδοποίηση προς τον αποστολέα.
 *
 * @module server/sharing/share-open-notice
 */

import type { Firestore } from 'firebase-admin/firestore';

import { createModuleLogger } from '@/lib/telemetry';
import { announceTourLinkOpened } from '@/server/spatial-tour/tour-access-notifier';
import {
  isResolvableShareKind,
  linkPolicyOf,
  type ResolvableShareKind,
  type ResolvedSharePayload,
} from '@/services/sharing/share-resolve-contract';
import { registerShareDevice, type ShareDeviceRegistration } from './share-device';
import type { StoredShare } from './share-token-lookup';

const logger = createModuleLogger('ShareOpenNotice');

type OpenAnnouncer = (
  adminDb: Firestore,
  share: StoredShare,
  payload: ResolvedSharePayload,
  registration: ShareDeviceRegistration,
) => Promise<void>;

/** Περιήγηση: ο αποστολέας + το «για ποιον» του συνδέσμου (υποχρεωτικό για αυτό το είδος — `labelRequired`). */
const announceSpatialTourOpen: OpenAnnouncer = async (adminDb, share, payload, registration) => {
  if (payload.kind !== 'spatial_tour' || payload.data.subject === null) return;
  // Το «για ποιον» είναι το `label` (εσωτερικό), ΠΟΤΕ το `note` — εκείνο είναι το μήνυμα προς τον παραλήπτη (§4.7 Α3′′).
  if (share.label === null) {
    logger.warn('Σύνδεσμος περιήγησης χωρίς «για ποιον» — καμία ειδοποίηση ανοίγματος', { shareId: share.id });
    return;
  }
  await announceTourLinkOpened(adminDb, {
    subject: payload.data.subject,
    shareId: share.id,
    senderUid: share.createdBy,
    who: share.label,
    deviceOrdinal: registration.ordinal,
  });
};

const OPEN_ANNOUNCERS: Readonly<Partial<Record<ResolvableShareKind, OpenAnnouncer>>> = {
  spatial_tour: announceSpatialTourOpen,
};

/** Τα είδη που **ξέρουν** να αναγγείλουν — για την άγκυρα απόκλισης από την πολιτική. */
export const OPEN_NOTICE_KINDS: readonly ResolvableShareKind[] = Object.keys(OPEN_ANNOUNCERS).filter(isResolvableShareKind);

/**
 * Καλείται **μία** φορά ανά επίσκεψη (όχι μέσα στο κουπόνι επίσκεψης), **μετά** την καταγραφή πρόσβασης και την
 * προβολή — ό,τι αναγγέλλεται έχει ήδη σερβιριστεί.
 */
export async function noteShareOpened(
  adminDb: Firestore,
  input: { readonly share: StoredShare; readonly payload: ResolvedSharePayload; readonly device: string },
): Promise<void> {
  if (!linkPolicyOf(input.share.entityType).openNotice) return;
  try {
    const registration = await registerShareDevice(adminDb, input.share, input.device);
    if (registration.outcome !== 'first-open' && registration.outcome !== 'new-device') return;
    const announce = OPEN_ANNOUNCERS[input.payload.kind];
    if (announce === undefined) {
      logger.error('Είδος με openNotice χωρίς αναγγελέα', { kind: input.payload.kind, shareId: input.share.id });
      return;
    }
    await announce(adminDb, input.share, input.payload, registration);
  } catch (error) {
    logger.error('Η καταγραφή ανοίγματος συνδέσμου απέτυχε', {
      shareId: input.share.id, error: error instanceof Error ? error.message : String(error),
    });
  }
}
