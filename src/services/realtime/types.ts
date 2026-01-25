/**
 * 🏢 ENTERPRISE: Centralized Real-time Types
 *
 * Type-safe definitions for the real-time system.
 * Used by RealtimeService, hooks, and consumers.
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
  | 'units'
  | 'floors'
  | 'contacts'
  | 'project_floorplans'
  | 'building_floorplans';

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
 * Used by useRealtimeUnits hook for live unit counts per building
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
// EVENT TYPES (for cross-component communication)
// ============================================================================

/**
 * 🏢 ENTERPRISE: Real-time event types for CustomEvent dispatch
 */
export const REALTIME_EVENTS = {
  BUILDING_UPDATED: 'realtime:building-updated',
  PROJECT_UPDATED: 'realtime:project-updated',
  BUILDING_PROJECT_LINKED: 'realtime:building-project-linked',
  UNIT_BUILDING_LINKED: 'realtime:unit-building-linked',
  NAVIGATION_REFRESH: 'realtime:navigation-refresh',
} as const;

export type RealtimeEventType = typeof REALTIME_EVENTS[keyof typeof REALTIME_EVENTS];

/**
 * 🏢 ENTERPRISE: Event payload for building-project link
 */
export interface BuildingProjectLinkPayload {
  buildingId: string;
  previousProjectId: string | null;
  newProjectId: string | null;
  timestamp: number;
}

/**
 * 🏢 ENTERPRISE: Event payload for unit-building link
 */
export interface UnitBuildingLinkPayload {
  unitId: string;
  previousBuildingId: string | null;
  newBuildingId: string | null;
  timestamp: number;
}

/**
 * 🏢 ENTERPRISE: Event payload for project update
 * Used for real-time sync across all pages (Navigation, Audit, DXF Viewer)
 */
export interface ProjectUpdatedPayload {
  projectId: string;
  updates: {
    name?: string;
    title?: string;
    status?: string;
  };
  timestamp: number;
}

/**
 * 🏢 ENTERPRISE: localStorage key for cross-page sync
 * Using storage events to sync updates across browser tabs
 */
export const REALTIME_STORAGE_KEYS = {
  PROJECT_UPDATED: 'realtime:project-updated',
} as const;
