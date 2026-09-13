/**
 * @module services/report-engine/builder-export-types
 * @enterprise ADR-268 Phase 3 — Export Type Definitions
 *
 * Shared types for builder PDF + Excel export.
 * Consumed by builder-pdf-exporter.ts and builder-excel-exporter.ts.
 */

import type {
  BuilderDomainId,
  DomainDefinition,
  BuilderQueryResponse,
  ReportBuilderFilter,
  GroupingResult,
  GroupedRow,
  BuilderChartType,
  FilterOperator,
  FieldDefinition,
} from '@/config/report-builder/report-builder-types';
import { nowISO } from '@/lib/date-local';

// ============================================================================
// Export Configuration Types
// ============================================================================

/** Watermark mode for PDF export */
export type WatermarkMode = 'none' | 'confidential' | 'confidential-user';

/** Export file format */
export type ExportFormat = 'pdf' | 'excel';

/** Export scope when cross-filter is active */
export type ExportScope = 'all' | 'filtered';

/** Parameters passed from UI to export functions */
export interface BuilderExportParams {
  domain: BuilderDomainId;
  domainDefinition: DomainDefinition;
  results: BuilderQueryResponse;
  columns: string[];
  filters: ReportBuilderFilter[];
  groupingResult: GroupingResult | null;
  filteredGroups: GroupedRow[] | null;
  grandTotals: Record<string, number>;
  chartImageDataUrl: string | null;
  activeChartType: BuilderChartType | null;
  format: ExportFormat;
  watermark: WatermarkMode;
  scope: ExportScope;
  userName: string;
}

// ============================================================================
// Operator Symbol Mapping (for PDF/Excel filter display)
// ============================================================================

export const OPERATOR_SYMBOLS: Record<FilterOperator, string> = {
  eq: '=',
  neq: '≠',
  contains: '~',
  starts_with: '~',
  gt: '>',
  gte: '≥',
  lt: '<',
  lte: '≤',
  between: '↔',
  before: '<',
  after: '>',
  in: '∈',
} as const;

// ============================================================================
// Helpers
// ============================================================================

/** Build human-readable filter summary: "Status = Πωλημένο · Τιμή > €50K" */
export function buildFiltersText(
  filters: ReportBuilderFilter[],
  domainDefinition: DomainDefinition,
): string {
  if (filters.length === 0) return 'Χωρίς φίλτρα';

  return filters
    .map((f) => {
      const field = domainDefinition.fields.find(
        (fd: FieldDefinition) => fd.key === f.fieldKey,
      );
      const label = field?.labelKey ?? f.fieldKey;
      const symbol = OPERATOR_SYMBOLS[f.operator];
      const val = Array.isArray(f.value) ? f.value.join(', ') : String(f.value);
      return `${label} ${symbol} ${val}`;
    })
    .join(' · ');
}

/**
 * **Ποιες στήλες ζήτησε ο χρήστης, με τον ορισμό τους — και με τη ΣΕΙΡΑ που τις ζήτησε.**
 *
 * ⚠️ Η σειρά είναι του `params.columns`, όχι του `domainDefinition.fields`: ο χρήστης
 * αναδιατάσσει στήλες και η εξαγωγή οφείλει να τον ακολουθεί. Γι' αυτό γίνεται `map` πάνω
 * στα **αιτήματα** και `find` στους ορισμούς — ποτέ το αντίστροφο.
 *
 * ⛔ Στήλη που δεν αντιστοιχεί σε πεδίο **πέφτει σιωπηλά**: το αποθηκευμένο layout μπορεί να
 * κρατά στήλη που καταργήθηκε από τον τομέα, και μια εξαγωγή που σκάει γι' αυτό είναι
 * χειρότερη από μια εξαγωγή με μία στήλη λιγότερη.
 *
 * 🧹 Ζούσε **ταυτόσημη** σε `builder-pdf-exporter.ts` και `builder-excel-exporter.ts`
 * (CHECK 3.28, 2026-09-12). Το σπίτι της είναι εδώ: και οι δύο εξαγωγείς εισάγουν ήδη από
 * αυτό το αρχείο, και η ερώτηση είναι για τις **παραμέτρους εξαγωγής**, όχι για τη μορφή.
 */
export function getFieldDefs(params: BuilderExportParams): FieldDefinition[] {
  return params.columns
    .map((key) => params.domainDefinition.fields.find((f) => f.key === key))
    .filter((f): f is FieldDefinition => f !== undefined);
}

/** Generate domain-aware filename: Nestor_Units_Report_2026-03-29.pdf */
export function buildExportFilename(
  domainId: BuilderDomainId,
  extension: 'pdf' | 'xlsx',
): string {
  const domainLabel = domainId.charAt(0).toUpperCase() + domainId.slice(1);
  const today = nowISO().slice(0, 10);
  // 🔶 ΤΟ ΠΡΟΘΕΜΑ ΜΕΝΕΙ «Nestor_», ΚΑΙ ΕΙΝΑΙ ΔΗΛΩΜΕΝΗ ΑΠΟΦΑΣΗ (ADR-857 §7 #15).
  //
  // Το `Nestor` είναι **παλιά γραφή** — αλλά αυτό το πρόθεμα **κατεβαίνει στον δίσκο του
  // πελάτη**. Μια δουλειά ταυτότητας δεν αλλάζει ονόματα παραδοτέων αρχείων «στον δρόμο»:
  // είναι απόφαση **προϊόντος**, όχι τεχνική συμμόρφωση — ίδιο σχήμα με το δημοσιευμένο
  // νομικό κείμενο του §7 #2.
  //
  // ⚠️ ΜΗΝ το «διορθώσεις» σε `Nestor App` ή `NestorApp` για να σιωπήσει η CHECK 3.81:
  // δηλώνεται στο `.product-identity.json`, και το `builder-export.test.ts` κατοχυρώνει
  // τη σύμβαση. Αν αλλάξει, αλλάζουν **μαζί** — και επειδή το ζήτησε άνθρωπος.
  return `Nestor_${domainLabel}_Report_${today}.${extension}`;
}
