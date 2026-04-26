import type { Timestamp } from 'firebase/firestore';
import type { TradeCode } from './trade';

// ============================================================================
// RFQ STATUS
// ============================================================================

export type RfqStatus = 'draft' | 'active' | 'closed' | 'archived';

export const RFQ_STATUS_TRANSITIONS: Record<RfqStatus, RfqStatus[]> = {
  draft:    ['active', 'archived'],
  active:   ['closed', 'archived'],
  closed:   ['archived'],
  archived: [],
} as const;

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
