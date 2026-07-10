/**
 * ADR-531 Φ5b → ADR-608 — Tekton `<dim>` record → **native `LinearDimensionEntity`**.
 *
 * Ο Τέκτων κρατά κάθε διάσταση ως ΕΝΑ παραμετρικό record: γραμμή `end0`→`end1` (με κενό
 * `gap0`/`gap1` για το κείμενο), έτοιμο κείμενο `<s>`, χρώμα γραμμής/κειμένου, μέγεθος,
 * `end_style`. Παλιά το εκρήγνυμε (`tekDimToEntities`) σε dumb line/text primitives → χάνονταν
 * ο «οργανισμός» (associativity/style/grips). Εδώ το χαρτογραφούμε στο δικό μας **παραμετρικό**
 * `DimensionEntity`, ώστε renderer/grips/style να το χειρίζονται **ενιαία, όπως ο Τέκτων**:
 * η πράσινη γραμμή σπάει μόνη της για το κείμενο (`dimgap`) και το κείμενο κεντράρεται στον
 * άξονα — δωρεάν από τον `buildDimensionGeometry`. Κάθε `<seg>` = ΕΝΑ dimension (chain = follow-up).
 *
 * ΚΡΙΣΙΜΟ (×scale): τα `end0`/`end1` είναι σε **paper-scaled** μέτρα (π.χ. μήκος 2.6), ενώ η
 * ετικέτα του Τέκτονα δείχνει το ΠΡΑΓΜΑΤΙΚΟ μήκος (π.χ. "5.20"). Γι' αυτό βάζουμε το **έτοιμο**
 * `<s>` string ως `userText` override → σωστή ετικέτα ανεξαρτήτως κλίμακας (preserve-and-replay,
 * όπως οι σκάλες) αντί να αφήσουμε τη γεωμετρία να μετρήσει λάθος τιμή.
 */

import { generateDimensionId } from '@/services/enterprise-id-convenience';
import { tekMetersToScene } from '../../export/core/tek/tek-geometry';
import { tekColorToHex } from './tek-color';
import { hexToTrueColor } from '../../utils/dxf-true-color';
import { hexToAci } from '../../ui/text-toolbar/controls/aci-palette';
import { radToDeg, normalizeAngleDeg } from '../../rendering/entities/shared/geometry-angle-utils';
import { getDimStyleRegistry } from '../../systems/dimensions/dim-style-registry';
import {
  NESTOR_DIM_ANNOTATION_SCALE,
  NESTOR_DIM_TEXT_HEIGHT,
  NESTOR_DIM_ARROW_SIZE,
  NESTOR_DIM_ARROW_BLOCK,
  NESTOR_DIM_TEXT_PLACEMENT,
  NESTOR_DIM_TEXT_FILL,
} from '../../systems/dimensions/nestor-dim-appearance';
import type { DimensionOverride, LinearDimensionEntity } from '../../types/dimension';
import type { Point2D } from '../../rendering/types/Types';
import type { SceneUnits } from '../../utils/scene-units';
import type { TekDimRecord, TekDimSeg, TekPoint2D } from './tek-import-types';

/** Ένα tek σημείο (μέτρα, Y-up) → scene `Point2D` (Y-flip μέσω του SSoT `tekMetersToScene`). */
function toScene(p: TekPoint2D, units: SceneUnits): Point2D {
  return tekMetersToScene(p.x, p.y, units);
}

/**
 * `end_style_res` του Τέκτονα → arrowhead block name (SSoT `ARROWHEAD_BLOCKS`). ΜΟΝΟ panel-verified
 * τιμές — 8 = «Βέλος 2» = `NESTOR_DIM_ARROW_BLOCK` (tektonArrow2). Άγνωστο style → `undefined`
 * (κληρονομεί το `dimblk` του ενεργού DimStyle).
 */
const TEK_END_STYLE_ARROW_BLOCK: Readonly<Record<number, string>> = {
  8: NESTOR_DIM_ARROW_BLOCK,
};

/**
 * Style override από τα **4 ξεχωριστά** χρώματα του Τέκτονα (panel «Εμφάνιση»): γραμμή (`<color>`),
 * κείμενο (`<dtext_color>`), βέλη (`<ends_color>`, μπορντώ), witness (`<drv_color>`, μπλε) + τύπο άκρου
 * (`<end_style>`→`dimblk`). Κάθε χρώμα: truecolor (ακριβές hex, wins στο render) + ACI companion
 * (nearest-match, DXF round-trip)· absent → line color.
 *
 * Το **μέγεθος/διάταξη/μάσκα** (dimscale/dimtxt/dimasz/dimtad/dimtfill) έρχεται από την κοινή SSoT
 * `nestor-dim-appearance` — **ΙΔΙΟ** με τις app-created διαστάσεις (μηδέν απόκλιση app ↔ Tekton).
 * Μόνο τα ΧΡΩΜΑΤΑ διαφέρουν (εδώ ανά-record του Τέκτονα· app = πράσινη ταυτότητα Nestor).
 */
function dimOverrides(rec: TekDimRecord): DimensionOverride {
  const lineHex = tekColorToHex(rec.color);
  const textHex = rec.dtextColor ? tekColorToHex(rec.dtextColor) : lineHex;
  const arrowHex = rec.endsColor ? tekColorToHex(rec.endsColor) : lineHex;
  const witnessHex = rec.drvColor ? tekColorToHex(rec.drvColor) : lineHex;
  const arrowBlock = TEK_END_STYLE_ARROW_BLOCK[rec.endStyle];
  return {
    dimclrd: hexToAci(lineHex), dimclrdTrueColor: hexToTrueColor(lineHex),
    dimclre: hexToAci(witnessHex), dimclreTrueColor: hexToTrueColor(witnessHex),
    dimclrt: hexToAci(textHex), dimclrtTrueColor: hexToTrueColor(textHex),
    arrowColor: hexToAci(arrowHex), arrowTrueColor: hexToTrueColor(arrowHex),
    dimasz: NESTOR_DIM_ARROW_SIZE,
    dimscale: NESTOR_DIM_ANNOTATION_SCALE,
    dimtad: NESTOR_DIM_TEXT_PLACEMENT,
    dimtxt: NESTOR_DIM_TEXT_HEIGHT,
    dimtfill: NESTOR_DIM_TEXT_FILL,
    ...(arrowBlock ? { dimblk: arrowBlock } : {}),
  };
}

/**
 * Def points μιας πατιάς — `[extOrigin1, extOrigin2, dimLineRef]` (semantic του linear dim):
 * extension origins = τα σημεία αναφοράς `<inter>` (witness bases) αν υπάρχουν, αλλιώς τα άκρα
 * της γραμμής `end0`/`end1` (μηδέν witness). `dimLineRef` = `end0` → η γραμμή διάστασης περνά
 * ακριβώς από τα άκρα του Τέκτονα. `rotation` = κατεύθυνση της γραμμής (`end0`→`end1`).
 */
function segDefPoints(
  seg: TekDimSeg, refPoints: readonly TekPoint2D[], units: SceneUnits,
): { defPoints: Point2D[]; rotationDeg: number } {
  const origin1 = refPoints.length >= 2 ? refPoints[0] : seg.end0;
  const origin2 = refPoints.length >= 2 ? refPoints[1] : seg.end1;
  const end0 = toScene(seg.end0, units);
  const end1 = toScene(seg.end1, units);
  const rotationDeg = normalizeAngleDeg(radToDeg(Math.atan2(end1.y - end0.y, end1.x - end0.x)));
  return { defPoints: [toScene(origin1, units), toScene(origin2, units), end0], rotationDeg };
}

/**
 * Tekton `<dim>` record → native `LinearDimensionEntity[]` (μία ανά πατιά `<seg>`). styleId = το
 * ενεργό dim style· gap/κεντράρισμα/βέλη τα αναλαμβάνει ο δικός μας dimension renderer (SSoT).
 */
export function tekDimToDimensionEntities(
  rec: TekDimRecord, units: SceneUnits,
): LinearDimensionEntity[] {
  const activeStyle = getDimStyleRegistry().getActiveStyle();
  const overrides = dimOverrides(rec);
  return rec.segs.map((seg) => {
    const { defPoints, rotationDeg } = segDefPoints(seg, rec.refPoints, units);
    return {
      id: generateDimensionId(),
      type: 'dimension',
      layerId: '',
      dimensionType: 'linear',
      styleId: activeStyle.id,
      defPoints,
      rotation: rotationDeg,
      userText: seg.text || '<>', // έτοιμο string Τέκτονα· κενό → measured token
      overrides,
    } satisfies LinearDimensionEntity;
  });
}
