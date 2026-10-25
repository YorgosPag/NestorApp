/**
 * =============================================================================
 * ΙΔΙΟΤΗΤΑ ΚΑΤΑΛΟΓΟΥ (Attribute) — ορισμός (ADR-923 §5.2)
 * =============================================================================
 *
 * Ορίζεται **μία φορά** ανά χώρο στη βιβλιοθήκη και χρησιμοποιείται από πολλές οικογένειες
 * (Akeneo attribute · Revit shared parameter). Το `type` ζει **στο ανώτερο επίπεδο** (για
 * ερωτήματα Firestore) και **στενεύει** το `config` — discriminated union, ώστε μια
 * ιδιότητα `measurement` να μην μπορεί ποτέ να κουβαλά `options` ενός `select`.
 *
 * 🔑 **Αμετάβλητα μετά τη δημιουργία**: `code`. **Αμετάβλητο όσο χρησιμοποιείται**: `type`
 * (Akeneo· η αλλαγή τύπου σε χρησιμοποιημένη ιδιότητα θα άφηνε ασύμβατες τιμές — νέα
 * ιδιότητα + μετάπτωση, ADR-923 §5.2 «Εξέλιξη σχήματος»).
 *
 * @module subapps/catalog/types/attribute
 */

import type { LocalizedText } from '@/i18n/localized-text';
import type {
  AssetKind,
  AttributeType,
  ReferenceRelation,
  TableColumnType,
} from '../vocabulary/attribute-types';

// ── Ρυθμίσεις ανά τύπο ───────────────────────────────────────────────────────

export interface TextAttributeConfig {
  readonly maxLength: number | null;
  /** Κανονική έκφραση (ECMAScript) που πρέπει να ταιριάζει ολόκληρη η τιμή. */
  readonly pattern: string | null;
}

export interface RichTextAttributeConfig {
  readonly maxLength: number | null;
}

export interface NumberAttributeConfig {
  readonly min: number | null;
  readonly max: number | null;
  readonly decimals: number;
  readonly negativeAllowed: boolean;
}

export interface MeasurementAttributeConfig extends NumberAttributeConfig {
  /** Κωδικός οικογένειας μέτρησης (πλατφόρμας ή χώρου). Τα min/max σε **μονάδα προβολής**. */
  readonly measurementFamilyCode: string;
  /** Η μονάδα που προτείνεται στην εισαγωγή και στην προβολή. */
  readonly defaultUnitCode: string;
}

export interface SelectOption {
  /** Αμετάβλητος κωδικός επιλογής — η ταυτότητα που διαβάζει η εισαγωγή. */
  readonly code: string;
  readonly labels: LocalizedText;
}

/** Η σειρά των επιλογών είναι η σειρά του πίνακα (δηλωμένη σειρά σε **ένα** έγγραφο). */
export interface SelectAttributeConfig {
  readonly options: readonly SelectOption[];
}

export interface MultiSelectAttributeConfig extends SelectAttributeConfig {
  readonly maxSelections: number | null;
}

export interface DateAttributeConfig {
  /** ISO 8601 ημερομηνία (YYYY-MM-DD) ή `null`. */
  readonly min: string | null;
  readonly max: string | null;
}

export interface AssetAttributeConfig {
  readonly assetKinds: readonly AssetKind[];
  readonly maxFiles: number;
}

export interface ReferenceAttributeConfig {
  readonly relation: ReferenceRelation;
  /** Περιορισμός στόχου σε οικογένειες (κωδικοί)· κενό = οποιοδήποτε προϊόν. */
  readonly targetFamilyCodes: readonly string[];
  readonly maxReferences: number | null;
}

interface TableColumnBase {
  readonly code: string;
  readonly labels: LocalizedText;
}

/** Τα επιπλέον πεδία κάθε τύπου στήλης — δεμένα στη ρίζα μέσω του `Record<TableColumnType,…>`. */
type TableColumnExtrasByType = Record<TableColumnType, object> & {
  readonly text: Readonly<Record<string, never>>;
  readonly boolean: Readonly<Record<string, never>>;
  readonly number: { readonly decimals: number };
  readonly measurement: {
    readonly measurementFamilyCode: string;
    readonly unitCode: string;
    readonly decimals: number;
  };
  readonly select: { readonly options: readonly SelectOption[] };
};

export type TableColumn = {
  [K in TableColumnType]: TableColumnBase & { readonly type: K } & TableColumnExtrasByType[K];
}[TableColumnType];

/** Η πρώτη στήλη είναι η **στήλη-κλειδί** (μοναδική ανά γραμμή). */
export interface TableAttributeConfig {
  readonly columns: readonly TableColumn[];
}

/** Χάρτης τύπος → ρύθμιση. Δεμένος στη ρίζα `AttributeType` (CHECK 3.73). */
export interface AttributeConfigByType {
  readonly text: TextAttributeConfig;
  readonly richText: RichTextAttributeConfig;
  readonly number: NumberAttributeConfig;
  readonly measurement: MeasurementAttributeConfig;
  readonly boolean: Readonly<Record<string, never>>;
  readonly select: SelectAttributeConfig;
  readonly multiSelect: MultiSelectAttributeConfig;
  readonly date: DateAttributeConfig;
  readonly asset: AssetAttributeConfig;
  readonly reference: ReferenceAttributeConfig;
  readonly table: TableAttributeConfig;
}

/** Εγγύηση μεταγλώττισης: ο χάρτης καλύπτει **ακριβώς** τους τύπους της ρίζας. */
type AssertExhaustive<T extends Record<AttributeType, unknown>> = T;
export type AttributeConfigMap = AssertExhaustive<AttributeConfigByType>;

export type TypedAttributeConfig = {
  [K in AttributeType]: { readonly type: K; readonly config: AttributeConfigMap[K] };
}[AttributeType];

// ── Αντιστοιχίσεις σε εξωτερικά λεξικά (ADR-923 §5.2 · §17) ─────────────────

export type PlatformTermBinding =
  | { readonly status: 'unbound' }
  | { readonly status: 'proposed'; readonly termId: string }
  | { readonly status: 'bound'; readonly termId: string };

export interface AttributeMappings {
  readonly etimFeature: string | null;
  readonly bsddUri: string | null;
  readonly ifc: { readonly pset: string; readonly property: string } | null;
  readonly atoeCode: string | null;
  /** Δέσμευση στο Κοινό Λεξικό Χαρακτηριστικών Πλατφόρμας — §17, γεμίζει σε επόμενη φάση. */
  readonly platformTerm: PlatformTermBinding;
}

// ── Ο ορισμός ────────────────────────────────────────────────────────────────

interface AttributeDefinitionBase {
  readonly code: string;
  readonly groupId: string;
  readonly labels: LocalizedText;
  readonly description: LocalizedText;
  /** Τιμή ανά γλώσσα (μόνο για τύπους του `LOCALIZABLE_ATTRIBUTE_TYPES`). */
  readonly localizable: boolean;
  /** Τιμή ανά κανάλι (π.χ. σύντομη περιγραφή μόνο για εκτύπωση). */
  readonly scopable: boolean;
  /** Μοναδική τιμή σε όλο τον κατάλογο (π.χ. κωδικός είδους). */
  readonly unique: boolean;
  /** Κλειδί σειράς μέσα στην ομάδα (fractional index). */
  readonly orderKey: string;
  readonly mappings: AttributeMappings;
}

export type CatalogAttributeDefinition = AttributeDefinitionBase & TypedAttributeConfig;

/**
 * Η αποθηκευμένη μορφή προσθέτει το **παράγωγο** `measurementFamilyCodes` (για `array-contains`: «ποιες
 * ιδιότητες χρησιμοποιούν αυτή την οικογένεια μέτρησης;» — η ίδια η ιδιότητα **ή** στήλη πίνακά της).
 * Το γράφει **μόνο** ο γραφέας από το `config`.
 */
export type StoredCatalogAttributeDefinition = CatalogAttributeDefinition & {
  readonly measurementFamilyCodes: readonly string[];
};

/** Οι οικογένειες μέτρησης που χρησιμοποιεί μια ιδιότητα (η ίδια ή στήλες πίνακα), χωρίς διπλότυπα. */
export function deriveAttributeMeasurementFamilyCodes(attribute: CatalogAttributeDefinition): string[] {
  if (attribute.type === 'measurement') return [attribute.config.measurementFamilyCode];
  if (attribute.type !== 'table') return [];
  const codes = attribute.config.columns.flatMap((column) =>
    column.type === 'measurement' ? [column.measurementFamilyCode] : [],
  );
  return [...new Set(codes)];
}

/** Ορισμός ιδιότητας συγκεκριμένου τύπου. */
export type CatalogAttributeOfType<K extends AttributeType> = AttributeDefinitionBase & {
  readonly type: K;
  readonly config: AttributeConfigMap[K];
};
