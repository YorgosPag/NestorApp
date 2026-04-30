import type { Timestamp } from 'firebase/firestore';
import type { TradeCode } from './trade';
import type { RfqLineSource } from './rfq-line';
import type { SourcingEventStatus } from './sourcing-event';

// ============================================================================
// RFQ STATUS
// ============================================================================

export type RfqStatus = 'draft' | 'active' | 'closed' | 'cancelled' | 'archived';

export const RFQ_STATUS_TRANSITIONS: Record<RfqStatus, RfqStatus[]> = {
  draft:     ['active', 'cancelled', 'archived'],
  active:    ['closed', 'cancelled', 'archived'],
  closed:    ['active', 'archived'],
  cancelled: ['archived'],
  archived:  [],
} as const;

// ADR-335 — Set of statuses that block line edits, invite sends, status mutations.
export const RFQ_LIFECYCLE_LOCKED_STATUSES: ReadonlySet<RfqStatus> = new Set<RfqStatus>([
  'closed',
  'cancelled',
  'archived',
]);

// ADR-335 — Cancellation reason categories (free-text fallback via 'other').
export type RfqCancellationReason =
  | 'project_change'
  | 'budget_cut'
  | 'no_responses'
  | 'duplicate'
  | 'wrong_scope'
  | 'other';

export const RFQ_CANCELLATION_REASONS: readonly RfqCancellationReason[] = [
  'project_change',
  'budget_cut',
  'no_responses',
  'duplicate',
  'wrong_scope',
  'other',
] as const;

// ============================================================================
// AWARD MODE — ADR-327 §17 Q12
// ============================================================================

export type AwardMode = 'whole_package' | 'cherry_pick';

// ============================================================================
// REMINDER TEMPLATE — ADR-327 §17 Q19
// ============================================================================

export type ReminderTemplate = 'aggressive' | 'standard' | 'soft' | 'off';

export const REMINDER_SCHEDULES: Record<Exclude<ReminderTemplate, 'off'>, number[]> = {
  aggressive: [72, 48, 24, 6, 1],
  standard:   [48, 24, 6],
  soft:       [24, 1],
} as const;

// ============================================================================
// RFQ LINE (the ask — not a quote line)
// ============================================================================

export interface RfqLine {
  id: string;
  description: string;
  trade: TradeCode;
  categoryCode: string | null;
  quantity: number | null;
  unit: string | null;
  notes: string | null;
}

// ============================================================================
// RFQ ENTITY
// ============================================================================

export interface RFQ {
  id: string;
  projectId: string;
  buildingId: string | null;
  companyId: string;
  title: string;
  description: string | null;
  lines: RfqLine[];
  deadlineDate: Timestamp | null;
  status: RfqStatus;
  awardMode: AwardMode;
  reminderTemplate: ReminderTemplate;
  invitedVendorIds: string[];
  winnerQuoteId: string | null;
  comparisonTemplateId: string | null;
  auditTrail: Array<{
    timestamp: Timestamp;
    userId: string;
    action: string;
    detail: string | null;
  }>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;

  // --- Multi-Vendor extension (ADR-327 §17 Q28-Q31, additive 2026-04-29) ---
  // All optional, non-breaking. Step (c) will migrate the inline `lines[]`
  // and `invitedVendorIds[]` arrays away once the new fields/sub-collection
  // are wired through services + UI.

  /** Optional parent sourcing event for multi-trade packages (Q31). */
  sourcingEventId?: string | null;
  /** Denormalized parent status for fast filter without join (Q31). */
  sourcingEventStatus?: SourcingEventStatus | null;
  /** Denormalized count of fan-out vendor invitations (Q28). */
  invitedVendorCount?: number;
  /** Denormalized count of vendor responses (Q28). */
  respondedCount?: number;
  /** Migration breadcrumb for line-storage source (Q29 sub-collection). */
  linesStorage?: RfqLineSource | 'inline_legacy' | null;

  // --- ADR-335 lifecycle (cancellation metadata) ---
  /** Reason category when status === 'cancelled'. */
  cancellationReason?: RfqCancellationReason | null;
  /** Free-text detail when reason === 'other' or extra context. */
  cancellationDetail?: string | null;
  /** Server timestamp the cancellation was committed. */
  cancelledAt?: Timestamp | null;
  /** UID who triggered the cancellation. */
  cancelledBy?: string | null;
  /** Whether vendors with active invites were notified at cancel time. */
  cancellationNotifiedVendors?: boolean | null;
}

// ============================================================================
// DTOs
// ============================================================================

export interface CreateRfqDTO {
  projectId: string;
  buildingId?: string | null;
  title: string;
  description?: string | null;
  lines?: RfqLine[];
  deadlineDate?: string | null;
  awardMode?: AwardMode;
  reminderTemplate?: ReminderTemplate;
  comparisonTemplateId?: string | null;
  invitedVendorIds?: string[];
  /** Optional parent sourcing event for multi-trade packages (Q31). */
  sourcingEventId?: string | null;
  /** BOQ item IDs for sub-collection snapshot lines (Q29 BOQ-first path). */
  boqItemIds?: string[];
  /** Ad-hoc line definitions for Q29 escape-hatch path. */
  adHocLines?: import('./rfq-line').CreateRfqLineDTO[];
}

export interface UpdateRfqDTO {
  title?: string;
  description?: string | null;
  lines?: RfqLine[];
  deadlineDate?: string | null;
  awardMode?: AwardMode;
  reminderTemplate?: ReminderTemplate;
  status?: RfqStatus;
  winnerQuoteId?: string | null;
}

export interface RfqFilters {
  projectId?: string;
  status?: RfqStatus;
  search?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

export function rfqIsMultiTrade(rfq: Pick<RFQ, 'lines'>): boolean {
  const trades = new Set(rfq.lines.map((l) => l.trade));
  return trades.size > 1;
}

// ============================================================================
// MODULE UMBRELLA RE-EXPORTS — ADR-327 §17 Q28-Q31 (Multi-Vendor extension)
// ============================================================================
// Forward references to the sub-collection / parent-collection schemas defined
// in their own modules. Re-exporting here makes rfq.ts the canonical RFQ-domain
// type entry point during the step (a)→(c) migration.

export type {
  RfqLine as RfqLineRecord,
  RfqLineSource,
  PublicRfqLine,
  CreateRfqLineDTO,
  UpdateRfqLineDTO,
} from './rfq-line';
export { toPublicRfqLine } from './rfq-line';

export type {
  SourcingEvent,
  SourcingEventStatus,
  CreateSourcingEventDTO,
  UpdateSourcingEventDTO,
  SourcingEventFilters,
} from './sourcing-event';
export {
  SOURCING_EVENT_STATUS_TRANSITIONS,
  deriveSourcingEventStatus,
} from './sourcing-event';
