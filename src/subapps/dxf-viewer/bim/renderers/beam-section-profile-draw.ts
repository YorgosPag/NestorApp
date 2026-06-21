/**
 * Beam steel I/H cross-section profile symbol drawing — ADR-363 Phase 5.5h + 5.5j.
 *
 * Extracted from `BeamRenderer` to keep that renderer under the 500-line Google
 * file-size limit (N.7.1). Pure drawing function: takes the canvas context, the
 * beam, the current viewport scale and a `worldToScreen` projector — zero `this`,
 * zero subscriptions (ADR-040 compliant).
 *
 * Symbol size adapts to beam screen width (Phase 5.5j): width is clamped to
 * [SECTION_SYMBOL_W_MIN_PX, SECTION_SYMBOL_W_MAX_PX] so it remains legible across
 * zoom levels. All proportional sub-dimensions (web, flange, offset) scale
 * uniformly with the computed width.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §6 Phase 5.5h
 */

import type { Point2D } from '../../rendering/types/Types';
import type { BeamEntity } from '../types/beam-types';
import { DEFAULT_I_FLANGE_THICKNESS_MM, DEFAULT_I_WEB_THICKNESS_MM } from '../types/column-types';
import { resolveSubcategoryStyle } from '../../config/bim-line-weight-resolver';
import { resolveCutState } from '../../config/bim-view-range';
import { useDrawingScaleStore } from '../../state/drawing-scale-store';
import { adaptBimBodyFill } from '../utils/bim-body-fill';
import { getLayer } from '../../stores/LayerStore';
import { isConcreteLineweight } from '../../config/lineweight-iso-catalog';
import { getBimEntityKeyPoints2D } from '../utils/bim-entity-points';
// ADR-507 Φ7 — material classification ενοποιήθηκε στο MATERIAL_HATCH_MAP SSoT.
import { normalizeMaterial } from '../hatch/material-hatch-map';
import {
  computeIProfileOutline,
  computeHProfileOutline,
  SECTION_PROFILE_W_PX,
  SECTION_PROFILE_H_PX,
  SECTION_WEB_W_PX,
  SECTION_FLANGE_T_PX,
  SECTION_H_FLANGE_T_PX,
  SECTION_OFFSET_PX,
  SECTION_MIN_SCALE,
  SECTION_MIN_BEAM_LEN_PX,
  SECTION_FILL_COLOR,
  SECTION_STROKE_COLOR,
  SECTION_LINE_WIDTH_PX,
  SECTION_SYMBOL_W_MIN_PX,
  SECTION_SYMBOL_W_MAX_PX,
  SECTION_SYMBOL_BEAM_W_RATIO,
} from '../beams/beam-section-profile';

/**
 * Draw the steel I/H cross-section profile symbol for a beam (hover/selection only).
 * No-op for non-steel beams or below the minimum legibility scale.
 */
export function drawBeamSectionProfile(
  ctx: CanvasRenderingContext2D,
  beam: BeamEntity,
  scale: number,
  worldToScreen: (p: Point2D) => Point2D,
): void {
  // ADR-363 Φ2 — το σύμβολο διατομής εμφανίζεται για μεταλλικό υλικό Ή όταν η
  // διατομή είναι ρητά I-shape (catalog) — ανεξάρτητα από το material ID.
  const isSteelSection =
    beam.params.sectionKind === 'I-shape' ||
    normalizeMaterial(beam.params.material) === 'steel';
  if (!isSteelSection) return;
  if (scale < SECTION_MIN_SCALE) return;

  const _spDs = useDrawingScaleStore.getState();
  const _spLayer = beam.layerId ? getLayer(beam.layerId) : null;
  const _spLayerOverride = _spLayer ? {
    lineweightMm: isConcreteLineweight(_spLayer.lineweight) ? _spLayer.lineweight : undefined,
    color: _spLayer.color ?? undefined,
  } : undefined;
  const _spZTop = beam.params.topElevation + (beam.params.zOffset ?? 0);
  const _spCutState = resolveCutState(
    { zBottomMm: _spZTop - beam.params.depth, zTopMm: _spZTop, category: 'beam' },
    _spDs.viewRange,
  );
  const { lineWidthPx: _spPx, color: _spCol } = resolveSubcategoryStyle({
    category: 'beam', subcategoryKey: 'section-profile',
    cutState: _spCutState, scaleDenominator: _spDs.drawingScale,
    dpi: 96, objectStyles: _spDs.objectStyles,
    elementOverride: beam.styleOverride, layerOverride: _spLayerOverride,
  });

  const [sp, ep] = getBimEntityKeyPoints2D(beam);

  const startS = worldToScreen(sp);
  const endS = worldToScreen(ep);
  const dx = endS.x - startS.x;
  const dy = endS.y - startS.y;
  const len = Math.hypot(dx, dy);
  if (len < SECTION_MIN_BEAM_LEN_PX) return;

  // Phase 5.5j — scale-adaptive symbol size: proportional to beam screen
  // width, clamped to [W_MIN, W_MAX] px.
  const beamWidthPx = beam.params.width * scale;
  const symW = Math.min(
    Math.max(beamWidthPx * SECTION_SYMBOL_BEAM_W_RATIO, SECTION_SYMBOL_W_MIN_PX),
    SECTION_SYMBOL_W_MAX_PX,
  );
  const symH = symW * (SECTION_PROFILE_H_PX / SECTION_PROFILE_W_PX);
  const symWebW = symW * (SECTION_WEB_W_PX / SECTION_PROFILE_W_PX);
  const symFlangeT = symW * (SECTION_FLANGE_T_PX / SECTION_PROFILE_W_PX);
  const symHFlangeT = symW * (SECTION_H_FLANGE_T_PX / SECTION_PROFILE_W_PX);
  const symOffset = SECTION_OFFSET_PX + (symW - SECTION_PROFILE_W_PX) * 0.3;

  // Perpendicular unit vector (screen space).
  const perpX = -dy / len;
  const perpY = dx / len;

  const midS = { x: (startS.x + endS.x) / 2, y: (startS.y + endS.y) / 2 };
  const beamHalfWidthPx = beamWidthPx / 2;
  const cx = midS.x + perpX * (beamHalfWidthPx + symOffset);
  const cy = midS.y + perpY * (beamHalfWidthPx + symOffset);

  const screenAngle = Math.atan2(dy, dx);
  // ADR-363 Φ2 — όταν υπάρχουν πραγματικά I-shape params (από catalog), το glyph
  // αποτυπώνει τις αληθινές αναλογίες h/b, tf/h, tw/b (clamped για ευκρίνεια).
  // Αλλιώς: το σχηματικό I/H hint βάσει sectionType.
  const ish = beam.params.ishape;
  let outline: ReadonlyArray<{ x: number; y: number }>;
  if (beam.params.sectionKind === 'I-shape' && ish && beam.params.width > 0 && beam.params.depth > 0) {
    const b = beam.params.width;
    const h = beam.params.depth;
    const tf = ish.flangeThickness ?? DEFAULT_I_FLANGE_THICKNESS_MM;
    const tw = ish.webThickness ?? DEFAULT_I_WEB_THICKNESS_MM;
    const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
    const realH = symW * clamp(h / b, 0.5, 4);
    const realWebW = symW * clamp(tw / b, 0.05, 0.5);
    const realFlangeT = realH * clamp(tf / h, 0.05, 0.45);
    outline = computeIProfileOutline(symW, realH, realWebW, realFlangeT);
  } else {
    const isHBeam = (beam.params.sectionType ?? 'I') === 'H';
    outline = isHBeam
      ? computeHProfileOutline(symW, symH, symWebW, symHFlangeT)
      : computeIProfileOutline(symW, symH, symWebW, symFlangeT);
  }

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(screenAngle + Math.PI / 2);
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(outline[0].x, outline[0].y);
  for (let i = 1; i < outline.length; i++) {
    ctx.lineTo(outline[i].x, outline[i].y);
  }
  ctx.closePath();
  // FULL SSoT (bim-body-fill) — κοινό adaptive layer με όλα τα BIM body fills.
  ctx.fillStyle = adaptBimBodyFill(SECTION_FILL_COLOR);
  ctx.fill();
  ctx.strokeStyle = _spCol ?? SECTION_STROKE_COLOR;
  ctx.lineWidth = _spPx ?? SECTION_LINE_WIDTH_PX;
  ctx.stroke();
  ctx.restore();

  if (beam.params.profileDesignation) {
    const labelOffsetPx = symW / 2 + 8;
    const labelX = cx + perpX * labelOffsetPx;
    const labelY = cy + perpY * labelOffsetPx;
    ctx.save();
    ctx.font = 'bold 8px sans-serif';
    ctx.fillStyle = SECTION_STROKE_COLOR;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(beam.params.profileDesignation, labelX, labelY);
    ctx.restore();
  }
}
