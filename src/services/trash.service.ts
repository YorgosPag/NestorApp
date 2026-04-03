/**
 * TrashService — Client-side service for centralized trash operations
 *
 * @module services/trash
 * @enterprise ADR-281 — SSOT Soft-Delete System
 */

import { apiClient } from "@/lib/api/enterprise-api-client";
import { API_ROUTES } from "@/config/domain-constants";
import type { SoftDeletableEntityType } from "@/types/soft-deletable";

interface RestoreResponse {
  entityType: string;
  entityId: string;
  restoredStatus: string;
}

interface PermanentDeleteResponse {
  entityType: string;
  entityId: string;
  deleted: boolean;
}

export class TrashService {
  /** Restore single entity from trash */
  static async restore(
    entityType: SoftDeletableEntityType,
    entityId: string,
  ): Promise<RestoreResponse> {
    return apiClient.post<RestoreResponse>(
      API_ROUTES.TRASH.RESTORE(entityType, entityId),
    );
  }

  /** Restore multiple entities from trash */
  static async bulkRestore(
    entityType: SoftDeletableEntityType,
    ids: string[],
  ): Promise<void> {
    await Promise.all(ids.map((id) => TrashService.restore(entityType, id)));
  }

  /** Permanently delete single entity (must be in trash) */
  static async permanentDelete(
    entityType: SoftDeletableEntityType,
    entityId: string,
  ): Promise<PermanentDeleteResponse> {
    return apiClient.delete<PermanentDeleteResponse>(
      API_ROUTES.TRASH.PERMANENT_DELETE(entityType, entityId),
    );
  }

  /** Permanently delete multiple entities */
  static async bulkPermanentDelete(
    entityType: SoftDeletableEntityType,
    ids: string[],
  ): Promise<void> {
    await Promise.all(
      ids.map((id) => TrashService.permanentDelete(entityType, id)),
    );
  }
}
