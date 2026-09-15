/**
 * @fileoverview Accounting Audit Service — Event Logging Helper
 * @description Synchronous audit entry creation (Q6 — Google/SAP atomic pattern)
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-30
 * @see DECISIONS-PHASE-1c.md Q1, Q6, Q7
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, max 500 lines
 */

import { generateAccountingAuditLogId } from '@/services/enterprise-id.service';

import type { IAccountingRepository } from '../types/interfaces';
import type {
  AccountingAuditEventType,
  AuditEntityType,
  AccountingAuditEntry,
} from '../types/accounting-audit';
import { isoNow } from './repository/firestore-helpers';

// ============================================================================
// CORE AUDIT HELPER (synchronous — await, NOT fire-and-forget)
// ============================================================================

export interface AccountingEventParams {
  eventType: AccountingAuditEventType;
  entityType: AuditEntityType;
  entityId: string;
  userId: string;
  details: string;
  metadata?: Record<string, string | number | boolean | null>;
}

/**
 * **The ONE composition of an audit entry** (ADR-841 §7 Α23).
 *
 * Exported so a writer that changes material data **inside a Firestore transaction**
 * can append the entry in the SAME transaction (`appendAuditEntryInTransaction`) — the change and
 * its trace commit together or not at all. Never a second entry builder.
 */
export function accountingAuditEntryOf(params: AccountingEventParams): AccountingAuditEntry {
  return {
    auditId: generateAccountingAuditLogId(),
    eventType: params.eventType,
    entityType: params.entityType,
    entityId: params.entityId,
    userId: params.userId,
    timestamp: isoNow(),
    details: params.details,
    metadata: params.metadata ?? {},
  };
}

/**
 * Log an accounting audit event — synchronous (Q6)
 *
 * Called by the audited repository wrapper (Q7) or directly by hooks.
 * MUST be awaited — if it fails, the parent operation fails too.
 */
export async function logAccountingEvent(
  repository: IAccountingRepository,
  params: AccountingEventParams
): Promise<void> {
  await repository.createAuditEntry(accountingAuditEntryOf(params));
}
