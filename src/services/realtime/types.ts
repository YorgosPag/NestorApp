/**
 * 🏢 ENTERPRISE: Centralized Real-time Types
 *
 * Type-safe definitions for the real-time system.
 * Used by RealtimeService, hooks, and consumers.
 */

import type { DocumentData, QueryConstraint } from 'firebase/firestore';
import type { ProjectStatus } from '@/types/project';

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
  // Link events
  BUILDING_PROJECT_LINKED: 'realtime:building-project-linked',
  UNIT_BUILDING_LINKED: 'realtime:unit-building-linked',
  NAVIGATION_REFRESH: 'realtime:navigation-refresh',
  // Association link events (contact_links, file_links)
  CONTACT_LINK_CREATED: 'realtime:contact-link-created',
  CONTACT_LINK_DELETED: 'realtime:contact-link-deleted',
  FILE_LINK_CREATED: 'realtime:file-link-created',
  FILE_LINK_DELETED: 'realtime:file-link-deleted',
  // Entity linking events (Building-Project, Unit-Building, etc.)
  ENTITY_LINKED: 'realtime:entity-linked',
  ENTITY_UNLINKED: 'realtime:entity-unlinked',
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
    status?: ProjectStatus;
  };
  timestamp: number;
}

/**
 * 🏢 ENTERPRISE: Event payload for building update
 * Used for real-time sync when building data changes
 */
export interface BuildingUpdatedPayload {
  buildingId: string;
  updates: {
    name?: string;
    address?: string;
    city?: string;
    status?: string;
    totalArea?: number;
    floors?: number;
    projectId?: string | null;
  };
  timestamp: number;
}

/**
 * 🏢 ENTERPRISE: Event payload for unit update
 * Used for real-time sync when unit data changes
 */
export interface UnitUpdatedPayload {
  unitId: string;
  updates: {
    name?: string;
    type?: string;
    status?: string;
    area?: number;
    floor?: number;
    buildingId?: string | null;
    soldTo?: string | null;
  };
  timestamp: number;
}

/**
 * 🏢 ENTERPRISE: Event payload for contact update
 * Used for real-time sync when contact data changes
 */
export interface ContactUpdatedPayload {
  contactId: string;
  updates: {
    firstName?: string;
    lastName?: string;
    companyName?: string;
    serviceName?: string;
    status?: string;
    isFavorite?: boolean;
  };
  timestamp: number;
}

/**
 * 🏢 ENTERPRISE: Event payload for building creation
 * Used for real-time sync when new building is created
 */
export interface BuildingCreatedPayload {
  buildingId: string;
  building: {
    name?: string;
    address?: string;
    city?: string;
    projectId?: string | null;
  };
  timestamp: number;
}

/**
 * 🏢 ENTERPRISE: Event payload for building deletion
 * Used for real-time sync when building is deleted
 */
export interface BuildingDeletedPayload {
  buildingId: string;
  timestamp: number;
}

/**
 * 🏢 ENTERPRISE: Event payload for project creation
 * Used for real-time sync when new project is created
 */
export interface ProjectCreatedPayload {
  projectId: string;
  project: {
    name?: string;
    title?: string;
    status?: ProjectStatus;
    companyId?: string;
  };
  timestamp: number;
}

/**
 * 🏢 ENTERPRISE: Event payload for project deletion
 * Used for real-time sync when project is deleted
 */
export interface ProjectDeletedPayload {
  projectId: string;
  timestamp: number;
}

/**
 * 🏢 ENTERPRISE: Event payload for contact creation
 * Used for real-time sync when new contact is created
 */
export interface ContactCreatedPayload {
  contactId: string;
  contact: {
    type: 'individual' | 'company' | 'service';
    firstName?: string;
    lastName?: string;
    companyName?: string;
    serviceName?: string;
  };
  timestamp: number;
}

/**
 * 🏢 ENTERPRISE: Event payload for contact deletion
 * Used for real-time sync when contact is deleted
 */
export interface ContactDeletedPayload {
  contactId: string;
  timestamp: number;
}

/**
 * 🏢 ENTERPRISE: Event payload for unit creation
 * Used for real-time sync when new unit is created
 */
export interface UnitCreatedPayload {
  unitId: string;
  unit: {
    name?: string;
    type?: string;
    buildingId?: string | null;
  };
  timestamp: number;
}

/**
 * 🏢 ENTERPRISE: Event payload for unit deletion
 * Used for real-time sync when unit is deleted
 */
export interface UnitDeletedPayload {
  unitId: string;
  timestamp: number;
}

// ============================================================================
// TASK EVENT PAYLOADS (CRM Tasks)
// ============================================================================

/**
 * 🏢 ENTERPRISE: Event payload for task creation
 * Used for real-time sync when new CRM task is created
 */
export interface TaskCreatedPayload {
  taskId: string;
  task: {
    title?: string;
    type?: string;
    priority?: string;
    status?: string;
    assignedTo?: string;
    leadId?: string | null;
  };
  timestamp: number;
}

/**
 * 🏢 ENTERPRISE: Event payload for task update
 * Used for real-time sync when CRM task is modified
 */
export interface TaskUpdatedPayload {
  taskId: string;
  updates: {
    title?: string;
    type?: string;
    priority?: string;
    status?: string;
    assignedTo?: string;
    dueDate?: string;
    leadId?: string | null;
  };
  timestamp: number;
}

/**
 * 🏢 ENTERPRISE: Event payload for task deletion
 * Used for real-time sync when CRM task is deleted
 */
export interface TaskDeletedPayload {
  taskId: string;
  timestamp: number;
}

// ============================================================================
// OPPORTUNITY EVENT PAYLOADS (CRM Opportunities)
// ============================================================================

/**
 * 🏢 ENTERPRISE: Event payload for opportunity creation
 * Used for real-time sync when new opportunity is created
 */
export interface OpportunityCreatedPayload {
  opportunityId: string;
  opportunity: {
    name?: string;
    stage?: string;
    value?: number;
    leadId?: string | null;
    assignedTo?: string;
  };
  timestamp: number;
}

/**
 * 🏢 ENTERPRISE: Event payload for opportunity update
 * Used for real-time sync when opportunity is modified
 */
export interface OpportunityUpdatedPayload {
  opportunityId: string;
  updates: {
    name?: string;
    stage?: string;
    value?: number;
    probability?: number;
    expectedCloseDate?: string;
    leadId?: string | null;
    assignedTo?: string;
  };
  timestamp: number;
}

/**
 * 🏢 ENTERPRISE: Event payload for opportunity deletion
 * Used for real-time sync when opportunity is deleted
 */
export interface OpportunityDeletedPayload {
  opportunityId: string;
  timestamp: number;
}

// ============================================================================
// COMMUNICATION EVENT PAYLOADS (CRM Communications)
// ============================================================================

/**
 * 🏢 ENTERPRISE: Event payload for communication creation
 * Used for real-time sync when new communication is logged
 */
export interface CommunicationCreatedPayload {
  communicationId: string;
  communication: {
    type?: 'email' | 'phone' | 'meeting' | 'note' | 'other';
    subject?: string;
    leadId?: string | null;
    contactId?: string | null;
    userId?: string;
  };
  timestamp: number;
}

/**
 * 🏢 ENTERPRISE: Event payload for communication update
 * Used for real-time sync when communication is modified
 */
export interface CommunicationUpdatedPayload {
  communicationId: string;
  updates: {
    type?: 'email' | 'phone' | 'meeting' | 'note' | 'other';
    subject?: string;
    content?: string;
    leadId?: string | null;
    contactId?: string | null;
  };
  timestamp: number;
}

/**
 * 🏢 ENTERPRISE: Event payload for communication deletion
 * Used for real-time sync when communication is deleted
 */
export interface CommunicationDeletedPayload {
  communicationId: string;
  timestamp: number;
}

// ============================================================================
// FILE EVENT PAYLOADS (File Records)
// ============================================================================

/**
 * 🏢 ENTERPRISE: Event payload for file creation
 * Used for real-time sync when new file is uploaded
 */
export interface FileCreatedPayload {
  fileId: string;
  file: {
    displayName?: string;
    entityType?: string;
    entityId?: string;
    category?: string;
    contentType?: string;
    status?: string;
  };
  timestamp: number;
}

/**
 * 🏢 ENTERPRISE: Event payload for file update
 * Used for real-time sync when file metadata is modified
 */
export interface FileUpdatedPayload {
  fileId: string;
  updates: {
    displayName?: string;
    status?: string;
    lifecycleState?: string;
    sizeBytes?: number;
    hasDownloadUrl?: boolean;
  };
  timestamp: number;
}

/**
 * 🏢 ENTERPRISE: Event payload for file trashed
 * Used for real-time sync when file is moved to trash
 */
export interface FileTrashedPayload {
  fileId: string;
  trashedBy: string;
  purgeAt?: string;
  timestamp: number;
}

/**
 * 🏢 ENTERPRISE: Event payload for file restored
 * Used for real-time sync when file is restored from trash
 */
export interface FileRestoredPayload {
  fileId: string;
  restoredBy: string;
  timestamp: number;
}

/**
 * 🏢 ENTERPRISE: Event payload for file deletion
 * Used for real-time sync when file is permanently deleted
 */
export interface FileDeletedPayload {
  fileId: string;
  timestamp: number;
}

// ============================================================================
// NOTIFICATION EVENT PAYLOADS
// ============================================================================

/**
 * 🏢 ENTERPRISE: Event payload for notification creation
 * Used for real-time sync when new notification is created
 */
export interface NotificationCreatedPayload {
  notificationId: string;
  notification: {
    type?: string;
    title?: string;
    userId?: string;
  };
  timestamp: number;
}

/**
 * 🏢 ENTERPRISE: Event payload for notification update
 * Used for real-time sync when notification is marked as read
 */
export interface NotificationUpdatedPayload {
  notificationId: string;
  updates: {
    isRead?: boolean;
  };
  timestamp: number;
}

/**
 * 🏢 ENTERPRISE: Event payload for notification deletion
 * Used for real-time sync when notification is deleted
 */
export interface NotificationDeletedPayload {
  notificationId: string;
  timestamp: number;
}

// ============================================================================
// OBLIGATION EVENT PAYLOADS
// ============================================================================

/**
 * 🏢 ENTERPRISE: Event payload for obligation creation
 */
export interface ObligationCreatedPayload {
  obligationId: string;
  obligation: {
    title?: string;
    type?: string;
    status?: string;
  };
  timestamp: number;
}

/**
 * 🏢 ENTERPRISE: Event payload for obligation update
 */
export interface ObligationUpdatedPayload {
  obligationId: string;
  updates: {
    title?: string;
    status?: string;
    dueDate?: string;
  };
  timestamp: number;
}

/**
 * 🏢 ENTERPRISE: Event payload for obligation deletion
 */
export interface ObligationDeletedPayload {
  obligationId: string;
  timestamp: number;
}

// ============================================================================
// WORKSPACE EVENT PAYLOADS
// ============================================================================

/**
 * 🏢 ENTERPRISE: Event payload for workspace creation
 */
export interface WorkspaceCreatedPayload {
  workspaceId: string;
  workspace: {
    name?: string;
    companyId?: string;
  };
  timestamp: number;
}

/**
 * 🏢 ENTERPRISE: Event payload for workspace update
 */
export interface WorkspaceUpdatedPayload {
  workspaceId: string;
  updates: {
    name?: string;
    settings?: Record<string, unknown>;
  };
  timestamp: number;
}

/**
 * 🏢 ENTERPRISE: Event payload for workspace deletion
 */
export interface WorkspaceDeletedPayload {
  workspaceId: string;
  timestamp: number;
}

// ============================================================================
// RELATIONSHIP EVENT PAYLOADS (Contact Relationships)
// ============================================================================

/**
 * 🏢 ENTERPRISE: Event payload for relationship creation
 */
export interface RelationshipCreatedPayload {
  relationshipId: string;
  relationship: {
    type?: string;
    sourceId?: string;
    targetId?: string;
  };
  timestamp: number;
}

/**
 * 🏢 ENTERPRISE: Event payload for relationship update
 */
export interface RelationshipUpdatedPayload {
  relationshipId: string;
  updates: {
    type?: string;
    notes?: string;
  };
  timestamp: number;
}

/**
 * 🏢 ENTERPRISE: Event payload for relationship deletion
 */
export interface RelationshipDeletedPayload {
  relationshipId: string;
  timestamp: number;
}

// ============================================================================
// SESSION EVENT PAYLOADS
// ============================================================================

/**
 * 🏢 ENTERPRISE: Event payload for session creation
 */
export interface SessionCreatedPayload {
  sessionId: string;
  session: {
    userId?: string;
    deviceInfo?: string;
  };
  timestamp: number;
}

/**
 * 🏢 ENTERPRISE: Event payload for session update
 */
export interface SessionUpdatedPayload {
  sessionId: string;
  updates: {
    lastActivity?: string;
    isActive?: boolean;
  };
  timestamp: number;
}

/**
 * 🏢 ENTERPRISE: Event payload for session deletion
 */
export interface SessionDeletedPayload {
  sessionId: string;
  timestamp: number;
}

// ============================================================================
// USER SETTINGS EVENT PAYLOADS
// ============================================================================

/**
 * 🏢 ENTERPRISE: Event payload for user settings update
 */
export interface UserSettingsUpdatedPayload {
  userId: string;
  updates: {
    settingKey?: string;
    value?: unknown;
  };
  timestamp: number;
}

// ============================================================================
// FLOORPLAN EVENT PAYLOADS
// ============================================================================

/**
 * 🏢 ENTERPRISE: Event payload for floorplan creation
 */
export interface FloorplanCreatedPayload {
  floorplanId: string;
  floorplan: {
    name?: string;
    entityType?: string;
    entityId?: string;
  };
  timestamp: number;
}

/**
 * 🏢 ENTERPRISE: Event payload for floorplan update
 */
export interface FloorplanUpdatedPayload {
  floorplanId: string;
  updates: {
    name?: string;
    data?: unknown;
  };
  timestamp: number;
}

/**
 * 🏢 ENTERPRISE: Event payload for floorplan deletion
 */
export interface FloorplanDeletedPayload {
  floorplanId: string;
  timestamp: number;
}

// ============================================================================
// ASSOCIATION LINK EVENT PAYLOADS (contact_links, file_links)
// ============================================================================

/**
 * 🏢 ENTERPRISE: Event payload for contact link creation
 * Used for real-time sync when contact is linked to an entity
 */
export interface ContactLinkCreatedPayload {
  linkId: string;
  link: {
    sourceContactId: string;
    sourceWorkspaceId?: string;
    targetEntityType: string;
    targetEntityId: string;
    targetWorkspaceId?: string;
  };
  timestamp: number;
}

/**
 * 🏢 ENTERPRISE: Event payload for contact link deletion
 */
export interface ContactLinkDeletedPayload {
  linkId: string;
  timestamp: number;
}

/**
 * 🏢 ENTERPRISE: Event payload for file link creation
 * Used for real-time sync when file is linked to an entity
 */
export interface FileLinkCreatedPayload {
  linkId: string;
  link: {
    sourceFileId: string;
    sourceWorkspaceId?: string;
    targetEntityType: string;
    targetEntityId: string;
    targetWorkspaceId?: string;
  };
  timestamp: number;
}

/**
 * 🏢 ENTERPRISE: Event payload for file link deletion
 */
export interface FileLinkDeletedPayload {
  linkId: string;
  timestamp: number;
}

// ============================================================================
// ENTITY LINKING EVENT PAYLOADS (Building-Project, Unit-Building, etc.)
// ============================================================================

/**
 * 🏢 ENTERPRISE: Event payload for entity linking
 * Used by EntityLinkingService for centralized real-time sync
 */
export interface EntityLinkedPayload {
  entityId: string;
  entityType: string;
  parentId: string;
  parentType: string;
  previousParentId: string | null;
  timestamp: number;
}

/**
 * 🏢 ENTERPRISE: Event payload for entity unlinking
 */
export interface EntityUnlinkedPayload {
  entityId: string;
  entityType: string;
  previousParentId: string | null;
  timestamp: number;
}

/**
 * 🏢 ENTERPRISE: localStorage keys for cross-page sync
 * Using storage events to sync updates across browser tabs
 */
export const REALTIME_STORAGE_KEYS = {
  // Update events
  PROJECT_UPDATED: 'realtime:project-updated',
  BUILDING_UPDATED: 'realtime:building-updated',
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
  // Association link events
  CONTACT_LINK_CREATED: 'realtime:contact-link-created',
  CONTACT_LINK_DELETED: 'realtime:contact-link-deleted',
  FILE_LINK_CREATED: 'realtime:file-link-created',
  FILE_LINK_DELETED: 'realtime:file-link-deleted',
  // Entity linking events
  ENTITY_LINKED: 'realtime:entity-linked',
  ENTITY_UNLINKED: 'realtime:entity-unlinked',
} as const;
