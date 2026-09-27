import 'server-only';

/**
 * @fileoverview **«ΤΟ ΓΡΑΦΕΙΟ Χ ΣΑΣ ΑΦΑΙΡΕΣΕ» — ΜΕ ΛΟΓΙΑ, ΟΧΙ ΜΕ 403** — ADR-892 §3.6 #3.
 * @related server/workspace/member-exit (ο καλών) · server/notifications/notification-orchestrator (ο αγωγός)
 * @module server/workspace/member-exit-notifier
 *
 * 🔑 **Ο χώρος της ειδοποίησης είναι ο ΠΡΟΣΩΠΙΚΟΣ** του ανθρώπου: στο γραφείο δεν έχει πια πρόσβαση, άρα
 * ειδοποίηση εκεί θα ήταν αόρατη. Κανένας σύνδεσμος (τίποτα να ανοίξει) ⇒ κανένας κανόνας προορισμού.
 * 🔑 **Ταυτότητα = δρόμος + γραφείο + άνθρωπος + στιγμή της πράξης**: επανάληψη της ίδιας πράξης (ιδεμποτική
 * επισκευή) **δεν** ξαναστέλνει· νέα πράξη (νέα θητεία που τελειώνει, νέα παύση) **στέλνει**.
 * 🔑 ADR-892 Φ2β: και η **παύση** και η **επαναφορά** λέγονται με λόγια — ίδιο υποχρεωτικό event ασφαλείας
 * (το αναγνωριστικό του μένει: είναι αποθηκευμένο σε σταλμένες ειδοποιήσεις).
 * ⚠️ **Ποτέ μπλοκάρον**: η έξοδος έγινε· μια ειδοποίηση που αποτυγχάνει γράφεται στο log.
 */

import {
  getCurrentEnvironment,
  NOTIFICATION_ENTITY_TYPES,
  NOTIFICATION_EVENT_TYPES,
  SOURCE_SERVICES,
} from '@/config/notification-events';
import { createBundleTranslate } from '@/i18n/bundle-translate';
import elShared from '@/i18n/locales/el/common-shared.json';
import { getErrorMessage } from '@/lib/error-utils';
import { createModuleLogger } from '@/lib/telemetry';
import { readWorkspaceName } from '@/lib/workspace/workspace-catalog';
import type { MemberExitKind } from '@/lib/workspace/member-exit-policy';
import { dispatchNotification } from '@/server/notifications/notification-orchestrator';
import { personalWorkspace, workspaceTenantId } from '@/types/workspace-membership';

const logger = createModuleLogger('member-exit-notifier');

/** Κάθε αλλαγή πρόσβασης που λέγεται στον άνθρωπο — οι τρεις δρόμοι εξόδου **και** η επαναφορά (ADR-892 Φ2β). */
export type MemberAccessNoticeKind = MemberExitKind | 'restore';

interface NoticeWording {
  /** Σύντομος τίτλος: **τι** έγινε, σε **ποιο** γραφείο. */
  readonly titleKey: string;
  /** Το σώμα: τι **δεν** επηρεάζεται και **τι ακολουθεί** (ADR-892 §13 — το email δεν είναι πια μόνο τίτλος). */
  readonly bodyKey: string;
  /** Πρόθεμα ταυτότητας ανά είδος πράξης — ποτέ σύγκρουση `eventId` ανάμεσα σε λήξη, παύση και επαναφορά. */
  readonly idPrefix: 'workspace-exit' | 'workspace-pause' | 'workspace-restore';
}

/** **Ένας** χάρτης ανά δρόμο (όχι `if` στον καλούντα) — νέος δρόμος χωρίς γραμμή **δεν μεταγλωττίζεται**. */
const WORDING_BY_KIND: Readonly<Record<MemberAccessNoticeKind, NoticeWording>> = {
  removal: {
    titleKey: 'workspaceMembershipEnded.removedTitle',
    bodyKey: 'workspaceMembershipEnded.removedBody',
    idPrefix: 'workspace-exit',
  },
  departure: {
    titleKey: 'workspaceMembershipEnded.leftTitle',
    bodyKey: 'workspaceMembershipEnded.leftBody',
    idPrefix: 'workspace-exit',
  },
  pause: {
    titleKey: 'workspaceMembershipEnded.pausedTitle',
    bodyKey: 'workspaceMembershipEnded.pausedBody',
    idPrefix: 'workspace-pause',
  },
  restore: {
    titleKey: 'workspaceMembershipEnded.restoredTitle',
    bodyKey: 'workspaceMembershipEnded.restoredBody',
    idPrefix: 'workspace-restore',
  },
};

/**
 * 🔑 **Η εφεδρεία (και το email) βγαίνει ΑΠΟ ΤΟ LOCALE, όχι από γραμμένο κείμενο** — ίδιο ιδίωμα με το
 * `listing-announcement-copy.ts`. Ήταν δεύτερη, **άλλη** διατύπωση εδώ, και μετρήθηκε ζωντανά (27/09) ότι το
 * email έλεγε άλλα από το κουδούνι. Τώρα μία πρόταση, ένα σημείο.
 * 🔶 Η γλώσσα της εφεδρείας είναι η ελληνική για **κάθε** παραλήπτη — όριο του αγωγού, όχι αυτού του αρχείου.
 */
const elSharedT = createBundleTranslate({ 'common-shared': elShared }, 'common-shared');

export interface MemberExitNotice {
  readonly kind: MemberAccessNoticeKind;
  readonly companyId: string;
  readonly uid: string;
  /** Μοναδικό ανά πράξη — η στιγμή της (ISO). */
  readonly occurredAtISO: string;
}

export async function announceMemberExit(notice: MemberExitNotice): Promise<void> {
  const wording = WORDING_BY_KIND[notice.kind];
  try {
    const params = { office: await readWorkspaceName(notice.companyId) };
    await dispatchNotification({
      eventType: NOTIFICATION_EVENT_TYPES.SECURITY_WORKSPACE_MEMBERSHIP_ENDED,
      recipientId: notice.uid,
      tenantId: workspaceTenantId(personalWorkspace(notice.uid)),
      workspace: personalWorkspace(notice.uid),
      title: elSharedT(wording.titleKey, params),
      titleKey: wording.titleKey,
      titleParams: params,
      body: elSharedT(wording.bodyKey, params),
      bodyKey: wording.bodyKey,
      bodyParams: params,
      eventId: `${wording.idPrefix}:${notice.companyId}:${notice.uid}:${notice.occurredAtISO}`,
      entityId: notice.companyId,
      entityType: NOTIFICATION_ENTITY_TYPES.USER,
      source: { service: SOURCE_SERVICES.SECURITY, feature: 'workspace-exit', env: getCurrentEnvironment() },
    });
  } catch (error: unknown) {
    logger.error('Η ειδοποίηση εξόδου από γραφείο δεν στάλθηκε', {
      companyId: notice.companyId, uid: notice.uid, error: getErrorMessage(error),
    });
  }
}
