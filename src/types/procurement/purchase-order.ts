/**
 * Purchase Order Types — ADR-267: Lightweight Procurement Module
 *
 * 6-state workflow (Procore/SAP pattern):
 * Draft → Approved → Ordered → Partially Delivered → Delivered → Closed
 * + Cancelled (from draft/approved/ordered)
 *
 * Delivery status = AUTOMATIC based on quantities received.
 * Invoice linking = action (linkedInvoiceIds[]), NOT a status.
 *
 * @module types/procurement/purchase-order
 * @see ADR-267 §4.1 (Purchase Order Entity)
 */

// ============================================================================
// STATUS & WORKFLOW
// ============================================================================

/** PO Status — 6-state workflow + cancelled */
export type PurchaseOrderStatus =
  | 'draft'                // Δημιουργήθηκε, δεν εγκρίθηκε ακόμα
  | 'approved'             // Εγκρίθηκε — έτοιμο για αποστολή
  | 'ordered'              // Στάλθηκε στον προμηθευτή (0% received)
  | 'partially_delivered'  // Μερική παραλαβή (1-99% received) — AUTO
  | 'delivered'            // Πλήρης παραλαβή (100% received) — AUTO
  | 'closed'               // Ολοκληρώθηκε
  | 'cancelled';           // Ακυρώθηκε

/** Allowed state transitions — SSoT for validation */
export const PO_STATUS_TRANSITIONS: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
  draft: ['approved', 'cancelled'],
  approved: ['ordered', 'cancelled'],
  ordered: ['partially_delivered', 'delivered', 'cancelled'],
  partially_delivered: ['partially_delivered', 'delivered'],
  delivered: ['closed'],
  closed: [],
  cancelled: [],
} as const;

/** PO Filter state (SSoT — consumed by usePurchaseOrders + procurementFiltersConfig) */
export interface POFilters {
  search: string;
  status: PurchaseOrderStatus | null;
  projectId: string | null;
  supplierId: string | null;
}

/** Status sets for filtering — SSoT, avoid hardcoding in services */
export const PO_MATCHABLE_STATUSES: ReadonlySet<PurchaseOrderStatus> = new Set([
  'ordered', 'partially_delivered', 'delivered',
]);

export const PO_COMMITTED_STATUSES: ReadonlySet<PurchaseOrderStatus> = new Set([
  'ordered', 'partially_delivered', 'delivered', 'closed',
]);

/** Status metadata for UI rendering */
export const PO_STATUS_META: Record<PurchaseOrderStatus, {
  label: { el: string; en: string };
  color: 'gray' | 'blue' | 'yellow' | 'orange' | 'green' | 'emerald' | 'red';
  icon: string;
}> = {
  draft:               { label: { el: 'Πρόχειρο', en: 'Draft' },               color: 'gray',    icon: 'FileEdit' },
  approved:            { label: { el: 'Εγκρίθηκε', en: 'Approved' },           color: 'blue',    icon: 'CheckCircle' },
  ordered:             { label: { el: 'Παραγγέλθηκε', en: 'Ordered' },         color: 'yellow',  icon: 'Send' },
  partially_delivered: { label: { el: 'Μερική Παραλαβή', en: 'Partial' },      color: 'orange',  icon: 'PackageOpen' },
  delivered:           { label: { el: 'Παραλήφθηκε', en: 'Delivered' },         color: 'green',   icon: 'PackageCheck' },
  closed:              { label: { el: 'Ολοκληρώθηκε', en: 'Closed' },          color: 'emerald', icon: 'CircleCheck' },
  cancelled:           { label: { el: 'Ακυρώθηκε', en: 'Cancelled' },          color: 'red',     icon: 'XCircle' },
} as const;

// ============================================================================
// CANCELLATION REASONS
// ============================================================================

/** Cancellation reason — mandatory dropdown when cancelling */
export type POCancellationReason =
  | 'supplier_change'    // Αλλαγή προμηθευτή
  | 'plan_change'        // Αλλαγή σχεδίου/scope
  | 'wrong_order'        // Λάθος παραγγελία
  | 'supplier_delay'     // Καθυστέρηση προμηθευτή
  | 'budget_cut'         // Περικοπή budget
  | 'duplicate'          // Διπλή παραγγελία
  | 'other';             // Άλλο

export const PO_CANCELLATION_REASONS: Record<POCancellationReason, {
  label: { el: string; en: string };
}> = {
  supplier_change: { label: { el: 'Αλλαγή προμηθευτή', en: 'Supplier change' } },
  plan_change:     { label: { el: 'Αλλαγή σχεδίου', en: 'Plan change' } },
  wrong_order:     { label: { el: 'Λάθος παραγγελία', en: 'Wrong order' } },
  supplier_delay:  { label: { el: 'Καθυστέρηση προμηθευτή', en: 'Supplier delay' } },
  budget_cut:      { label: { el: 'Περικοπή budget', en: 'Budget cut' } },
  duplicate:       { label: { el: 'Διπλή παραγγελία', en: 'Duplicate order' } },
  other:           { label: { el: 'Άλλο', en: 'Other' } },
} as const;

// ============================================================================
// VAT RATES
// ============================================================================

/** ΦΠΑ rate — PO-level (24% default, 0% ενδοκοινοτικές) */
export type POVatRate = 24 | 13 | 6 | 0;

export const PO_VAT_RATES: { value: POVatRate; label: string }[] = [
  { value: 24, label: '24%' },
  { value: 13, label: '13%' },
  { value: 6,  label: '6%' },
  { value: 0,  label: '0% (Ενδοκοινοτική)' },
];

// ============================================================================
// ATTACHMENT
// ============================================================================

/** PO Attachment — Firebase Storage */
export interface POAttachment {
  id: string;              // 'poatt_XXXXX' (enterprise-id)
  fileName: string;
  fileSize: number;        // bytes
  mimeType: string;
  storagePath: string;     // /purchase_orders/{poId}/attachments/{id}
  uploadedBy: string;      // userId
  uploadedAt: string;      // ISO
}

/** Max 5 files, max 10MB each */
export const PO_ATTACHMENT_LIMITS = {
  maxFiles: 5,
  maxFileSizeBytes: 10 * 1024 * 1024, // 10MB
  allowedMimeTypes: [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  ],
} as const;

// ============================================================================
// LINE ITEM
// ============================================================================

/** Purchase Order Line Item */
export interface PurchaseOrderItem {
  id: string;                       // 'poi_XXXXX'
  description: string;
  quantity: number;
  unit: string;                     // From PROCUREMENT_UNIT_OPTIONS or custom
  unitPrice: number;
  total: number;                    // quantity × unitPrice

  // BOQ Integration (optional link, categoryCode required)
  boqItemId: string | null;         // ref → boq_items (optional)
  categoryCode: string;             // ΑΤΟΕ code (OIK-1...OIK-12) — MANDATORY

  // Delivery Tracking — Partial deliveries
  quantityReceived: number;         // default: 0
  quantityRemaining: number;        // quantity - quantityReceived (computed)
}

// ============================================================================
// PURCHASE ORDER — CORE ENTITY
// ============================================================================

/** Purchase Order document — Firestore: purchase_orders/{poId} */
export interface PurchaseOrder {
  id: string;                       // 'po_XXXXX' (enterprise-id)
  poNumber: string;                 // 'PO-0042' (sequential, no year reset)
  companyId: string;

  // References
  projectId: string;                // ref → projects
  buildingId: string | null;        // ref → buildings (optional)
  supplierId: string;               // ref → contacts (supplier persona)

  // Status
  status: PurchaseOrderStatus;

  // Line Items (embedded array — max ~30 items per PO typically)
  items: PurchaseOrderItem[];

  // Financial Summary (computed, stored for query efficiency)
  currency: 'EUR';
  subtotal: number;
  taxRate: POVatRate;
  taxAmount: number;
  total: number;

  // Dates
  dateCreated: string;              // ISO
  dateNeeded: string | null;        // Optional
  dateOrdered: string | null;
  dateDelivered: string | null;
  dateInvoiced: string | null;

  // Delivery
  deliveryAddress: string | null;   // Auto-fill from project, editable

  // Payment Terms
  paymentTermsDays: number | null;  // Auto-fill from supplier
  paymentDueDate: string | null;    // Auto: dateOrdered + paymentTermsDays

  // Accounting Links
  linkedInvoiceIds: string[];       // ref → accounting_invoices (1:many)

  // Notes (2 fields — Procore/Oracle pattern)
  supplierNotes: string | null;     // Visible on PDF
  internalNotes: string | null;     // Hidden from PDF

  // Attachments
  attachments: POAttachment[];

  // Cancellation (mandatory if status = cancelled)
  cancellationReason: POCancellationReason | null;
  cancellationComment: string | null;

  // Quote link (ADR-327 P5 — auto-generated from awarded quote)
  sourceQuoteId: string | null;

  // Metadata
  createdBy: string;                // userId
  approvedBy: string | null;
  updatedAt: string;
  isDeleted: boolean;               // Soft delete only
}

// ============================================================================
// PROCUREMENT SETTINGS (Feature Flags)
// ============================================================================

/** Per-company procurement configuration */
export interface ProcurementSettings {
  requireSeparateApprover: boolean;    // false = self-approve OK
  autoApproveThreshold: number | null; // null = no auto-approve
  termsAndConditions: string | null;   // Standard T&C for PDF footer
}

export const PROCUREMENT_DEFAULTS: ProcurementSettings = {
  requireSeparateApprover: false,
  autoApproveThreshold: null,
  termsAndConditions: null,
};

// ============================================================================
// BUDGET OVERVIEW (Computed — for dashboard)
// ============================================================================

/** Budget awareness per ΑΤΟΕ category */
export interface BudgetOverviewItem {
  categoryCode: string;         // e.g., 'OIK-2'
  categoryName: string;         // e.g., 'Σκυροδέματα'
  budgeted: number;             // SUM(boq.estimatedCost)
  committed: number;            // SUM(po.total) WHERE ordered/partially/delivered
  spent: number;                // SUM(invoice.total) linked to POs
  remaining: number;            // budgeted - committed
  percentUsed: number;          // committed / budgeted × 100
}

// ============================================================================
// FORM / API DTOs
// ============================================================================

/** Create PO — request payload */
export interface CreatePurchaseOrderDTO {
  projectId: string;
  buildingId?: string | null;
  supplierId: string;
  items: Omit<PurchaseOrderItem, 'id' | 'quantityReceived' | 'quantityRemaining'>[];
  taxRate: POVatRate;
  dateNeeded?: string | null;
  deliveryAddress?: string | null;
  paymentTermsDays?: number | null;
  supplierNotes?: string | null;
  internalNotes?: string | null;
  sourceQuoteId?: string | null;
}

/** Update PO — partial update payload */
export interface UpdatePurchaseOrderDTO {
  projectId?: string;
  buildingId?: string | null;
  supplierId?: string;
  items?: Omit<PurchaseOrderItem, 'id' | 'quantityReceived' | 'quantityRemaining'>[];
  taxRate?: POVatRate;
  dateNeeded?: string | null;
  deliveryAddress?: string | null;
  paymentTermsDays?: number | null;
  supplierNotes?: string | null;
  internalNotes?: string | null;
}

/** Record delivery — per item quantities */
export interface RecordDeliveryDTO {
  items: {
    itemId: string;
    quantityReceived: number;
  }[];
}

// ============================================================================
// AUDIT EVENTS
// ============================================================================

/** Procurement audit event types */
export type ProcurementAuditAction =
  | 'procurement.po.created'
  | 'procurement.po.approved'
  | 'procurement.po.ordered'
  | 'procurement.po.status_changed'
  | 'procurement.po.items_edited'
  | 'procurement.po.cancelled'
  | 'procurement.po.deleted'
  | 'procurement.po.delivery_recorded'
  | 'procurement.po.invoice_linked';

// ============================================================================
// PERMISSIONS (ADR-267 §11)
// ============================================================================

/** Procurement-specific permissions */
export const PROCUREMENT_PERMISSIONS = {
  PO_READ: 'procurement:po:read',
  PO_CREATE: 'procurement:po:create',
  PO_APPROVE: 'procurement:po:approve',
  PO_CANCEL: 'procurement:po:cancel',
  PO_DELETE: 'procurement:po:delete',
  PO_READ_INTERNAL: 'procurement:po:read_internal',
} as const;

export type ProcurementPermission = typeof PROCUREMENT_PERMISSIONS[keyof typeof PROCUREMENT_PERMISSIONS];

// ============================================================================
// PO-INVOICE MATCHING (ADR-267 Phase C)
// ============================================================================

/** Candidate PO match for an expense document */
export interface POMatchCandidate {
  poId: string;
  poNumber: string;
  supplierId: string;
  total: number;
  subtotal: number;
  status: PurchaseOrderStatus;
  confidence: number;
  matchReasons: string[];
}

/** Result of PO-invoice matching */
export interface POMatchResult {
  candidates: POMatchCandidate[];
  bestMatch: POMatchCandidate | null;
  autoMatched: boolean;
}

/** Scoring config for PO-invoice matching */
export const PO_MATCH_SCORING = {
  AMOUNT_EXACT_POINTS: 40,
  AMOUNT_NEAR_POINTS: 25,
  AMOUNT_EXACT_TOLERANCE: 0.05,
  AMOUNT_NEAR_TOLERANCE: 0.10,
  DATE_NEAR_POINTS: 20,
  DATE_FAR_POINTS: 10,
  DATE_NEAR_DAYS: 30,
  DATE_FAR_DAYS: 60,
  LINE_ITEM_COUNT_POINTS: 15,
  DESCRIPTION_MATCH_POINTS: 15,
  REFERENCE_MATCH_POINTS: 10,
  AUTO_MATCH_THRESHOLD: 85,
  MAX_CANDIDATES: 10,
} as const;

// ============================================================================
// SUPPLIER METRICS (ADR-267 Phase C)
// ============================================================================

/** Aggregated supplier performance metrics */
export interface SupplierMetrics {
  supplierId: string;
  supplierName: string;
  totalOrders: number;
  totalSpend: number;
  averageOrderValue: number;
  onTimeDeliveryRate: number;
  averageLeadTimeDays: number | null;
  cancellationRate: number;
  categoryBreakdown: CategorySpend[];
  /** ISO date string of the most recent non-cancelled PO */
  lastOrderDate: string | null;
  /** Trade specialty codes from SupplierPersona (ADR-327 §9.3) */
  tradeSpecialties: string[];
}

/** Spend per ΑΤΟΕ category */
export interface CategorySpend {
  categoryCode: string;
  categoryName: string;
  totalSpend: number;
  orderCount: number;
}

/** Supplier comparison result */
export interface SupplierComparison {
  suppliers: SupplierMetrics[];
  totalSuppliers: number;
}

/** Monthly price trend data */
export interface SupplierPriceTrend {
  month: string;
  averageUnitPrice: number;
  orderCount: number;
  totalQuantity: number;
}
