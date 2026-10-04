/**
 * @module services/ownership/ownership-decision-notifier.service
 * @description **«Τι αποφασίστηκε για την ιδιοκτησία σας»** (ADR-900 §8 #2, Β3) — σχήμα Google Business Profile:
 * κάθε απόφαση φτάνει στον άνθρωπο με **λόγο** και **επόμενη ενέργεια**, και ο **υπάρχων** κάτοχος μαθαίνει όταν
 * άλλος πήρε την ιδιοκτησία.
 *
 * | Κατάσταση | Παραλήπτης | Γεγονός |
 * |---|---|---|
 * | `verified` · `rejected` | ο κάτοχος της απόδειξης | `properties.ownershipVerificationDecided` (διακόπτης) |
 * | `revoked` (με λόγο) | ο κάτοχος της απόδειξης | `security.ownershipLost` (υποχρεωτικό) |
 * | `superseded` | ο **προηγούμενος** κάτοχος | `security.ownershipLost` (υποχρεωτικό) |
 *
 * 🔑 **Κείμενα ΜΟΝΟ από το `common-shared`** (`createBundleTranslate`, όπως ο `member-exit-notifier`): το θέμα του
 * email και η οθόνη λένε το **ίδιο** πράγμα, χωρίς ελληνικά μέσα στον κώδικα. Πίνακες `Record` δεμένοι στις ρίζες
 * του λεξιλογίου ⇒ νέα κατάσταση ή λόγος **δεν μεταγλωττίζεται** μέχρι να αποφασίσει κάποιος τι λέει στον άνθρωπο.
 *
 * ⚠️ **Δεν πετά ΠΟΤΕ** — η απόφαση είναι ήδη γραμμένη. `pending-review` δεν είναι απόφαση ⇒ σιωπή.
 * Ιδεμποτία: `eventId` = απόδειξη + κατάσταση (μία ειδοποίηση ανά μετάβαση· η κατάσταση δεν ξαναγυρνά).
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import {
  getCurrentEnvironment,
  NOTIFICATION_ENTITY_TYPES,
  NOTIFICATION_EVENT_TYPES,
  SOURCE_SERVICES,
  type NotificationEventType,
} from '@/config/notification-events';
import { createBundleTranslate } from '@/i18n/bundle-translate';
import elShared from '@/i18n/locales/el/common-shared.json';
import { viewDestination, type NotificationDestination } from '@/lib/notifications/notification-destination';
import { custodyOf, custodyWorkspace, type ListingCustody } from '@/lib/owner-property/listing-custody';
import { ownerPropertyFromDocument } from '@/lib/owner-property/owner-property-from-document';
import { offerDetailHref } from '@/lib/owner-property/owner-property-routes';
import { createModuleLogger } from '@/lib/telemetry';
import { dispatchNotification } from '@/server/notifications/notification-orchestrator';
import type {
  OwnershipRevocationReason,
  OwnershipVerification,
  OwnershipVerificationStatus,
} from '@/types/ownership-verification';
import { workspaceTenantId } from '@/types/workspace-membership';

const logger = createModuleLogger('ownership-decision-notifier');

const elSharedT = createBundleTranslate({ 'common-shared': elShared }, 'common-shared');

/** Οι καταστάσεις που **είναι** απόφαση — το `pending-review` είναι η απουσία της. */
type DecidedStatus = Exclude<OwnershipVerificationStatus, 'pending-review'>;

interface Wording {
  readonly titleKey: string;
  readonly bodyKey: string;
  readonly eventType: NotificationEventType;
}

const OWNERSHIP_LOST = NOTIFICATION_EVENT_TYPES.SECURITY_OWNERSHIP_LOST;

const REVOKED_WORDING: Record<OwnershipRevocationReason, Wording> = {
  'evidence-invalid': { titleKey: 'ownershipDecision.revokedTitle', bodyKey: 'ownershipDecision.revokedBodyEvidenceInvalid', eventType: OWNERSHIP_LOST },
  'claimed-in-error': { titleKey: 'ownershipDecision.revokedTitle', bodyKey: 'ownershipDecision.revokedBodyClaimedInError', eventType: OWNERSHIP_LOST },
  'ownership-ended': { titleKey: 'ownershipDecision.revokedTitle', bodyKey: 'ownershipDecision.revokedBodyOwnershipEnded', eventType: OWNERSHIP_LOST },
  'owner-request': { titleKey: 'ownershipDecision.releasedTitle', bodyKey: 'ownershipDecision.releasedBody', eventType: OWNERSHIP_LOST },
};

const DECIDED = NOTIFICATION_EVENT_TYPES.PROPERTIES_OWNERSHIP_VERIFICATION_DECIDED;

const WORDING: Record<Exclude<DecidedStatus, 'revoked'>, Wording> = {
  verified: { titleKey: 'ownershipDecision.verifiedTitle', bodyKey: 'ownershipDecision.verifiedBody', eventType: DECIDED },
  rejected: { titleKey: 'ownershipDecision.rejectedTitle', bodyKey: 'ownershipDecision.rejectedBody', eventType: DECIDED },
  superseded: { titleKey: 'ownershipDecision.supersededTitle', bodyKey: 'ownershipDecision.supersededBody', eventType: OWNERSHIP_LOST },
};

/** Η διατύπωση μιας απόφασης — `null` για το `pending-review` (καμία απόφαση, καμία ειδοποίηση). */
export function ownershipDecisionWording(record: Pick<OwnershipVerification, 'status' | 'revocationReason'>): Wording | null {
  if (record.status === 'pending-review') return null;
  if (record.status !== 'revoked') return WORDING[record.status];
  // Ανάκληση χωρίς λόγο δεν γράφεται από κανέναν· αν βρεθεί, λέμε το αυστηρότερο που ξέρουμε.
  return REVOKED_WORDING[record.revocationReason ?? 'claimed-in-error'];
}

/**
 * **Ο προορισμός** — η σελίδα της αγγελίας (εκεί ζει η κάρτα επαλήθευσης), στον χώρο που τη **διαχειρίζεται**
 * (ADR-849 §6δ Β1). Εξάγεται ώστε ο ανιχνευτής απόκλισης να ρωτά **αυτόν** τον κανόνα.
 */
export function ownershipDecisionDestination(ownerPropertyId: string, custody: ListingCustody): NotificationDestination {
  return viewDestination(offerDetailHref(ownerPropertyId), custodyWorkspace(custody));
}

/**
 * Ειδοποιεί τον κάτοχο της απόδειξης `record` για την τρέχουσα κατάστασή της.
 * @returns `true` όταν στάλθηκε· `false` όταν παραλείφθηκε ή απέτυχε (με log). **Κανένα πέταγμα.**
 */
export async function announceOwnershipDecision(db: AdminFirestore, record: OwnershipVerification): Promise<boolean> {
  const wording = ownershipDecisionWording(record);
  if (wording === null) return false;
  try {
    const snap = await db.collection(COLLECTIONS.OWNER_PROPERTIES).doc(record.ownerPropertyId).get();
    const property = ownerPropertyFromDocument(snap.data(), record.ownerPropertyId);
    if (property === null) {
      logger.warn('Απόφαση κατοχής για αγγελία που δεν βρέθηκε — καμία ειδοποίηση', {
        data: { verificationId: record.id },
      });
      return false;
    }
    const custody = custodyOf(property);
    const params = { title: property.title };
    const result = await dispatchNotification({
      eventType: wording.eventType,
      recipientId: record.uid,
      tenantId: workspaceTenantId(custodyWorkspace(custody)),
      title: elSharedT(wording.titleKey, params),
      titleKey: wording.titleKey,
      titleParams: params,
      body: elSharedT(wording.bodyKey, params),
      bodyKey: wording.bodyKey,
      bodyParams: params,
      eventId: `ownership-decision:${record.id}>${record.status}`,
      entityId: record.ownerPropertyId,
      entityType: NOTIFICATION_ENTITY_TYPES.PROPERTY,
      ...ownershipDecisionDestination(record.ownerPropertyId, custody),
      source: { service: SOURCE_SERVICES.PROPERTIES, feature: 'ownership-verification', env: getCurrentEnvironment() },
    });
    return result.success;
  } catch (error) {
    logger.error('Η ειδοποίηση απόφασης κατοχής δεν στάλθηκε', {
      data: { verificationId: record.id, status: record.status },
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * **Ο προηγούμενος κάτοχος μαθαίνει** (GBP): η απόδειξή του έγινε `superseded` επειδή άλλος επαλήθευσε τον ίδιο
 * ΚΑΕΚ. Διαβάζει την **αποθηκευμένη** απόδειξη — ό,τι έγραψε η συναλλαγή, όχι ό,τι υποθέτουμε.
 */
export async function announceSupersededOwnership(db: AdminFirestore, verificationId: string | null): Promise<boolean> {
  if (verificationId === null) return false;
  try {
    const snap = await db.collection(COLLECTIONS.OWNERSHIP_VERIFICATIONS).doc(verificationId).get();
    const record = snap.exists ? (snap.data() as OwnershipVerification) : null;
    return record !== null && record.status === 'superseded' ? announceOwnershipDecision(db, record) : false;
  } catch (error) {
    logger.error('Η ειδοποίηση αλλαγής χεριών δεν στάλθηκε', {
      data: { verificationId },
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
