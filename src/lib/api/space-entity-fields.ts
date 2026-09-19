/**
 * =============================================================================
 * SSoT: Building-space PATCH field mapping (pure)
 * =============================================================================
 *
 * The `body → updateData` translation shared by `/api/parking/[id]` and
 * `/api/storages/[id]`. Both routes hand-copied this block; it is now declared
 * once.
 *
 * Deliberately dependency-free and separate from `space-entity-route.ts`: that
 * module is `server-only` and pulls the Next/Firebase-Admin graph, which would
 * make this pure logic untestable in a plain jest environment.
 *
 * Semantics that MUST NOT drift (a Firestore write path that changes
 * `undefined` / `null` / `''` handling corrupts documents silently rather than
 * failing loudly):
 *  - `undefined` = «not provided» → the key is omitted, leaving the stored value alone.
 *  - explicit `null` or a blank string → written as `null` (Firestore-clean).
 *  - the display field (`number` / `name`) and `type` use a TRUTHY guard — a
 *    blank value is ignored rather than nulled.
 *  - `status` is NOT writable here (ADR-777 §8.60.20): it is the record lifecycle
 *    (`active` · `deleted`), owned by creation + the soft-delete engine (ADR-281).
 *
 * @module lib/api/space-entity-fields
 * @see ADR-696 space-entity route SSoT · ADR-233 Entity coding
 */

import { z } from 'zod';
import { SPACE_COMMERCIAL_UPDATE_FIELDS } from '@/lib/api/space-commercial-fields';
import {
  OPERATIONAL_STATUSES,
  normalizeOperationalStatus,
} from '@/constants/operational-statuses';
import { NEW_SPACE_STATUSES } from '@/lib/spaces/space-status-split';

/**
 * 🔒 **Το `status` ενός χώρου ΔΕΝ γράφεται από σώμα αιτήματος** (ADR-777 §8.60.20).
 *
 * Είναι ο κύκλος ζωής της εγγραφής — `active` στη γέννηση, `deleted` από τον κάδο (ADR-281).
 * Ως τις 2026-09-18 ήταν ανάμεικτο πεδίο και η γρήγορη επεξεργασία έγραφε εκεί «Πωλημένη»,
 * παρακάμπτοντας τη συναλλαγή. `z.undefined()` και όχι παράλειψη: με `.passthrough()` ένα
 * παραλειπόμενο πεδίο **περνά σιωπηλά** και απλώς αγνοείται — εδώ ο παλιός πελάτης παίρνει
 * **400** και το μαθαίνει.
 */
const RECORD_STATUS_NOT_WRITABLE = z.undefined();

/** Η λειτουργική κατάσταση — το **ίδιο** λεξιλόγιο με τα ακίνητα, ή `null` («δεν δηλώνεται»). */
const OPERATIONAL_STATUS_FIELD = z.enum(OPERATIONAL_STATUSES);

/** Human-facing identifier of the space — parking spots use `number`, storage units `name`. */
export type SpaceDisplayField = 'number' | 'name';

/**
 * Validation shape shared by every building-space PATCH body. Both routes
 * declared these nine fields verbatim; extend it with the entity-specific ones:
 *
 * ```ts
 * const UpdateStorageSchema = z.object({
 *   name: z.string().max(200).optional(),
 *   floorId: z.string().max(128).nullable().optional(),
 *   ...SPACE_COMMON_UPDATE_FIELDS,
 * }).passthrough();
 * ```
 *
 * `_v` is included here because SPEC-256A version checking applies to every
 * space mutation — omitting it on one route would silently disable optimistic
 * concurrency for that entity.
 */
export const SPACE_COMMON_UPDATE_FIELDS = {
  /** ADR-233: Entity coding system identifier */
  code: z.string().max(50).nullable().optional(),
  type: z.string().max(50).optional(),
  status: RECORD_STATUS_NOT_WRITABLE,
  operationalStatus: OPERATIONAL_STATUS_FIELD.nullable().optional(),
  floor: z.union([z.string().max(50), z.number()]).nullable().optional(),
  area: z.number().min(0).max(999_999).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  buildingId: z.string().max(128).nullable().optional(),
  /** ADR-777 §8.60.18 — διάθεση + τιμή ανά ρόλο· κρίνεται από το `mapSpaceCommercialFields`. */
  ...SPACE_COMMERCIAL_UPDATE_FIELDS,
  /** SPEC-256A: expected document version for the optimistic-concurrency check */
  _v: z.number().int().optional(),
} as const;

/**
 * Το ίδιο, για τη **ΔΗΜΙΟΥΡΓΙΑ** — και γιατί χρειάστηκε δεύτερο ζεύγος
 * (ADR-742 §7undecies · N.0.2)
 *
 * 🔴 Το ADR-696 ενοποίησε το **PATCH** των δύο χώρων (`parking/[id]`,
 * `storages/[id]`) και **σταμάτησε εκεί**. Το `POST` των `parking/route.ts` και
 * `storages/route.ts` έμεινε **δίδυμο**: το `jscpd` το χτύπησε ως δύο κλώνους
 * (84 + 99 tokens) τη στιγμή που η Ομάδα 6 άγγιξε και τα δύο αρχεία.
 *
 * Ακριβώς το σχήμα που προειδοποιεί ο N.18: *κεντρικοποιείς το Α και αφήνεις το
 * Β δίδυμο*. Η μισή κεντρικοποίηση είναι η πιο επικίνδυνη — μοιάζει τελειωμένη.
 *
 * ⚠️ **Τι ΔΕΝ μπήκε εδώ, επίτηδες**: το `projectId`. Το `storages` το διαβάζει
 * από το σώμα (`body.projectId?.trim()`), ενώ το `parking` το **έχει ήδη
 * επιλύσει** νωρίτερα (`resolvedProjectId`, με έλεγχο ιδιοκτησίας γονέα). Ίδιο
 * όνομα, **άλλη πηγή**. Εξομάλυνση θα άλλαζε σιωπηλά ποιο `projectId` γράφεται
 * — δηλαδή θα «ενοποιούσε» δύο διαφορετικές αποφάσεις. Ομοίως το `type`:
 * το `storages` το **επικυρώνει** με `isValidStorageType`, το `parking` όχι.
 *
 * 🔑 Το `status` και το `operationalStatus` **μπήκαν** εδώ (ADR-777 §8.60.20): είναι πλέον
 * ίδια απόφαση για τους δύο χώρους — βλ. `mapCommonSpaceCreateFields`.
 */
export const SPACE_COMMON_CREATE_FIELDS = {
  /** ADR-233: Entity coding system identifier */
  code: z.string().max(50).optional(),
  buildingId: z.string().max(128).optional(),
  projectId: z.string().max(128).optional(),
  type: z.string().max(50).optional(),
  status: RECORD_STATUS_NOT_WRITABLE,
  operationalStatus: OPERATIONAL_STATUS_FIELD.optional(),
  floor: z.string().max(50).optional(),
  area: z.number().min(0).max(999_999).optional(),
  description: z.string().max(2000).optional(),
  notes: z.string().max(5000).optional(),
} as const;

/**
 * Τα πεδία δημιουργίας που οι δύο χώροι γράφουν με **πανομοιότυπη** σημασιολογία.
 *
 * 🔑 **Κατάσταση στη γέννηση** (ADR-777 §8.60.20): `status` = `active` **πάντα** (κύκλος ζωής)·
 * `operationalStatus` = ό,τι δηλώθηκε, αλλιώς `DEFAULT_OPERATIONAL_STATUS` — ο ίδιος κανόνας με
 * τη γέννηση ακινήτου. Διάθεση **δεν** γράφεται: νέα μονάδα = εκτός αγοράς (§8.60.18).
 *
 * 🔴 Η σημασιολογία **δεν** είναι ομοιόμορφη και **δεν πρέπει** να γίνει:
 *
 * | πεδίο | φρουρός | γιατί |
 * |---|---|---|
 * | `floor`, `description`, `notes`, `code` | κενό μετά από `trim()` ⇒ **παραλείπεται** | κενή συμβολοσειρά δεν είναι τιμή |
 * | `area` | `> 0` | μηδενικό εμβαδόν δεν είναι δεδομένο, είναι κενή φόρμα |
 *
 * ⛔ **Το @deprecated `price` ΔΕΝ γράφεται πια** (ADR-777 §8.60.18): ο επιλυτής το
 * διάβαζε **πάντα** ως πώληση, άρα θέση προς ενοικίαση δεν μπορούσε να δηλωθεί. Η τιμή
 * ζει στο `commercial.{askingPrice,rentPrice}` και την οδηγεί το `commercialStatus`
 * (`space-commercial-fields.ts`). Ο επιλυτής **συνεχίζει να το διαβάζει** ως δίχτυ για
 * παλιά έγγραφα («read both, write new» — μετρημένα 2026-09-18: **0** έγγραφα το έχουν).
 *
 * Επιστρέφει **μόνο** τα παρόντα πεδία, ώστε ο καλών να το κάνει spread πάνω
 * στα δικά του χωρίς να γράψει `undefined` στο Firestore.
 */
export function mapCommonSpaceCreateFields(
  body: Record<string, unknown>,
): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    status: NEW_SPACE_STATUSES.status,
    operationalStatus: normalizeOperationalStatus(body.operationalStatus) ?? NEW_SPACE_STATUSES.operationalStatus,
  };

  const floor = trimmedOrNull(body.floor);
  if (floor) fields.floor = floor;

  if (typeof body.area === 'number' && body.area > 0) fields.area = body.area;

  const description = trimmedOrNull(body.description);
  if (description) fields.description = description;

  const notes = trimmedOrNull(body.notes);
  if (notes) fields.notes = notes;

  const code = trimmedOrNull(body.code);
  if (code) fields.code = code;

  return fields;
}

/** `undefined` means «not provided» → the field is left untouched by the write. */
function isProvided(value: unknown): boolean {
  return value !== undefined;
}

/** Trim a string field, collapsing blank to `null`. Non-strings become `null`. */
function trimmedOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value.trim() || null : null;
}

/**
 * Map the PATCH fields BOTH space entities share.
 * Entity-specific extras (parking: `location` / `locationZone` / `projectId`;
 * storage: `floorId`) are merged on top by the route's `mapExtraFields`.
 */
export function mapCommonSpaceFields(
  body: Record<string, unknown>,
  displayField: SpaceDisplayField,
): Record<string, unknown> {
  const updateData: Record<string, unknown> = {};

  const display = trimmedOrNull(body[displayField]);
  if (display) updateData[displayField] = display;

  if (isProvided(body.code)) updateData.code = trimmedOrNull(body.code);
  if (body.type) updateData.type = body.type;
  if (isProvided(body.operationalStatus)) {
    updateData.operationalStatus = normalizeOperationalStatus(body.operationalStatus);
  }
  if (isProvided(body.floor)) {
    updateData.floor = typeof body.floor === 'string'
      ? body.floor.trim() || null
      : body.floor ?? null;
  }
  if (isProvided(body.area)) updateData.area = typeof body.area === 'number' ? body.area : null;
  if (isProvided(body.description)) updateData.description = trimmedOrNull(body.description);
  if (isProvided(body.notes)) updateData.notes = trimmedOrNull(body.notes);
  if (isProvided(body.buildingId)) updateData.buildingId = body.buildingId ?? null;

  return updateData;
}

/**
 * ADR-247 F-4 / ADR-233 — resolve the allocation code to cascade onto
 * `linkedSpaces`: prefer `code`, fall back to the display field for legacy docs.
 * Returns `null` when nothing changed, so the caller skips the cascade.
 */
export function resolveAllocationCodeChange(
  body: Record<string, unknown>,
  existing: Record<string, unknown>,
  displayField: SpaceDisplayField,
): string | null {
  const next = trimmedOrNull(body.code) || trimmedOrNull(body[displayField]);
  if (!next) return null;

  const previous = (existing.code as string) || (existing[displayField] as string);
  return next === previous ? null : next;
}
