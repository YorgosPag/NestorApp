import type { Timestamp } from 'firebase/firestore';
import type { SupplierSkuRef } from '@/subapps/catalog/types/supply-relationship';
import type { BoqPriceSource, BoqSupplierPriceSource } from '@/types/boq/price-source';
import type { TradeCode } from './trade';

// ============================================================================
// RFQ LINE — ADR-327 §17 Q29 (sub-collection rfqs/{rfqId}/lines/{lineId})
// ============================================================================
//
// Per Q29 (HYBRID Γ): BOQ-first with ad-hoc escape hatch.
//   - source = 'boq'    → snapshot from BOQ at RFQ creation time
//   - source = 'ad_hoc' → entered ad-hoc by PM in wizard
//   - source = 'catalog' → a supplier SKU picked from the catalog (ADR-923 §5.13 Ε6, Τ4): written ONLY by the
//     server, with the description taken from the SKU, never from the client
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

/** Οι προελεύσεις γραμμής, με τη σειρά που διαβάζονται (φόρμα, πίνακας): ΕΝΑΣ κατάλογος, τύπος και επανάληψη από εδώ. */
export const RFQ_LINE_SOURCES = ['boq', 'ad_hoc', 'catalog'] as const;
export type RfqLineSource = (typeof RFQ_LINE_SOURCES)[number];

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
  /**
   * ADR-923 §5.8 — το SKU που ζητά η γραμμή. Γραμμές παλιότερες από τα δύο πεδία δεν τα έχουν: διαβάζονται ως «κανένα».
   * ⛔ Μόνο εσωτερικά: το ποιον προμηθευτή ζήτησε ο αγοραστής δεν φτάνει ποτέ σε προμηθευτή (`PublicRfqLine`).
   */
  catalogRef?: SupplierSkuRef | null;
  /** Το στιγμιότυπο τιμής του BOQ, παγωμένο μαζί με τη γραμμή (Q29). Ζητούμενο SKU χωρίς τιμή ⇒ `null`. */
  priceSnapshot?: BoqSupplierPriceSource | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type RfqLineCatalogFields = Required<Pick<RfqLine, 'catalogRef' | 'priceSnapshot'>>;

/** Δεσμός και στιγμιότυπο από την πηγή τιμής, πάντα μαζί, ώστε να μη μπορούν να διαφωνήσουν. Ο τιμοκατάλογος κόστους δεν είναι SKU προμηθευτή. */
export function rfqLineCatalogFields(source: BoqPriceSource | null | undefined): RfqLineCatalogFields {
  if (source?.authority !== 'supplier') return { catalogRef: null, priceSnapshot: null };
  return { catalogRef: { supplierCompanyId: source.supplierCompanyId, variantId: source.variantId }, priceSnapshot: source };
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

/**
 * Μια γραμμή «Ζητήστε προσφορά» από τον κατάλογο (ADR-923 §5.13 Ε6, Τ4): η **διεύθυνση** του SKU και η ζήτηση του αγοραστή.
 * 🔒 Καμία περιγραφή, τιμή ή SKU ref από τον πελάτη: ο διακομιστής κρίνει το SKU (`resolveQuoteSku`) και γράφει το κείμενό του.
 */
export interface CreateRfqCatalogLineDTO {
  supplierCompanyId: string;
  modelId: string;
  variantId: string;
  quantity: number;
  unit: string;
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

/**
 * 🔒 Η ΜΙΑ προβολή προς προμηθευτή: λίστα επιτρεπόμενων, πεδίο προς πεδίο, ποτέ `...line`. Ό,τι δεν γράφεται εδώ δεν ταξιδεύει,
 * άρα κάθε μελλοντικό πεδίο μένει κλειστό εξ ορισμού (ADR-923 §5.8: το στιγμιότυπο είναι τιμή ενός προμηθευτή και το RFQ φτάνει σε άλλους).
 */
export function toPublicRfqLine(line: PublicRfqLine): PublicRfqLine {
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
  catalogRef?: SupplierSkuRef | null;
}

function toInternalRfqLine(line: RfqLine): InternalRfqLine {
  return { ...toPublicRfqLine(line), estimateUnitPrice: line.unitPrice ?? null, catalogRef: line.catalogRef ?? null };
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

/** Internal → vendor-safe, through the ONE allowlist: the estimate and the requested SKU are simply not on it. */
export function toPublicLine(line: InternalRfqLine): PublicRfqLine {
  return toPublicRfqLine(line);
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
