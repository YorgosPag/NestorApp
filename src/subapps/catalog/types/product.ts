/**
 * =============================================================================
 * ΜΟΝΤΕΛΑ, ΠΑΡΑΛΛΑΓΕΣ ΚΑΙ ΤΙΜΕΣ ΙΔΙΟΤΗΤΩΝ — ορισμοί (ADR-923 §5.10 Δ1–Δ5)
 * =============================================================================
 *
 * Δύο οντότητες (Akeneo product model ≠ product):
 *   - **μοντέλο** (`CatalogProductModelDefinition`): οι **κοινές** τιμές (ρίζα) ή οι τιμές
 *     του 1ου επιπέδου παραλλαγής (υπο-μοντέλο, `parentId` ≠ null)·
 *   - **προϊόν / SKU** (`CatalogProductDefinition`): οι τιμές του **τελευταίου** επιπέδου·
 *     απλό προϊόν χωρίς σχήμα παραλλαγών = `modelId: null` και κατέχει **όλες** τις τιμές.
 *
 * 🔑 **Αυστηρή κληρονομιά (Δ1)**: κάθε ιδιότητα έχει τιμή σε **ένα** επίπεδο, όπως λέει το
 * σχήμα παραλλαγών (Revit Type vs Instance). Καμία υπέρβαση (η Pimcore την επιτρέπει = δύο
 * αλήθειες). Ο απόγονος **διαβάζει** τις τιμές των προγόνων (`values/resolve-inherited.ts`).
 *
 * 🔑 **Σχήμα τιμής (Δ4)**: `values[attrId][channel|'*'][locale|'*'] = AttributeValue`. Το
 * `AttributeValue` είναι discriminated union **δεμένο** στη ρίζα `AttributeType` με το ίδιο
 * ιδίωμα του `AttributeConfigByType` — νέος τύπος ιδιότητας χωρίς μορφή τιμής σπάει τη μεταγλώττιση.
 *
 * 🔑 **Ποσά = κανονική δεκαδική συμβολοσειρά** (`"2.50"`), όχι `number` και όχι ό,τι
 * πληκτρολογήθηκε (`"2,50"`): κρατά την **ακρίβεια** του προμηθευτή (το «2,50» ≠ «2,5» σε τυπωμένο
 * κατάλογο), είναι **ανεξάρτητο γλώσσας** στην αποθήκευση (η αμφισημία «1.200» λύνεται **μία**
 * φορά, στην είσοδο, από τον **έναν** αναλυτή — `values/decimal-amount.ts`) και δεν υποφέρει από
 * θόρυβο κινητής υποδιαστολής. Ίδια επιλογή με το Akeneo (`amount: "2.5000"`).
 *
 * Τα **παράγωγα** (`amountStandard`, πληρότητα, facets) τα γράφει **μόνο** ο γραφέας (2β) —
 * δεν ανήκουν στον ορισμό.
 *
 * @module subapps/catalog/types/product
 */

import type { HumanLanguage } from '@/i18n/languages';
import type { AttributeType } from '../vocabulary/attribute-types';
import type { CatalogChannel } from '../vocabulary/channels';

// ── Μορφή τιμής ανά τύπο ιδιότητας ───────────────────────────────────────────

/** Κελί ιδιότητας-πίνακα: κείμενο/κωδικός επιλογής/κανονικό ποσό (string) ή ναι/όχι. */
export type TableCellValue = string | boolean;

/** Γραμμή ιδιότητας-πίνακα: κωδικός στήλης → κελί. Χάρτης, ΟΧΙ πίνακας (η Firestore απαγορεύει array-in-array). */
export type TableValueRow = Readonly<Record<string, TableCellValue>>;

/** Στόχος αναφοράς: προϊόν ή μοντέλο (Akeneo product links δείχνουν και στα δύο). */
export interface CatalogReferenceTarget {
  readonly kind: 'product' | 'productModel';
  readonly id: string;
}

/** Χάρτης τύπος → μορφή τιμής. Δεμένος στη ρίζα `AttributeType` (CHECK 3.73). */
export interface AttributeValueByType {
  readonly text: { readonly text: string };
  readonly richText: { readonly html: string };
  /** Κανονικό ποσό (`"1.60"`). */
  readonly number: { readonly amount: string };
  /** Κανονικό ποσό **στη μονάδα που έγραψε ο προμηθευτής** (ETIM: μονάδα από την πηγή). */
  readonly measurement: { readonly amount: string; readonly unitCode: string };
  readonly boolean: { readonly value: boolean };
  readonly select: { readonly optionCode: string };
  /** Η σειρά είναι η σειρά του προμηθευτή. */
  readonly multiSelect: { readonly optionCodes: readonly string[] };
  /** ISO 8601 ημερομηνία (YYYY-MM-DD). */
  readonly date: { readonly date: string };
  /** Id μέσων (`catalog_assets`)· η σειρά είναι η σειρά προβολής. */
  readonly asset: { readonly assetIds: readonly string[] };
  readonly reference: { readonly targets: readonly CatalogReferenceTarget[] };
  readonly table: { readonly rows: readonly TableValueRow[] };
}

/** Εγγύηση μεταγλώττισης: ο χάρτης καλύπτει **ακριβώς** τους τύπους της ρίζας. */
type AssertExhaustive<T extends Record<AttributeType, unknown>> = T;
type AttributeValueMap = AssertExhaustive<AttributeValueByType>;

export type AttributeValue = {
  [K in AttributeType]: { readonly type: K } & AttributeValueMap[K];
}[AttributeType];

export type AttributeValueOfType<K extends AttributeType> = Extract<AttributeValue, { readonly type: K }>;

// ── Θέσεις τιμής: κανάλι × γλώσσα ────────────────────────────────────────────

/** «Για κάθε κανάλι» / «για κάθε γλώσσα» — η θέση μιας τιμής που **δεν** είναι scopable/localizable. */
export const ANY_SLOT = '*' as const;
export type AnySlot = typeof ANY_SLOT;

export type ChannelSlot = CatalogChannel | AnySlot;
export type LocaleSlot = HumanLanguage | AnySlot;

/** Οι τιμές **μίας** ιδιότητας: `[channel|'*'][locale|'*']`. */
export type ValueSlots = Readonly<Partial<Record<ChannelSlot, Readonly<Partial<Record<LocaleSlot, AttributeValue>>>>>>;

/** Όλες οι τιμές ενός μοντέλου/προϊόντος: id ιδιότητας → θέσεις. */
export type ProductValues = Readonly<Record<string, ValueSlots>>;

// ── Ρητή απουσία τιμής (Δ5 · ETIM xChange `ReasonNoValue`) ───────────────────

/**
 * Γιατί μια ιδιότητα **δεν** έχει τιμή — δήλωση του προμηθευτή, όχι κενό:
 *   - `notApplicable` (ETIM NA): «δεν έχει νόημα γι' αυτό το προϊόν» ⇒ μετρά ως **πλήρες**·
 *   - `unknown` (ETIM UN): «υπάρχει αλλά δεν τη γνωρίζουμε ακόμη» ⇒ μετρά ως **ελλιπές**,
 *     αλλά ξεχωρίζει από το «ξεχάστηκε» στη λίστα εκκρεμοτήτων της πληρότητας.
 * Ανά **ιδιότητα** (όχι ανά γλώσσα): το «δεν εφαρμόζεται» είναι ιδιότητα του προϊόντος.
 */
export const NO_VALUE_REASONS = ['notApplicable', 'unknown'] as const;
export type NoValueReason = (typeof NO_VALUE_REASONS)[number];

/** id ιδιότητας → λόγος απουσίας. Ποτέ μαζί με τιμή για την ίδια ιδιότητα. */
export type NoValueReasons = Readonly<Record<string, NoValueReason>>;

// ── Οι ορισμοί ───────────────────────────────────────────────────────────────

/** Τα κοινά πεδία κάθε φορέα τιμών (μοντέλο, υπο-μοντέλο, προϊόν). */
export interface CatalogValueHolder {
  readonly values: ProductValues;
  readonly noValueReasons: NoValueReasons;
  /** Κατηγορίες· ο απόγονος κληρονομεί **και** προσθέτει (ένωση, Akeneo). */
  readonly categoryIds: readonly string[];
}

export interface CatalogProductModelDefinition extends CatalogValueHolder {
  /** Αμετάβλητος από τη δημιουργία· δίνει και το ντετερμινιστικό id (Δ3). */
  readonly code: string;
  readonly familyId: string;
  /** Αμετάβλητο: η αλλαγή σχήματος θα άλλαζε **ποιος** κατέχει κάθε τιμή. */
  readonly variantSchemeCode: string;
  /** `null` = ρίζα · id ρίζας = υπο-μοντέλο (μόνο σε σχήμα 2 επιπέδων). */
  readonly parentId: string | null;
}

export interface CatalogProductDefinition extends CatalogValueHolder {
  /** Το άμεσο μοντέλο-γονέας (ρίζα ή υπο-μοντέλο)· `null` = απλό προϊόν. */
  readonly modelId: string | null;
  /** Ίδια με του μοντέλου (επικυρώνεται)· κρατιέται εδώ για ερωτήματα `familyId ==`. */
  readonly familyId: string;
}

/** Το είδος ενός φορέα τιμών μέσα στην αλυσίδα κληρονομιάς. */
export type CatalogValueHolderKind = 'productModel' | 'product';
