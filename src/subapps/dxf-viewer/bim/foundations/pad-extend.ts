/**
 * pad-extend — pure builder επέκτασης pad πεδίλου ώστε να καλύψει και 2η κολόνα
 * (ADR-459 Phase 3 — «2 κολόνες + 1 πέδιλο = ένας οργανισμός», Revit combined footing).
 *
 * SSoT-συμβατή προσέγγιση (option α): μεγαλώνει το pad σε axis-aligned bbox που
 * περικλείει ΚΑΙ το υπάρχον footprint ΚΑΙ τη βάση της νέας κολόνας (+ περιθώριο),
 * με `anchor='center'` + `rotation=0`. Δεν εισάγει νέο type/schema/geometry builder
 * — επιστρέφει απλώς νέα `PadFootingParams` (το `UpdateFoundationParamsCommand`
 * ξανα-υπολογίζει geometry+validation atomically).
 *
 * Όριο v1: axis-aligned (grid-aligned κολόνες). Μη-ευθυγραμμισμένες κολόνες →
 * ορθογώνιο bbox (συντηρητικό, καλύπτει). Pure module — zero deps πλην scene-units.
 *
 * @see ../../core/commands/entity-commands/ExtendFootingToColumnCommand.ts — ο executor
 * @see docs/centralized-systems/reference/adrs/ADR-459-structural-organism-connectivity.md §Phase 3
 */

import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';
import type { FoundationEntity, PadFootingParams } from '../types/foundation-types';

interface Pt {
  readonly x: number;
  readonly y: number;
}

/**
 * Νέα `PadFootingParams` που καλύπτουν το υπάρχον pad + τη βάση της νέας κολόνας.
 * `null` αν το `pad` δεν είναι kind 'pad' ή τα σημεία είναι εκφυλισμένα.
 *
 * @param marginMm περιθώριο προεξοχής γύρω από το συνδυασμένο bbox (mm).
 */
export function buildExtendedPadParams(
  pad: FoundationEntity,
  columnVertices: readonly Pt[],
  marginMm: number,
  sceneUnits: SceneUnits,
): PadFootingParams | null {
  if (pad.params.kind !== 'pad') return null;
  const existing = pad.geometry?.footprint?.vertices ?? [];
  const all: readonly Pt[] = [...existing, ...columnVertices];
  if (all.length < 3) return null;

  const s = mmToSceneUnits(sceneUnits);
  const marginCanvas = marginMm * s;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of all) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  minX -= marginCanvas;
  minY -= marginCanvas;
  maxX += marginCanvas;
  maxY += marginCanvas;

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return {
    ...pad.params,
    anchor: 'center',
    rotation: 0,
    position: { x: cx, y: cy, z: 0 },
    width: (maxX - minX) / s,
    length: (maxY - minY) / s,
  };
}
