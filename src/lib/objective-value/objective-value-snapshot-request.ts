/**
 * @fileoverview **Τι στέλνει ο εκδότης για να παγώσει έναν υπολογισμό, και τι του απαντά ο server όταν αρνείται**
 * (ADR-947 Δ3 · Φ2). Ο ΕΝΑΣ πίνακας αρνήσεων ({@link OBJECTIVE_VALUE_SNAPSHOT_ERROR_CODES}) τον διαβάζουν η διαδρομή
 * (HTTP) **και** η οθόνη (κλειδί μηνύματος).
 * @related `objective-value-snapshot.ts` (το μοντέλο) · `services/objective-value/objective-value-snapshots.server.ts`
 * @module lib/objective-value/objective-value-snapshot-request
 *
 * 🔒 **Ο client ΔΕΝ στέλνει ποτέ**: ποσό, συντελεστές, προέλευση, τιμή ζώνης από τα δεδομένα, ημερομηνία αποτίμησης,
 *    ταυτότητα μηχανής ή προσόν. Όλα τα παράγει ο server — η θέση ξαναλύνεται σε ζώνη, η ημερομηνία είναι η σημερινή
 *    (κανένα στιγμιότυπο «με ημερομηνία στο παρελθόν»), το προσόν βγαίνει από τη δημοσιευμένη βιτρίνα.
 * 🔒 `.strict()` παντού: άγνωστο κλειδί ⇒ απόρριψη, ποτέ σιωπηλή αφαίρεση.
 *
 * **Layering**: leaf — σχήματα, σταθερές και ο μεταφραστής άρνησης σε `ApiError`· μηδέν I/O.
 */

import { z } from 'zod';

import type { IssuerQualification } from '@/config/document-validity/document-issuers';
import { ApiError } from '@/lib/api/api-error-types';
import { isDateKey } from '@/lib/calendar/date-key';

import type { ObjectiveValueDraft } from './objective-value-draft';
import {
  ANCILLARY_COMPLETIONS,
  CONSTRUCTION_KINDS,
  LEGAL_ENCUMBRANCES,
  OBJECTIVE_VALUE_FORMS,
  PARKING_POSITIONS,
  RESIDENCE_COMPLETIONS,
  RESIDENCE_FRONTAGES,
  STORAGE_POSITIONS,
  type ObjectiveValueMissing,
} from './objective-value-types';

/**
 * **Ποιος μπορεί να εκδώσει** — ADR-947 Δ9 (ΠΟΛ.1149/1994: βεβαιώσεις μηχανικού για τα στοιχεία εισόδου). ⏭️ Στη Φ3
 * μεταφέρεται στο `SERVICE_KIND_SPECS['objective-value-inputs']` (Δ4) και αυτή η σταθερά γίνεται ανάγνωσή του.
 */
export const OBJECTIVE_VALUE_ISSUER_QUALIFICATIONS = [
  'civil-engineer',
  'architect',
  'surveyor-engineer',
] as const satisfies readonly IssuerQualification[];

const MAX_SNAPSHOT_SUBJECT_LABEL_LENGTH = 200;
const MAX_LEVELS = 20;
const MAX_FRONT_KEY_LENGTH = 400;

const finite = z.number().finite();
const nonNegative = finite.nonnegative();

const levelSchema = z.object({ floor: finite.int().nullable(), area: nonNegative.nullable() }).strict();

/** Το πρόχειρο του υπολογιστή, **χωρίς** τιμή ζώνης: αυτή την ορίζει πάντα η ζώνη του αιτήματος. */
const draftSchema = z
  .object({
    form: z.enum(OBJECTIVE_VALUE_FORMS),
    levels: z.array(levelSchema).min(1).max(MAX_LEVELS),
    area: nonNegative.nullable(),
    storagePosition: z.enum(STORAGE_POSITIONS).nullable(),
    parkingPosition: z.enum(PARKING_POSITIONS).nullable(),
    frontage: z.enum(RESIDENCE_FRONTAGES).nullable(),
    hasCentralHeating: z.boolean().nullable(),
    hasElevator: z.boolean().nullable(),
    commercialityFactor: finite.positive().nullable(),
    commercialityAssumed: z.boolean(),
    permitDate: z.string().refine(isDateKey).nullable(),
    residenceCompletion: z.enum(RESIDENCE_COMPLETIONS).nullable(),
    ancillaryCompletion: z.enum(ANCILLARY_COMPLETIONS).nullable(),
    plotUtilisation: nonNegative.nullable(),
    construction: z.enum(CONSTRUCTION_KINDS),
    lightRoof: z.boolean(),
    thickWalls: z.boolean(),
    areaIncludesCommon: z.boolean(),
    coOwned: z.boolean(),
    encumbrance: z.enum(LEGAL_ENCUMBRANCES),
    ownershipPct: finite.gt(0).max(100).nullable(),
    damageRestorationCost: nonNegative.nullable(),
  })
  .strict();

const pointSchema = z.object({ lat: finite.min(-90).max(90), lng: finite.min(-180).max(180) }).strict();

const zoneRequestSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('valueZones'), point: pointSchema, frontKey: z.string().min(1).max(MAX_FRONT_KEY_LENGTH).nullable() }).strict(),
  z.object({ kind: z.literal('manual'), price: finite.positive() }).strict(),
]);

export const objectiveValueSnapshotBody = z
  .object({
    subject: z.object({ kind: z.literal('freeform'), label: z.string().trim().min(1).max(MAX_SNAPSHOT_SUBJECT_LABEL_LENGTH) }).strict(),
    draft: draftSchema,
    zone: zoneRequestSchema,
  })
  .strict();

export type ObjectiveValueSnapshotBody = z.infer<typeof objectiveValueSnapshotBody>;
export type ObjectiveValueSnapshotZoneRequest = z.infer<typeof zoneRequestSchema>;

/** Το πρόχειρο του αιτήματος ως πρόχειρο του υπολογιστή — η τιμή ζώνης μπαίνει πάντα από τη ζώνη. */
export function snapshotRequestDraft(draft: ObjectiveValueSnapshotBody['draft']): ObjectiveValueDraft {
  return { ...draft, zonePrice: null };
}

const OBJECTIVE_VALUE_SNAPSHOT_REFUSALS = [
  'absent',
  'unavailable',
  'professional-unavailable',
  'unqualified',
  'zone-unavailable',
  'zone-not-found',
  'front-not-candidate',
  'not-computed',
] as const;

export type ObjectiveValueSnapshotRefusal = (typeof OBJECTIVE_VALUE_SNAPSHOT_REFUSALS)[number];

/** Άρνηση → (HTTP, κωδικός). Οι κωδικοί είναι και τα κλειδιά μηνυμάτων της οθόνης. */
export const OBJECTIVE_VALUE_SNAPSHOT_ERROR_CODES: Readonly<Record<ObjectiveValueSnapshotRefusal, readonly [number, string]>> = {
  absent: [404, 'NOT_FOUND'],
  unavailable: [503, 'SNAPSHOTS_UNAVAILABLE'],
  'professional-unavailable': [422, 'PROFESSIONAL_UNAVAILABLE'],
  unqualified: [422, 'UNQUALIFIED'],
  'zone-unavailable': [503, 'VALUE_ZONES_UNAVAILABLE'],
  'zone-not-found': [422, 'ZONE_NOT_FOUND'],
  'front-not-candidate': [422, 'FRONT_NOT_CANDIDATE'],
  'not-computed': [422, 'NOT_COMPUTED'],
};

/**
 * Άρνηση → `ApiError` της διαδρομής (ο ΕΝΑΣ μεταφραστής για POST **και** GET). Το `missing` ταξιδεύει ως λεπτομέρεια:
 * η οθόνη λέει **τι** λείπει, με το λεξιλόγιο της μηχανής.
 */
export function objectiveValueSnapshotApiError(
  refusal: ObjectiveValueSnapshotRefusal,
  missing: readonly ObjectiveValueMissing[] | undefined,
): ApiError {
  const [status, code] = OBJECTIVE_VALUE_SNAPSHOT_ERROR_CODES[refusal];
  return new ApiError(status, `Objective value snapshot refused: ${refusal}`, code, missing === undefined ? undefined : { missing });
}
