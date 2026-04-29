import type { Timestamp } from 'firebase/firestore';

// ============================================================================
// SOURCING EVENT — ADR-327 §17 Q31 (Multi-Vendor Multi-Trade Package)
// ============================================================================
//
// Optional parent grouping N atomic single-trade RFQs into one logical
// procurement package (e.g. "Apartment block A — finishings package" →
// concrete + plastering + tiling + painting RFQs, each its own RFQ).
//
// Decision rationale (HYBRID A-Enhanced):
//   - 1 RFQ = 1 trade SEMPRE (atomic, simpler vendor matching)
//   - Multi-trade via parent collection (avoids inflating RFQ schema)
//   - status aggregated server-side from child RFQs (no client recomputation)
//   - NO vendor capabilities matrix in MVP — vendor self-service Phase 2

export type SourcingEventStatus =
  | 'draft'
  | 'active'      // ≥1 child rfq active
  | 'partial'     // some child rfqs closed, some still active
  | 'closed'      // all child rfqs closed
  | 'archived';

export const SOURCING_EVENT_STATUS_TRANSITIONS: Record<SourcingEventStatus, SourcingEventStatus[]> = {
  draft:    ['active', 'archived'],
  active:   ['partial', 'closed', 'archived'],
  partial:  ['closed', 'archived'],
  closed:   ['archived'],
  archived: [],
} as const;

export interface SourcingEvent {
  id: string;
  companyId: string;
  projectId: string;
  buildingId: string | null;
  title: string;
  description: string | null;
  status: SourcingEventStatus;
  rfqIds: string[];                  // denorm — fast list view
  rfqCount: number;                  // denorm — sum of child RFQs
  closedRfqCount: number;            // denorm — for status derivation
  deadlineDate: Timestamp | null;    // optional umbrella deadline (child RFQs may differ)
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

export interface CreateSourcingEventDTO {
  projectId: string;
  buildingId?: string | null;
  title: string;
  description?: string | null;
  deadlineDate?: string | null;      // ISO string from API boundary
}

export interface UpdateSourcingEventDTO {
  title?: string;
  description?: string | null;
  status?: SourcingEventStatus;
  deadlineDate?: string | null;
}

export interface SourcingEventFilters {
  projectId?: string;
  status?: SourcingEventStatus;
  search?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

export function deriveSourcingEventStatus(
  rfqCount: number,
  closedRfqCount: number,
  currentStatus: SourcingEventStatus,
): SourcingEventStatus {
  if (currentStatus === 'archived' || currentStatus === 'draft') return currentStatus;
  if (rfqCount === 0) return 'draft';
  if (closedRfqCount === 0) return 'active';
  if (closedRfqCount < rfqCount) return 'partial';
  return 'closed';
}
