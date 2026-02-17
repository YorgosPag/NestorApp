/**
 * 🏢 ENTERPRISE: Centralized Real-time System
 *
 * Single entry point for all real-time functionality.
 *
 * @example
 * ```tsx
 * // Import service
 * import { RealtimeService, useRealtimeBuildings } from '@/services/realtime';
 *
 * // Use in component
 * const { getBuildingCount } = useRealtimeBuildings();
 *
 * // Dispatch events
 * RealtimeService.dispatchBuildingProjectLinked({
 *   buildingId: 'abc',
 *   previousProjectId: null,
 *   newProjectId: 'xyz',
 *   timestamp: Date.now()
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
  type BuildingProjectLinkPayload,
  // Update payloads
  type ProjectUpdatedPayload,
  type BuildingUpdatedPayload,
  type UnitUpdatedPayload,
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
  type UnitCreatedPayload,
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
  type UnitDeletedPayload,
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
  REALTIME_EVENTS,
  REALTIME_STORAGE_KEYS,
} from './types';

// Hooks
export { useRealtimeQuery } from './hooks/useRealtimeQuery';
export { useRealtimeBuildings } from './hooks/useRealtimeBuildings';
export { useRealtimeUnits } from './hooks/useRealtimeUnits';
