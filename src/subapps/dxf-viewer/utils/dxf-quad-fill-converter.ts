/**
 * 🏢 ENTERPRISE: DXF SOLID / 3DFACE / TRACE Converters (ADR-635 Φάση B)
 *
 * Τα τρία αυτά DXF entities είναι ιστορικά "filled quad" primitives — SOLID/TRACE
 * είναι bytewise ταυτόσημα (TRACE = προγενέστερη ονομασία), 3DFACE είναι το αληθινό
 * 3D face (κάθε κορυφή έχει δικό της Z, plus code 70 invisible-edge flags). Και τα 3
 * κωδικοποιούν 4 κορυφές στα ΙΔΙΑ group codes: 10/20/30, 11/21/31, 12/22/32, 13/23/33
 * — γι' αυτό μοιράζονται ΕΝΑ SSoT parser (`parseQuadVertices`) + ΕΝΑ builder
 * (`convertQuadFill`), με 3 λεπτά exported wrappers (jscpd-safe, N.18).
 *
 * ⚠️ BOWTIE GOTCHA (κρίσιμο): η σειρά ΖΩΓΡΑΦΙΣΜΑΤΟΣ του quad είναι 1ο→2ο→4ο→3ο
 * (ΟΧΙ 1-2-3-4). Αν διαβάσεις τις κορυφές με τη σειρά codes τους (10,11,12,13) και
 * τις βάλεις ως polygon χωρίς swap, παίρνεις "παπιγιόν" (self-intersecting quad).
 * @see AutoCAD DXF Reference: SOLID / 3DFACE / TRACE entities.
 *
 * Χαρτογραφούνται σε `HatchEntity` (type:'hatch', fillType:'solid') — ο `HatchRenderer`
 * (ήδη registered) τα ζωγραφίζει σαν συμπαγές poché, χωρίς νέο renderer. Read-only 2D
 * projection: το Z αγνοείται στο boundaryPaths (ο DXF viewer είναι 2D). Το native
 * SOLID/3DFACE/TRACE export round-trip (αντί για HATCH) είναι Φάση D — βλ. ADR-635.
 *
 * @see dxf-entity-converters.ts — master router που δρομολογεί SOLID/3DFACE/TRACE εδώ.
 * @see bim/hatch/hatch-properties.ts — isSolidHatch SSoT (fillType προτεραιότητα).
 * @see bim/geometry/shared/polygon-utils.ts — projectPointTo2D SSoT (ADR-597 §17.11).
 */

import type { AnySceneEntity } from '../types/scene';
import type { Point2D } from '../rendering/types/Types';
import { projectPointTo2D } from '../bim/geometry/shared/polygon-utils';
import { extractEntityColor } from './dxf-converter-helpers';
import { dwarn } from '../debug';

/** Μία κορυφή quad, με Z (world) — χρήσιμη μόνο για το non-zero-Z diagnostic, όχι render. */
interface QuadVertex3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** Αποτέλεσμα parse: κορυφές ΗΔΗ σε σωστό (bowtie-corrected) draw-order, deduped αν τρίγωνο. */
interface ParsedQuad {
  /** 3 κορυφές (τρίγωνο) ή 4 (quad) — ΗΔΗ στη σωστή σειρά ζωγραφίσματος. */
  readonly vertices: readonly QuadVertex3[];
  /** true όταν η 4η κορυφή (13/23/33) έλειπε ή ήταν ίση με την 3η — DXF triangle convention. */
  readonly isTriangle: boolean;
  /** true όταν κάποιο Z ≠ 0 — μόνο για diagnostic warning, ΔΕΝ μπλοκάρει το import. */
  readonly hasNonZeroZ: boolean;
}

/** `parseFloat(raw)` με fallback σε `fallback` όταν raw λείπει ή είναι NaN. */
function coordOr(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const n = parseFloat(raw);
  return Number.isNaN(n) ? fallback : n;
}

/**
 * SSoT parser για SOLID/3DFACE/TRACE quad κορυφές (ADR-635 Φάση B).
 *
 * Διαβάζει 10/20/30, 11/21/31, 12/22/32, 13/23/33 από το flat `data` (οι κωδικοί
 * ΔΕΝ επαναλαμβάνονται σε αυτά τα entities → ασφαλές, δεν χρειάζονται ordered pairs).
 * Η 4η κορυφή είναι προαιρετική· απούσα ή ίση με την 3η → τρίγωνο (γνωστή DXF σύμβαση).
 *
 * Επιστρέφει τις κορυφές ΗΔΗ στη σωστή σειρά ζωγραφίσματος (1,2,4,3 — bowtie swap),
 * deduped σε τρίγωνο ώστε ο καταναλωτής να μην χρειάζεται να ξέρει τίποτα για bowtie.
 *
 * @returns Parsed quad/triangle ή `null` (+ dwarn) αν λείπουν οι πρώτες 3 κορυφές.
 */
export function parseQuadVertices(
  data: Record<string, string>,
  entityLabel: 'SOLID' | '3DFACE' | 'TRACE',
  index: number
): ParsedQuad | null {
  const x1 = parseFloat(data['10']);
  const y1 = parseFloat(data['20']);
  const z1 = coordOr(data['30'], 0);
  const x2 = parseFloat(data['11']);
  const y2 = parseFloat(data['21']);
  const z2 = coordOr(data['31'], 0);
  const x3 = parseFloat(data['12']);
  const y3 = parseFloat(data['22']);
  const z3 = coordOr(data['32'], 0);

  if (isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2) || isNaN(x3) || isNaN(y3)) {
    dwarn('EntityConverter', `⚠️ Skipping ${entityLabel} ${index}: missing corner coordinates`, {
      x1, y1, x2, y2, x3, y3, available: Object.keys(data),
    });
    return null;
  }

  // 4η κορυφή προαιρετική — DXF triangle convention: absent/malformed → ίδια με 3η.
  const x4 = coordOr(data['13'], x3);
  const y4 = coordOr(data['23'], y3);
  const z4 = coordOr(data['33'], z3);

  const isTriangle = x4 === x3 && y4 === y3 && z4 === z3;

  const v1: QuadVertex3 = { x: x1, y: y1, z: z1 };
  const v2: QuadVertex3 = { x: x2, y: y2, z: z2 };
  const v3: QuadVertex3 = { x: x3, y: y3, z: z3 };
  const v4: QuadVertex3 = { x: x4, y: y4, z: z4 };

  // ⚠️ BOWTIE FIX: draw order = 1,2,4,3 (ΟΧΙ 1,2,3,4). Σε τρίγωνο (v4===v3) το
  // αποτέλεσμα [v1,v2,v3] είναι ήδη σωστό deduped τρίγωνο.
  const vertices: readonly QuadVertex3[] = isTriangle ? [v1, v2, v3] : [v1, v2, v4, v3];

  const hasNonZeroZ = z1 !== 0 || z2 !== 0 || z3 !== 0 || z4 !== 0;

  return { vertices, isTriangle, hasNonZeroZ };
}

/**
 * Κοινό builder (ΟΧΙ exported) — μετατρέπει parsed quad → `HatchEntity` (solid fill).
 * Οι 3 wrappers `convertSolid`/`convert3dFace`/`convertTrace` το καλούν με μόνο τη
 * διαφορά του label/idPrefix (jscpd-safe, N.18 — μηδέν clone στην πραγματική λογική).
 */
function convertQuadFill(
  data: Record<string, string>,
  layer: string,
  index: number,
  idPrefix: 'solid' | '3dface' | 'trace',
  entityLabel: 'SOLID' | '3DFACE' | 'TRACE'
): AnySceneEntity | null {
  const parsed = parseQuadVertices(data, entityLabel, index);
  if (!parsed) return null;

  if (parsed.hasNonZeroZ) {
    // 2D viewer — Z προβάλλεται στο XY (projectPointTo2D SSoT). Non-blocking note.
    dwarn('EntityConverter', `${entityLabel} ${index}: non-zero Z dropped in 2D projection`);
  }

  const boundary: Point2D[] = parsed.vertices.map(projectPointTo2D);
  const color = extractEntityColor(data);

  return {
    id: `${idPrefix}_${index}`,
    type: 'hatch',
    layerId: layer,
    visible: true,
    boundaryPaths: [boundary],
    patternName: 'SOLID',
    patternType: 'solid',
    fillType: 'solid',
    islandStyle: 'normal',
    // ADR-636 Φ2.4 (D.3) — remember the origin primitive so export reproduces the NATIVE
    // SOLID/TRACE/3DFACE (not a downgraded HATCH). `boundary` stays draw-order (1-2-4-3); the
    // export `emitQuadFill` un-bowties it back to the DXF 10/11/12/13 slots (inverse of parse).
    dxfSourceType: idPrefix,
    ...(color && { color }),
  };
}

/** Convert SOLID entity (filled quad/triangle, ίδιο byte-layout με TRACE). */
export function convertSolid(
  data: Record<string, string>,
  layer: string,
  index: number
): AnySceneEntity | null {
  return convertQuadFill(data, layer, index, 'solid', 'SOLID');
}

/** Convert 3DFACE entity (αληθινό 3D face· Z ανά κορυφή· code 70 = invisible edges, μη καταναλωμένο). */
export function convert3dFace(
  data: Record<string, string>,
  layer: string,
  index: number
): AnySceneEntity | null {
  return convertQuadFill(data, layer, index, '3dface', '3DFACE');
}

/** Convert TRACE entity (ιστορική πρόγονος του SOLID, bytewise ταυτόσημη). */
export function convertTrace(
  data: Record<string, string>,
  layer: string,
  index: number
): AnySceneEntity | null {
  return convertQuadFill(data, layer, index, 'trace', 'TRACE');
}
