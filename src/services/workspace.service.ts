/**
 * =============================================================================
 * 🏢 ENTERPRISE: Workspace Service
 * =============================================================================
 *
 * CRUD service για Workspace management.
 * Implements ΤΕΛΕΙΩΤΙΚΗ ΕΝΤΟΛΗ workspace requirements.
 *
 * @module services/workspace.service
 * @enterprise ADR-032 - Workspace-based Multi-Tenancy
 * @migration ADR-214 Phase 2 — reads/writes via FirestoreQueryService
 *
 * @example
 * ```typescript
 * import { WorkspaceService } from '@/services/workspace.service';
 *
 * // Create Office Directory workspace
 * const workspace = await WorkspaceService.createWorkspace({
 *   type: 'office_directory',
 *   displayName: 'Κοινός Κατάλογος',
 *   createdBy: 'user_123',
 * });
 *
 * // List workspaces for user
 * const workspaces = await WorkspaceService.listWorkspacesForUser('user_123');
 * ```
 */

import { where, orderBy, type QueryConstraint } from 'firebase/firestore';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import {
  SPECIAL_WORKSPACE_IDS,
  DEFAULT_WORKSPACE_SETTINGS,
} from '@/types/workspace';
import type {
  Workspace,
  WorkspaceType,
  CreateWorkspaceInput,
  UpdateWorkspaceInput,
  ListWorkspacesParams,
} from '@/types/workspace';
import type { DocumentData } from 'firebase/firestore';
// 🏢 ENTERPRISE: Centralized real-time service for cross-page sync
import { RealtimeService } from '@/services/realtime';
import { generateWorkspaceId } from '@/services/enterprise-id.service';
import { createModuleLogger } from '@/lib/telemetry';
import { normalizeToISO } from '@/lib/date-local';

const logger = createModuleLogger('WorkspaceService');

// ============================================================================
// POST-QUERY NORMALIZATION (replaces workspaceConverter.fromFirestore)
// ============================================================================

/**
 * Convert raw Firestore document data to typed Workspace.
 * Handles Timestamp → ISO string conversion for date fields.
 */
function toWorkspace(raw: DocumentData): Workspace {
  const createdAt = normalizeToISO(raw.createdAt) ?? new Date().toISOString();
  const updatedAt = normalizeToISO(raw.updatedAt) ?? undefined;

  return {
    id: raw.id as string,
    type: raw.type as Workspace['type'],
    displayName: raw.displayName as string,
    description: raw.description as string | undefined,
    companyId: raw.companyId as string | undefined,
    status: raw.status as Workspace['status'],
    settings: raw.settings as Workspace['settings'],
    createdAt,
    createdBy: raw.createdBy as string,
    updatedAt,
    updatedBy: raw.updatedBy as string | undefined,
    metadata: raw.metadata as Workspace['metadata'],
  };
}

// ============================================================================
// WORKSPACE SERVICE
// ============================================================================

export class WorkspaceService {
  // ==========================================================================
  // CREATE
  // ==========================================================================

  /**
   * Create a new workspace
   *
   * @param input - Workspace creation parameters
   * @returns Created workspace
   */
  static async createWorkspace(input: CreateWorkspaceInput): Promise<Workspace> {
    const { type, displayName, description, companyId, createdBy, settings, metadata } = input;

    // Validation: companyId required for type='company'
    if (type === 'company' && !companyId) {
      throw new Error('companyId is required for workspace type=company');
    }

    // Generate workspace ID
    const workspaceId = this.generateWorkspaceId(type, companyId);

    // Create workspace document
    const workspace: Workspace = {
      id: workspaceId,
      type,
      displayName,
      description,
      companyId,
      status: 'active',
      settings: settings || DEFAULT_WORKSPACE_SETTINGS,
      createdAt: new Date().toISOString(),
      createdBy,
      metadata,
    };

    // Save to Firestore via centralized service
    await firestoreQueryService.create(
      'WORKSPACES',
      workspace as unknown as Record<string, unknown>,
      { documentId: workspaceId }
    );

    logger.info(`✅ [WorkspaceService] Created workspace: ${workspaceId} (${type})`);

    // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
    RealtimeService.dispatch('WORKSPACE_CREATED', {
      workspaceId,
      workspace: {
        name: displayName,
        companyId,
      },
      timestamp: Date.now(),
    });

    return workspace;
  }

  /**
   * Create Office Directory workspace (special singleton)
   *
   * @param createdBy - User ID creating the workspace
   * @returns Office Directory workspace
   */
  static async createOfficeDirectoryWorkspace(createdBy: string): Promise<Workspace> {
    const { SPECIAL_WORKSPACE_IDS } = await import('@/types/workspace');

    // Check if already exists
    const existing = await this.getWorkspaceById(SPECIAL_WORKSPACE_IDS.OFFICE_DIRECTORY);
    if (existing) {
      logger.info(`✅ [WorkspaceService] Office Directory already exists`);
      return existing;
    }

    // Create Office Directory
    return this.createWorkspace({
      type: 'office_directory',
      displayName: 'Κοινός Κατάλογος',
      description: 'Κοινός κατάλογος γραφείου για shared συνεργάτες και αρχεία',
      createdBy,
    });
  }

  // ==========================================================================
  // READ
  // ==========================================================================

  /**
   * Get workspace by ID
   *
   * @param workspaceId - Workspace ID
   * @returns Workspace or null
   */
  static async getWorkspaceById(workspaceId: string): Promise<Workspace | null> {
    const raw = await firestoreQueryService.getById<DocumentData>('WORKSPACES', workspaceId);
    return raw ? toWorkspace(raw) : null;
  }

  /**
   * List all workspaces (with optional filters)
   *
   * @param params - Query parameters
   * @returns Array of workspaces
   */
  static async listWorkspaces(params: ListWorkspacesParams = {}): Promise<Workspace[]> {
    const { type, status, limit: limitParam } = params;

    const constraints: QueryConstraint[] = [orderBy('displayName', 'asc')];
    if (type) constraints.push(where('type', '==', type));
    if (status) constraints.push(where('status', '==', status));

    const result = await firestoreQueryService.getAll<DocumentData>('WORKSPACES', {
      constraints,
      maxResults: limitParam,
    });

    return result.documents.map(toWorkspace);
  }

  /**
   * List workspaces for a specific user
   *
   * @param userId - User ID
   * @returns Array of workspaces accessible by this user
   */
  static async listWorkspacesForUser(userId: string): Promise<Workspace[]> {
    // TODO: Implement workspace membership check
    // For now, return all active workspaces
    // In production, this should query WORKSPACE_MEMBERS collection

    return this.listWorkspaces({ status: 'active' });
  }

  /**
   * Get workspace for a company
   *
   * @param companyId - Company ID (from contacts collection)
   * @returns Workspace or null
   */
  static async getWorkspaceForCompany(companyId: string): Promise<Workspace | null> {
    const result = await firestoreQueryService.getAll<DocumentData>('WORKSPACES', {
      constraints: [
        where('type', '==', 'company'),
        where('companyId', '==', companyId),
      ],
      maxResults: 1,
    });

    if (result.isEmpty) return null;
    return toWorkspace(result.documents[0]);
  }

  // ==========================================================================
  // UPDATE
  // ==========================================================================

  /**
   * Update workspace
   *
   * @param workspaceId - Workspace ID
   * @param input - Update parameters
   */
  static async updateWorkspace(
    workspaceId: string,
    input: UpdateWorkspaceInput
  ): Promise<void> {
    const { displayName, description, status, settings, updatedBy, metadata } = input;

    const updates: Record<string, unknown> = {
      updatedBy,
    };

    if (displayName !== undefined) updates.displayName = displayName;
    if (description !== undefined) updates.description = description;
    if (status !== undefined) updates.status = status;
    if (settings !== undefined) {
      // Merge settings
      const current = await this.getWorkspaceById(workspaceId);
      updates.settings = { ...current?.settings, ...settings };
    }
    if (metadata !== undefined) updates.metadata = metadata;

    await firestoreQueryService.update('WORKSPACES', workspaceId, updates);

    logger.info(`✅ [WorkspaceService] Updated workspace: ${workspaceId}`);

    // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
    RealtimeService.dispatch('WORKSPACE_UPDATED', {
      workspaceId,
      updates: {
        name: displayName,
      },
      timestamp: Date.now(),
    });
  }

  /**
   * Archive workspace
   *
   * @param workspaceId - Workspace ID
   * @param updatedBy - User ID performing the action
   */
  static async archiveWorkspace(workspaceId: string, updatedBy: string): Promise<void> {
    await this.updateWorkspace(workspaceId, {
      status: 'archived',
      updatedBy,
    });

    logger.info(`✅ [WorkspaceService] Archived workspace: ${workspaceId}`);
  }

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  /**
   * Generate workspace ID
   *
   * @param type - Workspace type
   * @param companyId - Company ID (for type='company')
   * @returns Generated workspace ID
   */
  private static generateWorkspaceId(type: WorkspaceType, companyId?: string): string {
    if (type === 'office_directory') {
      return SPECIAL_WORKSPACE_IDS.OFFICE_DIRECTORY;
    }

    if (type === 'company' && companyId) {
      return `ws_company_${companyId}`;
    }

    if (type === 'personal') {
      return generateWorkspaceId();
    }

    // Fallback
    return generateWorkspaceId();
  }

  /**
   * Check if workspace exists
   *
   * @param workspaceId - Workspace ID
   * @returns True if exists
   */
  static async exists(workspaceId: string): Promise<boolean> {
    const workspace = await this.getWorkspaceById(workspaceId);
    return workspace !== null;
  }
}

// Default export for convenience
export default WorkspaceService;
