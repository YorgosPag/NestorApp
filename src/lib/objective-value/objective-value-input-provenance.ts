/**
 * @fileoverview **Από πού ήρθε κάθε είσοδος του υπολογιστή** — η κλειστή ένωση των τεσσάρων σκελών του ADR-947 Δ2,
 * ως **παράγωγο** του προχείρου, της προσυμπλήρωσης και της θέσης. Καθαρές συναρτήσεις, χωρίς React.
 * @related `objective-value-prefill.ts` (η βάση σύγκρισης) · `components/objective-value/ObjectiveValueContent.tsx` (ο κάτοχος) ·
 *   `components/objective-value/ObjectiveValueProvenanceBadge.tsx` (το σήμα) · ADR-947 §5 Δ2 · Φ1β
 * @module lib/objective-value/objective-value-input-provenance
 *
 * 🔑 **Τέσσερα σκέλη, το καθένα δείχνει σε ΥΠΑΡΧΟΝ SSoT** — καμία δεύτερη κλίμακα προέλευσης:
 * 1. `property` — προσυμπληρώθηκε από το ακίνητο/αγγελία· φέρει `AttributeProvenance`.
 * 2. `openData` — τιμή ζώνης / ΣΕ από την πηγή· φέρει `OpenDataSourceId`.
 * 3. `assumption` — νόμιμη προεπιλογή· φέρει `ObjectiveValueAssumptionKind` (το ΕΝΑ λεξιλόγιο υποθέσεων).
 * 4. `user` — δική σας τιμή· όταν **παρακάμπτει** το σκέλος 1, φέρει την αρχική τιμή και την επαναφορά.
 *
 * 🔑 **Παράγωγο, ποτέ αποθηκευμένο** (ίδια φιλοσοφία με το αποτέλεσμα της μηχανής): η προέλευση βγαίνει από τη
 * σύγκριση προχείρου ↔ προσυμπλήρωσης σε κάθε απόδοση, άρα δεν μπορεί να μείνει πίσω από την τιμή.
 *
 * 🔑 **Ίση τιμή ≠ παράκαμψη** (Thomson Reuters · Figma): αν ο άνθρωπος ξαναγράψει την ίδια τιμή, το σήμα μένει
 * «από το ακίνητο». Η παράκαμψη είναι **διαφορά**, όχι χειρονομία.
 *
 * 🔑 **«Δική σας τιμή» μόνο όπου υπάρχει αντιπαράθεση** (ProConnect: σημαδεύεται το εισαγόμενο και το παρακαμφθέν,
 * όχι κάθε πληκτρολόγηση): χωρίς προσυμπλήρωση, όλες οι τιμές είναι του ανθρώπου — σήμα σε όλες θα ήταν θόρυβος. Η
 * τιμή ζώνης και ο ΣΕ το παίρνουν πάντα, γιατί έχουν **πάντα** εναλλακτική πηγή.
 *
 * 🔴 **Η προέλευση ΔΕΝ ταξιδεύει στη διεύθυνση** (ADR-947 Δ2): τη φτιάχνει οποιοσδήποτε. Ό,τι φτάνει με την
 * προσυμπλήρωση λογίζεται {@link PREFILL_PROVENANCE} — όλα τα πεδία της είναι σήμερα δηλώσεις. Ισχυρότερη προέλευση
 * (`measured`/`attested`, Φ5) φτάνει **μόνο** με αναφορά που λύνεται στον server, ποτέ ως ετικέτα στο URL.
 */

import type { OpenDataSourceId } from '@/config/open-data-sources';
import type { AttributeProvenance } from '@/lib/property/attribute-provenance';

import type { ObjectiveValueAssumptionKind } from './listing-objective-value';
import type { LevelDraft, ObjectiveValueDraft } from './objective-value-draft';
import type { AppliedFactor, ObjectiveValueResult } from './objective-value-types';

/** Η προέλευση όσων φέρνει η διεύθυνση — δήλωση αγγελιοδότη/ιδιοκτήτη, ποτέ κάτι ισχυρότερο (βλ. 🔴 πάνω). */
export const PREFILL_PROVENANCE: AttributeProvenance = 'declared';

/** Η πηγή της τιμής ζώνης και του ΣΕ. */
const ZONE_SOURCE: OpenDataSourceId = 'valueZones';

/** Τιμή εισόδου όπως την ξέρει το πρόχειρο — για το «άλλαξε από …». */
export type ObjectiveValueInputValue = string | number | boolean;

/** Η παράκαμψη μιας τιμής του ακινήτου: τι ήταν, και ποια αλλαγή στο πρόχειρο την επαναφέρει. */
export interface ObjectiveValueOverride {
  readonly original: ObjectiveValueInputValue;
  readonly revert: Partial<ObjectiveValueDraft>;
}

/**
 * Οι υποθέσεις που **συμβαίνουν** στον υπολογιστή — υποσύνολο του ΕΝΟΣ λεξιλογίου (`Extract`, ποτέ δεύτερη λίστα): η
 * οθόνη απαντά εξαντλητικά μόνο σε ό,τι μπορεί να δει.
 */
export type CalculatorAssumption = Extract<ObjectiveValueAssumptionKind, 'areaWithoutCommon' | 'parkingDefaultArea' | 'commercialityUnknown'>;

/** Η κλειστή ένωση των τεσσάρων σκελών (ADR-947 Δ2). */
export type ObjectiveValueInputSource =
  | { readonly kind: 'property'; readonly provenance: AttributeProvenance }
  | { readonly kind: 'openData'; readonly source: OpenDataSourceId }
  | { readonly kind: 'assumption'; readonly assumption: CalculatorAssumption }
  | { readonly kind: 'user'; readonly overrides: ObjectiveValueOverride | null };

/** Οι είσοδοι με σήμα — κλειστή λίστα· τα επίπεδα της κατοικίας έχουν δικό τους δείκτη. */
export type ObjectiveValueScalarInput =
  | 'form'
  | 'area'
  | 'frontage'
  | 'hasCentralHeating'
  | 'hasElevator'
  | 'permitDate'
  | 'areaIncludesCommon';

export type ObjectiveValueInputKey = ObjectiveValueScalarInput | 'zonePrice' | 'commercialityFactor' | 'levelFloor' | 'levelArea';

export interface ObjectiveValueLevelSources {
  readonly floor: ObjectiveValueInputSource | null;
  readonly area: ObjectiveValueInputSource | null;
}

/** Η προέλευση όλων των εισόδων· `null` = χωρίς σήμα (κενή τιμή, ή καμία αντιπαράθεση). */
export interface ObjectiveValueProvenance {
  readonly zonePrice: ObjectiveValueInputSource | null;
  readonly commercialityFactor: ObjectiveValueInputSource | null;
  readonly fields: Readonly<Record<ObjectiveValueScalarInput, ObjectiveValueInputSource | null>>;
  readonly levels: readonly ObjectiveValueLevelSources[];
  /** Η μία αλλαγή που επαναφέρει **όλες** τις παρακάμψεις — `null` όταν δεν υπάρχει καμία. */
  readonly revertAll: Partial<ObjectiveValueDraft> | null;
  /** Πόσες είσοδοι παρακάμπτουν τιμή του ακινήτου. */
  readonly overrideCount: number;
}

/** Τι ξέρει η θέση για τις δύο εισόδους που δεν ζουν στο πρόχειρο. */
export interface ObjectiveValueLocationFacts {
  /** Η τιμή ζώνης ήρθε από τα δεδομένα ζωνών (όχι χειροκίνητη). */
  readonly zonePriceFromSource: boolean;
  readonly zonePrice: number | null;
  /** Ο ΣΕ που δίνει η πηγή **και μετρά** για αυτό το ακίνητο — `null` αλλιώς. */
  readonly sourcedCommercialityFactor: number | null;
}

export interface ObjectiveValueProvenanceInput {
  readonly draft: ObjectiveValueDraft;
  /** Ό,τι εφάρμοσε η προσυμπλήρωση — η βάση σύγκρισης· `null` = ο υπολογιστής άνοιξε κενός. */
  readonly prefill: Partial<ObjectiveValueDraft> | null;
  readonly location: ObjectiveValueLocationFacts;
}

const FROM_PROPERTY: ObjectiveValueInputSource = { kind: 'property', provenance: PREFILL_PROVENANCE };
const FROM_ZONES: ObjectiveValueInputSource = { kind: 'openData', source: ZONE_SOURCE };
const USER_VALUE: ObjectiveValueInputSource = { kind: 'user', overrides: null };

function assumed(assumption: CalculatorAssumption): ObjectiveValueInputSource {
  return { kind: 'assumption', assumption };
}

/** Τιμή ↔ βάση (μη κενή): ίση ⇒ ακίνητο · διαφορετική ⇒ δική σας, με την αρχική και την επαναφορά. */
function compared(
  value: ObjectiveValueInputValue | null,
  base: ObjectiveValueInputValue,
  revert: Partial<ObjectiveValueDraft>,
): ObjectiveValueInputSource {
  return value === base ? FROM_PROPERTY : { kind: 'user', overrides: { original: base, revert } };
}

/** Η αλλαγή που ξαναγράφει **ένα** πεδίο — γενική ως προς το κλειδί, ώστε ο τύπος της τιμής να ακολουθεί το πεδίο. */
function patchOf<K extends ObjectiveValueScalarInput>(key: K, value: Partial<ObjectiveValueDraft>[K]): Partial<ObjectiveValueDraft> {
  const patch: Partial<ObjectiveValueDraft> = {};
  patch[key] = value;
  return patch;
}

/** Χωρίς βάση: υπόθεση όπου ο νόμος ορίζει προεπιλογή, αλλιώς «δική σας» μόνο όταν υπάρχει αντιπαράθεση. */
function unprefilled(key: ObjectiveValueScalarInput, draft: ObjectiveValueDraft, prefilled: boolean): ObjectiveValueInputSource | null {
  if (key === 'areaIncludesCommon' && draft.form === 'residence' && !draft.areaIncludesCommon) return assumed('areaWithoutCommon');
  if (key === 'area' && draft.form === 'parking' && draft.area === null) return assumed('parkingDefaultArea');
  if (!prefilled || draft[key] === null) return null;
  return USER_VALUE;
}

const SCALAR_INPUTS: readonly ObjectiveValueScalarInput[] = [
  'form',
  'area',
  'frontage',
  'hasCentralHeating',
  'hasElevator',
  'permitDate',
  'areaIncludesCommon',
];

/** Ποιες είσοδοι μετρούν για το έντυπο — μια παλιά τιμή κατοικίας δεν παίρνει σήμα όταν το ακίνητο έγινε αποθήκη. */
function scalarApplies(key: ObjectiveValueScalarInput, form: ObjectiveValueDraft['form']): boolean {
  if (key === 'form' || key === 'permitDate') return true;
  return key === 'area' ? form !== 'residence' : form === 'residence';
}

function scalarSource<K extends ObjectiveValueScalarInput>(
  key: K,
  draft: ObjectiveValueDraft,
  prefill: Partial<ObjectiveValueDraft> | null,
): ObjectiveValueInputSource | null {
  if (!scalarApplies(key, draft.form)) return null;
  const base = prefill?.[key];
  if (base === undefined || base === null) return unprefilled(key, draft, prefill !== null);
  return compared(draft[key], base, patchOf(key, base));
}

function withLevelField(level: LevelDraft, field: keyof LevelDraft, value: number): LevelDraft {
  return field === 'floor' ? { ...level, floor: value } : { ...level, area: value };
}

function levelFieldSource(
  field: keyof LevelDraft,
  index: number,
  draft: ObjectiveValueDraft,
  prefill: Partial<ObjectiveValueDraft> | null,
): ObjectiveValueInputSource | null {
  const base = prefill?.levels?.[index]?.[field] ?? null;
  const value = draft.levels[index]?.[field] ?? null;
  if (base === null) return prefill !== null && value !== null ? USER_VALUE : null;
  const revert = { levels: draft.levels.map((level, i) => (i === index ? withLevelField(level, field, base) : level)) };
  return compared(value, base, revert);
}

function levelSources(draft: ObjectiveValueDraft, prefill: Partial<ObjectiveValueDraft> | null): readonly ObjectiveValueLevelSources[] {
  if (draft.form !== 'residence') return [];
  return draft.levels.map((_, index) => ({
    floor: levelFieldSource('floor', index, draft, prefill),
    area: levelFieldSource('area', index, draft, prefill),
  }));
}

function zonePriceSource(location: ObjectiveValueLocationFacts): ObjectiveValueInputSource | null {
  if (location.zonePrice === null) return null;
  return location.zonePriceFromSource ? FROM_ZONES : USER_VALUE;
}

function commercialitySource(draft: ObjectiveValueDraft, location: ObjectiveValueLocationFacts): ObjectiveValueInputSource | null {
  if (location.sourcedCommercialityFactor !== null) return FROM_ZONES;
  if (draft.commercialityAssumed) return assumed('commercialityUnknown');
  return draft.commercialityFactor === null ? null : USER_VALUE;
}

function overridesOf(sources: readonly (ObjectiveValueInputSource | null)[]): readonly ObjectiveValueOverride[] {
  return sources.flatMap((source) => (source?.kind === 'user' && source.overrides !== null ? [source.overrides] : []));
}

/**
 * «Επαναφορά όλων» — οι τιμές της βάσης για **κάθε** παρακαμφθέν πεδίο. Τα επίπεδα επανέρχονται ως **σύνολο** από τη
 * βάση: οι επιμέρους επαναφορές θα έγραφαν η καθεμία ολόκληρο τον πίνακα και η τελευταία θα έσβηνε τις άλλες.
 */
function revertAllOf(
  scalarOverrides: readonly ObjectiveValueOverride[],
  levelOverrides: number,
  prefill: Partial<ObjectiveValueDraft> | null,
): Partial<ObjectiveValueDraft> | null {
  if (scalarOverrides.length === 0 && levelOverrides === 0) return null;
  const merged = scalarOverrides.reduce<Partial<ObjectiveValueDraft>>((patch, override) => ({ ...patch, ...override.revert }), {});
  return levelOverrides > 0 && prefill?.levels !== undefined ? { ...merged, levels: prefill.levels } : merged;
}

/** **Η προέλευση όλων των εισόδων** — καλείται σε κάθε απόδοση (`useMemo`), ποτέ αποθηκευμένη. */
export function deriveInputProvenance({ draft, prefill, location }: ObjectiveValueProvenanceInput): ObjectiveValueProvenance {
  const fields: Record<ObjectiveValueScalarInput, ObjectiveValueInputSource | null> = {
    form: scalarSource('form', draft, prefill),
    area: scalarSource('area', draft, prefill),
    frontage: scalarSource('frontage', draft, prefill),
    hasCentralHeating: scalarSource('hasCentralHeating', draft, prefill),
    hasElevator: scalarSource('hasElevator', draft, prefill),
    permitDate: scalarSource('permitDate', draft, prefill),
    areaIncludesCommon: scalarSource('areaIncludesCommon', draft, prefill),
  };
  const levels = levelSources(draft, prefill);
  const scalarOverrides = overridesOf(SCALAR_INPUTS.map((key) => fields[key]));
  const levelOverrides = overridesOf(levels.flatMap((level) => [level.floor, level.area])).length;
  return {
    zonePrice: zonePriceSource(location),
    commercialityFactor: commercialitySource(draft, location),
    fields,
    levels,
    revertAll: revertAllOf(scalarOverrides, levelOverrides, prefill),
    overrideCount: scalarOverrides.length + levelOverrides,
  };
}

/**
 * **Σε ποιον συντελεστή της μηχανής μετρά κάθε είσοδος** — ολικός πίνακας: νέα είσοδος ⇒ ο μεταγλωττιστής ρωτά. Κενή
 * λίστα = η είσοδος δεν είναι συντελεστής (η τιμή ζώνης είναι η **βάση**· το είδος διαλέγει **έντυπο**).
 */
export const INPUT_FACTORS_OF: Readonly<Record<ObjectiveValueInputKey, readonly AppliedFactor['key'][]>> = {
  zonePrice: [],
  form: [],
  commercialityFactor: ['floor', 'position'],
  levelFloor: ['floor'],
  levelArea: ['area'],
  area: ['position'],
  frontage: ['frontage'],
  hasCentralHeating: ['centralHeating'],
  hasElevator: ['elevator'],
  permitDate: ['age'],
  areaIncludesCommon: ['mixedArea'],
};

/**
 * Τι λέει ο νόμος για αυτή την είσοδο **σε αυτόν τον υπολογισμό** — από την ανάλυση της μηχανής, ποτέ δεύτερη λίστα
 * άρθρων. `neutral` = μετρήθηκε αλλά ο συντελεστής βγήκε 1 (η μηχανή δεν τον καταγράφει) · `none` = δεν είναι
 * συντελεστής, ή δεν υπάρχει ακόμη ποσό.
 */
export type ObjectiveValueLawRef =
  | { readonly kind: 'applied'; readonly ref: string; readonly factor: number }
  | { readonly kind: 'neutral' }
  | { readonly kind: 'none' };

export function lawRefOf(key: ObjectiveValueInputKey, result: ObjectiveValueResult, level?: number): ObjectiveValueLawRef {
  const keys = INPUT_FACTORS_OF[key];
  if (keys.length === 0 || result.kind !== 'computed') return { kind: 'none' };
  const applied = result.factors.find(
    (factor) => keys.includes(factor.key) && (level === undefined || factor.level === undefined || factor.level === level),
  );
  return applied === undefined ? { kind: 'neutral' } : { kind: 'applied', ref: applied.ref, factor: applied.factor };
}
