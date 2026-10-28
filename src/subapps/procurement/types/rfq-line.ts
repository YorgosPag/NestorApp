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

// ============================================================================
// WHERE THE LINES LIVE — ADR-327 §17 Q29 (ONE answer for every reader)
// ============================================================================
//
// Since Q29 the lines live in `rfqs/{id}/lines`; the inline `RFQ.lines[]` is
// LEGACY and is `[]` on every new RFQ. Until 2026-10-27 the vendor portal and
// the package aggregate read the inline array ⇒ the vendor got an EMPTY form
// and the quote got the wrong trade (ADR-327 changelog 2026-10-27).
//
// ⚠️ `linesStorage` is written ONCE, at creation. An RFQ created without lines
// (`null`) and filled later through `/lines` keeps `null` — its lines are in
// the sub-collection. So the inline array is the source ONLY when the RFQ says
// so (`'inline_legacy'`), or carries no breadcrumb at all (pre-Q29 document)
// AND has inline content.

/** The part of an RFQ that decides where its lines live. */
export interface RfqLinesHolder {
  readonly linesStorage?: RfqLineSource | 'inline_legacy' | null;
  /** Legacy inline lines — the stored shape is the pre-Q29 subset (no `displayOrder`, no tenant). */
  readonly lines: readonly RfqLine[];
}

export type RfqLinesLocation = 'subcollection' | 'inline';

export function rfqLinesLocation(rfq: RfqLinesHolder): RfqLinesLocation {
  if (rfq.linesStorage === 'inline_legacy') return 'inline';
  if (rfq.linesStorage === undefined && rfq.lines.length > 0) return 'inline';
  return 'subcollection';
}

// ============================================================================
// INTERNAL PROJECTION — the PM's side (bid leveling, ADR-327 §8.5)
// ============================================================================

/**
 * The vendor-safe line + the PM's internal estimate. The estimate is the FIRST source of a leveling
 * plug (a gap the vendor left) — so it exists only on the PM's side and is stripped by `toPublicLine`.
 */
export interface InternalRfqLine extends PublicRfqLine {
  estimateUnitPrice: number | null;
}

function toInternalRfqLine(line: RfqLine): InternalRfqLine {
  return { ...toPublicRfqLine(line), estimateUnitPrice: line.unitPrice ?? null };
}

/** A legacy inline line, made whole: its stored subset lacks `displayOrder` (array order IS the order). */
function legacyInlineToInternal(line: RfqLine, index: number): InternalRfqLine {
  return {
    ...toInternalRfqLine(line),
    categoryCode: line.categoryCode ?? null,
    quantity: line.quantity ?? null,
    unit: line.unit ?? null,
    notes: line.notes ?? null,
    displayOrder: line.displayOrder ?? index,
  };
}

/** Internal → vendor-safe: drops the estimate (the ONE place it is removed). */
export function toPublicLine({ estimateUnitPrice: _estimate, ...line }: InternalRfqLine): PublicRfqLine {
  return line;
}

/**
 * The lines of an RFQ, PM side — pure, so the storage rule is provable without Firestore.
 * `subcollection` = the documents of `rfqs/{id}/lines`, already ordered by `displayOrder`.
 */
export function resolveInternalRfqLines(
  rfq: RfqLinesHolder,
  subcollection: readonly RfqLine[],
): InternalRfqLine[] {
  return rfqLinesLocation(rfq) === 'inline'
    ? rfq.lines.map(legacyInlineToInternal)
    : subcollection.map(toInternalRfqLine);
}

/** The vendor-safe lines of an RFQ — the SAME storage rule, minus the estimate. */
export function resolvePublicRfqLines(
  rfq: RfqLinesHolder,
  subcollection: readonly RfqLine[],
): PublicRfqLine[] {
  return resolveInternalRfqLines(rfq, subcollection).map(toPublicLine);
}
