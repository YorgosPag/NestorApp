/**
 * BOQ Service Contracts — Interfaces
 *
 * Repository και Service interfaces για το σύστημα επιμετρήσεων.
 * Pattern: src/services/obligations/contracts.ts
 *
 * @module services/measurements/contracts
 * @see ADR-175 (Quantity Surveying / BOQ)
 */

import type {
  BOQItem,
  BOQCategory,
  BOQSummary,
  BOQItemStatus,
  CreateBOQItemInput,
  UpdateBOQItemInput,
  BOQFilters,
} from '@/types/boq';

// ============================================================================
// SEARCH FILTERS
// ============================================================================

export type BOQSearchFilters = BOQFilters;

// ============================================================================
// STATISTICS
// ============================================================================

export interface BOQStats {
  total: number;
  draft: number;
  submitted: number;
  approved: number;
  certified: number;
  locked: number;
  totalEstimatedCost: number;
}

// ============================================================================
// ΚΟΙΝΗ ΕΠΙΦΑΝΕΙΑ — ΜΙΑ ΓΡΑΦΗ ΤΩΝ ΥΠΟΓΡΑΦΩΝ
// ============================================================================

/**
 * Οι έντεκα υπογραφές που `IBOQRepository` και `IBOQService` μοιράζονται **αυτούσιες**.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ΚΟΙΝΗ ΒΑΣΗ ΚΑΙ ΟΧΙ ΔΥΟ ΓΡΑΦΕΣ
 * ─────────────────────────────────────────────────────────────────────────────
 * Το service **προωθεί** αυτές τις μεθόδους στο repository με τα ίδια ορίσματα·
 * η επιχειρηματική λογική προστίθεται *πριν* την προώθηση, δεν αλλάζει την
 * υπογραφή. Δύο χειρόγραφα αντίγραφα των ίδιων υπογραφών είναι **δεύτερη πηγή
 * αλήθειας**: η προσθήκη του `companyId` (ADR-734 §7) απαίτησε την ίδια αλλαγή
 * σε 8 μεθόδους × 2 σημεία, και μια ξεχασμένη θα άφηνε το ένα στρώμα να δέχεται
 * tenant που το άλλο αγνοεί.
 *
 * Είναι η ίδια αρχή που εφαρμόζει ήδη το `boq-read-contract.ts`
 * (`Pick<IBOQService, …>` σκόπιμα, ΟΧΙ ξαναγραμμένες υπογραφές), και το CHECK
 * 3.28 το εντόπισε ως δομικό διπλότυπο 29 γραμμών.
 *
 * ⚠️ **Η βάση ορίζει το σχήμα, όχι τη συμπεριφορά.** Το κάθε στρώμα δηλώνει τι
 * επιπλέον εγγυάται (governance στο service, πρόσβαση στα δεδομένα στο
 * repository) στο δικό του docblock παρακάτω.
 */
interface IBOQItemAccess {
  /** Λήψη όλων των items ανά building (companyId required for tenant isolation) */
  getByBuilding(companyId: string, buildingId: string): Promise<BOQItem[]>;

  /** Λήψη όλων των items ανά project (aggregation across buildings, companyId required) */
  getByProject(companyId: string, projectId: string): Promise<BOQItem[]>;

  /**
   * Λήψη ενός item βάσει ID, **μέσα στον tenant του καλούντος**.
   *
   * ⚠️ Το `companyId` είναι υποχρεωτικό σε **κάθε** μέθοδο που διευθυνσιοδοτεί με
   * id. Μέχρι το ADR-734 §7 ήταν η μοναδική εξαίρεση, με τον έλεγχο ιδιοκτησίας
   * να ζει έξω από το service (`fetchOwnedBoqItem`) — δηλαδή κάλυπτε **μόνο** τη
   * διαδρομή του πράκτορα και κανέναν άλλο καλούντα.
   *
   * Γραμμή άλλου πελάτη επιστρέφει `null` — ίδιο αποτέλεσμα με «δεν υπάρχει»,
   * ώστε να μη λειτουργεί ως μαντείο ύπαρξης (`boq-tenant-ownership.ts`).
   */
  getById(companyId: string, id: string): Promise<BOQItem | null>;

  /** Δημιουργία νέου item */
  create(data: CreateBOQItemInput, userId: string, companyId: string): Promise<BOQItem>;

  /** Ενημέρωση item (tenant-scoped: ξένη γραμμή ⇒ `null`, καμία εγγραφή) */
  update(companyId: string, id: string, data: UpdateBOQItemInput): Promise<BOQItem | null>;

  /** Διαγραφή item (tenant-scoped: ξένη γραμμή ⇒ `false`, καμία εγγραφή) */
  delete(companyId: string, id: string): Promise<boolean>;

  /** Μαζική διαγραφή (tenant-scoped ανά γραμμή) */
  bulkDelete(companyId: string, ids: string[]): Promise<number>;

  /** Αντιγραφή item (tenant-scoped· το αντίγραφο μένει στον ίδιο tenant) */
  duplicate(companyId: string, id: string): Promise<BOQItem | null>;

  /** Αναζήτηση με φίλτρα (companyId required for tenant isolation) */
  search(companyId: string, buildingId: string, filters?: BOQSearchFilters): Promise<BOQItem[]>;

  /** Στατιστικά ανά building (companyId required for tenant isolation) */
  getStatistics(companyId: string, buildingId: string): Promise<BOQStats>;

  /** Λήψη κατηγοριών (ΑΤΟΕ) */
  getCategories(companyId: string): Promise<BOQCategory[]>;
}

// ============================================================================
// REPOSITORY INTERFACE — CRUD + QUERIES
// ============================================================================

/**
 * Πρόσβαση στα δεδομένα. Καμία επιχειρηματική εγγύηση πέρα από τον tenant: το
 * `delete()` εδώ σβήνει **οποιαδήποτε** δική μας γραμμή· ο κανόνας «μόνο draft»
 * ζει στο service.
 */
export interface IBOQRepository extends IBOQItemAccess {
  /** Αλλαγή status (tenant-scoped: ξένη γραμμή ⇒ `false`, καμία εγγραφή) */
  updateStatus(
    companyId: string,
    id: string,
    status: BOQItemStatus,
    userId: string
  ): Promise<boolean>;
}

// ============================================================================
// SERVICE INTERFACE — BUSINESS LOGIC + GOVERNANCE
// ============================================================================

/**
 * Ό,τι και το repository, **συν** τη διακυβέρνηση του ADR-175/ADR-329:
 * `update()` απορρίπτει locked/certified πεδία, `delete()`/`bulkDelete()` δέχονται
 * μόνο `draft`, και οι μεταβάσεις περνούν από τον πίνακα επιτρεπόμενων.
 *
 * Το `updateStatus()` **δεν** εκτίθεται εδώ σκόπιμα: η αλλαγή κατάστασης περνά
 * υποχρεωτικά από `transition()` ή `reopenToDraft()`, που ελέγχουν αν επιτρέπεται.
 */
export interface IBOQService extends IBOQItemAccess {
  /** Governance transition (draft→submitted→approved→certified→locked, tenant-scoped) */
  transition(
    companyId: string,
    id: string,
    targetStatus: BOQItemStatus,
    userId: string
  ): Promise<boolean>;

  /** Reopen to draft — unlocks scope fields for editing (ADR-329 §3.3.1, tenant-scoped) */
  reopenToDraft(companyId: string, id: string, userId: string): Promise<boolean>;

  /** Σύνοψη κτιρίου (αθροιστικά, companyId required) */
  getBuildingSummary(companyId: string, buildingId: string): Promise<BOQSummary | null>;
}
