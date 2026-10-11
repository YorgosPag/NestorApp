/**
 * ADR-911 Φ4 — κοινό στήσιμο των tests ανοιγμάτων πάνω στο σχέδιο δοκιμής. ΕΝΑ σημείο για το
 * «η σκηνή όπως την αφήνει η Φ3» και για τη ζωντανή σκηνή που γράφει ο πραγματικός γραφέας.
 */

import type { AnySceneEntity, Entity } from '../../../types/entities';
import type { SceneModel } from '../../../types/scene';
import type { WallEntity } from '../../types/wall-types';
import { buildWallEntity } from '../../../hooks/drawing/wall-completion';
import { applyTrimPatches, computeWallTrims } from '../../walls/wall-trims';
import type { WallSceneAccessor } from '../../walls/add-wall-to-scene';
import { computeWallProposal } from '../wall-proposal';
import { computeOpeningProposal, type OpeningProposal } from '../opening-proposal';
import fixture from './fixtures/floor-plan-lines.json';

export const LEVEL = 'lvl';
export const ENTITIES = fixture.entities as unknown as readonly Entity[];
export const colorOf = (e: Entity): string | null => (e as { color?: string }).color?.toLowerCase() ?? null;
export const WALL = '#003fff';
export const OPENING = '#00cccc';

/** Οι τοίχοι όπως τους γράφει η Φ3. `acceptAll` = εγκρίθηκαν και τα 2 «προς απόφαση». */
export function writtenWalls(acceptAll: boolean): WallEntity[] {
  const input = { entities: ENTITIES, wallColorHex: WALL, colorOf, sceneUnits: 'mm' as const, levelId: LEVEL };
  const base = computeWallProposal(input);
  const undecided = new Set(base.items.filter((i) => i.status === 'needs-decision').map((i) => i.key));
  const walls = acceptAll ? computeWallProposal({ ...input, acceptedKeys: undecided }).walls : base.walls;
  const trimmed = applyTrimPatches(walls as readonly AnySceneEntity[], computeWallTrims(walls, []));
  return trimmed as unknown as WallEntity[];
}

export const sceneOf = (walls: readonly WallEntity[], extra: readonly Entity[] = []): Entity[] =>
  [...ENTITIES, ...(walls as unknown as Entity[]), ...extra];

export const propose = (entities: readonly Entity[]): OpeningProposal =>
  computeOpeningProposal({ entities, openingColorHex: OPENING, colorOf, sceneUnits: 'mm' });

/** Συνθετικός τοίχος = καθαρός τοίχος: δεν κληρονομεί τα κοψίματα άκρων του προτύπου. */
export const NO_TRIMS = { startMiter: undefined, endMiter: undefined, startBevel: undefined, endBevel: undefined };

export function rebuilt(wall: WallEntity, params: WallEntity['params']): WallEntity {
  const built = buildWallEntity(params, wall.layerId ?? 'layer', 'straight', 'mm');
  if (!built.ok) throw new Error(`host: ${built.hardErrors.join(',')}`);
  return built.entity;
}

export interface LiveScene {
  readonly accessor: WallSceneAccessor;
  readonly entities: () => readonly Entity[];
}

/** Ζωντανή σκηνή ενός επιπέδου — ό,τι χρειάζεται ο γραφέας για να γράψει μέσα από το ιστορικό. */
export function liveScene(initial: readonly Entity[]): LiveScene {
  let scene = { units: 'mm', entities: [...initial] } as unknown as SceneModel;
  return {
    accessor: {
      currentLevelId: LEVEL,
      getLevelScene: () => scene,
      setLevelScene: (_id, next) => { scene = next; },
    },
    entities: () => scene.entities as unknown as readonly Entity[],
  };
}
