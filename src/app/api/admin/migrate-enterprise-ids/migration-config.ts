/**
 * =============================================================================
 * MIGRATION CONFIG — Types, Collection Configs, Helpers
 * =============================================================================
 *
 * SSoT for enterprise ID migration configuration.
 *
 * @module api/admin/migrate-enterprise-ids/migration-config
 * @see ADR-210 (Document ID Generation Audit)
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import {
  generateBuildingId,
  generateContactId,
  generateCompanyId,
  generateNotificationId,
  generateFeedbackId,
  generatePipelineAuditId,
  generateEntityAuditId,
  generatePipelineQueueId,
  generateObligationId,
  generateContractId,
  generateBrokerageId,
  generateCommissionId,
  ENTERPRISE_ID_PREFIXES,
} from '@/services/enterprise-id.service';

// =============================================================================
// TYPES
// =============================================================================

export interface LegacyDocument {
  readonly id: string;
  readonly collection: string;
  readonly newId: string;
  readonly type?: string;
}

export interface MigrationResult {
  readonly oldId: string;
  readonly newId: string;
  readonly collection: string;
  readonly subcollectionsMigrated: number;
  readonly referencesUpdated: number;
}

export interface MigrationReport {
  readonly buildings: ReadonlyArray<LegacyDocument>;
  readonly contacts: ReadonlyArray<LegacyDocument>;
  readonly simpleCollections: ReadonlyArray<LegacyDocument>;
  readonly totalLegacy: number;
}

// =============================================================================
// SIMPLE COLLECTION CONFIGS
// =============================================================================

export interface SimpleCollectionConfig {
  readonly collectionName: string;
  readonly validPrefixes: ReadonlyArray<string>;
  readonly generateId: () => string;
  readonly hasInternalId: boolean;
}

export const SIMPLE_COLLECTIONS: ReadonlyArray<SimpleCollectionConfig> = [
  { collectionName: COLLECTIONS.NOTIFICATIONS, validPrefixes: [ENTERPRISE_ID_PREFIXES.NOTIFICATION], generateId: generateNotificationId, hasInternalId: false },
  { collectionName: COLLECTIONS.AI_AGENT_FEEDBACK, validPrefixes: [ENTERPRISE_ID_PREFIXES.FEEDBACK], generateId: generateFeedbackId, hasInternalId: false },
  { collectionName: COLLECTIONS.AI_PIPELINE_AUDIT, validPrefixes: [ENTERPRISE_ID_PREFIXES.PIPELINE_AUDIT], generateId: generatePipelineAuditId, hasInternalId: false },
  { collectionName: COLLECTIONS.ENTITY_AUDIT_TRAIL, validPrefixes: [ENTERPRISE_ID_PREFIXES.ENTITY_AUDIT], generateId: generateEntityAuditId, hasInternalId: false },
  { collectionName: COLLECTIONS.AI_PIPELINE_QUEUE, validPrefixes: [ENTERPRISE_ID_PREFIXES.PIPELINE_QUEUE], generateId: generatePipelineQueueId, hasInternalId: false },
  { collectionName: COLLECTIONS.OBLIGATIONS, validPrefixes: [ENTERPRISE_ID_PREFIXES.OBLIGATION], generateId: generateObligationId, hasInternalId: false },
  { collectionName: COLLECTIONS.LEGAL_CONTRACTS, validPrefixes: [ENTERPRISE_ID_PREFIXES.CONTRACT], generateId: generateContractId, hasInternalId: true },
  { collectionName: COLLECTIONS.BROKERAGE_AGREEMENTS, validPrefixes: [ENTERPRISE_ID_PREFIXES.BROKERAGE], generateId: generateBrokerageId, hasInternalId: true },
  { collectionName: COLLECTIONS.COMMISSION_RECORDS, validPrefixes: [ENTERPRISE_ID_PREFIXES.COMMISSION], generateId: generateCommissionId, hasInternalId: true },
];

// =============================================================================
// PREFIXES & CONSTANTS
// =============================================================================

export const BUILDING_PREFIXES = [ENTERPRISE_ID_PREFIXES.BUILDING] as const;
export const CONTACT_PREFIXES = [ENTERPRISE_ID_PREFIXES.CONTACT, ENTERPRISE_ID_PREFIXES.COMPANY] as const;
export const BUILDING_SUBCOLLECTIONS = ['units', 'floors', 'parking', 'storage'] as const;

// =============================================================================
// HELPERS
// =============================================================================

/** UUID v4 format check (after prefix) */
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Check if an ID has proper enterprise format: prefix_uuid-v4.
 * Rejects legacy formats that have the right prefix but wrong ID body.
 */
export function hasEnterprisePrefix(id: string, prefixes: ReadonlyArray<string>): boolean {
  for (const prefix of prefixes) {
    if (id.startsWith(`${prefix}_`)) {
      const remainder = id.slice(prefix.length + 1);
      return UUID_V4_REGEX.test(remainder);
    }
  }
  return false;
}

/** Re-export ID generators used by scan */
export { generateBuildingId, generateContactId, generateCompanyId };
