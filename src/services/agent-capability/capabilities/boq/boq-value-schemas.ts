/**
 * Σχήματα ωφέλιμου φορτίου των BOQ δυνατοτήτων
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ `Record<keyof T, SchemaField>` ΚΑΙ ΟΧΙ ΑΠΛΟ ΑΝΤΙΚΕΙΜΕΝΟ
 * ─────────────────────────────────────────────────────────────────────────────
 * Το `envelope.value` περνά **αυτούσιο** ό,τι επιστρέφει το service (ADR-734
 * §6.3 κανόνας 3). Άρα ένα σχήμα που περιγράφει λιγότερα πεδία από τον
 * πραγματικό τύπο **λέει ψέματα** — και μάλιστα σε πράκτορα που θα παρουσιάσει
 * τον αριθμό προς υπογραφή.
 *
 * Ο τύπος `Readonly<Record<keyof BOQItem, SchemaField>>` κάνει την πληρότητα
 * **υπόθεση του compiler**: νέο πεδίο στο `BOQItem` σπάει τη μεταγλώττιση εδώ.
 * Η λίστα `required` παράγεται από τα ίδια δεδομένα — δεν γράφεται δεύτερη φορά.
 * Ίδιο μοτίβο με το `BOQ_STATUS_RANK` (`types/boq/lifecycle.ts`).
 *
 * @module services/agent-capability/capabilities/boq/boq-value-schemas
 * @see ADR-734 §6.3, §7
 */

import type {
  BOQCategory,
  BOQCategorySummary,
  BOQItem,
  BOQSummary,
  BaselineDriftResult,
  CostBreakdown,
  VarianceResult,
} from '@/types/boq';
import { BOQ_SCOPE_VALUES, BOQ_STATUS_LIFECYCLE_ORDER } from '@/types/boq';
import type { BOQStats } from '@/services/measurements/contracts';
import {
  arraySchema,
  fieldsToObjectSchema,
  type JsonSchema,
  nullable,
  optionalField as opt,
  requiredField as req,
  type SchemaField,
} from '../../registry';

// ============================================================================
// ΠΡΩΤΟΓΕΝΗ
// ============================================================================

const STR: JsonSchema = { type: 'string' };
const NUM: JsonSchema = { type: 'number' };
const BOOL: JsonSchema = { type: 'boolean' };
const STR_OR_NULL = nullable(STR);
const NUM_OR_NULL = nullable(NUM);
const BOOL_OR_NULL = nullable(BOOL);
const STR_ARRAY_OR_NULL = nullable(arraySchema(STR));

const STATUS_SCHEMA: JsonSchema = { type: 'string', enum: [...BOQ_STATUS_LIFECYCLE_ORDER] };
const SCOPE_SCHEMA: JsonSchema = { type: 'string', enum: [...BOQ_SCOPE_VALUES] };

/** Ελεύθερος χάρτης `propertyId → ποσοστό` — κλειδιά άγνωστα εκ των προτέρων. */
const NUMBER_MAP_OR_NULL: JsonSchema = nullable({ type: 'object' });

// ============================================================================
// BOQ ITEM
// ============================================================================

const BOQ_ITEM_FIELDS: Readonly<Record<keyof BOQItem, SchemaField>> = {
  id: req(STR),
  companyId: req({ ...STR, description: 'Tenant. Επιβεβαιώνεται server-side — δεν δηλώνεται ποτέ από τον πράκτορα.' }),
  projectId: req(STR),
  buildingId: req(STR),
  scope: req(SCOPE_SCHEMA),
  linkedFloorId: req(STR_OR_NULL),
  linkedUnitId: req(STR_OR_NULL),
  linkedUnitIds: req(STR_ARRAY_OR_NULL),
  costAllocationMethod: req({ type: 'string', enum: ['by_area', 'equal', 'custom'] }),
  customAllocations: req(NUMBER_MAP_OR_NULL),
  categoryCode: req({ ...STR, description: 'Κωδικός κατηγορίας ΑΤΟΕ (π.χ. OIK-2).' }),
  subCategoryCode: req(STR_OR_NULL),
  title: req(STR),
  description: req(STR_OR_NULL),
  unit: req({ ...STR, description: 'Μονάδα μέτρησης (m, m2, m3, kg, ton, pcs, …).' }),
  estimatedQuantity: req({ ...NUM, description: 'Καθαρή προϋπολογιστική ποσότητα (χωρίς φύρα).' }),
  actualQuantity: req({ ...NUM_OR_NULL, description: 'Πραγματική ποσότητα· null όσο δεν έχει καταχωρηθεί.' }),
  wasteFactor: req({ ...NUM, description: 'Συντελεστής φύρας (0.08 = 8%).' }),
  wastePolicy: req(STR),
  materialUnitCost: req(NUM),
  laborUnitCost: req(NUM),
  equipmentUnitCost: req(NUM),
  priceAuthority: req(STR),
  linkedPhaseId: req(STR_OR_NULL),
  linkedTaskId: req(STR_OR_NULL),
  linkedInvoiceId: req(STR_OR_NULL),
  linkedContractorId: req(STR_OR_NULL),
  source: req(STR),
  measurementMethod: req(STR),
  status: req({ ...STATUS_SCHEMA, description: 'Κύκλος ζωής έγκρισης (ISO 19650).' }),
  qaStatus: req(STR),
  notes: req(STR_OR_NULL),
  createdBy: req(STR_OR_NULL),
  approvedBy: req(STR_OR_NULL),
  createdAt: req(STR),
  updatedAt: req(STR),
  sourceType: opt(nullable({ type: 'string', enum: ['manual', 'bim-auto'] })),
  sourceEntityId: opt(STR_OR_NULL),
  sourceEntityType: opt(STR_OR_NULL),
  detached: opt(BOOL_OR_NULL),
  liveQuantity: opt({ ...NUM_OR_NULL, description: 'ADR-674 — ποσότητα του ζωντανού BIM μοντέλου.' }),
  liveQuantitySyncedAt: opt(STR_OR_NULL),
  parentBoqItemId: opt(STR_OR_NULL),
  isGroupParent: opt(BOOL_OR_NULL),
  layerIndex: opt(NUM_OR_NULL),
  materialId: opt(STR_OR_NULL),
};

export const BOQ_ITEM_SCHEMA = fieldsToObjectSchema(BOQ_ITEM_FIELDS, 'Γραμμή επιμέτρησης (ADR-175).');
export const BOQ_ITEM_ARRAY_SCHEMA = arraySchema(BOQ_ITEM_SCHEMA, 'Γραμμές επιμέτρησης.');

// ============================================================================
// ΥΠΟΛΟΓΙΖΟΜΕΝΑ (cost-engine — ποτέ αποθηκευμένα)
// ============================================================================

const COST_BREAKDOWN_FIELDS: Readonly<Record<keyof CostBreakdown, SchemaField>> = {
  netQuantity: req(NUM),
  grossQuantity: req({ ...NUM, description: 'net × (1 + wasteFactor).' }),
  materialCost: req(NUM),
  laborCost: req(NUM),
  equipmentCost: req(NUM),
  unitCost: req(NUM),
  totalCost: req(NUM),
  wasteFactorApplied: req(NUM),
  unit: req(STR),
};

export const COST_BREAKDOWN_SCHEMA = fieldsToObjectSchema(
  COST_BREAKDOWN_FIELDS,
  'Ανάλυση κόστους — υπολογίζεται at runtime, ποτέ αποθηκευμένη (ADR-175).',
);

const VARIANCE_FIELDS: Readonly<Record<keyof VarianceResult, SchemaField>> = {
  estimated: req(NUM),
  actual: req(NUM),
  delta: req({ ...NUM, description: 'actual − estimated.' }),
  percent: req({ ...NUM, description: 'delta / estimated × 100.' }),
  estimatedCost: req(NUM),
  actualCost: req(NUM),
  costDelta: req(NUM),
};

export const VARIANCE_SCHEMA = nullable(
  fieldsToObjectSchema(VARIANCE_FIELDS, 'Απόκλιση εκτίμησης vs πραγματικών. null όταν δεν υπάρχει actualQuantity.'),
);

const BASELINE_DRIFT_FIELDS: Readonly<Record<keyof BaselineDriftResult, SchemaField>> = {
  baseline: req({ ...NUM, description: 'Παγωμένη υπογεγραμμένη ποσότητα (estimatedQuantity).' }),
  live: req({ ...NUM, description: 'Τρέχουσα ποσότητα του ζωντανού BIM μοντέλου.' }),
  delta: req(NUM),
  percent: req(NUM),
  syncedAt: req(STR_OR_NULL),
};

export const BASELINE_DRIFT_SCHEMA = nullable(
  fieldsToObjectSchema(
    BASELINE_DRIFT_FIELDS,
    'ADR-674 — απόκλιση ζωντανού μοντέλου από το υπογεγραμμένο baseline. null = δεν παρακολουθείται ή δεν αποκλίνει.',
  ),
);

// ============================================================================
// ΑΘΡΟΙΣΤΙΚΑ & ΑΝΑΦΟΡΙΚΑ
// ============================================================================

const CATEGORY_SUMMARY_FIELDS: Readonly<Record<keyof BOQCategorySummary, SchemaField>> = {
  categoryCode: req(STR),
  categoryName: req(STR),
  itemCount: req(NUM),
  totalEstimatedCost: req(NUM),
  totalActualCost: req(NUM_OR_NULL),
};

const SUMMARY_FIELDS: Readonly<Record<keyof BOQSummary, SchemaField>> = {
  buildingId: req(STR),
  totalItems: req(NUM),
  totalEstimatedCost: req(NUM),
  totalActualCost: req(NUM_OR_NULL),
  categories: req(arraySchema(fieldsToObjectSchema(CATEGORY_SUMMARY_FIELDS))),
  lastUpdated: req({
    ...STR,
    description: 'Χρόνος υπολογισμού της σύνοψης — ΔΕΝ συμμετέχει στο inputsHash του φακέλου.',
  }),
};

export const BOQ_SUMMARY_SCHEMA = nullable(
  fieldsToObjectSchema(SUMMARY_FIELDS, 'Αθροιστική σύνοψη κτιρίου. null όταν το κτίριο δεν έχει γραμμές επιμέτρησης.'),
);

const STATS_FIELDS: Readonly<Record<keyof BOQStats, SchemaField>> = {
  total: req(NUM),
  draft: req(NUM),
  submitted: req(NUM),
  approved: req(NUM),
  certified: req(NUM),
  locked: req(NUM),
  totalEstimatedCost: req(NUM),
};

export const BOQ_STATS_SCHEMA = fieldsToObjectSchema(STATS_FIELDS, 'Πλήθη ανά κατάσταση + συνολικό εκτιμώμενο κόστος.');

const CATEGORY_FIELDS: Readonly<Record<keyof BOQCategory, SchemaField>> = {
  id: req(STR),
  companyId: req(STR),
  code: req({ ...STR, description: 'Κωδικός ΑΤΟΕ (π.χ. OIK-2).' }),
  nameEL: req(STR),
  nameEN: req(STR),
  description: req(STR_OR_NULL),
  level: req(STR),
  parentId: req(STR_OR_NULL),
  sortOrder: req(NUM),
  defaultWasteFactor: req(NUM),
  allowedUnits: req(arraySchema(STR)),
  isActive: req(BOOL),
  createdAt: req(STR),
  updatedAt: req(STR),
};

export const BOQ_CATEGORY_ARRAY_SCHEMA = arraySchema(
  fieldsToObjectSchema(CATEGORY_FIELDS, 'Κατηγορία ΑΤΟΕ — master data.'),
  'Οι κατηγορίες ΑΤΟΕ του πελάτη.',
);

// ============================================================================
// ΣΥΝΘΕΤΟ — item + κόστος
// ============================================================================

/**
 * Το `boq_get_item` επιστρέφει **δύο** αντικείμενα δίπλα-δίπλα αντί για ένωση
 * `BOQItem & CostBreakdown` (όπως έλεγε αρχικά το ADR §7): τα δύο συγκρούονται
 * σε `unit` και συγχέουν `wasteFactor` με `wasteFactorApplied`. Σύνθεση, όχι
 * μετασχηματισμός — κανένα από τα δύο δεν αλλοιώνεται (ADR-734 §6.3 κανόνας 3).
 */
export const BOQ_ITEM_WITH_COST_SCHEMA = fieldsToObjectSchema(
  {
    item: req(BOQ_ITEM_SCHEMA),
    cost: req(COST_BREAKDOWN_SCHEMA),
  },
  'Η γραμμή επιμέτρησης και η ανάλυση κόστους της.',
);
