/**
 * =============================================================================
 * 🏢 ENTERPRISE: Workspace Service
 * =============================================================================
 *
 * CRUD service για Workspace management.
 * Implements ΤΕΛΕΙΩΤΙΚΗ ΕΝΤΟΛΗ workspace requirements.
 *
 * @module services/workspace.service
 * @enterprise ADR-787 — Η πολυ-οργανισμική πλατφόρμα (Κ-2: το συμβόλαιο του μέλους)
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

import { where } from 'firebase/firestore';
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
} from '@/types/workspace';
import type { DocumentData } from 'firebase/firestore';
// 🏢 ENTERPRISE: Centralized real-time service for cross-page sync
import { RealtimeService } from '@/services/realtime';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { generateWorkspaceId } from '@/services/enterprise-id.service';
import { createModuleLogger } from '@/lib/telemetry';
import { normalizeToISO, nowISO } from '@/lib/date-local';

const logger = createModuleLogger('WorkspaceService');

// ============================================================================
// POST-QUERY NORMALIZATION (replaces workspaceConverter.fromFirestore)
// ============================================================================

/**
 * Convert raw Firestore document data to typed Workspace.
 * Handles Timestamp → ISO string conversion for date fields.
 */
function toWorkspace(raw: DocumentData): Workspace {
  const createdAt = normalizeToISO(raw.createdAt) ?? nowISO();
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
      createdAt: nowISO(),
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

  // ⛔ Η `listWorkspaces()` ΔΙΑΓΡΑΦΗΚΕ (ADR-787 Κ-2, 2026-08-22).
  //
  // Ήταν *«όλοι οι χώροι»*, χωρίς καμία ερώτηση για το **ποιος ρωτά** — και ο
  // **μοναδικός** της καλών ήταν η `listWorkspacesForUser`, που την τύλιγε
  // αγνοώντας το `userId`. Δηλαδή ήταν **ο ίδιος ο μηχανισμός** του ελαττώματος
  // που καταγράφει το ADR-787 §2.7 β: *«όλοι οι οργανισμοί της πλατφόρμας»*.
  //
  // Μόλις η `listWorkspacesForUser` έμαθε να ρωτά τον διακομιστή, αυτή έμεινε
  // με **μηδέν καλούντες**. ⚠️ Δεν αφήνεται «μήπως χρειαστεί»: ένα αφιλτράριστο
  // `getAll('WORKSPACES')` με φιλικό όνομα είναι πρόσκληση στον επόμενο —
  // και το φίλτρο μισθωτή που το «έσωζε» **δεν το έσωζε** (§5.1 α #2: το
  // έσωζε η απουσία δεδομένων).
  //
  // ⛔ ΜΗΝ την επαναφέρεις. «Ποιους χώρους βλέπω;» απαντιέται από τον
  //    διακομιστή, μέσω `GET /api/workspaces`.

  /**
   * Οι χώροι **αυτού** του ανθρώπου — απαντημένοι από τον **διακομιστή**.
   *
   * ─────────────────────────────────────────────────────────────────────────
   * 🔴 ΤΙ ΑΛΛΑΞΕ ΚΑΙ ΓΙΑΤΙ (ADR-787 Κ-2 · §2.7 β, 2026-08-22)
   * ─────────────────────────────────────────────────────────────────────────
   * Μέχρι σήμερα αυτή η μέθοδος **έπαιρνε το `userId` και δεν το χρησιμοποιούσε
   * πουθενά**: γύριζε *«όλοι οι ενεργοί χώροι»*, με σχόλιο *«TODO: Implement
   * workspace membership check»*. Ήταν ακίνδυνο **μόνο** επειδή η συλλογή
   * `workspaces` δεν υπάρχει· την ημέρα που θα υπήρχε δεύτερος χώρος, γινόταν
   * *«όλοι οι οργανισμοί της πλατφόρμας»* **χωρίς καμία αλλαγή κώδικα**.
   *
   * ⛔ **ΜΗΝ την ξαναγυρίσεις σε ερώτημα Firestore από τον φυλλομετρητή** — ούτε
   *    «με φίλτρο αυτή τη φορά». Ένα collection-group ερώτημα πάνω στα μέλη,
   *    εκτελεσμένο από τον πελάτη, σαρώνει **όλα τα γραφεία**: απαρίθμηση που
   *    απαγορεύει ρητά το **ADR-787 Ε-5 §4 #1**. Γι' αυτό δεν υπάρχει κανόνας
   *    collection-group στο `firestore.rules` — η απουσία του **είναι** η
   *    απόφαση.
   *
   * @throws Σφάλμα δικτύου/διακομιστή. ⚠️ **Ο καλών ΔΕΝ επιτρέπεται να το
   *   μεταφράσει σε κενή λίστα**: *άγνωστο ≠ κενό* (N.12 · Ε-5 §4 #3).
   */
  static async listWorkspacesForUser(_userId: string): Promise<Workspace[]> {
    const response = await apiClient.get<{ data?: { workspaces?: Workspace[] } }>(
      API_ROUTES.WORKSPACES.MINE,
    );
    return response?.data?.workspaces ?? [];
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
