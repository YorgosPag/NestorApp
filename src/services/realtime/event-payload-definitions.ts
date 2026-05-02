/**
 * =============================================================================
 * Realtime Event Payload Definitions
 * =============================================================================
 *
 * All payload interfaces for RealtimeService events.
 * Extracted from types.ts for Google SRP compliance (N.7.1).
 * Consumed via re-export from types.ts — no breaking changes for callers.
 *
 * @module services/realtime/event-payload-definitions
 */

import type { Project, ProjectStatus } from '@/types/project';
import type { Building } from '@/types/building/contracts';

// ============================================================================
// BUILDING / PROJECT LINK PAYLOADS
// ============================================================================

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
 * 🏢 ENTERPRISE: Event payload for property-building link
 */
export interface PropertyBuildingLinkPayload {
  propertyId: string;
  previousBuildingId: string | null;
  newBuildingId: string | null;
  timestamp: number;
}

// ============================================================================
// PROJECT EVENT PAYLOADS
// ============================================================================

/**
 * 🏢 ENTERPRISE: Event payload for project update
 * Used for real-time sync across all pages (Navigation, Audit, DXF Viewer)
 */
export interface ProjectUpdatedPayload {
  projectId: string;
  updates: Partial<Project>;
  timestamp: number;
}

/**
 * 🏢 ENTERPRISE: Event payload for building update
 * Used for real-time sync when building data changes
 */
export interface BuildingUpdatedPayload {
  buildingId: string;
  updates: Partial<Building>;
  timestamp: number;
}

/**
 * 🏢 ENTERPRISE: Event payload for unit update
 * Used for real-time sync when unit data changes
 */
export interface PropertyUpdatedPayload {
  propertyId: string;
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
export interface PropertyCreatedPayload {
  propertyId: string;
  property: {
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
export interface PropertyDeletedPayload {
  propertyId: string;
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
    description?: string;
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
  displayName?: string;
  entityId?: string;
  entityType?: string;
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
// PARKING EVENT PAYLOADS
// ============================================================================

/**
 * Event payload for parking spot creation
 */
export interface ParkingCreatedPayload {
  parkingSpotId: string;
  parkingSpot: {
    number?: string;
    buildingId?: string;
    type?: string;
    status?: string;
  };
  timestamp: number;
}

/**
 * Event payload for parking spot update
 */
export interface ParkingUpdatedPayload {
  parkingSpotId: string;
  updates: {
    number?: string;
    type?: string;
    status?: string;
    floor?: string;
    area?: number;
    price?: number;
    buildingId?: string | null;
  };
  timestamp: number;
}

/**
 * Event payload for parking spot deletion
 */
export interface ParkingDeletedPayload {
  parkingSpotId: string;
  timestamp: number;
}

// ============================================================================
// STORAGE EVENT PAYLOADS
// ============================================================================

/**
 * Event payload for storage creation
 */
export interface StorageCreatedPayload {
  storageId: string;
  storage: {
    name?: string;
    buildingId?: string;
    type?: string;
    status?: string;
  };
  timestamp: number;
}

/**
 * Event payload for storage update
 */
export interface StorageUpdatedPayload {
  storageId: string;
  updates: {
    name?: string;
    type?: string;
    status?: string;
    floor?: string;
    area?: number;
    buildingId?: string | null;
  };
  timestamp: number;
}

/**
 * Event payload for storage deletion
 */
export interface StorageDeletedPayload {
  storageId: string;
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

// ============================================================================
// CASCADE PROPAGATION EVENT PAYLOADS (ADR-231)
// ============================================================================

/**
 * Event payload for cascade hierarchy propagation
 * Dispatched client-side after API confirms a link change
 */
export interface CascadePropagatedPayload {
  /** The entity that was linked/unlinked (e.g. building, property) */
  sourceEntityType: 'building' | 'project' | 'property';
  sourceEntityId: string;
  /** Which field changed (e.g. projectId, companyId, buildingId) */
  changedField: string;
  /** New value of the changed field (null = unlinked) */
  newValue: string | null;
  timestamp: number;
}

// ============================================================================
// LEGAL CONTRACT EVENT PAYLOADS (ADR-230)
// ============================================================================

export interface ContractCreatedPayload {
  contractId: string;
  propertyId: string;
  phase: string;
  timestamp: number;
}

export interface ContractUpdatedPayload {
  contractId: string;
  propertyId: string;
  timestamp: number;
}

export interface ContractStatusChangedPayload {
  contractId: string;
  propertyId: string;
  previousStatus: string;
  newStatus: string;
  timestamp: number;
}

export interface ContractDeletedPayload {
  contractId: string;
  propertyId: string;
  timestamp: number;
}

export interface ContractProfessionalChangedPayload {
  contractId: string;
  propertyId: string;
  role: string;
  contactId: string | null;
  timestamp: number;
}

// ============================================================================
// EVENT MAP — type-safe mapping from event key → payload type
// ============================================================================

/**
 * Data-driven event map: maps every REALTIME_EVENTS key to its payload type.
 * Used by RealtimeService.dispatch() and RealtimeService.subscribe() for
 * full type inference — no need for individual dispatch/subscribe methods.
 */
export interface RealtimeEventMap {
  // Update events (16)
  PROJECT_UPDATED: ProjectUpdatedPayload;
  BUILDING_UPDATED: BuildingUpdatedPayload;
  UNIT_UPDATED: PropertyUpdatedPayload;
  CONTACT_UPDATED: ContactUpdatedPayload;
  TASK_UPDATED: TaskUpdatedPayload;
  OPPORTUNITY_UPDATED: OpportunityUpdatedPayload;
  COMMUNICATION_UPDATED: CommunicationUpdatedPayload;
  FILE_UPDATED: FileUpdatedPayload;
  NOTIFICATION_UPDATED: NotificationUpdatedPayload;
  OBLIGATION_UPDATED: ObligationUpdatedPayload;
  WORKSPACE_UPDATED: WorkspaceUpdatedPayload;
  RELATIONSHIP_UPDATED: RelationshipUpdatedPayload;
  SESSION_UPDATED: SessionUpdatedPayload;
  USER_SETTINGS_UPDATED: UserSettingsUpdatedPayload;
  FLOORPLAN_UPDATED: FloorplanUpdatedPayload;
  PARKING_UPDATED: ParkingUpdatedPayload;
  STORAGE_UPDATED: StorageUpdatedPayload;
  // Create events (15+)
  PROJECT_CREATED: ProjectCreatedPayload;
  BUILDING_CREATED: BuildingCreatedPayload;
  UNIT_CREATED: PropertyCreatedPayload;
  CONTACT_CREATED: ContactCreatedPayload;
  TASK_CREATED: TaskCreatedPayload;
  OPPORTUNITY_CREATED: OpportunityCreatedPayload;
  COMMUNICATION_CREATED: CommunicationCreatedPayload;
  FILE_CREATED: FileCreatedPayload;
  NOTIFICATION_CREATED: NotificationCreatedPayload;
  OBLIGATION_CREATED: ObligationCreatedPayload;
  WORKSPACE_CREATED: WorkspaceCreatedPayload;
  RELATIONSHIP_CREATED: RelationshipCreatedPayload;
  SESSION_CREATED: SessionCreatedPayload;
  FLOORPLAN_CREATED: FloorplanCreatedPayload;
  PARKING_CREATED: ParkingCreatedPayload;
  STORAGE_CREATED: StorageCreatedPayload;
  // Delete events (15+)
  PROJECT_DELETED: ProjectDeletedPayload;
  BUILDING_DELETED: BuildingDeletedPayload;
  UNIT_DELETED: PropertyDeletedPayload;
  CONTACT_DELETED: ContactDeletedPayload;
  TASK_DELETED: TaskDeletedPayload;
  OPPORTUNITY_DELETED: OpportunityDeletedPayload;
  COMMUNICATION_DELETED: CommunicationDeletedPayload;
  FILE_DELETED: FileDeletedPayload;
  NOTIFICATION_DELETED: NotificationDeletedPayload;
  OBLIGATION_DELETED: ObligationDeletedPayload;
  WORKSPACE_DELETED: WorkspaceDeletedPayload;
  RELATIONSHIP_DELETED: RelationshipDeletedPayload;
  SESSION_DELETED: SessionDeletedPayload;
  FLOORPLAN_DELETED: FloorplanDeletedPayload;
  PARKING_DELETED: ParkingDeletedPayload;
  STORAGE_DELETED: StorageDeletedPayload;
  // File extras (2)
  FILE_TRASHED: FileTrashedPayload;
  FILE_RESTORED: FileRestoredPayload;
  // Association links (4)
  CONTACT_LINK_CREATED: ContactLinkCreatedPayload;
  CONTACT_LINK_DELETED: ContactLinkDeletedPayload;
  CONTACT_LINK_REMOVED: ContactLinkDeletedPayload;
  FILE_LINK_CREATED: FileLinkCreatedPayload;
  FILE_LINK_DELETED: FileLinkDeletedPayload;
  // Specific link events (legacy — kept for backward compat)
  BUILDING_PROJECT_LINKED: BuildingProjectLinkPayload;
  PROPERTY_BUILDING_LINKED: PropertyBuildingLinkPayload;
  NAVIGATION_REFRESH: { timestamp: number };
  // Entity linking (2)
  ENTITY_LINKED: EntityLinkedPayload;
  ENTITY_UNLINKED: EntityUnlinkedPayload;
  // Cascade propagation (ADR-231)
  CASCADE_PROPAGATED: CascadePropagatedPayload;
  // Legal contracts (ADR-230)
  CONTRACT_CREATED: ContractCreatedPayload;
  CONTRACT_UPDATED: ContractUpdatedPayload;
  CONTRACT_STATUS_CHANGED: ContractStatusChangedPayload;
  CONTRACT_DELETED: ContractDeletedPayload;
  CONTRACT_PROFESSIONAL_CHANGED: ContractProfessionalChangedPayload;
}
