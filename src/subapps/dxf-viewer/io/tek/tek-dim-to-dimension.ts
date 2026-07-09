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
import type { DimensionOverride, LinearDimensionEntity } from '../../types/dimension';
import type { Point2D } from '../../rendering/types/Types';
import type { SceneUnits } from '../../utils/scene-units';
import type { TekDimRecord, TekDimSeg, TekPoint2D } from './tek-import-types';

/** Ένα tek σημείο (μέτρα, Y-up) → scene `Point2D` (Y-flip μέσω του SSoT `tekMetersToScene`). */
function toScene(p: TekPoint2D, units: SceneUnits): Point2D {
  return tekMetersToScene(p.x, p.y, units);
}

/**
 * `end_style_res` του Τέκτονα → arrowhead block name του SSoT (`ARROWHEAD_BLOCKS`). ΜΟΝΟ
 * panel-verified τιμές — 8 = «Βέλος 2» = τριγωνικό γεμάτο = custom `tektonArrow2` (base 0.050 :
 * μήκος 0.120). Άγνωστο style → `undefined` (κληρονομεί το `dimblk` του ενεργού DimStyle).
 */
const TEK_END_STYLE_ARROW_BLOCK: Readonly<Record<number, string>> = {
  8: 'tektonArrow2',
};

/**
 * ADR-608 — **Annotation scale** (Giorgio 2026-07-09: «σαν Τέκτονας»). Οι διαστάσεις Τέκτονα
 * σχεδιάζονται σε ΠΡΑΓΜΑΤΙΚΟ μέγεθος (βέλος 0.120m, κείμενο ~0.25m) → μικροσκοπικές σε προβολή
 * κτιρίου (model-space, μικραίνουν στο zoom-out). Λύση: override `dimscale` = `TEK_RENDER_DIMSCALE
 * × TEK_DIM_ANNOTATION_MAG` → κλιμακώνει ΟΜΟΙΟΜΟΡΦΑ κείμενο + βέλος + κενά + προεκτάσεις (γνήσιο
 * annotation scale), κρατώντας ΟΛΕΣ τις αναλογίες (βάση:μήκος, text:arrow). Καθολικός συντελεστής
 * μεγέθους ΟΛΟΥ ΤΟΥ ΣΥΣΤΗΜΑΤΟΣ σήμανσης — η **μετρούμενη διάσταση (γεωμετρία/defPoints) ΔΕΝ
 * επηρεάζεται** (ο dimscale κλιμακώνει μόνο τη σήμανση). Giorgio 2026-07-09: «μίκρυνε όλο το σύστημα
 * χωρίς να αλλάξει το μήκος» → μείωση MAG. Browser-βαθμονομούμενος: άλλαξε ΜΟΝΟ το `TEK_DIM_ANNOTATION_MAG`.
 */
const TEK_DIM_ANNOTATION_MAG = 1.5;

/**
 * ADR-608 — ΡΗΤΟ ύψος κειμένου διάστασης (`dimtxt`, paper-mm· Giorgio 2026-07-10: «ύψος κειμένου
 * = 0.8»). Ξεχωριστό από τα βέλη (`dimasz` ανέπαφο)· κλιμακώνεται με το `dimscale` όπως όλα.
 * Browser-βαθμονομούμενο: νέα προτίμηση Giorgio → άλλαξε ΜΟΝΟ αυτή την τιμή.
 */
const TEK_DIM_TEXT_HEIGHT = 0.8;

/**
 * Μέγεθος βέλους «Βέλος 2» — **ΡΗΤΗ browser-βαθμονόμηση** (Giorgio 2026-07-09, step-by-step). Δύο
 * ανεξάρτητες διαστάσεις (γι' αυτό custom `tektonArrow2` block, όχι `closedFilled`):
 *  - **ΜΗΚΟΣ** (μέσο βάσης → κορυφή, εκεί που συγκλίνουν οι πλάγιες) = `TEK_ARROW_LENGTH_M` (0.120m)
 *    → εδώ, μέσω `dimasz` (block length = 1.0 unit).
 *  - **ΒΑΣΗ** (κάθετη γραμμή) = 0.050m → κωδικοποιημένη στο `TEKTON_ARROW2_HALF_WIDTH` του block
 *    (`dim-arrowhead-blocks.ts`), ΟΧΙ εδώ.
 *
 * Ο renderer: length = `dimasz × dimscale × mmToSceneUnits` (scene = mm, `dimscale` = drawing scale
 * default `TEK_RENDER_DIMSCALE` 1:100, βλ. `resolveEffectiveDimscale`+`DEFAULT_DRAWING_SCALE`). Άρα
 * `dimasz(paper-mm) = length_mm / dimscale`. Νέα μέτρηση Giorgio → άλλαξε `TEK_ARROW_LENGTH_M` (μήκος)
 * ή το `TEKTON_ARROW2_HALF_WIDTH` του block (βάση).
 */
const TEK_ARROW_LENGTH_M = 0.12;
const TEK_RENDER_DIMSCALE = 100;
const M_TO_MM = 1000;

function resolveArrowSizeMm(): number {
  return (TEK_ARROW_LENGTH_M * M_TO_MM) / TEK_RENDER_DIMSCALE;
}

/**
 * Style override από τα **4 ξεχωριστά** χρώματα + βέλος του Τέκτονα (panel «Εμφάνιση»):
 * γραμμή διάστασης (`<color>`), κείμενο (`<dtext_color>`), βέλη/άκρα (`<ends_color>`, μπορντώ),
 * οδηγοί/witness (`<drv_color>`, μπλε), τύπος άκρου (`<end_style>`→`dimblk`), μέγεθος βέλους (`dimasz`
 * = ρητή βαθμονόμηση) + **annotation scale** (`dimscale`, βλ. `TEK_DIM_ANNOTATION_MAG`). Κάθε χρώμα
 * παίρνει truecolor (ακριβές hex, wins στο render) + ACI companion (nearest-match, DXF round-trip).
 * Absent κανάλι → line color.
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
    dimasz: resolveArrowSizeMm(),
    dimscale: TEK_RENDER_DIMSCALE * TEK_DIM_ANNOTATION_MAG,
    // Κείμενο ΟΜΟΑΞΩΝΙΚΟ με τη γραμμή διάστασης (κεντραρισμένο στον άξονα, όχι «above») — Giorgio.
    dimtad: 'centered',
    // Ρητό ύψος κειμένου (τα βέλη μένουν) — βλ. `TEK_DIM_TEXT_HEIGHT`.
    dimtxt: TEK_DIM_TEXT_HEIGHT,
    // Μάσκα κειμένου = ΦΟΝΤΟ ΣΧΕΔΙΟΥ (καμβάς Nestor 2Δ), ώστε το κείμενο να «κόβει» τη γραμμή — Giorgio.
    dimtfill: 'backgroundColor',
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
