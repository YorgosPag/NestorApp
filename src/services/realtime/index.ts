/**
 * Centralized Real-time System
 *
 * Single entry point for all real-time functionality.
 *
 * @example
 * ```tsx
 * import { RealtimeService } from '@/services/realtime';
 *
 * // Dispatch events (type-safe)
 * RealtimeService.dispatch('PROJECT_UPDATED', {
 *   projectId: 'abc',
 *   updates: { name: 'New name' },
 *   timestamp: Date.now()
 * });
 *
 * // Subscribe to events (type-safe)
 * const unsub = RealtimeService.subscribe('PROJECT_UPDATED', (payload) => {
 *   console.log(payload.projectId, payload.updates);
 * });
 * ```
 */

// Core Service
export { RealtimeService, default as RealtimeServiceInstance } from './RealtimeService';

// Types
export {
  type RealtimeCollection,
  type SubscriptionStatus,
  type RealtimeQueryOptions,
  type RealtimeDocOptions,
  type RealtimeQueryResult,
  type RealtimeDocResult,
  type RealtimeBuilding,
  type RealtimeProject,
  type RealtimeUnit,
  type RealtimeEventMap,
  type BuildingProjectLinkPayload,
  type PropertyBuildingLinkPayload,
  // Update payloads
  type ProjectUpdatedPayload,
  type BuildingUpdatedPayload,
  type PropertyUpdatedPayload,
  type ContactUpdatedPayload,
  type TaskUpdatedPayload,
  type OpportunityUpdatedPayload,
  type CommunicationUpdatedPayload,
  type FileUpdatedPayload,
  type NotificationUpdatedPayload,
  type ObligationUpdatedPayload,
  type WorkspaceUpdatedPayload,
  type RelationshipUpdatedPayload,
  type SessionUpdatedPayload,
  type UserSettingsUpdatedPayload,
  type FloorplanUpdatedPayload,
  // Create payloads
  type BuildingCreatedPayload,
  type ProjectCreatedPayload,
  type ContactCreatedPayload,
  type PropertyCreatedPayload,
  type TaskCreatedPayload,
  type OpportunityCreatedPayload,
  type CommunicationCreatedPayload,
  type FileCreatedPayload,
  type NotificationCreatedPayload,
  type ObligationCreatedPayload,
  type WorkspaceCreatedPayload,
  type RelationshipCreatedPayload,
  type SessionCreatedPayload,
  type FloorplanCreatedPayload,
  // Delete payloads
  type BuildingDeletedPayload,
  type ProjectDeletedPayload,
  type ContactDeletedPayload,
  type PropertyDeletedPayload,
  type TaskDeletedPayload,
  type OpportunityDeletedPayload,
  type CommunicationDeletedPayload,
  type FileDeletedPayload,
  type FileTrashedPayload,
  type FileRestoredPayload,
  type NotificationDeletedPayload,
  type ObligationDeletedPayload,
  type WorkspaceDeletedPayload,
  type RelationshipDeletedPayload,
  type SessionDeletedPayload,
  type FloorplanDeletedPayload,
  // Parking payloads
  type ParkingCreatedPayload,
  type ParkingUpdatedPayload,
  type ParkingDeletedPayload,
  // Association link payloads
  type ContactLinkCreatedPayload,
  type ContactLinkDeletedPayload,
  type FileLinkCreatedPayload,
  type FileLinkDeletedPayload,
  // Entity linking payloads
  type EntityLinkedPayload,
  type EntityUnlinkedPayload,
  type RealtimeEventType,
  // Server→Client sync bridge types (generic)
  type EntitySyncAction,
  type SyncEntityType,
  // @deprecated — use EntitySyncAction
  type ContactSyncAction,
  SYNC_SOURCE_AI_AGENT,
  REALTIME_EVENTS,
} from './types';

// Hooks
export { useRealtimeQuery } from './hooks/useRealtimeQuery';
export { useRealtimeBuildings } from './hooks/useRealtimeBuildings';
export { useRealtimeProperties } from './hooks/useRealtimeProperties';
export { useRealtimeTasks } from './hooks/useRealtimeTasks';
export type { TaskStats } from './hooks/useRealtimeTasks';
export { useRealtimeOpportunities } from './hooks/useRealtimeOpportunities';
export { useRealtimeBuildingFloors } from './hooks/useRealtimeBuildingFloors';
export { useRealtimeBuildingFloorplan } from './hooks/useRealtimeBuildingFloorplan';
export { useRealtimePropertiesTrashCount } from './hooks/useRealtimePropertiesTrashCount';
export type { UseRealtimePropertiesTrashCountReturn } from './hooks/useRealtimePropertiesTrashCount';
