/**
 * ADR-656 M11 — ΕΓΣΑ87 coordinate grid → native CAD entities (the export consumer).
 *
 * The «Bake to drawing» counterpart of the live screen graticule: turn the ONE pure
 * `TopoGridModel` into `line` + `text` entities that flow through `completeEntities`
 * (ADR-057) — so the baked grid gets undo, persistence, rendering, selection and DXF/PDF
 * export for FREE, exactly like the contours (`topo-to-entities`) and point labels
 * (`topo-point-labels`). No bespoke geometry: each cross is two short lines, each perimeter
 * label a text at the round coordinate in metres.
 *
 * Pure: the layer id is passed in (the hook owns the layer lifecycle), so this stays
 * unit-testable and free of store side effects.
 */

import type { LineEntity, TextEntity } from '../../types/entities';
import type { Point2D } from '../../rendering/types/Types';
import { generateEntityId } from '@/services/enterprise-id.service';
import { lengthMmToM } from '../../utils/scene-units';
import type { WorldToDisplayProjector } from '../geo-referencing/geo-transform';
import { projectWorldPoint } from './topo-display-frame';
import type { PerimeterLabel, TopoGridModel } from './topo-grid-model';
import {
  TOPO_GRID_COLOR, TOPO_GRID_LABEL_COLOR, TOPO_GRID_CROSS_WORLD_MM,
  TOPO_GRID_LABEL_HEIGHT_MM, TOPO_GRID_LABEL_DECIMALS,
} from './topo-grid-config';

type GridEntity = LineEntity | TextEntity;

/** One straight line segment on the grid layer. */
function lineAt(start: Point2D, end: Point2D, layerId: string): LineEntity {
  return { id: generateEntityId(), type: 'line', layerId, color: TOPO_GRID_COLOR, start, end };
}

/**
 * A cross at a round intersection = a horizontal + a vertical arm (canonical mm).
 *
 * ADR-650 §M10f — οι βραχίονες χτίζονται σε WORLD και **προβάλλονται ολόκληροι**: δείχνουν τη
 * διεύθυνση των γραμμών ΕΓΣΑ, άρα σε στραμμένο έργο πρέπει να στρίψουν μαζί τους (αλλιώς ο
 * σταυρός θα «κοίταζε» το χαρτί ενώ ο κάναβος κοιτάζει τον Βορρά).
 */
function toCrossLines(
  c: Point2D, layerId: string, projector: WorldToDisplayProjector | null,
): LineEntity[] {
  const a = TOPO_GRID_CROSS_WORLD_MM;
  const at = (x: number, y: number): Point2D => projectWorldPoint({ x, y }, projector);
  return [
    lineAt(at(c.x - a, c.y), at(c.x + a, c.y), layerId),
    lineAt(at(c.x, c.y - a), at(c.x, c.y + a), layerId),
  ];
}

/** Format a round coordinate (canonical mm) as its whole-metre ΕΓΣΑ87 value, e.g. `200`. */
export function formatGridCoordinate(coordinateMm: number): string {
  return lengthMmToM(coordinateMm).toFixed(TOPO_GRID_LABEL_DECIMALS);
}

/**
 * A perimeter coordinate label, offset just outside its edge so it clears the grid.
 *
 * ADR-650 §M10f — η **ΘΕΣΗ** προβάλλεται, το **offset** μπαίνει μετά, σε display frame: τα glyphs
 * σχεδιάζονται οριζόντια στο χαρτί, οπότε ένα στραμμένο offset θα έριχνε την ετικέτα πάνω στη
 * γραμμή. Η **ΤΙΜΗ** (`coordinateMm`) μένει ΕΓΣΑ — αυτή είναι όλη η δουλειά του καννάβου.
 */
function toPerimeterLabel(
  l: PerimeterLabel, layerId: string, projector: WorldToDisplayProjector | null,
): TextEntity {
  const off = TOPO_GRID_LABEL_HEIGHT_MM * 1.5;
  const anchor = projectWorldPoint(l.worldPos, projector);
  // Eastings sit below the bottom edge (centred); Northings sit left of the left edge.
  const position = l.axis === 'E'
    ? { x: anchor.x, y: anchor.y - off }
    : { x: anchor.x - off, y: anchor.y };
  return {
    id: generateEntityId(),
    type: 'text',
    layerId,
    color: TOPO_GRID_LABEL_COLOR,
    position,
    text: formatGridCoordinate(l.coordinateMm),
    fontSize: TOPO_GRID_LABEL_HEIGHT_MM,
    height: TOPO_GRID_LABEL_HEIGHT_MM,
    alignment: l.axis === 'E' ? 'center' : 'right',
  };
}

/**
 * Build the baked grid entities: two lines per cross + one text per perimeter label.
 * An empty model (no lines inside the rectangle) yields no entities.
 *
 * `projector` (ADR-650 §M10f) υποχρεωτικό — `null` = μη-γεωαναφερμένο έργο (WORLD ≡ DISPLAY).
 */
export function buildTopoGridEntities(
  model: TopoGridModel, layerId: string, projector: WorldToDisplayProjector | null,
): GridEntity[] {
  const entities: GridEntity[] = [];
  for (const cross of model.crosses) entities.push(...toCrossLines(cross, layerId, projector));
  for (const label of model.perimeterLabels) {
    entities.push(toPerimeterLabel(label, layerId, projector));
  }
  return entities;
}
