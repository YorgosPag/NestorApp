/**
 * Τα **συμβόλαια** των αιτημάτων εισαγωγής που μοιράζονται οθόνη και διακομιστής (ADR-923 §5.5.1). Ο zod ζει στο
 * `schema/zod/catalog-import.schema.ts`.
 * @module subapps/catalog/types/catalog-import-requests
 */

import type { ViewFreshness } from '@/types/server-view';
import type { CatalogAttributeDefinition } from './attribute';
import type { ImportAssetView } from './catalog-media';
import type { CatalogWire } from './catalog-record';
import type {
  ImportBatchDefinition,
  ImportBatchTarget,
  ImportLabelMemoryDefinition,
  ImportSupplierMemoryDefinition,
  ImportLineDecision,
  ImportProfileDefinition,
  ImportProposalDefinition,
} from './catalog-import';
import type { HumanFieldDecision, ImportLineBindLevel, ImportLineRefusal, ImportSourceKind } from '../vocabulary/catalog-import';
import type { CatalogChannel } from '../vocabulary/channels';

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
  /** `null` = αναίρεση της απόφασης ανθρώπου, το πεδίο επιστρέφει στον κανόνα (§5.5.2 Β9α, `HumanFieldDecision`). */
  readonly decision: HumanFieldDecision;
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
  /**
   * §5.5.2 Β10: μαζί με `revert` — «φέρε ξανά ό,τι λέει η μνήμη τιμών» (επανάληψη μιας αναιρεμένης εφαρμογής μνήμης). Ο διακομιστής
   * αποφασίζει τι λέει η μνήμη· ο πελάτης δεν γράφει ποτέ ο ίδιος προέλευση.
   */
  readonly fallback?: 'memory';
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
  /** §5.5.2 Β10: πεδία που η μνήμη τιμών γέμισε (`apply`) ή άδειασε (`undo`). */
  readonly values: number;
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
  /** `suggested` = η εφαρμόσιμη με τις περισσότερες εγκρίσεις ανάμεσα σε ≥2 εφαρμόσιμες (`suggestedOptionIndex`): ξεχωρίζει, **δεν** εφαρμόζεται. */
  readonly options: readonly (ImportMemoryOption & { readonly usable: boolean; readonly suggested: boolean })[];
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
  /** §5.5.2 Β10: τι ξέρει η μνήμη τιμών για πεδία που έμειναν χωρίς τιμή. Απόν = τίποτα. */
  readonly values?: readonly ImportValueMemoryHint[];
  /** §5.5.2 Β10: πεδία εκκρεμών προτάσεων που γέμισε η μνήμη τιμών (για την «αναίρεση όλων»). */
  readonly valuesFromMemory: number;
}

/**
 * Τι ξέρει η **μνήμη τιμών** για ένα πεδίο εκκρεμούς πρότασης που **δεν** εφάρμοσε (§5.5.2 Β10): σύγκρουση (η οθόνη ρωτά, ποτέ «κερδίζει
 * ο συχνότερος»), ή απάντηση που δεν διαβάζεται πια (`usable: false`) ή που ο άνθρωπος αναίρεσε. Κάθε επιλογή είναι **κείμενο** που θα
 * περάσει από τον ίδιο κωδικοποιητή.
 */
export interface ImportValueMemoryHint {
  readonly proposalId: string;
  readonly rowKey: string;
  readonly targetKey: string;
  readonly memoryId: string;
  readonly verdict: 'apply' | 'conflict';
  /** `suggested` = η εφαρμόσιμη με τις περισσότερες εγκρίσεις ανάμεσα σε ≥2 εφαρμόσιμες (`suggestedOptionIndex`): ξεχωρίζει, **δεν** εφαρμόζεται. */
  readonly options: readonly { readonly text: string; readonly count: number; readonly lastBatchId: string; readonly usable: boolean; readonly suggested: boolean }[];
}

export type ImportLabelMemoryWire = CatalogWire<ImportLabelMemoryDefinition>;

/** Η μνήμη ενός προμηθευτή (§5.5.2 Β5.2): οι εγγραφές του, και αν κόπηκε στο όριο ανάγνωσης. */
/** §5.5.2 Β10: ό,τι ζει στη μνήμη ενός προμηθευτή — γραμμές **και** τιμές, μία συλλογή. */
export type ImportSupplierMemoryWire = CatalogWire<ImportSupplierMemoryDefinition>;

export interface LabelMemoryListView {
  readonly entries: readonly ImportSupplierMemoryWire[];
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
  /**
   * §5.5.2 Β3.1 Γ12: η **τρέχουσα** αναθεώρηση της οικογένειας της παρτίδας — ο πελάτης κρίνει μ' αυτήν ποιες σελίδες ξαναχτίζονται
   * (`stalePages`). `null` = παρτίδα χωρίς οικογένεια, ή οικογένεια που δεν υπάρχει πια.
   */
  readonly schemaRevision: number | null;
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
  /**
   * §5.5.2 Β9δ: μαζί με `decision: null` — η γραμμή επιστρέφει στην κρίση της **μνήμης** του προμηθευτή, όπως το `null` ενός πεδίου
   * στην κρίση του κανόνα. Ο client δεν δηλώνει ποτέ ποια ήταν η μνήμη: ο διακομιστής τη ρωτά ξανά (`memoryOverrideForLine`).
   */
  readonly fallback?: 'memory';
  /**
   * §5.5.2 Β3 Γ11: «Ναι, πρόσθεσέ την» — η ιδιότητα **δημιουργείται** και δένεται στην οικογένεια της παρτίδας (επίπεδο από το `bind`) σε
   * **μία** συναλλαγή της μηχανής σχήματος, και μετά η γραμμή αντιστοιχίζεται σε αυτήν. Μαζί του: `decision: null`, `bind` όχι `null`.
   */
  readonly create?: ImportLineAttributeCreate;
}

/** Η νέα ιδιότητα μιας γραμμής: ο ορισμός της βιβλιοθήκης και τα κανάλια όπου είναι υποχρεωτική στην οικογένεια. */
export interface ImportLineAttributeCreate {
  readonly definition: CatalogAttributeDefinition;
  readonly requiredChannels: readonly CatalogChannel[];
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
