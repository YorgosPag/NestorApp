/**
 * BOQ Core Entities — Data Model
 *
 * Κύριες οντότητες για το σύστημα επιμετρήσεων:
 * - BOQItem: Μεμονωμένη εργασία/υλικό
 * - BOQCategory: Κατηγορία ΑΤΟΕ
 * - BOQSummary: Αθροιστικά στοιχεία ανά κτίριο
 *
 * @module types/boq/boq
 * @see ADR-175 §4.2 (Data Hierarchy)
 */

import type {
  BOQMeasurementUnit,
  BOQItemStatus,
  MeasurementMethod,
  BOQSource,
  QAStatus,
  CategoryLevel,
  WastePolicy,
  SourceAuthority,
} from './units';

// ============================================================================
// BOQ ITEM — ΚΥΡΙΟ ENTITY
// ============================================================================

/** Ένα μεμονωμένο BOQ item (εργασία ή υλικό) */
export interface BOQItem {
  /** Firestore document ID */
  id: string;

  /** Tenant isolation */
  companyId: string;

  /** Ανήκει σε project */
  projectId: string;

  /** Ανήκει σε building */
  buildingId: string;

  // --- Scope ---

  /** Scope: ολόκληρο κτίριο ή μεμονωμένη μονάδα */
  scope: 'building' | 'unit';

  /** ID μονάδας αν scope = 'unit' (null αν scope = 'building') */
  linkedUnitId: string | null;

  // --- Ταυτότητα ---

  /** Κωδικός κατηγορίας ΑΤΟΕ (π.χ. 'OIK-2') */
  categoryCode: string;

  /** Σύντομη περιγραφή (π.χ. 'Οπλισμένο σκυρόδεμα C20/25') */
  title: string;

  /** Αναλυτική περιγραφή */
  description: string | null;

  /** Μονάδα μέτρησης */
  unit: BOQMeasurementUnit;

  // --- Ποσότητες ---

  /** Προϋπολογιστική εκτίμηση (net quantity) */
  estimatedQuantity: number;

  /** Πραγματική ποσότητα (συμπληρώνεται μετά) */
  actualQuantity: number | null;

  /** Ποσοστό φύρας (0.08 = 8%) */
  wasteFactor: number;

  /** Πολιτική φύρας */
  wastePolicy: WastePolicy;

  // --- Κοστολόγηση (μοναδιαίες τιμές) ---

  /** Κόστος υλικού ανά μονάδα (€) */
  materialUnitCost: number;

  /** Κόστος εργασίας ανά μονάδα (€) */
  laborUnitCost: number;

  /** Κόστος εξοπλισμού ανά μονάδα (€) */
  equipmentUnitCost: number;

  /** Προέλευση τιμής (master/project/item override) */
  priceAuthority: SourceAuthority;

  // --- Σύνδεση με Gantt ---

  /** Σύνδεση με φάση κατασκευής (construction_phases.id) */
  linkedPhaseId: string | null;

  /** Σύνδεση με εργασία κατασκευής (construction_tasks.id) */
  linkedTaskId: string | null;

  // --- Σύνδεση με Accounting (Phase D — πεδία υπάρχουν, UI αργότερα) ---

  /** Σύνδεση με τιμολόγιο accounting */
  linkedInvoiceId: string | null;

  /** Σύνδεση με υπεργολάβο (contacts.id) */
  linkedContractorId: string | null;

  // --- Μεταδεδομένα ---

  /** Πηγή δεδομένων */
  source: BOQSource;

  /** Μέθοδος μέτρησης */
  measurementMethod: MeasurementMethod;

  /** Κύκλος ζωής (governance) */
  status: BOQItemStatus;

  /** Ποιοτικός έλεγχος */
  qaStatus: QAStatus;

  /** Σημειώσεις ελεύθερου κειμένου */
  notes: string | null;

  /** Ποιος δημιούργησε */
  createdBy: string | null;

  /** Ποιος ενέκρινε (αν status = approved) */
  approvedBy: string | null;

  /** Ημερομηνία δημιουργίας (ISO string) */
  createdAt: string;

  /** Ημερομηνία τελευταίας ενημέρωσης (ISO string) */
  updatedAt: string;
}

// ============================================================================
// BOQ CATEGORY — ΑΤΟΕ ΚΑΤΗΓΟΡΙΕΣ
// ============================================================================

/** Κατηγορία ΑΤΟΕ — master data */
export interface BOQCategory {
  /** Firestore document ID */
  id: string;

  /** Tenant isolation */
  companyId: string;

  /** Κωδικός κατηγορίας (π.χ. 'OIK-1', 'OIK-2.1') */
  code: string;

  /** Ελληνική ονομασία */
  nameEL: string;

  /** Αγγλική ονομασία */
  nameEN: string;

  /** Σύντομη περιγραφή */
  description: string | null;

  /** Επίπεδο ιεραρχίας */
  level: CategoryLevel;

  /** ID γονικής κατηγορίας (null αν root) */
  parentId: string | null;

  /** Σειρά εμφάνισης */
  sortOrder: number;

  /** Default waste factor (0.05 = 5%) */
  defaultWasteFactor: number;

  /** Επιτρεπόμενες μονάδες μέτρησης */
  allowedUnits: BOQMeasurementUnit[];

  /** Ενεργή ή απενεργοποιημένη */
  isActive: boolean;

  /** Ημερομηνία δημιουργίας (ISO string) */
  createdAt: string;

  /** Ημερομηνία ενημέρωσης (ISO string) */
  updatedAt: string;
}

// ============================================================================
// BOQ SUMMARIES — ΑΘΡΟΙΣΤΙΚΑ
// ============================================================================

/** Σύνοψη ανά κατηγορία ΑΤΟΕ */
export interface BOQCategorySummary {
  categoryCode: string;
  categoryName: string;
  itemCount: number;
  totalEstimatedCost: number;
  totalActualCost: number | null;
}

/** Σύνοψη ανά κτίριο */
export interface BOQSummary {
  buildingId: string;
  totalItems: number;
  totalEstimatedCost: number;
  totalActualCost: number | null;
  categories: BOQCategorySummary[];
  lastUpdated: string;
}

/** Σύνοψη ανά project (rollup) */
export interface BOQProjectSummary {
  projectId: string;
  buildings: BOQSummary[];
  totalEstimatedCost: number;
  totalActualCost: number | null;
}

// ============================================================================
// INPUT / FILTER TYPES
// ============================================================================

/** Input για δημιουργία νέου BOQ item */
export interface CreateBOQItemInput {
  projectId: string;
  buildingId: string;
  scope: 'building' | 'unit';
  linkedUnitId?: string | null;
  categoryCode: string;
  title: string;
  description?: string | null;
  unit: BOQMeasurementUnit;
  estimatedQuantity: number;
  wasteFactor?: number;
  materialUnitCost?: number;
  laborUnitCost?: number;
  equipmentUnitCost?: number;
  linkedPhaseId?: string | null;
  linkedTaskId?: string | null;
  source?: BOQSource;
  measurementMethod?: MeasurementMethod;
  notes?: string | null;
}

/** Input για ενημέρωση BOQ item (partial) */
export interface UpdateBOQItemInput {
  title?: string;
  description?: string | null;
  unit?: BOQMeasurementUnit;
  estimatedQuantity?: number;
  actualQuantity?: number | null;
  wasteFactor?: number;
  wastePolicy?: WastePolicy;
  materialUnitCost?: number;
  laborUnitCost?: number;
  equipmentUnitCost?: number;
  priceAuthority?: SourceAuthority;
  linkedPhaseId?: string | null;
  linkedTaskId?: string | null;
  linkedInvoiceId?: string | null;
  linkedContractorId?: string | null;
  measurementMethod?: MeasurementMethod;
  qaStatus?: QAStatus;
  notes?: string | null;
}

/** Φίλτρα αναζήτησης BOQ items */
export interface BOQFilters {
  buildingId?: string;
  scope?: 'building' | 'unit';
  categoryCode?: string;
  status?: BOQItemStatus | 'all';
  source?: BOQSource;
  linkedPhaseId?: string;
  searchText?: string;
}

// ============================================================================
// DEFAULTS
// ============================================================================

/** Default τιμές για νέα BOQ items */
export const BOQ_ITEM_DEFAULTS = {
  scope: 'building' as const,
  status: 'draft' as const,
  source: 'manual' as const,
  measurementMethod: 'manual' as const,
  qaStatus: 'pending' as const,
  wastePolicy: 'inherited' as const,
  priceAuthority: 'master' as const,
  wasteFactor: 0,
  materialUnitCost: 0,
  laborUnitCost: 0,
  equipmentUnitCost: 0,
} as const;
