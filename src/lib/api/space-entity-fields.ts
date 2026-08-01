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
 *  - the display field (`number` / `name`), `type` and `status` use a TRUTHY
 *    guard — a blank value is ignored rather than nulled.
 *
 * @module lib/api/space-entity-fields
 * @see ADR-696 space-entity route SSoT · ADR-233 Entity coding
 */

import { z } from 'zod';

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
  status: z.string().max(50).optional(),
  floor: z.union([z.string().max(50), z.number()]).nullable().optional(),
  area: z.number().min(0).max(999_999).nullable().optional(),
  price: z.number().min(0).max(999_999_999).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  buildingId: z.string().max(128).nullable().optional(),
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
 * — δηλαδή θα «ενοποιούσε» δύο διαφορετικές αποφάσεις. Ομοίως το `type`/`status`:
 * το `storages` τα **επικυρώνει** με `isValidStorageType`, το `parking` όχι.
 */
export const SPACE_COMMON_CREATE_FIELDS = {
  /** ADR-233: Entity coding system identifier */
  code: z.string().max(50).optional(),
  buildingId: z.string().max(128).optional(),
  projectId: z.string().max(128).optional(),
  type: z.string().max(50).optional(),
  status: z.string().max(50).optional(),
  floor: z.string().max(50).optional(),
  area: z.number().min(0).max(999_999).optional(),
  price: z.number().min(0).max(999_999_999).optional(),
  description: z.string().max(2000).optional(),
  notes: z.string().max(5000).optional(),
} as const;

/**
 * Τα **έξι** πεδία δημιουργίας που οι δύο χώροι έγραφαν με **πανομοιότυπη**
 * σημασιολογία.
 *
 * 🔴 Η σημασιολογία **δεν** είναι ομοιόμορφη και **δεν πρέπει** να γίνει:
 *
 * | πεδίο | φρουρός | γιατί |
 * |---|---|---|
 * | `floor`, `description`, `notes`, `code` | κενό μετά από `trim()` ⇒ **παραλείπεται** | κενή συμβολοσειρά δεν είναι τιμή |
 * | `area` | `> 0` | μηδενικό εμβαδόν δεν είναι δεδομένο, είναι κενή φόρμα |
 * | `price` | `>= 0` | **το μηδέν είναι έγκυρη τιμή** (δωρεάν/συμπεριλαμβανόμενο) |
 *
 * Η διαφορά `area > 0` vs `price >= 0` ήταν ήδη εκεί, ίδια και στα δύο αρχεία.
 * Γραμμένη δύο φορές, ένα «καθάρισμα» θα την εξομάλυνε και θα έσβηνε σιωπηλά
 * κάθε μηδενική τιμή.
 *
 * Επιστρέφει **μόνο** τα παρόντα πεδία, ώστε ο καλών να το κάνει spread πάνω
 * στα δικά του χωρίς να γράψει `undefined` στο Firestore.
 */
export function mapCommonSpaceCreateFields(
  body: Record<string, unknown>,
): Record<string, unknown> {
  const fields: Record<string, unknown> = {};

  const floor = trimmedOrNull(body.floor);
  if (floor) fields.floor = floor;

  if (typeof body.area === 'number' && body.area > 0) fields.area = body.area;
  if (typeof body.price === 'number' && body.price >= 0) fields.price = body.price;

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
  if (body.status) updateData.status = body.status;
  if (isProvided(body.floor)) {
    updateData.floor = typeof body.floor === 'string'
      ? body.floor.trim() || null
      : body.floor ?? null;
  }
  if (isProvided(body.area)) updateData.area = typeof body.area === 'number' ? body.area : null;
  if (isProvided(body.price)) updateData.price = typeof body.price === 'number' ? body.price : null;
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
