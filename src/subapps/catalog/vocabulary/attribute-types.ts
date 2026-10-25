/**
 * =============================================================================
 * ΤΟ ΛΕΞΙΛΟΓΙΟ ΤΩΝ ΤΥΠΩΝ ΙΔΙΟΤΗΤΑΣ (ADR-923 §5.2) — ΡΙΖΑ, CHECK 3.73
 * =============================================================================
 *
 * **Κλειστό σύνολο.** Κάθε άλλη δήλωση που απαριθμεί τύπους ιδιότητας (zod schema,
 * χάρτης εικονιδίων, ετικέτες, επιτρεπτοί άξονες) **πρέπει** να είναι δεμένη εδώ
 * (`Record<AttributeType,…>` · `satisfies readonly AttributeType[]`), ώστε ένας νέος
 * τύπος να σπάει τη μεταγλώττιση αντί να εμφανιστεί στην οθόνη ως κενό.
 *
 * Σύνολο ευθυγραμμισμένο με τους μεγάλους PIM (Akeneo: text · textarea · number ·
 * metric · boolean · simpleselect · multiselect · date · asset · product_link · table):
 * το `identifier` του Akeneo **δεν** είναι τύπος εδώ — είναι η σημαία `unique` πάνω σε
 * `text`/`number`, ώστε να μη χρειάζεται δεύτερη ιδιότητα για «κωδικό».
 *
 * @module subapps/catalog/vocabulary/attribute-types
 */

export const ATTRIBUTE_TYPES = [
  'text',
  'richText',
  'number',
  'measurement',
  'boolean',
  'select',
  'multiSelect',
  'date',
  'asset',
  'reference',
  'table',
] as const;

export type AttributeType = (typeof ATTRIBUTE_TYPES)[number];

export function isAttributeType(value: unknown): value is AttributeType {
  return (ATTRIBUTE_TYPES as readonly unknown[]).includes(value);
}

/**
 * **Τύποι που μπορούν να είναι άξονας παραλλαγής** (Akeneo: simple select · boolean ·
 * metric). Ένας άξονας πρέπει να έχει **διακριτές, συγκρίσιμες** τιμές — το ελεύθερο
 * κείμενο θα γεννούσε «500L» και «500 L» ως δύο παραλλαγές.
 */
export const AXIS_ATTRIBUTE_TYPES = ['select', 'boolean', 'measurement'] as const satisfies readonly AttributeType[];

export type AxisAttributeType = (typeof AXIS_ATTRIBUTE_TYPES)[number];

/** Αριθμητικοί τύποι — οι μόνοι που συγκρίνουν οι κανόνες συνέπειας με `<`/`>`. */
export const NUMERIC_ATTRIBUTE_TYPES = ['number', 'measurement'] as const satisfies readonly AttributeType[];

export type NumericAttributeType = (typeof NUMERIC_ATTRIBUTE_TYPES)[number];

/** Τύποι που δέχονται τη σημαία `unique` (μοναδική τιμή στον κατάλογο). */
export const UNIQUE_CAPABLE_ATTRIBUTE_TYPES = ['text', 'number'] as const satisfies readonly AttributeType[];

/** Τύποι που μπορούν να έχουν τιμή **ανά γλώσσα** (`localizable`). */
export const LOCALIZABLE_ATTRIBUTE_TYPES = [
  'text',
  'richText',
  'asset',
] as const satisfies readonly AttributeType[];

export function isAxisAttributeType(type: AttributeType): type is AxisAttributeType {
  return (AXIS_ATTRIBUTE_TYPES as readonly AttributeType[]).includes(type);
}

export function isNumericAttributeType(type: AttributeType): type is NumericAttributeType {
  return (NUMERIC_ATTRIBUTE_TYPES as readonly AttributeType[]).includes(type);
}

export function isUniqueCapableAttributeType(type: AttributeType): boolean {
  return (UNIQUE_CAPABLE_ATTRIBUTE_TYPES as readonly AttributeType[]).includes(type);
}

export function isLocalizableAttributeType(type: AttributeType): boolean {
  return (LOCALIZABLE_ATTRIBUTE_TYPES as readonly AttributeType[]).includes(type);
}

// ── Υπο-λεξιλόγια ρυθμίσεων ανά τύπο ────────────────────────────────────────

/** Είδη αρχείου που δέχεται ιδιότητα `asset`. */
export const ASSET_KINDS = ['image', 'document', 'bim', 'video'] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

/**
 * Σχέση ιδιότητας `reference` (εξάρτημα · ανταλλακτικό · συμβατό · αντικαταστάτης ·
 * σχετικό) — η **σημασία** της αναφοράς, όχι μόνο ο στόχος της (Salsify/inRiver «link types»).
 */
export const REFERENCE_RELATIONS = ['accessory', 'sparePart', 'compatible', 'replacement', 'related'] as const;
export type ReferenceRelation = (typeof REFERENCE_RELATIONS)[number];

/**
 * Τύποι στήλης ιδιότητας `table` (π.χ. καμπύλη αντλίας: παροχή → μανομετρικό) — **υποσύνολο**
 * των τύπων ιδιότητας, δεμένο στη ρίζα: μια στήλη `measurement` σημαίνει **το ίδιο** με μια
 * ιδιότητα `measurement`. Η πρώτη στήλη είναι **στήλη-κλειδί** (μοναδική ανά γραμμή).
 */
export const TABLE_COLUMN_TYPES = ['select', 'text', 'number', 'measurement', 'boolean'] as const satisfies readonly AttributeType[];
export type TableColumnType = (typeof TABLE_COLUMN_TYPES)[number];

/** Τύποι που επιτρέπονται ως στήλη-κλειδί (η πρώτη) — διακριτές, συγκρίσιμες τιμές. */
export const TABLE_KEY_COLUMN_TYPES = ['select', 'text', 'number', 'measurement'] as const satisfies readonly TableColumnType[];
