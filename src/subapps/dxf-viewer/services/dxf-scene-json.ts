/**
 * ADR-358 Phase 9E-6f — Pure scene-JSON (de)serialisation helpers.
 *
 * Extracted from `dxf-firestore-storage.impl.ts` to give the parser zero
 * Firebase deps so it can be unit-tested without the heavy auth/storage
 * harness. Re-exported back from the impl for call-site stability.
 *
 * Storage contract:
 *   - Persist `SceneModel.layersById` (id-keyed SSoT post-9E-6e).
 *   - Accept legacy `parsed.layers` (name-keyed, pre-9E-6e) at load-time
 *     so files written before the refactor still hydrate cleanly.
 *
 * The fallback chain `parsed.layersById ?? parsed.layers ?? {}` was added
 * to fix the post-9E-6e regression where `parseAndValidateScene` returned
 * a SceneModel without `layersById`, which `useLevelSceneLoader` rejected
 * with `"Scene not found"` → empty scene → floorplan + any drawn entity
 * vanished after every hard refresh.
 */

import type { SceneModel, SceneLayer } from '../types/entities';
import { migrateLayersById, deriveLayersByIdFromEntities } from './dxf-scene-migration';

/**
 * ADR-913 §2 — τι είπε το κείμενο μιας σκηνής: σκηνή, **ρητά άδεια** σκηνή, ή κάτι που δεν διαβάζεται.
 *
 * Το «άδεια» και το «άκυρη» ήταν μέχρι τώρα το ΙΔΙΟ `null`, και ο loader του επιπέδου έκρινε και τα δύο
 * «ορφανό αρχείο» ⇒ ένα αρχείο που άδειασε μία φορά δεν ξαναδεχόταν ποτέ εγγραφή. Τα χωρίζουμε εδώ, στην
 * πηγή, ώστε μόνο το **αποδεδειγμένα** άδειο να μπορεί να ανοίξει τον στόχο (baseline 0).
 */
export type SceneJsonInspection =
  | { readonly kind: 'scene'; readonly scene: SceneModel }
  /** Έγκυρο JSON αντικείμενο με `entities: []` — ο δίσκος λέει ρητά «μηδέν οντότητες». */
  | { readonly kind: 'empty' }
  /** Κακό JSON, όχι αντικείμενο, ή χωρίς πίνακα `entities` (π.χ. placeholder `{}`) — άγνωστο περιεχόμενο. */
  | { readonly kind: 'invalid' };

/**
 * Parse scene JSON text into a validated SceneModel.
 * Returns null if JSON is invalid or scene is empty (placeholder `{}`) — βλ. {@link inspectSceneJson}
 * για το ΓΙΑΤΙ (οι υπάρχοντες καλούντες κρατούν ακριβώς την ίδια σημασία).
 *
 * ADR-358 Phase 14: applies `migrateLayersById` so pre-ADR-358 scenes
 * (SceneLayer with only 4 legacy fields) are upgraded to the full shape at
 * load time — idempotent for already-migrated documents.
 */
export function parseAndValidateScene(text: string): SceneModel | null {
  const inspected = inspectSceneJson(text);
  return inspected.kind === 'scene' ? inspected.scene : null;
}

/** ADR-913 §2 — ο ΕΝΑΣ αναλυτής κειμένου σκηνής· το `parseAndValidateScene` είναι λεπτό περιτύλιγμά του. */
export function inspectSceneJson(text: string): SceneJsonInspection {
  try {
    const raw: unknown = JSON.parse(text);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { kind: 'invalid' };
    const parsed = raw as Record<string, unknown>;
    const entities = parsed.entities;
    if (!Array.isArray(entities)) return { kind: 'invalid' };
    if (entities.length === 0) return { kind: 'empty' };
    return { kind: 'scene', scene: buildSceneFromParsed(parsed, entities) };
  } catch {
    return { kind: 'invalid' };
  }
}

/** Μη-άδεια, ήδη επικυρωμένη σκηνή ⇒ `SceneModel` (μετανάστευση layers + μεταφορά κάθε αποθηκευμένου πεδίου). */
function buildSceneFromParsed(parsed: Record<string, unknown>, entities: unknown[]): SceneModel {
  const rawLayers = (parsed.layersById ?? parsed.layers ?? {}) as Record<string, Partial<SceneLayer> & Record<string, unknown>>;
  const migratedLayers = migrateLayersById(rawLayers);
  // ADR-358 δίχτυ ασφαλείας — αποθηκευμένο scene χωρίς layer table (vintage/exploded
  // DXF ή stale layerless blob): ανακατασκεύασε ελάχιστα layers από τα entities ώστε
  // το «Επίπεδο» dropdown να μην είναι ποτέ κενό (πάντα ≥1, implicit «0» ως έσχατη λύση).
  const layersById = Object.keys(migratedLayers).length > 0
    ? migratedLayers
    : deriveLayersByIdFromEntities(entities);

  // ADR-650 §M10e — CARRY EVERY PERSISTED FIELD, then override only the four this loader
  // validates/migrates. This was a hand-picked whitelist of exactly those four, so every
  // OTHER SceneModel field was written correctly by `JSON.stringify(scene)` and vanished
  // silently on reload — no type error, no warning, visible only to the user. It was
  // already eating `dimStyles` (ADR-362), `headerDimscale` (ADR-362 R10), `linetypeScale`
  // (ADR-510 Φ2H) and `version`, and it would have eaten `sourceOrigin` too, making the
  // whole M10e Σκέλος Α decorative. Spread-then-override so no FUTURE field can regress
  // this way either. Fenced by the round-trip test.
  // (`layers` is the pre-ADR-358 legacy key — consumed into `layersById` above, so it is
  // dropped here rather than carried as dead weight.)
  const { layers: _legacyLayers, ...carried } = parsed;

  return {
    ...carried,
    entities: entities as SceneModel['entities'],
    layersById,
    bounds: (parsed.bounds ?? { minX: 0, minY: 0, maxX: 0, maxY: 0 }) as SceneModel['bounds'],
    units: (parsed.units ?? 'mm') as SceneModel['units'],
  } as SceneModel;
}
