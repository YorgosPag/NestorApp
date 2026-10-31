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

export type PublicationScope =
  | { readonly kind: 'all' }
  | { readonly kind: 'categories'; readonly categoryIds: readonly string[] }
  | { readonly kind: 'selection'; readonly entries: readonly PublicationSelectionEntry[] };

/** `none` = τεχνικός κατάλογος χωρίς τιμές · `priced` = **δημοσιευμένη** έκδοση για ένα κοινό. */
export type PublicationPricing =
  | { readonly kind: 'none' }
  | { readonly kind: 'priced'; readonly priceListId: string; readonly priceListVersionId: string; readonly audience: PriceAudience };

export interface PublicationTheme {
  readonly fontCode: PublicationFontCode;
  /** Μέσο του χώρου (ρόλος λογότυπου)· `null` = χωρίς. */
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
  /** Εικόνες κάτω από 300 dpi στο τυπωμένο μέγεθος. */
  readonly lowResolutionImageCount: number;
  /** Εικόνες που στο προφίλ εκτύπωσης δεν είναι CMYK. */
  readonly nonCmykImageCount: number;
}

export interface PublicationRunDefinition {
  readonly recipeId: string;
  readonly recipeRevision: number;
  /** Το κλειδί ιδεμποτίας: hash συνταγής + δεδομένων + τιμών + έκδοσης απόδοσης. */
  readonly inputHash: string;
  readonly audienceKey: string;
  /** `true` ⇒ η έκδοση περιέχει τιμές: και η λήψη της κρίνεται από `catalog:pricing:view` (§5.11 «3δ» Ζ). */
  readonly priced: boolean;
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
  lowResolutionImageCount: 0,
  nonCmykImageCount: 0,
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
