/**
 * Τα **συμβόλαια** των αιτημάτων εισαγωγής που μοιράζονται οθόνη και διακομιστής (ADR-923 §5.5.1). Ο zod ζει στο
 * `schema/zod/catalog-import.schema.ts`.
 * @module subapps/catalog/types/catalog-import-requests
 */

import type { ViewFreshness } from '@/types/server-view';
import type { ImportAssetView } from './catalog-media';
import type { CatalogWire } from './catalog-record';
import type {
  ImportBatchDefinition,
  ImportBatchTarget,
  ImportLabelMemoryDefinition,
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

/** `POST …/imports/[id]/assets` (ADR-934 §5.2.2 Μ-β4): μία διεύθυνση **της παρτίδας**· `retry` = ρητή «Ξαναδοκιμή» αποτυχημένης. */
export interface FetchImportAssetRequest {
  readonly uri: string;
  readonly retry?: boolean;
}

/** `GET …/imports/[id]/assets` — η ουρά μέσων της παρτίδας. */
export interface ImportAssetsView {
  readonly assets: readonly ImportAssetView[];
}

export interface ImportFieldDecisionInput {
  readonly rowKey: string;
  readonly targetKey: string;
  readonly decision: Exclude<ImportFieldDecision, 'pending'>;
}

/**
 * Διόρθωση από τον άνθρωπο (§5.5.2 Β6): γράφεται στον **κατάλογο διορθώσεων** της πρότασης, όχι μέσα στην ανάγνωση, και ο ίδιος
 * αγωγός ξανακρίνει τα πάντα. `revert` = η διόρθωση φεύγει, ισχύει ξανά η πηγή.
 */
export interface ImportFieldEditInput {
  readonly rowKey: string;
  readonly targetKey: string;
  readonly text: string;
  readonly revert?: boolean;
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

/**
 * Η πρόχειρη έκδοση τιμοκαταλόγου μιας παρτίδας ιδιοτήτων (§5.5.2 Β4 Δ1). `null` = καμία. Αλλάζει **χωρίς** νέα ανάγνωση: οι εκκρεμείς
 * προτάσεις τιμών ξανασχεδιάζονται απέναντι στη νέα έκδοση.
 */
export interface SetImportPriceTargetRequest {
  readonly expectedRevision: number;
  readonly priceListVersionId: string | null;
}

/**
 * Ο προμηθευτής (επαφή) μιας παρτίδας ιδιοτήτων (§5.5.2 Β5 Απόφαση 1). `null` = κανένας. Αλλάζει **χωρίς** νέα ανάγνωση και **χωρίς**
 * εφαρμογή μνήμης στις σελίδες που διαβάστηκαν ήδη (Απόφαση 4): η μνήμη ισχύει από την επόμενη ανάγνωση και μαθαίνει στις εγκρίσεις.
 */
export interface SetImportSupplierRequest {
  readonly expectedRevision: number;
  readonly supplierContactId: string | null;
  /** §5.5.2 Β5.2: μαθαίνει η παρτίδα; Απόν = δεν αλλάζει. */
  readonly learnLabels?: boolean;
}

/**
 * Ρητή πράξη μνήμης σε υπάρχουσα παρτίδα (§5.5.2 Β5.2 · Απόφαση 4): `apply` = εφαρμογή της μνήμης σε γραμμές χωρίς απόφαση · `undo` =
 * αφαίρεση **όλων** των αποφάσεων που έβαλε η μνήμη. Και οι δύο ξαναχτίζουν τους πίνακες χωρίς AI. Κατάσταση με κλειδί ⇒ χωρίς CAS παρτίδας.
 */
export interface ImportMemoryActionRequest {
  readonly action: 'apply' | 'undo';
}

/** Πίνακας που η πράξη μνήμης δεν άγγιξε, με τον λόγο. */
export interface ImportMemoryTableRefusal {
  readonly page: number;
  readonly table: string;
  readonly reason: ImportLineRefusal;
}

export interface ImportMemoryActionOutcome {
  /** Αποφάσεις που μπήκαν (`apply`) ή βγήκαν (`undo`). */
  readonly lines: number;
  /** Πίνακες που ξαναχτίστηκαν. */
  readonly tables: number;
  readonly refused: readonly ImportMemoryTableRefusal[];
  /** Η εφαρμογή σταμάτησε στο όριο αποφάσεων γραμμής της παρτίδας (`IMPORT_MAX_LINE_OVERRIDES`). */
  readonly limitReached: boolean;
}

export interface ImportMemoryActionResult {
  readonly view: ImportBatchDetailView;
  readonly outcome: ImportMemoryActionOutcome;
}

/** Μία επιλογή του ιστορικού μνήμης, όπως τη δείχνει η οθόνη: απόφαση + πόσες εγκρίσεις τη στήριξαν. */
export interface ImportMemoryOption {
  readonly decision: ImportLineDecision;
  readonly count: number;
  readonly lastBatchId: string;
}

/**
 * Τι ξέρει η μνήμη για μια γραμμή χωρίς πεδίο **που δεν έχει ακόμη απόφαση** (§5.5.2 Β5.2). `apply` = μία απόφαση στο ιστορικό ·
 * `conflict` = περισσότερες (η οθόνη ρωτά, ποτέ «κερδίζει ο συχνότερος»). `usable: false` = η απόφαση δεν εφαρμόζεται εδώ (ιδιότητα
 * εκτός σχήματος, τιμή χωρίς τιμοκατάλογο): φαίνεται, δεν μετρά.
 */
export interface ImportMemoryHint {
  readonly page: number;
  readonly table: string;
  readonly line: number;
  readonly memoryId: string;
  readonly verdict: 'apply' | 'conflict';
  readonly options: readonly (ImportMemoryOption & { readonly usable: boolean })[];
}

/** Η μνήμη του προμηθευτή απέναντι στην παρτίδα: **μόνο ανάγνωση**, καμία εγγραφή (Απόφαση 4). */
export interface ImportMemoryHints {
  readonly hints: readonly ImportMemoryHint[];
  /** Γραμμές που η «Εφαρμογή μνήμης» θα αποφάσιζε τώρα. */
  readonly applicable: number;
  /** Γραμμές χωρίς ταυτότητα (παρτίδα παλαιότερη του Β5): η μνήμη δεν τις βλέπει πριν από ρητή «Εφαρμογή μνήμης». */
  readonly legacyLines: number;
  /** Αποφάσεις της παρτίδας που έβαλε η μνήμη (για την «αναίρεση όλων»). */
  readonly fromMemory: number;
}

export type ImportLabelMemoryWire = CatalogWire<ImportLabelMemoryDefinition>;

/** Η μνήμη ενός προμηθευτή (§5.5.2 Β5.2): οι εγγραφές του, και αν κόπηκε στο όριο ανάγνωσης. */
export interface LabelMemoryListView {
  readonly entries: readonly ImportLabelMemoryWire[];
  readonly truncated: boolean;
}

/** Άδειασμα της μνήμης ενός προμηθευτή (Akeneo: «clear all mapping memory»). */
export interface ClearLabelMemoryRequest {
  readonly supplierContactId: string;
}

export interface ClearLabelMemoryResult {
  readonly deleted: number;
}

export type ImportBatchWire = CatalogWire<ImportBatchDefinition>;
export type ImportProposalWire = CatalogWire<ImportProposalDefinition>;
export type ImportProfileWire = CatalogWire<ImportProfileDefinition>;

export interface ImportBatchDetailView {
  /** §5.5.2 (ADR-905): η αναθεώρηση του σήματος `importBatch:{id}` — ο πελάτης ξαναρωτά **μόνο** όταν το σήμα την ξεπεράσει. */
  readonly freshness: ViewFreshness;
  readonly batch: ImportBatchWire;
  readonly proposals: readonly ImportProposalWire[];
  /** §5.5.2 Β5.2: απούσα όταν η παρτίδα δεν έχει προμηθευτή. */
  readonly labelMemory?: ImportMemoryHints;
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

/** §5.5.2 Β7: μία νέα τιμή άξονα, όπως τη βλέπει και την αλλάζει ο άνθρωπος. Η ετικέτα πάει στη γλώσσα προεπιλογής. */
export interface ImportAxisOptionDraft {
  readonly code: string;
  readonly label: string;
}

/**
 * §5.5.2 Β7: νέες τιμές στον άξονα του πίνακα **και** δέσιμο της γραμμής που τις τυπώνει. Τη γραμμή τη βρίσκει ο διακομιστής, με
 * τον ίδιο κανόνα που θα διαβάσει ο αγωγός· ο πελάτης δεν τη δηλώνει. `expectedRevision` = της ιδιότητας (CAS του γραφέα ιδιοτήτων).
 */
export interface AddImportAxisOptionsRequest {
  readonly page: number;
  readonly table: string;
  readonly attributeId: string;
  readonly expectedRevision: number;
  readonly options: readonly ImportAxisOptionDraft[];
}

export interface SetImportLineResult {
  readonly view: ImportBatchDetailView;
  readonly outcome: ImportLineOutcome;
}
