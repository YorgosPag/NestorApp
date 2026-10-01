/**
 * @fileoverview **Οι δηλώσεις του αγγελιοδότη για την αντικειμενική αξία** — ό,τι η αγγελία δεν μπορεί να ξέρει
 * μόνη της (πρόσοψη, μικτά με κοινόχρηστους, ημερομηνία άδειας…) και η επιλογή απόκρυψης (ADR-898 Φ3β).
 * @related `listing-objective-value.ts` (ο αναγνώστης στον server) · `services/listings/public-listing-objective-value.ts`
 *   (η προβολή) · `services/owner-property/owner-property-declarations.service.ts` (ο γραφέας του ιδιώτη)
 * @module lib/objective-value/objective-value-declarations
 *
 * 🔑 **ΕΝΑ μπλοκ για ιδιώτη ΚΑΙ εταιρεία**: ο ίδιος τύπος, ο ίδιος αναγνώστης, η ίδια προβολή — και το ίδιο δικαίωμα
 * απόκρυψης για όλους (ADR-898 §12: η αγωγή κατά της Zillow ήρθε επειδή απόκρυψη είχαν μόνο επιλεγμένοι μεσίτες).
 *
 * 🔑 **`null` = «δεν απαντήθηκε», ποτέ «όχι»** — όπως στη μηχανή. Η μηχανή αποφασίζει τι λείπει.
 *
 * 🔑 **Η δήλωση καλύπτει ΜΟΝΟ το κενό** (ιεραρχία παραμέτρων τύπου Revit): θέρμανση και ανελκυστήρας έχουν γενικό
 * χαρακτηριστικό (`heatingType`, `amenities`) που **υπερισχύει**. Η δήλωση ναι/όχι υπάρχει επειδή ένα σύνολο
 * `amenities` με μόνο τον ανελκυστήρα θα δήλωνε ψευδώς «καμία άλλη παροχή» (ADR-842, τρεις καταστάσεις).
 *
 * 🔑 **Χωρίς δοχείο προέλευσης ανά πεδίο**: κάθε πεδίο έχει **μία** πηγή, τον αγγελιοδότη (ADR-842 §7.5 — προέλευση
 * σε πεδίο μίας πηγής είναι τελετουργία). Το «ποιος και πότε» το κρατά το ίχνος ελέγχου.
 */

import { z } from 'zod';

import { isDateKey } from '@/lib/calendar/date-key';

import { RESIDENCE_FRONTAGES, type ResidenceFrontage } from './objective-value-types';

/** Εμφάνιση στην αγγελία — εξ ορισμού `shown` (απόφαση Giorgio, ADR-898 §11.1). Η λίστα είναι η πηγή. */
export const OBJECTIVE_VALUE_DISPLAYS = ['shown', 'hidden'] as const;
export type ObjectiveValueDisplay = (typeof OBJECTIVE_VALUE_DISPLAYS)[number];

/**
 * **Πρόσοψη σε μέτωπο με δική του τιμή** (ADR-889 §10). Με το **όνομα του δρόμου**, όχι το `id` του μετώπου: τα
 * `id` αλλάζουν στις αναθεωρήσεις ζωνών. Δρόμος που δεν ταιριάζει πια ⇒ η ερώτηση ξαναγίνεται ανοιχτή.
 */
export type ZoneFrontDeclaration = { readonly kind: 'none' } | { readonly kind: 'street'; readonly street: string };

export const MAX_ZONE_FRONT_STREET_LENGTH = 200;

export interface ObjectiveValueDeclarations {
  readonly display: ObjectiveValueDisplay;
  readonly frontage: ResidenceFrontage | null;
  readonly zoneFront: ZoneFrontDeclaration | null;
  /** Το μικτό εμβαδόν της αγγελίας περιλαμβάνει κοινόχρηστους (άρθ. 2 §17 ⇒ × 0,90). */
  readonly areaIncludesCommon: boolean | null;
  /** `YYYY-MM-DD` — έκδοση ή τελευταία αναθεώρηση της οικοδομικής άδειας. */
  readonly permitDate: string | null;
  /** «Εγκατάσταση κεντρικής θέρμανσης» (άρθ. 3 §11) — μόνο όπου το `heatingType` δεν το κρίνει. */
  readonly hasCentralHeating: boolean | null;
  /** Μόνο όπου το `amenities` δεν απαντήθηκε. */
  readonly hasElevator: boolean | null;
}

/** Τα δηλώσιμα στοιχεία (χωρίς την εμφάνιση) — η λίστα είναι η πηγή· τη διαβάζει και η υπόθεση `declaredByLister`. */
export const OBJECTIVE_VALUE_DECLARED_FIELDS = [
  'frontage',
  'zoneFront',
  'areaIncludesCommon',
  'permitDate',
  'hasCentralHeating',
  'hasElevator',
] as const satisfies readonly (keyof ObjectiveValueDeclarations)[];
export type ObjectiveValueDeclaredField = (typeof OBJECTIVE_VALUE_DECLARED_FIELDS)[number];

export const UNDECLARED_OBJECTIVE_VALUE: ObjectiveValueDeclarations = {
  display: 'shown',
  frontage: null,
  zoneFront: null,
  areaIncludesCommon: null,
  permitDate: null,
  hasCentralHeating: null,
  hasElevator: null,
};

// ============================================================================
// ΑΝΑΓΝΩΣΗ — αυστηρή ανά πεδίο: άκυρη τιμή ⇒ `null` (ποτέ ρίψη, ποτέ «διόρθωση»)
// ============================================================================

function recordOf(raw: unknown): Readonly<Record<string, unknown>> {
  return typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

function booleanOrNull(raw: unknown): boolean | null {
  return typeof raw === 'boolean' ? raw : null;
}

function isZoneFrontStreet(raw: unknown): raw is string {
  return typeof raw === 'string' && raw.trim() === raw && raw.length > 0 && raw.length <= MAX_ZONE_FRONT_STREET_LENGTH;
}

function zoneFrontOf(raw: unknown): ZoneFrontDeclaration | null {
  const record = recordOf(raw);
  if (record.kind === 'none') return { kind: 'none' };
  return record.kind === 'street' && isZoneFrontStreet(record.street) ? { kind: 'street', street: record.street } : null;
}

/** Ό,τι είναι αποθηκευμένο (ή λείπει) → κανονικοποιημένο μπλοκ. Το σύνορο ανάγνωσης κάθε εγγράφου το καλεί. */
export function readObjectiveValueDeclarations(raw: unknown): ObjectiveValueDeclarations {
  const record = recordOf(raw);
  return {
    display: record.display === 'hidden' ? 'hidden' : 'shown',
    frontage: RESIDENCE_FRONTAGES.find((frontage) => frontage === record.frontage) ?? null,
    zoneFront: zoneFrontOf(record.zoneFront),
    areaIncludesCommon: booleanOrNull(record.areaIncludesCommon),
    permitDate: isDateKey(record.permitDate) ? record.permitDate : null,
    hasCentralHeating: booleanOrNull(record.hasCentralHeating),
    hasElevator: booleanOrNull(record.hasElevator),
  };
}

// ============================================================================
// ΔΙΟΡΘΩΣΗ — μερική: αλλάζουν ΜΟΝΟ τα κλειδιά που στάλθηκαν· ρητό `null` = «σβήσε την απάντηση»
// ============================================================================

const zoneFrontSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('none') }).strict(),
  z.object({ kind: z.literal('street'), street: z.string().refine(isZoneFrontStreet) }).strict(),
]);

/** Το σχήμα της διόρθωσης. `.strict()`: άγνωστο κλειδί ⇒ απόρριψη, ποτέ σιωπηλή αφαίρεση. */
export const objectiveValueDeclarationsPatchSchema = z
  .object({
    display: z.enum(OBJECTIVE_VALUE_DISPLAYS),
    frontage: z.enum(RESIDENCE_FRONTAGES).nullable(),
    zoneFront: zoneFrontSchema.nullable(),
    areaIncludesCommon: z.boolean().nullable(),
    permitDate: z.string().refine(isDateKey).nullable(),
    hasCentralHeating: z.boolean().nullable(),
    hasElevator: z.boolean().nullable(),
  })
  .partial()
  .strict()
  .refine((patch) => Object.keys(patch).length > 0);

export type ObjectiveValueDeclarationsPatch = z.infer<typeof objectiveValueDeclarationsPatchSchema>;

/**
 * Οι κωδικοί άρνησης (κλειδιά i18n στην οθόνη, N.11). `zoneFrontNotCandidate` το κρίνει ο γραφέας, γιατί θέλει
 * ανάγνωση των ζωνών (I/O) — εδώ ζει μόνο το λεξιλόγιο.
 */
export const OBJECTIVE_VALUE_PATCH_VIOLATIONS = ['permitDateInFuture', 'zoneFrontNotCandidate'] as const;
export type ObjectiveValuePatchViolation = (typeof OBJECTIVE_VALUE_PATCH_VIOLATIONS)[number];

export function isObjectiveValuePatchViolation(value: unknown): value is ObjectiveValuePatchViolation {
  return OBJECTIVE_VALUE_PATCH_VIOLATIONS.some((violation) => violation === value);
}

/** Κανόνες που θέλουν ρολόι — `today` = `YYYY-MM-DD` του καλούντος (ο server). */
export function objectiveValuePatchViolations(
  patch: ObjectiveValueDeclarationsPatch,
  today: string,
): readonly ObjectiveValuePatchViolation[] {
  // Τα κλειδιά `YYYY-MM-DD` συγκρίνονται λεξικογραφικά όπως χρονολογικά.
  return patch.permitDate != null && patch.permitDate > today ? ['permitDateInFuture'] : [];
}

export function applyObjectiveValuePatch(
  current: ObjectiveValueDeclarations,
  patch: ObjectiveValueDeclarationsPatch,
): ObjectiveValueDeclarations {
  return readObjectiveValueDeclarations({ ...current, ...patch });
}

// ============================================================================
// ΔΗΜΟΣΙΑ ΜΟΡΦΗ — κρυμμένη ⇒ ΚΑΝΕΝΑ στοιχείο υπολογισμού (ελαχιστοποίηση δεδομένων)
// ============================================================================

export type ListingObjectiveValueDeclared = Omit<ObjectiveValueDeclarations, 'display' | 'frontage'>;

/**
 * **Στη δημόσια αγγελία**: κρυμμένη ⇒ ούτε τα στοιχεία από τα οποία ξαναβγαίνει το ποσό. Η πρόσοψη ζει **έξω** από
 * αυτό (ορατό χαρακτηριστικό, `PublicListing.frontage`) και μένει ορατή και στην απόκρυψη.
 */
export type ListingObjectiveValueDeclarations =
  | { readonly display: 'hidden' }
  | { readonly display: 'shown'; readonly declared: ListingObjectiveValueDeclared };

export function listingObjectiveValueDeclarationsOf(
  declarations: ObjectiveValueDeclarations,
): ListingObjectiveValueDeclarations {
  if (declarations.display === 'hidden') return { display: 'hidden' };
  const { zoneFront, areaIncludesCommon, permitDate, hasCentralHeating, hasElevator } = declarations;
  return { display: 'shown', declared: { zoneFront, areaIncludesCommon, permitDate, hasCentralHeating, hasElevator } };
}

/**
 * **Ό,τι είναι αποθηκευμένο στη δημόσια αγγελία → η δημόσια μορφή** — ο ΕΝΑΣ αναγνώστης της (τον καλεί ο κρίκος 15
 * του σχήματος). Αυστηρός ανά πεδίο όπως ο αναγνώστης του εγγράφου· `hidden` μένει `hidden`, οτιδήποτε άλλο
 * διαβάζεται ως εμφάνιση εξ ορισμού. **Ιδιοδύναμος**: έγκυρη τιμή περνά αυτούσια.
 */
export function readListingObjectiveValueDeclarations(raw: unknown): ListingObjectiveValueDeclarations {
  const record = recordOf(raw);
  if (record.display === 'hidden') return { display: 'hidden' };
  return listingObjectiveValueDeclarationsOf(readObjectiveValueDeclarations({ ...recordOf(record.declared), display: 'shown' }));
}

/** **Η αγγελία για την οποία ο αγγελιοδότης δεν δήλωσε τίποτα** — ονομασμένη απουσία (ίδιο ιδίωμα με το `UNASKED_LISTING_ATTRIBUTES`). */
export const UNDECLARED_LISTING_OBJECTIVE_VALUE: ListingObjectiveValueDeclarations =
  listingObjectiveValueDeclarationsOf(UNDECLARED_OBJECTIVE_VALUE);

/** Τα στοιχεία που δηλώθηκαν (μη `null`), με τη σειρά της λίστας-πηγής. */
export function declaredFieldsOf(
  declarations: Partial<Pick<ObjectiveValueDeclarations, ObjectiveValueDeclaredField>>,
): readonly ObjectiveValueDeclaredField[] {
  return OBJECTIVE_VALUE_DECLARED_FIELDS.filter((field) => declarations[field] != null);
}
