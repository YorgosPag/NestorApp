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
import type { XChangeImportReport } from '../interop/etim/xchange-report';
import type { CatalogIssue } from '../schema/catalog-issues';
import type { AttributeValue, ChannelSlot, LocaleSlot, NoValueReason } from './product';
import type { ConsistencyViolation } from '../rules/evaluate-consistency';
import type { CatalogAssetRole } from '../vocabulary/asset-roles';
import type { EtimAttachmentType } from '../vocabulary/etim-attachments';
import type { PriceQuantity } from '../vocabulary/pricing';
import type { BRAND_FIELD, TradeIdentityField } from '../values/trade-identity';
import type {
  ImportBatchStatus,
  ImportDecisionSource,
  ImportFieldDecision,
  ImportFieldStatus,
  ImportIssueCode,
  ImportLineRefusal,
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
  /**
   * **Ρητή απουσία τιμής** (Δ5 · ETIM `ReasonNoValue` NA/UN, §23.2 K4): «δεν εφαρμόζεται» / «άγνωστο». Ανά **ιδιότητα**, όχι ανά
   * θέση κανάλι × γλώσσα — όπως το `noValueReasons` του φορέα. Το κείμενο του κελιού είναι ο κωδικός `NoValueReason`.
   */
  readonly noValueReason: { readonly attributeId: string };
  /**
   * **Πεδίο πλατφόρμας** της ταυτότητας εμπορίου (ADR-934 §5.1.7 · Σ1γ), όχι ιδιότητα: GTIN · MPN · «χωρίς GTIN» στο SKU, μάρκα στο
   * βάθος 0. Γράφεται **μόνο** με τις πράξεις του `values/trade-identity.ts`. Για το `noGtinReason` το κείμενο του κελιού είναι ο
   * κωδικός `NoValueReason`, όπως στο `noValueReason`.
   */
  readonly tradeIdentity: { readonly field: ImportTradeField };
}

/** Τα πεδία ταυτότητας που δέχεται η εισαγωγή: του SKU και η μάρκα. Από τα SSoT του `trade-identity`, όχι νέα λίστα. */
export type ImportTradeField = TradeIdentityField | typeof BRAND_FIELD;

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
  /**
   * Η μονάδα της πηγής, όταν το κείμενο είναι γυμνός αριθμός: δήλωση στήλης στο αρχείο, τυπωμένο σύμβολο στο PDF. Κωδικός ή
   * σύμβολο, τα καταλαβαίνει ο κωδικοποιητής. `null` σε μετρούμενη ιδιότητα = απόφαση ανθρώπου, ποτέ η προεπιλογή της ιδιότητας.
   */
  readonly unitCode: string | null;
  /** Ό,τι σήκωσε σημαία **πριν** από την τιμή (στοίχιση πίνακα). */
  readonly flags: readonly ImportIssue[];
  /**
   * Άλλα κελιά της πηγής που λένε **το ίδιο** για την ίδια ιδιότητα, σε άλλη μονάδα (1000 W · 3412 Btu/h), όπως τυπώθηκαν (§5.5.1 Ε7).
   * Επιβεβαίωση, όχι εύρημα: δεν ζητά απόφαση. Απούσα = κανένα.
   */
  readonly corroboratedBy?: readonly string[];
}

/**
 * Ένα μέσο όπως το λέει η πηγή, **πριν** κατέβει οτιδήποτε (ADR-934 §5.2 Μ1). Μία μορφή για κάθε πηγή: ο αναγνώστης
 * xChange και η στήλη URL του αρχείου γεμίζουν το ίδιο σχήμα, και από εκεί ένας δρόμος.
 * 🔑 Ένα μέσο **ανά αρχείο**: στο xChange ένας τύπος συνημμένου έχει πολλές λεπτομέρειες (π.χ. ένα PDF ανά γλώσσα).
 */
export interface ExtractedAsset {
  /** Κανονικό URI (`canonicalAssetUri`) — το πρώτο κλειδί ταυτότητας (Μ5). */
  readonly uri: string;
  readonly role: CatalogAssetRole;
  /** `AttachmentOrder` (≥ 1): η προτιμώμενη σειρά της πηγής. `null` = η πηγή δεν λέει (π.χ. `ItemAttachments`). */
  readonly order: number | null;
  readonly filename: string | null;
  /** Ετικέτες γλώσσας όπως τις γράφει η πηγή (`el-GR`). Κενό = η πηγή δεν δηλώνει γλώσσα. */
  readonly languages: readonly string[];
  /** ISO `YYYY-MM-DD`. */
  readonly issuedOn: string | null;
  /** ISO `YYYY-MM-DD` — λήξη πιστοποιητικού (Μ8). */
  readonly expiresOn: string | null;
  /** Ο κωδικός ETIM, όταν η πηγή είναι xChange: το ATX015 λέει «κύρια φωτογραφία», που είναι **χρήση**, όχι ρόλος. */
  readonly atx: EtimAttachmentType | null;
}

export interface ExtractedRow {
  /** Σταθερό μέσα στην πηγή: ο αναγνώστης της πρότασης και η αντιστοίχιση δεν εξαρτώνται από τη σειρά. */
  readonly rowKey: string;
  readonly cells: readonly ExtractedCell[];
  /** Μέσα επιπέδου SKU (στο xChange το `Product` είναι γραμμή). Απόν = κανένα. */
  readonly assets?: readonly ExtractedAsset[];
}

export interface ExtractedGroup {
  /** Το φυσικό κλειδί της πρότασης μέσα στην παρτίδα — ίδια πηγή ⇒ ίδια πρόταση. */
  readonly groupKey: string;
  /**
   * Ο σκοπός της πρότασης, όταν διαφέρει από της παρτίδας: η γραμμή τιμής ενός πίνακα PDF γίνεται πρόταση `priceLines` μέσα σε
   * παρτίδα ιδιοτήτων (§5.5.2 Β4). Απών = ο σκοπός της παρτίδας.
   */
  readonly purpose?: ImportPurpose;
  readonly modelCode: string | null;
  /** Κελιά επιπέδου μοντέλου (κοινά). */
  readonly sharedCells: readonly ExtractedCell[];
  readonly rows: readonly ExtractedRow[];
  /** Οι σελίδες του PDF απ' όπου προήλθε (κενό για αρχείο). */
  readonly pages: readonly number[];
  /** Μέσα επιπέδου μοντέλου (στήλη URL αρχείου με επίπεδο «μοντέλο», Μ1). Απόν = κανένα. */
  readonly assets?: readonly ExtractedAsset[];
}

// ── Η πρόταση ────────────────────────────────────────────────────────────────

/** Τιμή πεδίου τιμοκαταλόγου. */
export type ImportPriceValue =
  | { readonly type: 'money'; readonly minor: MinorAmount }
  | { readonly type: 'priceQuantity'; readonly quantity: PriceQuantity }
  | { readonly type: 'unit'; readonly unitCode: string }
  | { readonly type: 'discountGroup'; readonly discountGroupId: string | null };

/** Δήλωση ρητής απουσίας για μια ιδιότητα (στόχος `noValueReason`). */
export interface ImportNoValueReasonValue {
  readonly type: 'noValueReason';
  readonly reason: NoValueReason;
}

/**
 * Τιμή πεδίου ταυτότητας (GTIN · MPN · μάρκα), όπως θα γραφτεί στον ορισμό. Η ισότητα γίνεται **κατά κλειδί** (`tradeFieldKeyOf`):
 * το `4006381333931` και το `04006381333931` είναι το ίδιο GTIN.
 */
export interface ImportTradeTextValue {
  readonly type: 'tradeText';
  readonly text: string;
}

export type ImportFieldValue = AttributeValue | ImportPriceValue | ImportNoValueReasonValue | ImportTradeTextValue;

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
  /** §5.5.2 Α1: ποιος αποφάσισε. Απόν σε προτάσεις παλαιότερες της Φάσης 4β ⇒ `rule` (`decisionSourceOf`). */
  readonly decisionBy?: ImportDecisionSource;
  /** Το `ExtractedCell.corroboratedBy` του κελιού που κέρδισε: ο άνθρωπος βλέπει ότι η γραμμή Btu/h δεν χάθηκε. */
  readonly corroboratedBy?: readonly string[];
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
  | {
      readonly purpose: 'attributes';
      readonly familyId: string;
      readonly variantSchemeCode: string | null;
      readonly categoryIds: readonly string[];
      /**
       * Η **πρόχειρη** έκδοση τιμοκαταλόγου όπου πάει η τιμή της ίδιας ανάγνωσης (§5.5.2 Β4 Δ1). Ρύθμιση της παρτίδας, **όχι** μέρος
       * του κλειδιού της: αλλιώς ο ορισμός της θα γεννούσε νέα παρτίδα, άρα νέα πληρωμένη ανάγνωση. Απούσα/`null` = καμία.
       */
      readonly priceListVersionId?: string | null;
    }
  /** `identifierAttributeId`: η `unique` ιδιότητα στην οποία ανήκει ο κωδικός SKU του αρχείου. */
  | { readonly purpose: 'priceLines'; readonly priceListVersionId: string; readonly identifierAttributeId: string };

/** Ό,τι πληρώθηκε για την ανάγνωση. `costUsd: null` = το μοντέλο δεν έχει γραμμή στον πίνακα τιμών. */
export interface ImportPagesUsage {
  readonly requests: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly costUsd: number | null;
}

/** Ποια ερώτηση έγινε στο μοντέλο: αντιστοίχιση ανασυντεθειμένων πινάκων ή ανάγνωση με όραση. */
export type ImportPageRoute = 'table' | 'vision';

/** Μία απάντηση του μοντέλου, όπως ήρθε (§5.5.1 Ε6): εξηγεί μια αστοχία χωρίς νέα πληρωμένη κλήση. */
export interface ImportPageReadingDefinition {
  readonly batchId: string;
  readonly page: number;
  readonly route: ImportPageRoute;
  readonly attempt: number;
  readonly model: string;
  /** `null` = κενή απάντηση. */
  readonly rawText: string | null;
  readonly outcome: 'read' | 'failed';
  /** Η απάντηση απορρίφθηκε γιατί η εικόνα διέψευσε τη στρώση κειμένου. */
  readonly abandoned: boolean;
  readonly usage: ImportPagesUsage;
  /** Όσα ζητήθηκαν στην ανατροφοδότηση αυτής της ερώτησης. */
  readonly feedback: readonly string[];
  /** Τι ανασυντέθηκε από το PDF: η εξήγηση της ερώτησης, χωρίς ξανά άνοιγμα του αρχείου. */
  readonly tables: readonly { readonly key: string; readonly source: string; readonly witness: string; readonly rows: number; readonly columns: number }[];
}

/** Πίνακας της σελίδας που **δεν** έγινε πρόταση της οικογένειας (§5.5.1 Ε3). Δηλωμένος, ώστε να μη χαθεί σιωπηλά. */
export interface ImportPageSetAside {
  readonly page: number;
  readonly table: string;
  /** `unmapped` = έμοιαζε με πίνακα παραλλαγών, αλλά δεν αντιστοιχίστηκε. */
  readonly role: 'accessories' | 'other' | 'unmapped';
  readonly rows: number;
  /** Η πρώτη γραμμή του πίνακα, όπως τυπώνεται. */
  readonly label: string;
}

/**
 * Γραμμή πίνακα παραλλαγών που **δεν** έγινε πεδίο (§5.5.1 Ε7): η οικογένεια δεν έχει ιδιότητα που να της ταιριάζει, ή το μοντέλο δεν
 * έδειξε καμία. Δηλωμένη, ώστε να μη χαθεί σιωπηλά. Ό,τι μπήκε ως επιβεβαίωση (Btu/h) ή υποψήφιος κωδικός (Ε2) **δεν** είναι εδώ.
 */
export interface ImportPageUnmappedLine {
  readonly page: number;
  readonly table: string;
  /** Η θέση της γραμμής στον πίνακα: σταθερό κλειδί μέσα στη σελίδα. */
  readonly line: number;
  /** Οι ετικέτες της γραμμής όπως τυπώνονται, μαζί με τη μονάδα («ΠΑΡ.ΝΕΡΟΥ · ΥΨΗΛΗ (Η) · m³/h»). */
  readonly label: string;
  /** Οι τιμές της, στη σειρά της πηγής· ενωμένο κελί μετρά μία φορά. */
  readonly values: readonly string[];
  /** Τα κελιά της γραμμής στη σελίδα (ετικέτες + τιμές), για εστίαση στο PDF (§5.5.2 Β3). Απούσα σε παρτίδες παλαιότερες. */
  readonly regions?: readonly PageRegion[];
}

/** Η ανθρώπινη απόφαση για μια γραμμή πίνακα (§5.5.2 Β3 Γ1). Δείχνει **id** ιδιότητας: ο κωδικός μετονομάζεται. */
export type ImportLineDecision =
  | { readonly kind: 'attribute'; readonly attributeId: string }
  /**
   * Η γραμμή είναι η **τιμή** κάθε παραλλαγής (§5.5.2 Β4 Δ2), ανά `unitCode` (κωδικός του μητρώου μονάδων). Τη μονάδα τη δηλώνει ο
   * άνθρωπος: ο πίνακας του καταλόγου δεν την τυπώνει, και η νέα γραμμή τιμοκαταλόγου τη χρειάζεται.
   */
  | { readonly kind: 'price'; readonly unitCode: string }
  | { readonly kind: 'ignore' };

/**
 * Απόφαση γραμμής φυλαγμένη στην παρτίδα. Κλειδί `(page, table, line)`, όπως στη `ImportPageUnmappedLine`: η ανασύνθεση του πίνακα
 * είναι ντετερμινιστική, άρα η ίδια θέση είναι η ίδια γραμμή όσο δεν αλλάζει η ανασύνθεση (`tablesDrifted`).
 */
export interface ImportLineOverride {
  readonly page: number;
  readonly table: string;
  readonly line: number;
  readonly decision: ImportLineDecision;
  readonly by: string;
  readonly at: string;
}

/**
 * Σελίδα που διαβάστηκε **χωρίς στρώση κειμένου** (§5.5.1 Ε8). Δηλωμένη, ώστε οι τιμές της να μη φαίνονται απλώς «χωρίς επιβεβαίωση».
 * `absent` = η σελίδα δεν έχει κείμενο που εξάγεται: διαβάστηκε με όραση και καμία τιμή της δεν ελέγχεται απέναντι στο κείμενο.
 * `lost` = έχει κείμενο και η ανάγνωσή του απέτυχε: η σελίδα **δεν** στάλθηκε στο μοντέλο (τίποτα δεν πληρώθηκε) και ξαναδιαβάζεται.
 */
export interface ImportPageTextless {
  readonly page: number;
  readonly kind: 'absent' | 'lost';
  /** Το σφάλμα της ανάγνωσης όπως το είπε το pdf.js· `null` για `absent`. */
  readonly reason: string | null;
}

/**
 * Με ποια **έκδοση παραγωγής** (`IMPORT_PAGE_DERIVATION`) γράφτηκαν τα παράγωγα μιας σελίδας (§5.5.2 Β3.1). `refusal` = η αναβάθμιση
 * κρίθηκε και δεν μπόρεσε χωρίς νέα ανάγνωση: τα παλιά παράγωγα μένουν ως είχαν, ο λόγος φαίνεται, και δεν ξαναδοκιμάζεται.
 */
export interface ImportPageDerivation {
  readonly page: number;
  readonly version: number;
  readonly refusal: ImportLineRefusal | null;
}

/** Πρόοδος ανάγνωσης PDF, ανά σελίδα. Το `usage` λείπει από παρτίδες παλαιότερες της μέτρησης. */
export interface ImportBatchPages {
  readonly from: number;
  readonly to: number;
  readonly done: readonly number[];
  readonly failed: readonly number[];
  readonly usage?: ImportPagesUsage;
  readonly setAside?: readonly ImportPageSetAside[];
  /** Απούσα σε παρτίδες παλαιότερες της Ε7. */
  readonly unmappedLines?: readonly ImportPageUnmappedLine[];
  /** Απούσα σε παρτίδες παλαιότερες της Ε8. */
  readonly textless?: readonly ImportPageTextless[];
  /** Αποφάσεις ανθρώπου για γραμμές πινάκων (§5.5.2 Β3). Απούσα = καμία. */
  readonly lineOverrides?: readonly ImportLineOverride[];
  /** Σφραγίδες έκδοσης παραγωγής ανά σελίδα (§5.5.2 Β3.1). Απούσα σφραγίδα σελίδας = έκδοση 1. */
  readonly derivations?: readonly ImportPageDerivation[];
}

export interface ImportBatchDefinition {
  /** Το φυσικό κλειδί: δίνει και το id, άρα ίδια είσοδος ⇒ ίδια παρτίδα **δομικά**. */
  readonly code: string;
  readonly sourceKind: ImportSourceKind;
  readonly contentSha256: string;
  readonly fileName: string;
  readonly sizeBytes: number;
  /** Το `FileRecord` της πηγής. `null` πριν ολοκληρωθεί το ανέβασμα. */
  readonly fileId: string | null;
  /** Η παρτίδα που κατέχει το αρχείο, όταν ξαναχρησιμοποιείται αντίγραφο ίδιου περιεχομένου. `null`/απούσα = η ίδια. */
  readonly fileBatchId?: string | null;
  readonly target: ImportBatchTarget;
  /** Το προφίλ αντιστοίχισης και η έκδοσή του — μέρος του κλειδιού: διορθωμένο προφίλ ξαναπερνά. */
  readonly profileId: string | null;
  readonly profileRevision: number | null;
  /** Ρητή επανεκτέλεση: 0 η πρώτη. */
  readonly run: number;
  readonly status: ImportBatchStatus;
  readonly pages: ImportBatchPages | null;
  /** Τι μπήκε και τι όχι από αρχείο ETIM xChange: ό,τι μένει απέξω φαίνεται στον άνθρωπο, δεν χάνεται σιωπηλά. */
  readonly xchangeReport?: XChangeImportReport;
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
