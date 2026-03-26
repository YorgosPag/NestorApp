/**
 * =============================================================================
 * useFileAudit — Audit trail recording for file operations (ADR-195)
 * =============================================================================
 *
 * Fire-and-forget audit entries for entity types that support activity tracking.
 * Extracted from EntityFilesManager for Google SRP compliance.
 *
 * @module components/shared/files/hooks/useFileAudit
 */

import { useCallback, useMemo } from 'react';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import type { EntityType } from '@/config/domain-constants';
import type { FileRecord } from '@/types/file-record';

// ============================================================================
// TYPES
// ============================================================================

type AuditAction = 'updated' | 'deleted' | 'created' | 'unlinked';

interface UseFileAuditParams {
  entityType: EntityType;
  entityId: string;
  files: FileRecord[];
}

interface UseFileAuditReturn {
  /** Fire-and-forget audit trail entry. Only fires for auditable entity types. */
  recordFileActivity: (
    action: AuditAction,
    field: string,
    oldValue: string | null,
    newValue: string | null,
    label: string,
  ) => void;
  /** Look up a file's display name by ID from the current files array */
  getFileName: (fileId: string) => string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Entity types that support activity recording via API */
const AUDITABLE_ENTITY_TYPES: ReadonlySet<string> = new Set(['unit']);

// ============================================================================
// HOOK
// ============================================================================

export function useFileAudit({ entityType, entityId, files }: UseFileAuditParams): UseFileAuditReturn {
  const recordFileActivity = useCallback(
    (action: AuditAction, field: string, oldValue: string | null, newValue: string | null, label: string) => {
      if (!AUDITABLE_ENTITY_TYPES.has(entityType)) return;
      apiClient
        .post(API_ROUTES.ENTITY_ACTIVITY(entityType, entityId), {
          action,
          changes: [{ field, oldValue, newValue, label }],
        })
        .catch(() => { /* fire-and-forget — audit failure must never break file ops */ });
    },
    [entityType, entityId],
  );

  const getFileName = useCallback(
    (fileId: string): string => {
      const file = files.find((f) => f.id === fileId);
      return file?.displayName ?? file?.originalFilename ?? fileId;
    },
    [files],
  );

  return useMemo(
    () => ({ recordFileActivity, getFileName }),
    [recordFileActivity, getFileName],
  );
}
