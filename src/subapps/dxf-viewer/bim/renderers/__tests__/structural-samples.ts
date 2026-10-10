/**
 * Δομικά δείγματα για τις άγκυρες «οθόνη όπως πριν / χαρτί» (ADR-909 Γ2.5): τοίχος, επένδυση, άνοιγμα, πλάκα +
 * άνοιγμα πλάκας, κολόνα — όλα από το **εργοστάσιο της παραγωγής**, με τα προεπιλεγμένα χρώματα και πάχη τους.
 *
 * Όχι αρχείο test: βοήθημα που το μοιράζονται οι σουίτες του φακέλου (αδελφός του `recording-canvas.ts`).
 */

import type { EntityModel } from '../../../rendering/types/Types';
import { buildDefaultColumnParams, buildColumnEntity } from '../../../hooks/drawing/column-completion';
import { buildDefaultOpeningParams, buildOpeningEntity } from '../../../hooks/drawing/opening-completion';
import { buildDefaultSlabParams, buildSlabEntity } from '../../../hooks/drawing/slab-completion';
import { buildDefaultSlabOpeningParams, buildSlabOpeningEntity } from '../../../hooks/drawing/slab-opening-completion';
import { buildDefaultWallParams, buildWallEntity, type WallParamOverrides } from '../../../hooks/drawing/wall-completion';
import { buildDefaultWallCoveringParams, buildWallCoveringEntity } from '../../../hooks/drawing/wall-covering-completion';
import type { WallCoveringMaterialId } from '../../types/wall-covering-types';
import { recordingContext, type Painted } from './recording-canvas';

const LAYER_ID = 'layer-0';
const WALL_LENGTH_MM = 3000;
const SLAB_SIDE_MM = 4000;

type Built<E> = { readonly ok: true; readonly entity: E } | { readonly ok: false; readonly hardErrors: readonly string[] };

/** Δείγμα που το εργοστάσιο αρνείται είναι σφάλμα του δείγματος — δυνατά, όχι άδειος καμβάς. */
function built<E>(name: string, result: Built<E>): E {
  if (!result.ok) throw new Error(`το εργοστάσιο αρνήθηκε το δείγμα «${name}»: ${result.hardErrors.join(', ')}`);
  return result.entity;
}

export function sampleWall(overrides: WallParamOverrides = {}) {
  return built('wall', buildWallEntity(buildDefaultWallParams({ x: 0, y: 0 }, { x: WALL_LENGTH_MM, y: 0 }, overrides), LAYER_ID));
}

export type SampleWall = ReturnType<typeof sampleWall>;

/** Επένδυση μίας στρώσης στο μεσαίο κομμάτι της εσωτερικής όψης του τοίχου. */
export function sampleWallCovering(host: SampleWall, materialId: WallCoveringMaterialId) {
  const params = buildDefaultWallCoveringParams(
    { hostWallId: host.id, faceSide: 'inner', spanStartMm: 500, spanEndMm: 2500 },
    { layers: [{ materialId, thicknessMm: 10, function: 'body' }] },
  );
  return built('wall-covering', buildWallCoveringEntity(params, LAYER_ID, host));
}

export function sampleOpening(host: SampleWall) {
  const params = buildDefaultOpeningParams(host, { x: WALL_LENGTH_MM / 2, y: 0 });
  return built('opening', buildOpeningEntity(params, host, LAYER_ID));
}

export function sampleSlabOpening() {
  const ring = [{ x: 0, y: 0 }, { x: SLAB_SIDE_MM, y: 0 }, { x: SLAB_SIDE_MM, y: SLAB_SIDE_MM }, { x: 0, y: SLAB_SIDE_MM }];
  const slab = built('slab', buildSlabEntity(buildDefaultSlabParams(ring), LAYER_ID));
  const centre = { x: SLAB_SIDE_MM / 2, y: SLAB_SIDE_MM / 2 };
  return built('slab-opening', buildSlabOpeningEntity(buildDefaultSlabOpeningParams(slab, centre), slab, LAYER_ID));
}

export function sampleColumn() {
  return built('column', buildColumnEntity(buildDefaultColumnParams({ x: 0, y: 0 }), LAYER_ID));
}

interface PlanPainter {
  setTransform(transform: { scale: number; offsetX: number; offsetY: number }): void;
  render(entity: EntityModel, options?: Record<string, never>): void;
}

/** Ζωγράφισε ένα στοιχείο σε πλαστό καμβά, με ζωγράφο στημένο από τον καλούντα (π.χ. με τον τοίχο-ξενιστή του). */
export function paintedBy<R extends PlanPainter>(
  create: (ctx: CanvasRenderingContext2D) => R,
  entity: { readonly id: string },
): Painted {
  const { ctx, painted } = recordingContext();
  const renderer = create(ctx);
  renderer.setTransform({ scale: 1, offsetX: 0, offsetY: 0 });
  renderer.render(entity as unknown as EntityModel, {});
  return painted;
}
