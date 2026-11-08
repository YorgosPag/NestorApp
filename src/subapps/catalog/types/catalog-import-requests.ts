/**
 * Τα **συμβόλαια** των αιτημάτων εισαγωγής που μοιράζονται οθόνη και διακομιστής (ADR-923 §5.5.1). Ο zod ζει στο
 * `schema/zod/catalog-import.schema.ts`.
 * @module subapps/catalog/types/catalog-import-requests
 */

import type { CatalogWire } from './catalog-record';
import type {
  ImportBatchDefinition,
  ImportBatchTarget,
  ImportLineDecision,
  ImportProfileDefinition,
  ImportProposalDefinition,
} from './catalog-import';
import type { ImportFieldDecision, ImportLineBindLevel, ImportLineRefusal, ImportSourceKind } from '../vocabulary/catalog-import';

export interface CreateImportBatchRequest {
  readonly sourceKind: ImportSourceKind;
  readonly contentSha256: string;
  readonly fileName: string;
  readonly sizeBytes: number;
  readonly target: ImportBatchTarget;
  readonly profileId: string | null;
  readonly run: number;
  /** Το εύρος σελίδων ενός PDF (ένα κεφάλαιο). */
  readonly pageRange: { readonly from: number; readonly to: number } | null;
}

export interface AttachImportFileRequest {
  readonly expectedRevision: number;
  readonly fileId: string;
}

/** Η ανάγνωση μιας σελίδας: ιδεμπότητη, ο πελάτης οδηγεί την πρόοδο σελίδα-σελίδα και συνεχίζει μετά από διακοπή. */
export interface ReadImportPageRequest {
  readonly page: number;
}

export interface ImportFieldDecisionInput {
  readonly rowKey: string;
  readonly targetKey: string;
  readonly decision: Exclude<ImportFieldDecision, 'pending'>;
}

/** Διόρθωση από τον άνθρωπο: αλλάζει την **πηγή** της πρότασης, και ο ίδιος αγωγός ξανακρίνει τα πάντα. */
export interface ImportFieldEditInput {
  readonly rowKey: string;
  readonly targetKey: string;
  readonly text: string;
}

export interface UpdateImportProposalRequest {
  readonly expectedRevision: number;
  readonly decisions: readonly ImportFieldDecisionInput[];
  readonly edits: readonly ImportFieldEditInput[];
  /** Κωδικός μοντέλου όταν η πηγή δεν έδωσε. */
  readonly modelCode: string | null;
}

export interface ProposalActionRequest {
  readonly expectedRevision: number;
}

export type ImportBatchWire = CatalogWire<ImportBatchDefinition>;
export type ImportProposalWire = CatalogWire<ImportProposalDefinition>;
export type ImportProfileWire = CatalogWire<ImportProfileDefinition>;

export interface ImportBatchDetailView {
  readonly batch: ImportBatchWire;
  readonly proposals: readonly ImportProposalWire[];
}

/**
 * Απόφαση για γραμμή πίνακα (§5.5.2 Β3 Γ5). `decision: null` = αναίρεση. `bind` = η ιδιότητα μόλις γεννήθηκε στη βιβλιοθήκη από τη
 * γραμμή: ο διακομιστής τη δένει στην οικογένεια της παρτίδας, στο επίπεδο που διάλεξε ο άνθρωπος, πριν από την αντιστοίχιση.
 * Η απόφαση είναι κατάσταση με κλειδί, όχι αντικατάσταση εγγράφου: χωρίς CAS παρτίδας, η επανάληψη είναι ιδεμπότητη.
 */
export interface SetImportLineRequest {
  readonly page: number;
  readonly table: string;
  readonly line: number;
  readonly decision: ImportLineDecision | null;
  readonly bind: ImportLineBindLevel | null;
}

/** Τι έγινε: ξαναερμηνεύτηκε (ή δεν χρειαζόταν), ή αρνήθηκε **χωρίς** να γράψει τίποτα. */
export type ImportLineOutcome = { readonly kind: 'settled' } | { readonly kind: 'refused'; readonly reason: ImportLineRefusal };

export interface SetImportLineResult {
  readonly view: ImportBatchDetailView;
  readonly outcome: ImportLineOutcome;
}
