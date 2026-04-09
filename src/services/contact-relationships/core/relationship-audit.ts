// ============================================================================
// RELATIONSHIP AUDIT — Records relationship changes in contact audit trail
// ============================================================================
//
// Extracted from RelationshipCRUDService for SRP compliance (<500 lines).
// Fire-and-forget — never blocks the main CRUD operation.
//
// ============================================================================

import { Contact } from '@/types/contacts';
import { RelationshipType } from '@/types/contacts/relationships';
import { API_ROUTES, ENTITY_TYPES } from '@/config/domain-constants';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { ContactsService } from '@/services/contacts.service';
import { getContactById } from './relationship-helpers';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('RelationshipAudit');

// ============================================================================
// TYPES
// ============================================================================

export interface RelationshipAuditParams {
  sourceContactId: string;
  targetContactId: string;
  relationshipType: RelationshipType;
  action: 'linked' | 'unlinked' | 'updated';
  sourceContact?: Contact | null;
  targetContact?: Contact | null;
}

// ============================================================================
// AUDIT RECORDING
// ============================================================================

/**
 * Record audit trail entry for both source and target contacts
 * when a relationship is created, updated, terminated, or deleted.
 *
 * - 'linked' → relationship created (oldValue=null, newValue=type+name)
 * - 'unlinked' → relationship terminated/deleted (oldValue=type+name, newValue=null)
 * - 'updated' → relationship modified (both values set)
 */
export async function recordRelationshipAudit(params: RelationshipAuditParams): Promise<void> {
  try {
    // Fetch contacts if not provided (for update/terminate/delete paths)
    const [source, target] = params.sourceContact && params.targetContact
      ? [params.sourceContact, params.targetContact]
      : await Promise.all([
          params.sourceContact ?? getContactById(params.sourceContactId),
          params.targetContact ?? getContactById(params.targetContactId),
        ]);

    const sourceName = source ? ContactsService.getDisplayName(source) : params.sourceContactId;
    const targetName = target ? ContactsService.getDisplayName(target) : params.targetContactId;
    const typeKey = params.relationshipType;

    const buildOldValue = (otherName: string): string | null => {
      if (params.action === 'linked') return null;
      return `${typeKey} — ${otherName}`;
    };
    const buildNewValue = (otherName: string): string | null => {
      if (params.action === 'unlinked') return null;
      return `${typeKey} — ${otherName}`;
    };

    // Audit for source contact (shows target name)
    apiClient.post(API_ROUTES.AUDIT_TRAIL.RECORD, {
      entityType: ENTITY_TYPES.CONTACT,
      entityId: params.sourceContactId,
      entityName: sourceName,
      action: params.action,
      changes: [{
        field: 'relationship',
        oldValue: buildOldValue(targetName),
        newValue: buildNewValue(targetName),
        label: 'Σχέση',
      }],
    }).catch(() => {});

    // Audit for target contact (shows source name)
    apiClient.post(API_ROUTES.AUDIT_TRAIL.RECORD, {
      entityType: ENTITY_TYPES.CONTACT,
      entityId: params.targetContactId,
      entityName: targetName,
      action: params.action,
      changes: [{
        field: 'relationship',
        oldValue: buildOldValue(sourceName),
        newValue: buildNewValue(sourceName),
        label: 'Σχέση',
      }],
    }).catch(() => {});
  } catch (err) {
    logger.warn('⚠️ Audit trail recording failed (non-blocking):', err);
  }
}
