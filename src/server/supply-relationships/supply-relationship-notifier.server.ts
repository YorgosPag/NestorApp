import 'server-only';

/**
 * **Ποιος μαθαίνει τι** στη σχέση προμήθειας (ADR-923 §5.12).
 *
 * | Γεγονός | Προς | Γιατί |
 * |---|---|---|
 * | `requested` | όποιον δημοσίευσε τον σύνδεσμο | αίτημα που κανείς δεν βλέπει είναι πόρτα που δεν ανοίγει ποτέ |
 * | `accepted` | όποιον προσκάλεσε | ο κύκλος κλείνει |
 * | `approved` | όποιον ζήτησε | μόλις άνοιξε ο κατάλογος για το γραφείο του |
 *
 * 🔒 Καμία ειδοποίηση για απόρριψη ή ανάκληση: Σ7, ο αγοραστής δεν μαθαίνει λόγο, και μια ειδοποίηση θα ήταν λόγος.
 * ⚠️ Καμία αποτυχία ειδοποίησης δεν ακυρώνει την πράξη (N.7.2 #6): η σχέση έχει ήδη γραφτεί.
 * @module server/supply-relationships/supply-relationship-notifier.server
 */

import {
  getCurrentEnvironment,
  NOTIFICATION_ENTITY_TYPES,
  NOTIFICATION_EVENT_TYPES,
  SOURCE_SERVICES,
} from '@/config/notification-events';
import { createBundleTranslate } from '@/i18n/bundle-translate';
import elShared from '@/i18n/locales/el/common-shared.json';
import { viewDestination, type NotificationDestination } from '@/lib/notifications/notification-destination';
import { createModuleLogger } from '@/lib/telemetry';
import { readWorkspaceName } from '@/lib/workspace/workspace-catalog';
import { dispatchNotification } from '@/server/notifications/notification-orchestrator';
import { CATALOG_PAGES, SUPPLIERS_TAB_QUERY } from '@/subapps/catalog/catalog-routes';
import type { SupplyRelationship, SupplyRelationshipSide } from '@/subapps/catalog/types/supply-relationship';
import { orgWorkspace } from '@/types/workspace-membership';

const logger = createModuleLogger('supply-relationship-notifier');

const elSharedT = createBundleTranslate({ 'common-shared': elShared }, 'common-shared', 'el');

/** Κάθε πλευρά ανοίγει τη δική της καρτέλα, στον δικό της χώρο. */
export function supplyConnectionDestination(relationship: Pick<SupplyRelationship, 'companyId' | 'buyerCompanyId'>, side: SupplyRelationshipSide): NotificationDestination {
  return side === 'supplier'
    ? viewDestination(CATALOG_PAGES.connections, orgWorkspace(relationship.companyId))
    : viewDestination(`${CATALOG_PAGES.connections}${SUPPLIERS_TAB_QUERY}`, orgWorkspace(relationship.buyerCompanyId));
}

/** Ο παραλήπτης της έγκρισης είναι όποιος ζήτησε: έτσι ξαναβρίσκεται η πλευρά του από το έγγραφο. */
export function supplyNoticeSide(relationship: Pick<SupplyRelationship, 'requestedByUid'>, recipientUid: string): SupplyRelationshipSide {
  return relationship.requestedByUid === recipientUid ? 'buyer' : 'supplier';
}

export type SupplyNotice = 'requested' | 'accepted' | 'approved';

const TITLE_KEY: Readonly<Record<SupplyNotice, string>> = {
  requested: 'supplyConnection.requestedTitle',
  accepted: 'supplyConnection.acceptedTitle',
  approved: 'supplyConnection.approvedTitle',
};

const SIDE_OF_NOTICE: Readonly<Record<SupplyNotice, SupplyRelationshipSide>> = { requested: 'supplier', accepted: 'supplier', approved: 'buyer' };

/** Πες το στον άνθρωπο. Ποτέ δεν πετά. */
export async function announceSupplyChange(relationship: SupplyRelationship, notice: SupplyNotice, recipientUid: string): Promise<void> {
  const side = SIDE_OF_NOTICE[notice];
  const [tenantId, counterpartId] = side === 'supplier' ? [relationship.companyId, relationship.buyerCompanyId] : [relationship.buyerCompanyId, relationship.companyId];
  try {
    const who = (await readWorkspaceName(counterpartId).catch(() => '')).trim();
    const titleKey = TITLE_KEY[notice];
    const titleParams = { who: who === '' ? elSharedT('supplyConnection.unnamed') : who };
    await dispatchNotification({
      eventType: NOTIFICATION_EVENT_TYPES.PROCUREMENT_SUPPLY_CONNECTION,
      recipientId: recipientUid,
      tenantId,
      title: elSharedT(titleKey, titleParams),
      titleKey,
      titleParams,
      eventId: `supply-connection:${relationship.id}:${notice}:${relationship.revision}`,
      entityId: relationship.id,
      entityType: NOTIFICATION_ENTITY_TYPES.SUPPLY_RELATIONSHIP,
      ...supplyConnectionDestination(relationship, side),
      source: { service: SOURCE_SERVICES.PROCUREMENT, feature: 'supply-relationship', env: getCurrentEnvironment() },
    });
  } catch (error) {
    logger.error('Η ειδοποίηση σχέσης προμήθειας δεν στάλθηκε', {
      relationshipId: relationship.id, error: error instanceof Error ? error.message : String(error),
    });
  }
}
