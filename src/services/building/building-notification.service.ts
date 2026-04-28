import { dispatchNotification } from '@/server/notifications';
import {
  NOTIFICATION_EVENT_TYPES,
  NOTIFICATION_ENTITY_TYPES,
  SOURCE_SERVICES,
  getCurrentEnvironment,
} from '@/config/notification-events';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('BuildingNotificationService');

export function notifyBuildingCreated(params: {
  buildingId: string;
  buildingName: string;
  recipientId: string;
  tenantId: string;
}): void {
  void dispatchNotification({
    eventType: NOTIFICATION_EVENT_TYPES.BUILDING_CREATED,
    recipientId: params.recipientId,
    tenantId: params.tenantId,
    title: `Building ${params.buildingName} was created`,
    severity: 'success',
    source: { service: SOURCE_SERVICES.PROPERTIES, feature: 'buildings', env: getCurrentEnvironment() },
    eventId: `building.created.${params.buildingId}`,
    entityId: params.buildingId,
    entityType: NOTIFICATION_ENTITY_TYPES.BUILDING,
    titleKey: 'building.notifications.created',
    titleParams: { buildingName: params.buildingName },
  }).catch(err => logger.warn('[Buildings] Notification dispatch failed (non-critical)', { err }));
}
