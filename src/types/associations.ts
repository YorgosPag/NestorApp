/**
 * =============================================================================
 * 🏢 ENTERPRISE: Association Types (Linking Model)
 * =============================================================================
 *
 * Types για linking contacts και files μεταξύ workspaces/entities.
 * Implements ΤΕΛΕΙΩΤΙΚΗ ΕΝΤΟΛΗ linking requirements.
 *
 * @module types/associations
 * @enterprise ADR-032 - Linking Model (Associations)
 *
 * Canonical patterns:
 * - contact_links: Link contact από office_directory → company/project/unit
 * - file_links: Link fileRecord → (projectId/unitId/contactId/etc.)
 *
 * @example
 * ```typescript
 * // Link contact to company
 * const contactLink: ContactLink = {
 *   id: 'cl_001',
 *   sourceWorkspaceId: 'ws_office_directory',
 *   sourceContactId: 'contact_123',
 *   targetWorkspaceId: 'ws_company_001',
 *   targetEntityType: 'company',
 *   targetEntityId: 'company_xyz',
 *   reason: 'Συνεργάτης για όλες τις εταιρείες',
 *   createdBy: 'user_abc',
 *   createdAt: '2026-01-20T00:00:00Z',
 * };
 * ```
 */

import type { Timestamp } from 'firebase/firestore';
import type { EntityType } from '@/config/domain-constants';

// ============================================================================
// CONTACT LINKS
// ============================================================================

/**
 * Contact Link
 *
 * Links a contact from one workspace to another workspace or entity.
 * Enables "shared contacts" (e.g., office directory → multiple companies).
 */
export interface ContactLink {
  /** Unique link ID */
  id: string;

  /** Source workspace ID (where contact originates) */
  sourceWorkspaceId: string;

  /** Source contact ID */
  sourceContactId: string;

  /** Target workspace ID (where contact is linked to) */
  targetWorkspaceId?: string;

  /** Target entity type (company, project, unit, etc.) */
  targetEntityType?: EntityType;

  /** Target entity ID */
  targetEntityId?: string;

  /** Reason for the link (for audit trail) */
  reason?: string;

  /** Link status */
  status: 'active' | 'inactive';

  /** Created timestamp */
  createdAt: string | Timestamp;

  /** Created by user ID */
  createdBy: string;

  /** Updated timestamp */
  updatedAt?: string | Timestamp;

  /** Updated by user ID */
  updatedBy?: string;

  /** Metadata for extensibility */
  metadata?: Record<string, unknown>;
}

/**
 * Contact Link as stored in Firestore
 */
export interface ContactLinkFirestoreDoc {
  id: string;
  sourceWorkspaceId: string;
  sourceContactId: string;
  targetWorkspaceId?: string;
  targetEntityType?: EntityType;
  targetEntityId?: string;
  reason?: string;
  status: 'active' | 'inactive';
  createdAt: Timestamp;
  createdBy: string;
  updatedAt?: Timestamp;
  updatedBy?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Input for creating a contact link
 */
export interface CreateContactLinkInput {
  sourceWorkspaceId: string;
  sourceContactId: string;
  targetWorkspaceId?: string;
  targetEntityType?: EntityType;
  targetEntityId?: string;
  reason?: string;
  createdBy: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// FILE LINKS
// ============================================================================

/**
 * File Link
 *
 * Links a file (FileRecord) to one or more entities.
 * Enables files to be visible in multiple contexts without duplication.
 */
export interface FileLink {
  /** Unique link ID */
  id: string;

  /** Source file record ID */
  sourceFileId: string;

  /** Source workspace ID (where file originates) */
  sourceWorkspaceId: string;

  /** Target entity type (project, unit, contact, building, etc.) */
  targetEntityType: EntityType;

  /** Target entity ID */
  targetEntityId: string;

  /** Target workspace ID (if different from source) */
  targetWorkspaceId?: string;

  /** Reason for the link (for audit trail) */
  reason?: string;

  /** Link status */
  status: 'active' | 'inactive';

  /** Created timestamp */
  createdAt: string | Timestamp;

  /** Created by user ID */
  createdBy: string;

  /** Updated timestamp */
  updatedAt?: string | Timestamp;

  /** Updated by user ID */
  updatedBy?: string;

  /** Metadata for extensibility */
  metadata?: Record<string, unknown>;
}

/**
 * File Link as stored in Firestore
 */
export interface FileLinkFirestoreDoc {
  id: string;
  sourceFileId: string;
  sourceWorkspaceId: string;
  targetEntityType: EntityType;
  targetEntityId: string;
  targetWorkspaceId?: string;
  reason?: string;
  status: 'active' | 'inactive';
  createdAt: Timestamp;
  createdBy: string;
  updatedAt?: Timestamp;
  updatedBy?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Input for creating a file link
 */
export interface CreateFileLinkInput {
  sourceFileId: string;
  sourceWorkspaceId: string;
  targetEntityType: EntityType;
  targetEntityId: string;
  targetWorkspaceId?: string;
  reason?: string;
  createdBy: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// QUERY HELPERS
// ============================================================================

/**
 * Query parameters for listing contact links
 */
export interface ListContactLinksParams {
  /** Filter by source contact ID */
  sourceContactId?: string;

  /** Filter by source workspace ID */
  sourceWorkspaceId?: string;

  /** Filter by target workspace ID */
  targetWorkspaceId?: string;

  /** Filter by target entity type */
  targetEntityType?: EntityType;

  /** Filter by target entity ID */
  targetEntityId?: string;

  /** Filter by status */
  status?: 'active' | 'inactive';

  /** Limit results */
  limit?: number;
}

/**
 * Query parameters for listing file links
 */
export interface ListFileLinksParams {
  /** Filter by source file ID */
  sourceFileId?: string;

  /** Filter by source workspace ID */
  sourceWorkspaceId?: string;

  /** Filter by target entity type */
  targetEntityType?: EntityType;

  /** Filter by target entity ID */
  targetEntityId?: string;

  /** Filter by target workspace ID */
  targetWorkspaceId?: string;

  /** Filter by status */
  status?: 'active' | 'inactive';

  /** Limit results */
  limit?: number;
}

// ============================================================================
// ASSOCIATION RESULT TYPES
// ============================================================================

/**
 * Result of a successful link operation
 */
export interface LinkOperationResult {
  success: true;
  linkId: string;
  message: string;
}

/**
 * Result of a failed link operation
 */
export interface LinkOperationError {
  success: false;
  error: string;
  errorCode: string;
}

/**
 * Union type for link operation results
 */
export type LinkResult = LinkOperationResult | LinkOperationError;

// ============================================================================
// ASSOCIATION VIEW MODELS (for UI display)
// ============================================================================

/**
 * Contact with associated workspaces/entities
 * (For UI display - "Χρησιμοποιείται και σε:")
 */
export interface ContactWithLinks {
  contactId: string;
  contactName: string;
  sourceWorkspaceId: string;
  sourceWorkspaceName: string;
  linkedTo: Array<{
    workspaceId?: string;
    workspaceName?: string;
    entityType?: EntityType;
    entityId?: string;
    entityName?: string;
  }>;
}

/**
 * File with associated entities
 * (For UI display - virtual folders in Project/Unit views)
 */
export interface FileWithLinks {
  fileId: string;
  fileName: string;
  sourceWorkspaceId: string;
  linkedTo: Array<{
    entityType: EntityType;
    entityId: string;
    entityName?: string;
    workspaceId?: string;
  }>;
}
