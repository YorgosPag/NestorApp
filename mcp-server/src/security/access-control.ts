/**
 * Collection-level Access Control
 *
 * - READ: All collections (full visibility for Claude)
 * - WRITE: Allowlisted business collections only
 * - BLOCKED: System/security collections — no write/delete
 * - DELETE: Requires MCP_ALLOW_DELETE=true env var
 */

import type { OperationType, AccessDecision } from '../types.js';

// ============================================================================
// BLOCKED COLLECTIONS (no write/delete under any circumstance)
// ============================================================================

const BLOCKED_COLLECTIONS = new Set([
  'system',
  'config',
  'settings',
  'users',
  'roles',
  'permissions',
  'tokens',
  'security_roles',
  'counters',
  'sessions',
  'email_domain_policies',
  'country_security_policies',
  'user_2fa_settings',
]);

// ============================================================================
// WRITE ALLOWLIST (collections Claude can create/update documents in)
// ============================================================================

const WRITE_ALLOWED_COLLECTIONS = new Set([
  'contacts',
  'projects',
  'buildings',
  'properties',
  'floors',
  'tasks',
  'leads',
  'opportunities',
  'activities',
  'documents',
  'files',
  'obligations',
  'obligation_transmittals',
  'appointments',
  'communications',
  'messages',
  'conversations',
  'contact_links',
  'file_links',
  'construction_phases',
  'construction_tasks',
  'building_milestones',
  'invoices',
  'payments',
  'transactions',
  'employment_records',
  'attendance_events',
  'parking_spots',
  'boq_items',
  'boq_categories',
  'boq_price_lists',
  'boq_templates',
  'cheques',
  'legal_contracts',
  'brokerage_agreements',
  'commission_records',
  'ownership_tables',
  'accounting_invoices',
  'accounting_journal_entries',
  'accounting_bank_transactions',
  'accounting_bank_accounts',
  'accounting_fixed_assets',
  'accounting_efka_payments',
  'accounting_expense_documents',
  'accounting_tax_installments',
  'accounting_apy_certificates',
  'file_audit_log',
  'file_shares',
  'file_comments',
  'file_folders',
  'file_approvals',
  'entity_audit_trail',
  'notifications',
  'ai_chat_history',
  'ai_agent_feedback',
  'ai_pipeline_audit',
  'ai_pipeline_queue',
  'ai_usage',
  'external_identities',
  'contact_relationships',
  'searchDocuments',
]);

// ============================================================================
// ACCESS CHECK
// ============================================================================

export function checkAccess(collection: string, operation: OperationType): AccessDecision {
  // READ: always allowed
  if (operation === 'read') {
    return { allowed: true, reason: 'Read access granted' };
  }

  // BLOCKED collections
  if (BLOCKED_COLLECTIONS.has(collection)) {
    return {
      allowed: false,
      reason: `Collection "${collection}" is blocked for ${operation} operations (system/security collection)`,
    };
  }

  // DELETE: requires env var opt-in
  if (operation === 'delete') {
    if (process.env.MCP_ALLOW_DELETE !== 'true') {
      return {
        allowed: false,
        reason: 'Delete operations are disabled. Set MCP_ALLOW_DELETE=true to enable.',
      };
    }
    if (!WRITE_ALLOWED_COLLECTIONS.has(collection)) {
      return {
        allowed: false,
        reason: `Collection "${collection}" is not in the write allowlist`,
      };
    }
    return { allowed: true, reason: 'Delete access granted (opt-in enabled)' };
  }

  // WRITE: must be in allowlist
  if (!WRITE_ALLOWED_COLLECTIONS.has(collection)) {
    return {
      allowed: false,
      reason: `Collection "${collection}" is not in the write allowlist. Allowed: ${[...WRITE_ALLOWED_COLLECTIONS].slice(0, 10).join(', ')}...`,
    };
  }

  return { allowed: true, reason: 'Write access granted' };
}
