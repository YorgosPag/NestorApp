/**
 * =============================================================================
 * ΕΚΔΟΣΗ ΚΑΤΑΛΟΓΟΥ — συνταγή και αποτέλεσμα (ADR-923 §5.6 · §5.6.1)
 * =============================================================================
 *
 * **Συνταγή** = δηλωτικό «τι βγαίνει» (`catalog_publication_recipes`): εύρος · τιμές · γλώσσα · θέμα · πρότυπα · προφίλ.
 * **Έκδοση** = ένα αμετάβλητο αποτέλεσμα (`catalog_publication_runs`) με ταυτότητα το hash των εισόδων της: ίδιες είσοδοι ⇒
 * το **ίδιο** έγγραφο, άρα το ίδιο αρχείο χωρίς νέα απόδοση.
 *
 * 🔑 **Εξατομικευμένος κατάλογος = η ίδια συνταγή με άλλο κοινό**: το κοινό είναι πεδίο, όχι δεύτερο σύστημα, και οι τιμές
 *    λύνονται **μόνο** στον διακομιστή (§12).
 * 🔑 **Το εύρος δεν υποθέτει «μόνο προϊόντα»** (§22): η επιλογή δείχνει σε ανοιχτή ένωση `kind`.
 * @module subapps/catalog/types/publication
 */

import type { HumanLanguage } from '@/i18n/languages';
import type { LocalizedText } from '@/i18n/localized-text';
import type { LayoutColour } from '../publishing/layout-model';
import type { PublicationFontCode } from '../publishing/publication-fonts';
import type {
  PublicationOptionalTemplate,
  PublicationOutputProfile,
  PublicationPaperSize,
  TableGroupStyle,
} from '../publishing/publication-vocabulary';
import type { CatalogWire } from './catalog-record';
import type { PriceAudience } from './price-list';

/** Ό,τι μπορεί να επιλεγεί χειροκίνητα. Νέο είδος καταχώρισης (§22) = νέο μέλος εδώ και νέο πρότυπο στον συνθέτη. */
export type PublicationSelectionEntry =
  | { readonly kind: 'productModel'; readonly id: string }
  | { readonly kind: 'product'; readonly id: string };

/** Μία ιδιότητα του φίλτρου: OR μέσα στην ομάδα. Αντικείμενο, γιατί η Firestore δεν αποθηκεύει πίνακα μέσα σε πίνακα. */
export interface PublicationFacetGroup {
  readonly keys: readonly string[];
}

/** Το φίλτρο της οθόνης προϊόντων, χωρίς ταξινόμηση: τη σειρά την ορίζει ο συνθέτης. `familyId: null` υπάρχει μόνο στο πρόχειρο. */
export interface PublicationFilter {
  readonly familyId: string | null;
  readonly facetGroups: readonly PublicationFacetGroup[];
}

export type PublicationScope =
  | { readonly kind: 'all' }
  | { readonly kind: 'categories'; readonly categoryIds: readonly string[] }
  | { readonly kind: 'selection'; readonly entries: readonly PublicationSelectionEntry[] }
  | { readonly kind: 'filter'; readonly filter: PublicationFilter };

/** `none` = τεχνικός κατάλογος χωρίς τιμές · `priced` = **δημοσιευμένη** έκδοση για ένα κοινό. */
export type PublicationPricing =
  | { readonly kind: 'none' }
  | { readonly kind: 'priced'; readonly priceListId: string; readonly priceListVersionId: string; readonly audience: PriceAudience };

export interface PublicationTheme {
  readonly fontCode: PublicationFontCode;
  /** Μέσο του χώρου με ρόλο `logo` και εικόνα που αποδίδεται (`isPublicationLogo`)· `null` = χωρίς. */
  readonly logoAssetId: string | null;
  readonly primary: LayoutColour;
  readonly accent: LayoutColour;
}

export interface PublicationTemplateSet {
  /** Τα προαιρετικά πρότυπα που μπαίνουν. Η σελίδα οικογένειας και το πλέγμα μπαίνουν πάντα. */
  readonly enabled: readonly PublicationOptionalTemplate[];
  readonly groupStyle: TableGroupStyle;
  readonly gridColumns: number;
}

export interface PublicationRecipeDefinition {
  readonly code: string;
  readonly labels: LocalizedText;
  /** Ο τίτλος του εξωφύλλου και των μεταδεδομένων του PDF. */
  readonly title: LocalizedText;
  readonly scope: PublicationScope;
  readonly pricing: PublicationPricing;
  readonly language: HumanLanguage;
  readonly theme: PublicationTheme;
  readonly templates: PublicationTemplateSet;
  readonly profiles: readonly PublicationOutputProfile[];
  readonly paper: PublicationPaperSize;
  /** Σύντομη σημείωση στο υποσέλιδο («Οι τιμές δεν περιλαμβάνουν ΦΠΑ»). */
  readonly footerNote: LocalizedText;
}

// ── Η έκδοση (αποτέλεσμα) ───────────────────────────────────────────────────

export const PUBLICATION_RUN_STATUSES = ['queued', 'running', 'ready', 'failed'] as const;
export type PublicationRunStatus = (typeof PUBLICATION_RUN_STATUSES)[number];

export const PUBLICATION_RUN_PHASES = ['queued', 'reading', 'composing', 'rendering', 'storing', 'done'] as const;
export type PublicationRunPhase = (typeof PUBLICATION_RUN_PHASES)[number];

/** Κλειστό σύνολο αιτιών: το UI τις μεταφράζει· κανένα ελεύθερο κείμενο μηχανής δεν φτάνει στον άνθρωπο. */
export const PUBLICATION_FAILURES = [
  'engineUnavailable',
  'engineFailed',
  'engineTimeout',
  'priceAmbiguous',
  'priceVersionUnpublished',
  'renditionMissing',
  'emptyScope',
  'storageFailed',
  'interrupted',
  'internal',
] as const;
export type PublicationFailure = (typeof PUBLICATION_FAILURES)[number];

export interface PublicationProgress {
  readonly phase: PublicationRunPhase;
  /** Λογικές σελίδες του μοντέλου που ετοιμάστηκαν. */
  readonly pagesDone: number;
  /** `0` όσο δεν έχουν μετρηθεί. */
  readonly pagesTotal: number;
}

export interface PublicationArtifact {
  readonly profile: PublicationOutputProfile;
  readonly storagePath: string;
  readonly sizeBytes: number;
  /** Οι **πραγματικές** σελίδες του PDF. */
  readonly pageCount: number;
  readonly sha256: string;
  readonly renderMs: number;
}

/** Ό,τι **δεν** μπήκε ή χρειάζεται προσοχή — η έκδοση το λέει, ποτέ σιωπηλή παράλειψη. */
export interface PublicationReport {
  /** SKU κάτω από την πληρότητα του καναλιού `print` (§5.2). */
  readonly incompleteSkuCount: number;
  /** SKU χωρίς γραμμή στην έκδοση ⇒ τυπώνεται «ζητήστε προσφορά». */
  readonly unpricedSkuCount: number;
  /** Επιλογές του εύρους `selection`, ή τιμές του εύρους `filter`, που διαγράφηκαν μετά την αποθήκευση της συνταγής. */
  readonly missingSelectionCount: number;
  /** Εικόνες κάτω από 300 dpi στο τυπωμένο μέγεθος. */
  readonly lowResolutionImageCount: number;
  /** Εικόνες που στο προφίλ εκτύπωσης δεν είναι CMYK. */
  readonly nonCmykImageCount: number;
  /** Πίνακες που η οικογένεια θέλει ανεστραμμένους, αλλά οι ιδιότητες δεν χώρεσαν και συνεχίστηκαν σε νέο μπλοκ. */
  readonly untransposedTableCount: number;
  /** `false` ⇒ ο έλεγχος διάταξης **δεν έγινε**, άρα τα τρία μηδενικά παρακάτω δεν σημαίνουν «καθαρό». */
  readonly layoutChecked: boolean;
  /** Κομμάτια κειμένου που πατούν άλλο κείμενο στο τελικό PDF. */
  readonly overlappingTextCount: number;
  /** Κομμάτια κειμένου που βγαίνουν από το κομμένο χαρτί. */
  readonly clippedTextCount: number;
  /** Κομμάτια κειμένου κάτω από το ελάχιστο μέγεθος. */
  readonly undersizedTextCount: number;
}

/** Τα πεδία της αναφοράς που είναι μετρητές: το `layoutChecked` λέει αν τα τρία τελευταία μετρήθηκαν. */
export type PublicationReportCount = Exclude<keyof PublicationReport, 'layoutChecked'>;

export type PublicationLayoutReport = Pick<PublicationReport, 'layoutChecked' | 'overlappingTextCount' | 'clippedTextCount' | 'undersizedTextCount'>;

export const UNCHECKED_PUBLICATION_LAYOUT: PublicationLayoutReport = { layoutChecked: false, overlappingTextCount: 0, clippedTextCount: 0, undersizedTextCount: 0 };

/** Δικαστική δέσμευση: υπερισχύει κάθε προθεσμίας, με όνομα και λόγο (ADR-864 §21). */
export interface PublicationLegalHold {
  readonly placedBy: string;
  readonly placedAt: string;
  readonly reason: string;
}

export const PUBLICATION_DISPOSAL_CAUSES = ['schedule', 'manual'] as const;
export type PublicationDisposalCause = (typeof PUBLICATION_DISPOSAL_CAUSES)[number];

/** Η απόδειξη διάθεσης: σβήνονται μόνο τα bytes, και μένει ποιος, πότε, γιατί και με ποιον κανόνα. */
export interface PublicationDisposal {
  readonly disposedAt: string;
  readonly disposedBy: string;
  readonly cause: PublicationDisposalCause;
  readonly ruleId: string;
}

/** Τα γεγονότα της διατήρησης. Η κρίση πάνω τους ζει στο `publication-retention.ts`. */
export interface PublicationRetention {
  readonly downloadCount: number;
  readonly firstDownloadedAt: string | null;
  /** Πότε βγήκε νεότερη έκδοση της ίδιας συνταγής ή διαγράφηκε η συνταγή. Εδώ ξεκινά το ρολόι. */
  readonly supersededAt: string | null;
  readonly legalHold: PublicationLegalHold | null;
  readonly disposal: PublicationDisposal | null;
}

export const EMPTY_PUBLICATION_RETENTION: PublicationRetention = {
  downloadCount: 0,
  firstDownloadedAt: null,
  supersededAt: null,
  legalHold: null,
  disposal: null,
};

export interface PublicationRunDefinition {
  readonly recipeId: string;
  readonly recipeRevision: number;
  /** Το κλειδί ιδεμποτίας: hash συνταγής + δεδομένων + τιμών + έκδοσης απόδοσης. */
  readonly inputHash: string;
  readonly audienceKey: string;
  /** `true` ⇒ η έκδοση περιέχει τιμές: και η λήψη της κρίνεται από `catalog:pricing:view` (§5.11 «3δ» Ζ). */
  readonly priced: boolean;
  /** Η έκδοση τιμών που τύπωσε: από αυτήν εξαρτάται πόσο ζει το PDF. `null` = τεχνικός κατάλογος. */
  readonly priceVersion: { readonly priceListId: string; readonly priceListVersionId: string } | null;
  readonly retention: PublicationRetention;
  /** Η νωρίτερη στιγμή διάθεσης, όπου ψάχνει η σάρωση· `null` = δεν τρέχει ρολόι. */
  readonly dispositionDueAt: string | null;
  readonly status: PublicationRunStatus;
  readonly progress: PublicationProgress;
  readonly artifacts: readonly PublicationArtifact[];
  readonly report: PublicationReport | null;
  readonly failure: PublicationFailure | null;
  readonly attempts: number;
  readonly requestedAt: string;
  readonly requestedBy: string;
  readonly finishedAt: string | null;
}

export const EMPTY_PUBLICATION_REPORT: PublicationReport = {
  incompleteSkuCount: 0,
  unpricedSkuCount: 0,
  missingSelectionCount: 0,
  lowResolutionImageCount: 0,
  nonCmykImageCount: 0,
  untransposedTableCount: 0,
  ...UNCHECKED_PUBLICATION_LAYOUT,
};

// ── Η μορφή του σύρματος (JSON) — ό,τι παραδίδει η όψη του εκδότη στον πελάτη ────────────────

/** Συνταγή όπως φτάνει στην οθόνη (χρονοσφραγίδες ISO). */
export type PublicationRecipeWire = CatalogWire<PublicationRecipeDefinition>;

/** Έκδοση όπως φτάνει στην οθόνη — ίδια με το `StoredPublicationRun` του διακομιστή (που δεν εισάγεται στον πελάτη: `server-only`). */
export type PublicationRunWire = PublicationRunDefinition & {
  readonly id: string;
  readonly companyId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

/** `GET /api/catalog/publications` — συνταγές + πρόσφατες εκδόσεις. */
export interface PublicationsViewWire {
  readonly recipes: readonly PublicationRecipeWire[];
  readonly runs: readonly PublicationRunWire[];
}

/** `POST /api/catalog/publication-preview` — μία σελίδα PNG, ή ότι δεν υπάρχει συνταγή, ή η αιτία που δεν βγήκε. */
export type PublicationPreviewWire =
  | { readonly status: 'ready'; readonly pngBase64: string }
  | { readonly status: 'noRecipe' }
  | { readonly status: 'unavailable'; readonly failure: PublicationFailure };
