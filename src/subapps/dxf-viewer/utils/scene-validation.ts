/**
 * 🏢 ENTERPRISE: Scene validation SSoT — ΓΙΑΤΙ απέρριψε, όχι μόνο ΟΤΙ απέρριψε (ADR-635 Φ C.23)
 *
 * Το `DxfSceneBuilder.validateScene` επέστρεφε **ένα `boolean` για τρία εντελώς διαφορετικά
 * ερωτήματα** (δομή / bounds NaN / οντότητα χωρίς ταυτότητα). Το `false` κατέληγε στο toast
 * «check the file format», που είναι **λάθος συμβουλή στις δύο από τις τρεις περιπτώσεις**, και
 * κανείς — ούτε ο χρήστης, ούτε ο επόμενος μηχανικός — δεν μπορούσε να διαγνώσει τίποτα.
 *
 * Εδώ η απάντηση είναι **διακριτή ένωση**: ποια συνθήκη έπεσε, σε ποια οντότητα, ποιο πεδίο.
 * Η διαδρομή αποτυχίας πληρώνει ό,τι κοστίζει για μια **ακριβή** απάντηση (εντοπισμός της
 * πρώτης μη-πεπερασμένης συντεταγμένης, ομαδοποίηση των ανώνυμων οντοτήτων ανά τύπο) — μια
 * αποτυχημένη εισαγωγή δεν έχει προθεσμία, ο μηχανικός που την ερευνά έχει.
 *
 * ⚠️ **Η σημασιολογία αποδοχής είναι ΤΑΥΤΟΣΗΜΗ** με τον προηγούμενο boolean έλεγχο: ό,τι
 * περνούσε, περνά. Αυτό είναι διάγνωση, όχι αυστηροποίηση (γι' αυτό `Number.isNaN(Number(v))`
 * — αντιγράφει το global `isNaN` του παλιού κώδικα, όπου `undefined` ⇒ άκυρο αλλά `Infinity` ⇒
 * αποδεκτό). Αν κάποτε χρειαστεί αυστηροποίηση, είναι ξεχωριστή απόφαση με δικό της test.
 *
 * @see run-dxf-parse.ts     - ο μοναδικός καταναλωτής (τυλίγει το πόρισμα σε DxfImportResult)
 * @see dxf-scene-builder.ts - παράγει τη σκηνή που ελέγχεται εδώ
 */

import type { Entity, SceneModel } from '../types/scene';

/** Πεδία της σκηνής που πρέπει να υπάρχουν δομικά. */
export type SceneStructureField = 'entities' | 'layersById' | 'bounds';

/** Τα ΤΕΣΣΕΡΑ αριθμητικά πεδία του bbox που ελέγχονται (z εκτός — όπως και πριν). */
export type SceneBoundsField = 'min.x' | 'min.y' | 'max.x' | 'max.y';

/** Τα πεδία ταυτότητας/απόδοσης που κάθε οντότητα της σκηνής οφείλει να φέρει. */
export type EntityAttributionField = 'id' | 'type' | 'layerId';

/** Η πρώτη μη-πεπερασμένη αριθμητική συντεταγμένη που βρέθηκε σε οντότητα. */
export interface NonFiniteCoordinate {
  readonly index: number;
  readonly id?: string;
  readonly type?: string;
  /** Διαδρομή μέσα στην οντότητα, π.χ. `points[3].x`. */
  readonly path: string;
  readonly value: number;
}

/** Μία οντότητα χωρίς ταυτότητα — δείγμα για το μήνυμα σφάλματος. */
export interface UnattributedEntitySample {
  readonly index: number;
  readonly id?: string;
  readonly type?: string;
  readonly missing: readonly EntityAttributionField[];
}

export type SceneValidationFailure =
  | { readonly code: 'missing-structure'; readonly missing: readonly SceneStructureField[] }
  | {
      readonly code: 'non-finite-bounds';
      readonly fields: readonly SceneBoundsField[];
      readonly entityCount: number;
      /** Ο ένοχος, όταν εντοπίζεται — αλλιώς το NaN γεννήθηκε στον ίδιο τον υπολογισμό bbox. */
      readonly firstOffender?: NonFiniteCoordinate;
    }
  | {
      readonly code: 'unattributed-entity';
      readonly first: UnattributedEntitySample;
      readonly affectedCount: number;
      /** Πόσες ανώνυμες οντότητες ανά DXF τύπο — δείχνει αν φταίει ΕΝΑ pipeline. */
      readonly affectedByType: Readonly<Record<string, number>>;
    };

export type SceneValidationResult =
  | { readonly valid: true }
  | { readonly valid: false; readonly failure: SceneValidationFailure };

const VALID: SceneValidationResult = { valid: true };

/** Βάθος σάρωσης για τον εντοπισμό NaN — αρκετό για `vertices[i].points[j].x`. */
const MAX_SCAN_DEPTH = 6;

/** Αντιγράφει το global `isNaN` του προηγούμενου ελέγχου (undefined ⇒ true, Infinity ⇒ false). */
function isNaNLike(value: unknown): boolean {
  return Number.isNaN(Number(value));
}

function checkStructure(scene: SceneModel): SceneValidationFailure | null {
  const missing: SceneStructureField[] = [];
  if (!scene.entities) missing.push('entities');
  if (!scene.layersById) missing.push('layersById');
  if (!scene.bounds) missing.push('bounds');
  return missing.length > 0 ? { code: 'missing-structure', missing } : null;
}

/**
 * Πρώτη μη-πεπερασμένη αριθμητική τιμή μέσα σε αυθαίρετη δομή οντότητας. Ανεξάρτητη από
 * ΚΑΘΕ υλοποίηση bbox — γι' αυτό απαντά ακόμα κι όταν ο υπολογισμός bounds αλλάξει.
 */
function findNonFiniteNumber(value: unknown, path: string, depth: number): { path: string; value: number } | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? null : { path, value };
  }
  if (depth >= MAX_SCAN_DEPTH || value === null || typeof value !== 'object') return null;

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const hit = findNonFiniteNumber(value[i], `${path}[${i}]`, depth + 1);
      if (hit) return hit;
    }
    return null;
  }

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const hit = findNonFiniteNumber(child, path ? `${path}.${key}` : key, depth + 1);
    if (hit) return hit;
  }
  return null;
}

function findFirstNonFiniteEntity(entities: readonly Entity[]): NonFiniteCoordinate | undefined {
  for (let index = 0; index < entities.length; index++) {
    const entity = entities[index];
    const hit = findNonFiniteNumber(entity, '', 0);
    if (hit) {
      return { index, id: entity.id, type: entity.type, path: hit.path, value: hit.value };
    }
  }
  return undefined;
}

function checkBounds(scene: SceneModel): SceneValidationFailure | null {
  const { min, max } = scene.bounds;
  const fields: SceneBoundsField[] = [];
  if (isNaNLike(min?.x)) fields.push('min.x');
  if (isNaNLike(min?.y)) fields.push('min.y');
  if (isNaNLike(max?.x)) fields.push('max.x');
  if (isNaNLike(max?.y)) fields.push('max.y');
  if (fields.length === 0) return null;

  return {
    code: 'non-finite-bounds',
    fields,
    entityCount: scene.entities.length,
    firstOffender: findFirstNonFiniteEntity(scene.entities),
  };
}

function missingAttribution(entity: Entity): EntityAttributionField[] {
  const missing: EntityAttributionField[] = [];
  if (!entity.id) missing.push('id');
  if (!entity.type) missing.push('type');
  if (!entity.layerId) missing.push('layerId');
  return missing;
}

function checkAttribution(entities: readonly Entity[]): SceneValidationFailure | null {
  let first: UnattributedEntitySample | null = null;
  let affectedCount = 0;
  const affectedByType: Record<string, number> = {};

  for (let index = 0; index < entities.length; index++) {
    const entity = entities[index];
    const missing = missingAttribution(entity);
    if (missing.length === 0) continue;

    affectedCount++;
    const typeKey = entity.type || 'UNKNOWN';
    affectedByType[typeKey] = (affectedByType[typeKey] ?? 0) + 1;
    if (!first) first = { index, id: entity.id, type: entity.type, missing };
  }

  return first ? { code: 'unattributed-entity', first, affectedCount, affectedByType } : null;
}

/**
 * Επικυρώνει μια χτισμένη σκηνή. Η σειρά των ελέγχων είναι από το δομικό προς το ειδικό,
 * ώστε το πόρισμα να δείχνει πάντα τη ΡΙΖΑ και όχι ένα επακόλουθό της.
 */
export function validateSceneModel(scene: SceneModel): SceneValidationResult {
  const failure =
    checkStructure(scene) ??
    checkBounds(scene) ??
    checkAttribution(scene.entities);

  return failure ? { valid: false, failure } : VALID;
}

/** Τα Ν κορυφαία `TYPE×n` ενός μετρητή, για συμπαγές μήνυμα. */
function formatTypeCounts(counts: Readonly<Record<string, number>>, limit = 5): string {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([type, n]) => `${type}×${n}`)
    .join(', ');
}

/**
 * Τεχνική περιγραφή μίας γραμμής — για κονσόλα/logs/`DxfImportResult.error`.
 * **ΔΕΝ είναι μεταφρασμένη ετικέτα UI** (ίδια σύμβαση με το `summarizeDiagnostics`): το UI
 * χτίζει το δικό του μήνυμα από τη δομημένη αιτία.
 */
export function describeSceneValidationFailure(failure: SceneValidationFailure): string {
  switch (failure.code) {
    case 'missing-structure':
      return `scene is missing required field(s): ${failure.missing.join(', ')}`;

    case 'non-finite-bounds': {
      const offender = failure.firstOffender;
      const where = offender
        ? ` — first non-finite coordinate: entity #${offender.index}` +
          ` (${offender.type ?? 'UNKNOWN'}${offender.id ? ` id=${offender.id}` : ''})` +
          ` at ${offender.path || '<root>'} = ${offender.value}`
        : ' — no entity carries a non-finite coordinate, so the NaN was produced by the bounds computation itself';
      return `bounds are NaN (${failure.fields.join(', ')}) over ${failure.entityCount} entities${where}`;
    }

    case 'unattributed-entity': {
      const { first } = failure;
      return (
        `${failure.affectedCount} entit${failure.affectedCount === 1 ? 'y' : 'ies'} missing identity/attribution` +
        ` [${formatTypeCounts(failure.affectedByType)}]` +
        ` — first: #${first.index} (${first.type ?? 'UNKNOWN'}${first.id ? ` id=${first.id}` : ''})` +
        ` missing ${first.missing.join(', ')}`
      );
    }
  }
}
