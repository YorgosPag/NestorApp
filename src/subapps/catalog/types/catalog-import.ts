/**
 * =============================================================================
 * Ο ΑΓΩΓΟΣ ΕΙΣΑΓΩΓΗΣ — ορισμοί (ADR-923 §5.5 · §5.5.1)
 * =============================================================================
 *
 * ```
 * Πηγή (αρχείο · PDF · αργότερα σύνδεσμος §18 / ETIM xChange)
 *   └─► ExtractedGroup[]   ← η ΜΙΑ ουδέτερη μορφή: κάθε πηγή καταλήγει εδώ, μετά ο αγωγός δεν ξέρει από πού ήρθε
 *         └─► CatalogImportProposal  ← διαφορά ανά πεδίο απέναντι στα ζωντανά + ευρήματα
 *               └─► ανθρώπινη έγκριση ─► ΕΝΑΣ γραφέας (`commitAggregate` / γραμμές τιμοκαταλόγου)
 * ```
 *
 * 🔑 **Μία πρόταση = μία συναλλαγή**: όσα ανήκουν στο ίδιο σύνολο (μοντέλο + SKU) ή στο ίδιο τμήμα γραμμών. Η έγκριση
 * γράφει τα δεδομένα **και** το `applied` της πρότασης ατομικά, άρα η επανάληψη δεν ξαναγράφει τίποτα.
 * 🔑 **Κείμενο πρώτα**: κάθε πηγή δίνει **κείμενο**, και την τιμή τη βγάζει ο **ίδιος** κωδικοποιητής με το πλέγμα
 * παραλλαγών (`values/value-text-codec`). «2,5 kW» σημαίνει το ίδιο πληκτρολογημένο, επικολλημένο και διαβασμένο από PDF.
 * 🔑 **Κενό κελί = «δεν λέει τίποτα»**, ποτέ διαγραφή: η εισαγωγή δεν σβήνει ζωντανή τιμή.
 *
 * @module subapps/catalog/types/catalog-import
 */

import type { MinorAmount } from '@/lib/money/money';
import type { CatalogIssue } from '../schema/catalog-issues';
import type { AttributeValue, ChannelSlot, LocaleSlot } from './product';
import type { ConsistencyViolation } from '../rules/evaluate-consistency';
import type { PriceQuantity } from '../vocabulary/pricing';
import type {
  ImportBatchStatus,
  ImportFieldDecision,
  ImportFieldStatus,
  ImportIssueCode,
  ImportPriceField,
  ImportProposalStatus,
  ImportPurpose,
  ImportRowAction,
  ImportSourceKind,
} from '../vocabulary/catalog-import';

/** Εύρημα πεδίου ή γραμμής: του κριτή του καταλόγου ή της ίδιας της εισαγωγής. */
export type ImportIssue = CatalogIssue | (Omit<CatalogIssue, 'code'> & { readonly code: ImportIssueCode });

// ── Πού πάει μια τιμή ────────────────────────────────────────────────────────

/** Χάρτης είδος στόχου → στοιχεία. */
export interface ImportTargetByKind {
  /** Ο κωδικός του μοντέλου: η ομαδοποίηση γραμμών σε σύνολο. */
  readonly modelCode: Record<never, never>;
  /** Ιδιότητα σε συγκεκριμένη θέση. */
  readonly attribute: { readonly attributeId: string; readonly channel: ChannelSlot; readonly locale: LocaleSlot };
  /** Ο κωδικός SKU στη ροή «μόνο τιμές»: το κλειδί αντιστοίχισης με την παραλλαγή. */
  readonly skuIdentifier: Record<never, never>;
  readonly price: { readonly field: ImportPriceField };
}

export type ImportTarget = {
  [K in keyof ImportTargetByKind]: { readonly kind: K } & ImportTargetByKind[K];
}[keyof ImportTargetByKind];

// ── Άγκυρα πηγής: από πού ήρθε αυτή η τιμή ───────────────────────────────────

/** Περιοχή σελίδας σε κλάσματα 0..1, αρχή πάνω-αριστερά — ανεξάρτητη από ζουμ και ανάλυση. */
export interface PageRegion {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export type SourceAnchor =
  /** Κελί αρχείου: γραμμή και στήλη με βάση το 1, όπως τις βλέπει ο άνθρωπος. */
  | { readonly kind: 'cell'; readonly row: number; readonly column: number }
  /**
   * Σημείο PDF. `verified`: η AI έδειξε κομμάτι κειμένου της σελίδας που **όντως** λέει αυτή την τιμή. `null` = η
   * σελίδα δεν έχει στρώση κειμένου (σαρωμένη), άρα δεν μπορεί να διασταυρωθεί.
   */
  | { readonly kind: 'page'; readonly page: number; readonly regions: readonly PageRegion[]; readonly verified: boolean | null };

// ── Η ουδέτερη μορφή κάθε πηγής ──────────────────────────────────────────────

export interface ExtractedCell {
  readonly target: ImportTarget;
  /** Το κείμενο όπως βγήκε από την πηγή. `null` = κενό κελί. */
  readonly text: string | null;
  /** 1 για ντετερμινιστική πηγή (αρχείο)· η βεβαιότητα του μοντέλου για την AI. */
  readonly confidence: number;
  readonly anchor: SourceAnchor | null;
  /** Μονάδα της στήλης, όταν τα κελιά είναι γυμνοί αριθμοί. */
  readonly unitCode: string | null;
  /** Ό,τι σήκωσε σημαία **πριν** από την τιμή (στοίχιση πίνακα). */
  readonly flags: readonly ImportIssue[];
}

export interface ExtractedRow {
  /** Σταθερό μέσα στην πηγή: ο αναγνώστης της πρότασης και η αντιστοίχιση δεν εξαρτώνται από τη σειρά. */
  readonly rowKey: string;
  readonly cells: readonly ExtractedCell[];
}

export interface ExtractedGroup {
  /** Το φυσικό κλειδί της πρότασης μέσα στην παρτίδα — ίδια πηγή ⇒ ίδια πρόταση. */
  readonly groupKey: string;
  readonly modelCode: string | null;
  /** Κελιά επιπέδου μοντέλου (κοινά). */
  readonly sharedCells: readonly ExtractedCell[];
  readonly rows: readonly ExtractedRow[];
  /** Οι σελίδες του PDF απ' όπου προήλθε (κενό για αρχείο). */
  readonly pages: readonly number[];
}

// ── Η πρόταση ────────────────────────────────────────────────────────────────

/** Τιμή πεδίου τιμοκαταλόγου. */
export type ImportPriceValue =
  | { readonly type: 'money'; readonly minor: MinorAmount }
  | { readonly type: 'priceQuantity'; readonly quantity: PriceQuantity }
  | { readonly type: 'unit'; readonly unitCode: string }
  | { readonly type: 'discountGroup'; readonly discountGroupId: string | null };

export type ImportFieldValue = AttributeValue | ImportPriceValue;

export interface ImportProposalField {
  readonly target: ImportTarget;
  readonly sourceText: string;
  /** `null` = το κείμενο δεν διαβάστηκε (το `issues` λέει γιατί). */
  readonly incoming: ImportFieldValue | null;
  readonly live: ImportFieldValue | null;
  /** Η τιμή που είχε φέρει η προηγούμενη εισαγωγή: η βάση της σύγκρισης τριών σημείων. */
  readonly base: ImportFieldValue | null;
  readonly status: ImportFieldStatus;
  readonly confidence: number;
  readonly anchor: SourceAnchor | null;
  readonly issues: readonly ImportIssue[];
  readonly decision: ImportFieldDecision;
}

export interface ImportProposalRow {
  readonly rowKey: string;
  readonly holderKind: 'productModel' | 'product';
  /** `null` = νέος φορέας. */
  readonly holderId: string | null;
  /** Η αναθεώρηση πάνω στην οποία υπολογίστηκε η διαφορά· CAS στην έγκριση. `null` για νέο. */
  readonly expectedRevision: number | null;
  readonly action: ImportRowAction;
  /** Η ανθρώπινη ετικέτα της γραμμής (κωδικός SKU ή μοντέλου). */
  readonly label: string;
  readonly fields: readonly ImportProposalField[];
  readonly issues: readonly ImportIssue[];
}

export interface ImportProposalDefinition {
  readonly batchId: string;
  readonly groupKey: string;
  readonly purpose: ImportPurpose;
  readonly status: ImportProposalStatus;
  readonly familyId: string | null;
  readonly variantSchemeCode: string | null;
  readonly modelCode: string | null;
  /** Μόνο για `priceLines`: η έκδοση-στόχος. */
  readonly priceListVersionId: string | null;
  readonly pages: readonly number[];
  /** Η πηγή της πρότασης: ο επανυπολογισμός απέναντι στα ζωντανά **δεν** ξαναπληρώνει ανάγνωση. */
  readonly extracted: ExtractedGroup;
  readonly rows: readonly ImportProposalRow[];
  /** Οι κανόνες συνέπειας της οικογένειας, ΠΡΙΝ δει ο άνθρωπος την πρόταση (§21.3). */
  readonly violations: readonly ConsistencyViolation[];
  readonly appliedAt: string | null;
  readonly appliedBy: string | null;
}

// ── Η παρτίδα και το προφίλ ──────────────────────────────────────────────────

export type ImportBatchTarget =
  | { readonly purpose: 'attributes'; readonly familyId: string; readonly variantSchemeCode: string | null; readonly categoryIds: readonly string[] }
  /** `identifierAttributeId`: η `unique` ιδιότητα στην οποία ανήκει ο κωδικός SKU του αρχείου. */
  | { readonly purpose: 'priceLines'; readonly priceListVersionId: string; readonly identifierAttributeId: string };

/** Πρόοδος ανάγνωσης PDF, ανά σελίδα. */
export interface ImportBatchPages {
  readonly from: number;
  readonly to: number;
  readonly done: readonly number[];
  readonly failed: readonly number[];
}

export interface ImportBatchDefinition {
  /** Το φυσικό κλειδί: δίνει και το id, άρα ίδια είσοδος ⇒ ίδια παρτίδα **δομικά**. */
  readonly code: string;
  readonly sourceKind: ImportSourceKind;
  readonly contentSha256: string;
  readonly fileName: string;
  readonly sizeBytes: number;
  /** Το `FileRecord` της πηγής (κάτοχος: η παρτίδα). `null` πριν ολοκληρωθεί το ανέβασμα. */
  readonly fileId: string | null;
  readonly target: ImportBatchTarget;
  /** Το προφίλ αντιστοίχισης και η έκδοσή του — μέρος του κλειδιού: διορθωμένο προφίλ ξαναπερνά. */
  readonly profileId: string | null;
  readonly profileRevision: number | null;
  /** Ρητή επανεκτέλεση: 0 η πρώτη. */
  readonly run: number;
  readonly status: ImportBatchStatus;
  readonly pages: ImportBatchPages | null;
}

/** Μια στήλη του αρχείου → πού πάει. */
export interface ImportColumnRule {
  /** Η ετικέτα όπως στο αρχείο· σε αρχείο χωρίς επικεφαλίδα μένει κενή και μετρά η θέση. */
  readonly header: string;
  readonly position: number;
  /** `null` = η στήλη αγνοείται. */
  readonly target: ImportTarget | null;
  readonly unitCode: string | null;
}

export interface ImportProfileDefinition {
  readonly code: string;
  readonly label: string;
  readonly purpose: ImportPurpose;
  /** Ο προμηθευτής (επαφή) στον οποίο ανήκει· `null` = γενικό. */
  readonly supplierContactId: string | null;
  readonly familyId: string | null;
  readonly skipRows: number;
  readonly sheetIndex: number;
  readonly columns: readonly ImportColumnRule[];
}
