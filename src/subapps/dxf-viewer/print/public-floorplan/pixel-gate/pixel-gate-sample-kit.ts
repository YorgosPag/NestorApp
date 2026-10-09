/**
 * @fileoverview Τα κοινά εργαλεία των δειγμάτων της πύλης pixels — κελί, στρώμα, «χτίστηκε;» (CHECK 3.101).
 * @related ADR-909 §6.7 · ./pixel-gate-samples
 * @module subapps/dxf-viewer/print/public-floorplan/pixel-gate/pixel-gate-sample-kit
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { RenderableEntityType } from '../../../rendering/contract/renderable-entity-type';
import type { Entity } from '../../../types/entities';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { buildDefaultWallParams, buildWallEntity } from '../../../hooks/drawing/wall-completion';

export const LAYER_ID = 'pixel-gate-layer';

/** Τα σημεία αναφοράς ενός κελιού — κάθε εργοστάσιο παίρνει από εδώ, ποτέ δικές του συντεταγμένες. */
export interface CellGeometry {
  readonly centre: Point2D;
  /** Οριζόντιο τμήμα στη μέση του κελιού (τοίχος, δοκός, σωλήνας). */
  readonly from: Point2D;
  readonly to: Point2D;
  /** Τετράγωνο μέσα στο κελί, αριστερόστροφα (πλάκα, δάπεδο, γραμμοσκίαση). */
  readonly ring: Point2D[];
}

export type SampleFactory = (cell: CellGeometry) => Entity[];

export type Built<E> =
  | { readonly ok: true; readonly entity: E }
  | { readonly ok: false; readonly hardErrors: readonly string[] };

/** Δείγμα που το ίδιο το εργοστάσιο αρνείται είναι σφάλμα του **δείγματος** — δυνατά, όχι άδειο κελί. */
export function built<E>(type: RenderableEntityType, result: Built<E>): E {
  if (!result.ok) throw new Error(`pixel-gate: sample "${type}" rejected: ${result.hardErrors.join(', ')}`);
  return result.entity;
}

/** Εργοστάσιο που γυρίζει `null` αντί για στοιχείο: ίδιος κανόνας — δυνατά, όχι άδειο κελί. */
export function present<E>(type: RenderableEntityType, entity: E | null | undefined): E {
  if (entity === null || entity === undefined) throw new Error(`pixel-gate: the "${type}" sample was not built`);
  return entity;
}

/** Ο τοίχος των 3 m στη μέση του κελιού — δείγμα ο ίδιος, και ξενιστής για άνοιγμα και επένδυση. */
export function wallOf(cell: CellGeometry) {
  return built('wall', buildWallEntity(buildDefaultWallParams(cell.from, cell.to), LAYER_ID));
}

export function primitive<T extends Entity['type']>(
  type: T,
): { id: string; type: T; layerId: string; visible: true } {
  return { id: generateEntityId(), type, layerId: LAYER_ID, visible: true };
}
