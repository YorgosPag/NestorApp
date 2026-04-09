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
import type { AuditAction } from '@/types/audit-trail';

// ============================================================================
// TYPES
// ============================================================================

type FileAuditAction = 'updated' | 'deleted' | 'created' | 'unlinked';

interface UseFileAuditParams {
  entityType: EntityType;
  entityId: string;
  files: FileRecord[];
}

interface UseFileAuditReturn {
  /** Fire-and-forget audit trail entry. Only fires for auditable entity types. */
  recordFileActivity: (
    action: FileAuditAction,
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
const AUDITABLE_ENTITY_TYPES: ReadonlySet<string> = new Set(['property', 'contact']);

/** Entity types that route through the centralized /api/audit-trail/record endpoint */
const CENTRALIZED_AUDIT_TYPES: ReadonlySet<string> = new Set(['contact']);

/** Map file audit actions to centralized audit trail actions */
const FILE_TO_AUDIT_ACTION: Record<FileAuditAction, AuditAction> = {
  created: 'document_added',
  deleted: 'document_removed',
  unlinked: 'document_removed',
  updated: 'updated',
};

// ============================================================================
// HELPERS
// ============================================================================

/** Record via centralized audit trail API (for contacts and future entity types) */
function recordCentralizedAudit(
  entityType: string,
  entityId: string,
  action: FileAuditAction,
  field: string,
  oldValue: string | null,
  newValue: string | null,
  label: string,
): void {
  const auditAction = FILE_TO_AUDIT_ACTION[action];
  apiClient
    .post('/api/audit-trail/record', {
      entityType,
      entityId,
      entityName: null,
      action: auditAction,
      changes: [{ field, oldValue, newValue, label }],
    })
    .catch(() => { /* fire-and-forget */ });
}

/** Record via per-entity activity route (for properties) */
function recordEntityActivity(
  entityType: string,
  entityId: string,
  action: FileAuditAction,
  field: string,
  oldValue: string | null,
  newValue: string | null,
  label: string,
): void {
  apiClient
    .post(API_ROUTES.ENTITY_ACTIVITY(entityType, entityId), {
      action,
      changes: [{ field, oldValue, newValue, label }],
    })
    .catch(() => { /* fire-and-forget */ });
}

// ============================================================================
// HOOK
// ============================================================================

export function useFileAudit({ entityType, entityId, files }: UseFileAuditParams): UseFileAuditReturn {
  const recordFileActivity = useCallback(
    (action: FileAuditAction, field: string, oldValue: string | null, newValue: string | null, label: string) => {
      if (!AUDITABLE_ENTITY_TYPES.has(entityType)) return;

      if (CENTRALIZED_AUDIT_TYPES.has(entityType)) {
        recordCentralizedAudit(entityType, entityId, action, field, oldValue, newValue, label);
      } else {
        recordEntityActivity(entityType, entityId, action, field, oldValue, newValue, label);
      }
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
