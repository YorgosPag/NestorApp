/**
 * Κοινός harness των σουιτών του ελεγκτή «Μοντέλο από το σχέδιο»: το ΠΡΑΓΜΑΤΙΚΟ σχέδιο δοκιμής πάνω σε
 * μια σκηνή που γράφεται όπως η αληθινή (`setLevelScene` ⇒ νέα αναφορά), ώστε και η αναίρεση του ιστορικού
 * να δουλεύει πάνω της. ΕΝΑΣ ορισμός για όλες τις σουίτες — όχι αντίγραφα (CHECK 3.28).
 */

import type { Entity, SceneLayer } from '../../../types/entities';
import { isWallEntity } from '../../../types/entities';
import type { SceneModel } from '../../../types/scene';
import type { WallEntity } from '../../../bim/types/wall-types';
import type { Point2D } from '../../../rendering/types/Types';
import { buildAutoWallType } from '../../../bim/family-types/auto-wall-type';
import { getBuiltInWallTypes } from '../../../bim/family-types/built-in-types';
import { createWallTyper, type WallTypingSession } from '../../../bim/family-types/wall-typer';
import type { WallSceneAccessor } from '../../../bim/walls/add-wall-to-scene';
import fixture from '../../../bim/model-from-drawing/__tests__/fixtures/floor-plan-lines.json';
import { modelFromDrawingSession, type ModelFromDrawingDeps } from '../model-from-drawing-session';
import { captureModelFromDrawingSample, modelFromDrawingStore } from '../model-from-drawing-store';

export const LEVEL = 'lvl_test';
export const WALL_HEX = '#003fff';
export const ENTITIES = fixture.entities as unknown as readonly Entity[];
export const WALL_LINE = ENTITIES.find((e) => (e as { color?: string }).color?.toLowerCase() === WALL_HEX) as unknown as {
  start: Point2D; end: Point2D;
};
export const ON_WALL_LINE: Point2D = {
  x: (WALL_LINE.start.x + WALL_LINE.end.x) / 2,
  y: (WALL_LINE.start.y + WALL_LINE.end.y) / 2,
};
export const NOWHERE: Point2D = { x: -9e6, y: -9e6 };

/** Οι στρώσεις του fixture ανά id (`COLOR_160` → `#003FFF`), όπως τις δίνει το `getLayersById()`. */
export const FIXTURE_LAYERS: Record<string, SceneLayer> = Object.fromEntries(
  Object.entries((fixture as unknown as { layers: Record<string, { name: string; color: string }> }).layers)
    .map(([id, layer]) => [id, { ...layer, id } as unknown as SceneLayer]),
);
/** Το ίδιο σχέδιο με κάθε γραμμή ByLayer: κανένα ρητό `color`, μόνο `layerId`. */
export const BY_LAYER_ENTITIES = (fixture.entities as readonly { color?: string }[]).map((entity) => {
  const { color: _explicit, ...byLayer } = entity;
  return byLayer;
}) as unknown as readonly Entity[];

export interface Harness {
  readonly deps: ModelFromDrawingDeps;
  readonly commit: jest.Mock;
  readonly entities: () => readonly Entity[];
  readonly walls: () => WallEntity[];
  readonly setEntities: (next: readonly Entity[]) => void;
}

export function harness(initial: readonly Entity[] = ENTITIES, layersById: Record<string, SceneLayer> = {}): Harness {
  let scene = { entities: [...initial], units: 'mm' } as unknown as SceneModel;
  const accessor: WallSceneAccessor = {
    currentLevelId: LEVEL,
    getLevelScene: () => scene,
    setLevelScene: (_id, next) => { scene = next; },
  };
  let n = 0;
  const typer = createWallTyper({
    types: getBuiltInWallTypes('co'),
    mint: (category, thicknessMm) => buildAutoWallType(`t-${(n += 1)}`, category, thicknessMm, 'co', 'u'),
  });
  const commit = jest.fn();
  const typing: WallTypingSession = { typeWall: typer.typeWall, commit };
  const entities = (): readonly Entity[] => scene.entities as unknown as readonly Entity[];
  return {
    deps: { accessor, typing, layersById, pickTolerance: 5, undoName: 'undo-name' },
    commit,
    entities,
    walls: () => entities().filter(isWallEntity),
    setEntities: (next) => { scene = { ...scene, entities: [...next] } as unknown as SceneModel; },
  };
}

/** Κλικ-δείγμα σε γραμμή τοίχου ⇒ πρόταση υπό έλεγχο. */
export function sample(h: Harness, point: Point2D = ON_WALL_LINE): void {
  modelFromDrawingSession.open();
  captureModelFromDrawingSample(point);
  modelFromDrawingSession.adoptSample(h.deps);
}

/** Ο άνθρωπος επιβεβαιώνει κάθε ομάδα πάχους με την προτεινόμενη λειτουργία. */
export function confirmAllGroups(h: Harness): void {
  for (const g of modelFromDrawingStore.get().proposal?.groups ?? []) {
    modelFromDrawingSession.confirmGroup(g.thicknessMm, g.suggestedCategory, h.deps);
  }
}
