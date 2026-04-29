import type { Timestamp } from 'firebase/firestore';
import type { TradeCode } from './trade';

// ============================================================================
// RFQ LINE — ADR-327 §17 Q29 (sub-collection rfqs/{rfqId}/lines/{lineId})
// ============================================================================
//
// Per Q29 (HYBRID Γ): BOQ-first with ad-hoc escape hatch.
//   - source = 'boq'    → snapshot from BOQ at RFQ creation time
//   - source = 'ad_hoc' → entered ad-hoc by PM in wizard
//
// Snapshot semantics: we DO NOT live-update from BOQ. If a BOQ item changes
// after the RFQ is sent, the RFQ line keeps its original snapshot to
// preserve quote integrity. Promote-to-BOQ flow → Phase 2.
//
// Persistence:
//   - companyId denormalized for CHECK 3.10 firestore-companyid-baseline
//   - rfqId denormalized for collectionGroup queries across all RFQs
//   - displayOrder controls rendering order in vendor portal
//
// `unitPrice` is an OPTIONAL internal estimate. NEVER shown to vendors —
// stripped server-side when generating the public portal payload.

export type RfqLineSource = 'boq' | 'ad_hoc';

export interface RfqLine {
  id: string;
  rfqId: string;
  companyId: string;
  source: RfqLineSource;
  boqItemId: string | null;          // populated only when source === 'boq'
  description: string;
  trade: TradeCode;
  categoryCode: string | null;       // ATOE — universal join key with Quote/PO lines
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;          // INTERNAL estimate, NOT exposed to vendors
  notes: string | null;
  displayOrder: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CreateRfqLineDTO {
  source: RfqLineSource;
  boqItemId?: string | null;
  description: string;
  trade: TradeCode;
  categoryCode?: string | null;
  quantity?: number | null;
  unit?: string | null;
  unitPrice?: number | null;
  notes?: string | null;
  displayOrder?: number;
}

export interface UpdateRfqLineDTO {
  description?: string;
  trade?: TradeCode;
  categoryCode?: string | null;
  quantity?: number | null;
  unit?: string | null;
  unitPrice?: number | null;
  notes?: string | null;
  displayOrder?: number;
}

// ============================================================================
// PUBLIC PROJECTION — what the vendor sees in the portal
// ============================================================================
//
// Strips internal fields (unitPrice, boqItemId, source, companyId) before
// sending to the public vendor portal.

export interface PublicRfqLine {
  id: string;
  description: string;
  trade: TradeCode;
  categoryCode: string | null;
  quantity: number | null;
  unit: string | null;
  notes: string | null;
  displayOrder: number;
}

export function toPublicRfqLine(line: RfqLine): PublicRfqLine {
  return {
    id: line.id,
    description: line.description,
    trade: line.trade,
    categoryCode: line.categoryCode,
    quantity: line.quantity,
    unit: line.unit,
    notes: line.notes,
    displayOrder: line.displayOrder,
  };
}
