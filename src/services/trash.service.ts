/**
 * TrashService — Client-side service for centralized trash operations
 *
 * @module services/trash
 * @enterprise ADR-281 — SSOT Soft-Delete System
 */

import { apiClient } from "@/lib/api/enterprise-api-client";
import { API_ROUTES } from "@/config/domain-constants";
import type { LifecycleOutcome, SoftDeletableEntityType } from "@/types/soft-deletable";

interface RestoreResponse {
  entityType: string;
  entityId: string;
  restoredStatus: string;
  /** Ό,τι άλλο έκανε η επαναφορά (π.χ. «εκτός αγοράς») — το δηλώνει ο διακομιστής. */
  outcomes?: LifecycleOutcome[];
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

  /**
   * Αρχειοθέτηση (ADR-329 §3.9): η εγγραφή φεύγει από την καθημερινή λίστα και μένει για πάντα.
   * Διαθέσιμη μόνο για οντότητες με αρχείο· ο διακομιστής αρνείται τις υπόλοιπες.
   */
  static async archive(
    entityType: SoftDeletableEntityType,
    entityId: string,
  ): Promise<void> {
    await apiClient.post(API_ROUTES.TRASH.ARCHIVE(entityType, entityId));
  }

  /** Επαναφορά μίας εγγραφής από το αρχείο */
  static async unarchive(
    entityType: SoftDeletableEntityType,
    entityId: string,
  ): Promise<RestoreResponse> {
    return apiClient.post<RestoreResponse>(
      API_ROUTES.TRASH.UNARCHIVE(entityType, entityId),
    );
  }

  /**
   * Επαναφορά πολλών εγγραφών από το αρχείο.
   *
   * @returns ό,τι άλλο έκανε η επαναφορά, μία τιμή ανά εγγραφή που το έπαθε — ώστε το
   *          μήνυμα επιτυχίας να λέει τι συνέβη, όχι μόνο «επαναφέρθηκε»
   */
  static async bulkUnarchive(
    entityType: SoftDeletableEntityType,
    ids: string[],
  ): Promise<LifecycleOutcome[]> {
    const responses = await Promise.all(ids.map((id) => TrashService.unarchive(entityType, id)));
    return responses.flatMap((response) => response.outcomes ?? []);
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
