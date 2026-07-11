/**
 * 🏢 ENTERPRISE: DXF MLINE Converter (ADR-635 Φάση B · Φ C.7)
 *
 * MLINE (multiline) = N παράλληλες γραμμές που ορίζει ένα MLINESTYLE object
 * (offsets/colors ανά element) στο OBJECTS section. Φ C.7: ζωγραφίζουμε ΟΛΑ τα
 * elements ως N `type:'polyline'` — καθένα = η reference path μετατοπισμένη κατά
 * `(elementOffset + justAdjust) × scale`, με κοινό `groupId` (ADR-608 provenance)
 * ώστε το imported MLINE να παραμένει ΕΝΑ selectable unit (AutoCAD parity).
 *
 * Χωρίς MLINESTYLE (π.χ. R12 / απών style) → default STANDARD (±0.5), όπως το AutoCAD.
 *
 * SSoT reuse (ΟΧΙ νέο offset math): `offsetPolyline` (rendering/entities/shared/
 * geometry-offset-utils) — proven miter/bevel, positive = LEFT of travel = AutoCAD
 * MLINE +offset. Color resolution: `extractEntityColor` (ίδιο με κάθε converter).
 *
 * ⚠️ Δουλεύει πάνω σε ORDERED `pairs` (ίδιο idiom με HATCH/POLYLINE) — το flat
 * `data` map θα κρατούσε μόνο το ΤΕΛΕΥΤΑΙΟ 11/21 ζεύγος (πολλαπλά vertices).
 *
 * @see AutoCAD DXF Reference: MLINE entity
 * @see dxf-mline-style-parser.ts — MLINESTYLE (OBJECTS section) reader
 */

import type { AnySceneEntity } from '../types/scene';
import type { DxfMlineSource } from '../types/entities';
import type { Point2D, Point3D } from '../rendering/types/Types';
import type { MlineStyleDef, MlineStyleMap } from './dxf-mline-style-parser';
import { STANDARD_MLINE_STYLE } from './dxf-mline-style-parser';
import { offsetPolyline } from '../rendering/entities/shared/geometry-offset-utils';
import { extractEntityColor } from './dxf-converter-helpers';
import { dwarn } from '../debug';

type DxfPairs = ReadonlyArray<readonly [string, string]>;

/** MLINE justification (group 70): where the drawn line sits relative to the elements. */
const MLINE_JUSTIFY_TOP = 0;
const MLINE_JUSTIFY_BOTTOM = 2;

interface MlineParams {
  readonly scale: number;
  readonly justification: number;
  readonly styleName?: string;
  readonly styleHandle?: string;
  readonly isClosed: boolean;
  readonly entityColor?: string;
}

/**
 * Διαβάζει τα vertex-coordinate codes 11/21 (ΟΧΙ 10/20 — αυτά είναι το duplicate
 * "start point" της οντότητας). Codes 12/13/22/23/74/41/75/42 (direction/miter/
 * element params) παρεμβάλλονται αλλά δεν ταιριάζουν στο pattern-match, άρα αγνοούνται.
 */
function parseMlineVertices(pairs: DxfPairs): Point2D[] {
  const vertices: Point2D[] = [];
  let pendingX: number | undefined;

  for (const [code, value] of pairs) {
    if (code === '11') {
      const x = parseFloat(value);
      pendingX = Number.isNaN(x) ? undefined : x;
    } else if (code === '21' && pendingX !== undefined) {
      const y = parseFloat(value);
      if (!Number.isNaN(y)) vertices.push({ x: pendingX, y });
      pendingX = undefined;
    }
  }

  return vertices;
}

/** Extract MLINE scale (40), justification (70), style name (2)/handle (340), closed (71), color. */
function readMlineParams(pairs: DxfPairs): MlineParams {
  const first = (code: string): string | undefined => pairs.find(([c]) => c === code)?.[1];
  const scaleRaw = parseFloat(first('40') ?? '1');
  const scale = Number.isFinite(scaleRaw) ? scaleRaw : 1;
  const justification = parseInt(first('70') ?? '0', 10) || 0;
  // 71 bit 2 = closed (ΟΧΙ 70 bit 1 όπως LWPOLYLINE — διαφορετικό bitmask spec).
  const isClosed = ((parseInt(first('71') ?? '0', 10) || 0) & 2) === 2;
  const colorCode = first('62');
  const entityColor = colorCode ? extractEntityColor({ '62': colorCode }) : undefined;
  return {
    scale,
    justification,
    styleName: first('2'),
    styleHandle: first('340'),
    isClosed,
    entityColor,
  };
}

/** Resolve the MLINE's style by name then handle, falling back to AutoCAD STANDARD. */
function resolveMlineStyle(styles: MlineStyleMap | undefined, params: MlineParams): MlineStyleDef {
  if (!styles) return STANDARD_MLINE_STYLE;
  const byName = params.styleName ? styles.get(params.styleName) : undefined;
  const byHandle = params.styleHandle ? styles.get(params.styleHandle) : undefined;
  return byName ?? byHandle ?? STANDARD_MLINE_STYLE;
}

/**
 * Justification shift so the drawn reference path aligns with AutoCAD's convention:
 * Top → the max-offset element lands on the path; Bottom → the min-offset element;
 * Zero (default) → no shift (offset 0 on the path).
 */
function justificationAdjust(justification: number, elements: readonly { offset: number }[]): number {
  const offsets = elements.map(e => e.offset);
  if (justification === MLINE_JUSTIFY_TOP) return -Math.max(...offsets);
  if (justification === MLINE_JUSTIFY_BOTTOM) return -Math.min(...offsets);
  return 0;
}

/** Build one element polyline: reference path offset perpendicular by `distance` (2D). */
function buildElementVertices(refPath: readonly Point3D[], distance: number): Point2D[] {
  if (distance === 0) return refPath.map(({ x, y }) => ({ x, y }));
  return offsetPolyline(refPath, distance).map(({ x, y }) => ({ x, y }));
}

/**
 * Convert MLINE entity → N parallel `polyline` scene entities (ADR-635 Φ C.7), one per
 * MLINESTYLE element, grouped via `groupId`. Falls back to STANDARD (±0.5) when the
 * style is absent. Returns [] when there are < 2 reference vertices.
 */
export function convertMline(
  pairs: DxfPairs,
  layer: string,
  index: number,
  mlineStyles?: MlineStyleMap,
): AnySceneEntity[] {
  const vertices = parseMlineVertices(pairs);
  if (vertices.length < 2) {
    dwarn('EntityConverter', `⚠️ Skipping MLINE ${index}: insufficient vertices (11/21)`, vertices.length);
    return [];
  }

  const params = readMlineParams(pairs);
  const style = resolveMlineStyle(mlineStyles, params);
  const adjust = justificationAdjust(params.justification, style.elements);
  const refPath: Point3D[] = vertices.map(({ x, y }) => ({ x, y, z: 0 }));
  const groupId = `mline_${index}`;
  // ADR-636 Φ2.4 (D.4) — τα ΑΥΘΕΝΤΙΚΑ MLINE params (refPath + style + scale/justification),
  // ώστε ο export writer να αναπαράγει το native MLINE + MLINESTYLE (ΟΧΙ lossy reverse-offset).
  const source: DxfMlineSource = {
    refPath: vertices.map(({ x, y }) => ({ x, y })),
    scale: params.scale,
    justification: params.justification,
    isClosed: params.isClosed,
    ...(params.styleName && { styleName: params.styleName }),
    ...(params.styleHandle && { styleHandle: params.styleHandle }),
    ...(params.entityColor && { entityColor: params.entityColor }),
    style: {
      name: style.name,
      ...(style.handle && { handle: style.handle }),
      elements: style.elements.map((e) => ({ offset: e.offset, ...(e.aci && { aci: e.aci }) })),
    },
  };

  return style.elements.map((element, k) => {
    const distance = (element.offset + adjust) * params.scale;
    const elementColor = element.aci ? extractEntityColor({ '62': element.aci }) : undefined;
    const color = elementColor ?? params.entityColor;
    return {
      id: `${groupId}_e${k}`,
      type: 'polyline',
      layerId: layer,
      visible: true,
      vertices: buildElementVertices(refPath, distance),
      closed: params.isClosed,
      groupId,
      // Marker ΜΟΝΟ στο πρώτο element (emitter-carrier)· siblings suppress-άρονται στο export.
      ...(k === 0 && { dxfMlineSource: source }),
      ...(color && { color }),
    } as AnySceneEntity;
  });
}
