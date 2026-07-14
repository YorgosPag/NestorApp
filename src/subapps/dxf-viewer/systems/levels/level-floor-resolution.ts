'use client';

/**
 * ADR-420 / ADR-399 — resolve the viewer Level that owns a wizard-selected floor.
 *
 * The «Εισαγωγή Κάτοψης» wizard lets the user pick company → project → building →
 * floor. Historically the import wrote into whatever level was *currently active*
 * (`currentLevelId`), so importing onto floor B while floor A's tab was active
 * dumped floor B's scene + context onto floor A. Revit-true behaviour: each
 * building storey (`floorId`) maps to its own Level; the import must target the
 * level bound to the selected floor — creating it if it doesn't exist yet.
 *
 * Stable key = `floorId` (IfcBuildingStorey), consistent with the BIM floor-scope
 * SSoT (see `bim/persistence/bim-floor-scope.ts`).
 */
import type { Level } from './config';

export interface LevelFloorResolver {
  readonly levels: Level[];
  readonly addLevel: (name: string, setAsDefault?: boolean, floorId?: string) => Promise<string | null>;
  readonly linkLevelToFloor: (levelId: string, floorId: string | null, buildingId?: string | null) => Promise<void>;
}

export interface ResolveFloorLevelOptions {
  readonly floorId?: string;
  readonly buildingId?: string;
  readonly entityLabel?: string;
  readonly currentLevelId: string | null;
}

/**
 * Find the Level whose `floorId` matches the selected floor; create + link one
 * when absent. Returns the target level id (or `currentLevelId` for floor-less
 * imports — project/building-level canvases, which are not storeys).
 */
export async function findOrCreateLevelForFloor(
  resolver: LevelFloorResolver,
  opts: ResolveFloorLevelOptions,
): Promise<string | null> {
  // No floor selected (project/building-level import) → keep the active level.
  if (!opts.floorId) return opts.currentLevelId;

  const existing = resolver.levels.find((l) => l.floorId === opts.floorId);
  if (existing) return existing.id;

  const newId = await resolver.addLevel(opts.entityLabel || 'Όροφος', false, opts.floorId);
  if (newId) {
    await resolver.linkLevelToFloor(newId, opts.floorId, opts.buildingId ?? null);
  }
  return newId;
}

/**
 * SSoT — το **ενεργό buildingId** του viewer = το `buildingId` του πρώτου linked
 * level. Κάθε linked Level φέρει το ίδιο `buildingId` (ADR-237, link-time), οπότε
 * ο πρώτος αρκεί. Καταναλωτές: `LevelPanel` (φόρτωση floors) + Floor Management
 * modal (ADR-468). ΟΧΙ μέσω `useProjectHierarchy().selectedBuilding` (τυπικά null
 * στον viewer). Αντικαθιστά το διπλο-γραμμένο `levels.find(l => l.buildingId)`.
 */
export function resolveActiveBuildingId(levels: readonly Level[] | null | undefined): string | null {
  return levels?.find((l) => l.buildingId)?.buildingId ?? null;
}

/**
 * SSoT — το **durable projectId** του viewer = το `projectId` του πρώτου level που το
 * φέρει. Κάθε linked Level παίρνει το ίδιο `projectId` από τον wizard (ADR-309), άρα ο
 * πρώτος αρκεί.
 *
 * 🛡️ ADR-650 M10 (Εύρημα #2) — ΓΙΑΤΙ υπάρχει: ειδικοί όροφοι όπως η **Θεμελίωση**
 * δημιουργούνται ΧΩΡΙΣ δικό τους `projectId` (δεν περνούν από τον import wizard). Έτσι
 * το `saveContext?.projectId ?? currentLevel?.projectId` έβγαινε `undefined` εκεί →
 * το SITE-scope topo persistence δεν instantiate-άρονταν → το survey ΔΕΝ σωζόταν στη
 * θεμελίωση (`hasScope:FALSE`). Το projectId ενός αδελφού ορόφου (π.χ. ισόγειο) είναι
 * **σταθερή, διαθέσιμη-από-το-load** πηγή: δίνει ίδιο scope σε ΚΑΘΕ όροφο και δεν κάνει
 * flip `null→value` (που προκαλούσε per-project reset). Mirror του
 * {@link resolveActiveBuildingId}.
 */
export function resolveActiveProjectId(levels: readonly Level[] | null | undefined): string | null {
  return levels?.find((l) => l.projectId)?.projectId ?? null;
}
