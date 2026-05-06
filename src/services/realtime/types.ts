/**
 * 🏢 ENTERPRISE: Centralized Real-time Types
 *
 * Type-safe definitions for the real-time system.
 * Used by RealtimeService, hooks, and consumers.
 *
 * Payload interfaces extracted to event-payload-definitions.ts (Google SRP, N.7.1).
 */

import type { DocumentData, QueryConstraint } from 'firebase/firestore';

// ============================================================================
// CORE TYPES
// ============================================================================

/**
 * 🏢 ENTERPRISE: Supported Firestore collections for real-time
 */
export type RealtimeCollection =
  | 'buildings'
  | 'projects'
  | 'properties'
  | 'floors'
  | 'contacts'
  | 'project_floorplans'
  | 'files';

/**
 * 🏢 ENTERPRISE: Real-time subscription status
 */
export type SubscriptionStatus =
  | 'idle'
  | 'connecting'
  | 'active'
  | 'error'
  | 'disconnected';

/**
 * 🏢 ENTERPRISE: Real-time query options
 */
export interface RealtimeQueryOptions {
  /** Collection to watch */
  collection: RealtimeCollection;
  /** Optional query constraints (where, orderBy, limit) */
  constraints?: QueryConstraint[];
  /** Enable/disable the subscription */
  enabled?: boolean;
  /** Callback on successful update */
  onUpdate?: (data: DocumentData[]) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
}

/**
 * 🏢 ENTERPRISE: Single document real-time options
 */
export interface RealtimeDocOptions {
  /** Collection name */
  collection: RealtimeCollection;
  /** Document ID */
  documentId: string;
  /** Enable/disable the subscription */
  enabled?: boolean;
  /** Callback on successful update */
  onUpdate?: (data: DocumentData | null) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
}

/**
 * 🏢 ENTERPRISE: Real-time query return type
 */
export interface RealtimeQueryResult<T> {
  /** Current data */
  data: T[];
  /** Loading state */
  loading: boolean;
  /** Error message if any */
  error: string | null;
  /** Subscription status */
  status: SubscriptionStatus;
  /** Manual refetch trigger */
  refetch: () => void;
  /** Unsubscribe function */
  unsubscribe: () => void;
}

/**
 * 🏢 ENTERPRISE: Real-time document return type
 */
export interface RealtimeDocResult<T> {
  /** Current document data */
  data: T | null;
  /** Loading state */
  loading: boolean;
  /** Error message if any */
  error: string | null;
  /** Subscription status */
  status: SubscriptionStatus;
  /** Manual refetch trigger */
  refetch: () => void;
}

// ============================================================================
// NAVIGATION-SPECIFIC TYPES
// ============================================================================

/**
 * 🏢 ENTERPRISE: Building data for navigation real-time
 */
export interface RealtimeBuilding {
  id: string;
  name: string;
  projectId: string | null;
  address?: string;
  city?: string;
  status?: string;
  totalArea?: number;
  floors?: number;
  units?: number;
  addressesCount: number;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * 🏢 ENTERPRISE: Project data for navigation real-time
 */
export interface RealtimeProject {
  id: string;
  name: string;
  companyId: string;
  status?: string;
  progress?: number;
  description?: string;
}

/**
 * 🏢 ENTERPRISE: Unit data for navigation real-time
 * Used by useRealtimeProperties hook for live property counts per building
 */
export interface RealtimeUnit {
  id: string;
  name: string;
  buildingId: string | null;
  type?: string;
  status?: string;
  area?: number;
  floor?: number;
  createdAt?: string;
  updatedAt?: string;
}

// ============================================================================
// SERVER→CLIENT SYNC BRIDGE (AI Agent → UI)
// ============================================================================

/**
 * 🏢 ENTERPRISE: Generic entity sync actions for the server→client signal bridge.
 * Written to `config/ui_sync_signal` by server-side AI tools.
 * Client hooks subscribe via onSnapshot and trigger UI refresh.
 */
export type EntitySyncAction = 'CREATED' | 'UPDATED' | 'DELETED';

/**
 * Entity types supported by the AI sync bridge.
 * Add new entity types here as they gain AI agent support.
 */
export type SyncEntityType =
  | 'contacts'
  | 'tasks'
  | 'buildings'
  | 'projects'
  | 'opportunities'
  | 'communications';

/** @deprecated Use EntitySyncAction — kept for backward compatibility */
export type ContactSyncAction = 'CONTACT_CREATED' | 'CONTACT_UPDATED' | 'CONTACT_DELETED';

/** Source identifier for server-side AI agent writes */
export const SYNC_SOURCE_AI_AGENT = 'ai_agent' as const;

// ============================================================================
// EVENT TYPES (for cross-component communication)
// ============================================================================

/**
 * 🏢 ENTERPRISE: Real-time event types for CustomEvent dispatch
 */
export const REALTIME_EVENTS = {
  // Update events
  BUILDING_UPDATED: 'realtime:building-updated',
  PROJECT_UPDATED: 'realtime:project-updated',
  UNIT_UPDATED: 'realtime:unit-updated',
  CONTACT_UPDATED: 'realtime:contact-updated',
  TASK_UPDATED: 'realtime:task-updated',
  OPPORTUNITY_UPDATED: 'realtime:opportunity-updated',
  COMMUNICATION_UPDATED: 'realtime:communication-updated',
  FILE_UPDATED: 'realtime:file-updated',
  NOTIFICATION_UPDATED: 'realtime:notification-updated',
  OBLIGATION_UPDATED: 'realtime:obligation-updated',
  WORKSPACE_UPDATED: 'realtime:workspace-updated',
  RELATIONSHIP_UPDATED: 'realtime:relationship-updated',
  SESSION_UPDATED: 'realtime:session-updated',
  USER_SETTINGS_UPDATED: 'realtime:user-settings-updated',
  FLOORPLAN_UPDATED: 'realtime:floorplan-updated',
  // Create events
  BUILDING_CREATED: 'realtime:building-created',
  PROJECT_CREATED: 'realtime:project-created',
  CONTACT_CREATED: 'realtime:contact-created',
  UNIT_CREATED: 'realtime:unit-created',
  TASK_CREATED: 'realtime:task-created',
  OPPORTUNITY_CREATED: 'realtime:opportunity-created',
  COMMUNICATION_CREATED: 'realtime:communication-created',
  FILE_CREATED: 'realtime:file-created',
  NOTIFICATION_CREATED: 'realtime:notification-created',
  OBLIGATION_CREATED: 'realtime:obligation-created',
  WORKSPACE_CREATED: 'realtime:workspace-created',
  RELATIONSHIP_CREATED: 'realtime:relationship-created',
  SESSION_CREATED: 'realtime:session-created',
  FLOORPLAN_CREATED: 'realtime:floorplan-created',
  // Delete events
  BUILDING_DELETED: 'realtime:building-deleted',
  PROJECT_DELETED: 'realtime:project-deleted',
  CONTACT_DELETED: 'realtime:contact-deleted',
  UNIT_DELETED: 'realtime:unit-deleted',
  TASK_DELETED: 'realtime:task-deleted',
  OPPORTUNITY_DELETED: 'realtime:opportunity-deleted',
  COMMUNICATION_DELETED: 'realtime:communication-deleted',
  FILE_DELETED: 'realtime:file-deleted',
  FILE_TRASHED: 'realtime:file-trashed',
  FILE_RESTORED: 'realtime:file-restored',
  NOTIFICATION_DELETED: 'realtime:notification-deleted',
  OBLIGATION_DELETED: 'realtime:obligation-deleted',
  WORKSPACE_DELETED: 'realtime:workspace-deleted',
  RELATIONSHIP_DELETED: 'realtime:relationship-deleted',
  SESSION_DELETED: 'realtime:session-deleted',
  FLOORPLAN_DELETED: 'realtime:floorplan-deleted',
  // Parking events
  PARKING_CREATED: 'realtime:parking-created',
  PARKING_UPDATED: 'realtime:parking-updated',
  PARKING_DELETED: 'realtime:parking-deleted',
  // Storage events
  STORAGE_CREATED: 'realtime:storage-created',
  STORAGE_UPDATED: 'realtime:storage-updated',
  STORAGE_DELETED: 'realtime:storage-deleted',
  // Link events
  BUILDING_PROJECT_LINKED: 'realtime:building-project-linked',
  PROPERTY_BUILDING_LINKED: 'realtime:property-building-linked',
  NAVIGATION_REFRESH: 'realtime:navigation-refresh',
  // Legal contract events (ADR-230)
  CONTRACT_CREATED: 'realtime:contract-created',
  CONTRACT_UPDATED: 'realtime:contract-updated',
  CONTRACT_STATUS_CHANGED: 'realtime:contract-status-changed',
  CONTRACT_DELETED: 'realtime:contract-deleted',
  CONTRACT_PROFESSIONAL_CHANGED: 'realtime:contract-professional-changed',
  // Association link events (contact_links, file_links)
  CONTACT_LINK_CREATED: 'realtime:contact-link-created',
  CONTACT_LINK_DELETED: 'realtime:contact-link-deleted',
  CONTACT_LINK_REMOVED: 'realtime:contact-link-removed',
  FILE_LINK_CREATED: 'realtime:file-link-created',
  FILE_LINK_DELETED: 'realtime:file-link-deleted',
  // Entity linking events (Building-Project, Unit-Building, etc.)
  ENTITY_LINKED: 'realtime:entity-linked',
  ENTITY_UNLINKED: 'realtime:entity-unlinked',
  // Cascade propagation (ADR-231)
  CASCADE_PROPAGATED: 'realtime:cascade-propagated',
} as const;

export type RealtimeEventType = typeof REALTIME_EVENTS[keyof typeof REALTIME_EVENTS];

// ============================================================================
// PAYLOAD INTERFACES & EVENT MAP (extracted for SRP compliance)
// ============================================================================

export * from './event-payload-definitions';
