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

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { workspaceConverter } from '@/lib/firestore/converters/workspace.converter';
import {
  SPECIAL_WORKSPACE_IDS,
  DEFAULT_WORKSPACE_SETTINGS,
} from '@/types/workspace';
import type {
  Workspace,
  WorkspaceType,
  WorkspaceStatus,
  CreateWorkspaceInput,
  UpdateWorkspaceInput,
  ListWorkspacesParams,
} from '@/types/workspace';
// 🏢 ENTERPRISE: Centralized real-time service for cross-page sync
import { RealtimeService } from '@/services/realtime';

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

    // Save to Firestore
    const workspaceRef = doc(db, COLLECTIONS.WORKSPACES, workspaceId).withConverter(
      workspaceConverter
    );
    await setDoc(workspaceRef, workspace);

    console.log(`✅ [WorkspaceService] Created workspace: ${workspaceId} (${type})`);

    // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
    RealtimeService.dispatchWorkspaceCreated({
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
      console.log(`✅ [WorkspaceService] Office Directory already exists`);
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
    const workspaceRef = doc(db, COLLECTIONS.WORKSPACES, workspaceId).withConverter(
      workspaceConverter
    );
    const snapshot = await getDoc(workspaceRef);

    if (!snapshot.exists()) {
      return null;
    }

    return snapshot.data();
  }

  /**
   * List all workspaces (with optional filters)
   *
   * @param params - Query parameters
   * @returns Array of workspaces
   */
  static async listWorkspaces(params: ListWorkspacesParams = {}): Promise<Workspace[]> {
    const { type, status, limit: limitParam } = params;

    // Build query
    let q = query(
      collection(db, COLLECTIONS.WORKSPACES).withConverter(workspaceConverter),
      orderBy('displayName', 'asc')
    );

    // Add filters
    if (type) {
      q = query(q, where('type', '==', type));
    }
    if (status) {
      q = query(q, where('status', '==', status));
    }
    if (limitParam) {
      q = query(q, firestoreLimit(limitParam));
    }

    // Execute query
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => doc.data());
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
    const q = query(
      collection(db, COLLECTIONS.WORKSPACES).withConverter(workspaceConverter),
      where('type', '==', 'company'),
      where('companyId', '==', companyId),
      firestoreLimit(1)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    return snapshot.docs[0].data();
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

    const updates: Partial<Workspace> = {
      updatedAt: new Date().toISOString(),
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

    const workspaceRef = doc(db, COLLECTIONS.WORKSPACES, workspaceId);
    await updateDoc(workspaceRef, updates);

    console.log(`✅ [WorkspaceService] Updated workspace: ${workspaceId}`);

    // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
    RealtimeService.dispatchWorkspaceUpdated({
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

    console.log(`✅ [WorkspaceService] Archived workspace: ${workspaceId}`);
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
      return `ws_personal_${Date.now()}`;
    }

    // Fallback
    return `ws_${type}_${Date.now()}`;
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
