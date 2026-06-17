/**
 * ADR-471 — Beam reinforcement detail · ELEVATION (longitudinal) view builder (pure SSoT).
 *
 * Η **κύρια** όψη της δοκού: πλάγια προβολή κατά μήκος (άνοιγμα × ύψος) με
 *   - λεπτό περίγραμμα σκυροδέματος,
 *   - τις **διαμήκεις** ράβδους ως οριζόντιες γραμμές στις στάθμες w (κάτω συνεχείς,
 *     άνω αναρτήρες συνεχείς, άνω **στηρίξεων** curtailed κοντά στα άκρα — ορατές
 *     ως εσωτερική γραμμή ώστε να διαβάζεται η διακοπή),
 *   - τους **συνδετήρες** ως κατακόρυφες γραμμές στις στάθμες `stirrupLevelsMm`
 *     (πύκνωση κρίσιμης ζώνης lcr στα άκρα, EC8), με γάντζο 135° για `closed-hooked`,
 *   - τις διαστάσεις βήματος συνδετήρων ομαδοποιημένες σε ζώνες (`count×gap`, πάνω),
 *   - τη συνολική διάσταση ανοίγματος (κάτω) + ύψους (αριστερά) + ετικέτα συνδετήρων.
 *
 * Geometry-is-SSoT: ΟΛΕΣ οι θέσεις προέρχονται από το ΕΝΑ `resolveBeamRebarLayout`
 * (ίδιο mm space με 2Δ/3Δ/διατομή) — ΠΟΤΕ ξανα-υπολογισμένες. Mirror του
 * `column-detail-elevation.ts`, αλλά **longitudinal** (κατά μήκος αντί καθ' ύψος).
 *
 * @module subapps/dxf-viewer/bim/structural/detail-sheet/beam-detail-elevation
 * @see docs/centralized-systems/reference/adrs/ADR-471-unified-member-reinforcement.md §3
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { BeamEntity } from '../../types/beam-types';
import { buildBeamSectionContext } from '../section-context';
import { resolveBeamRebarLayout, type BeamRebarBar } from '../reinforcement/beam-rebar-layout';
import { DEFAULT_STIRRUP_TYPE, type BeamReinforcement } from '../reinforcement/beam-reinforcement-types';
import { formatBeamStirrupsLabel } from '../reinforcement/beam-reinforcement-compute';
import { pickScaleDenominator } from './detail-sheet-fit';
import { groupSpacingZones, formatSpacingZoneLabel } from './detail-sheet-spacing';
import type { DetailPrimitive, RectMm } from './detail-sheet-types';

const CONCRETE_OUTLINE_HEX = '#b0b0b0';
const REBAR_HEX = '#c0392b';
const DIM_HEX = '#333333';
const LABEL_HEX = '#444444';
const CONCRETE_OUTLINE_WIDTH_MM = 0.18;
const MIN_BAR_WIDTH_MM = 0.35;
const MIN_STIRRUP_WIDTH_MM = 0.3;
const DIM_WIDTH_MM = 0.13;
const DIM_TEXT_HEIGHT_MM = 2.6;
const LABEL_HEIGHT_MM = 2.4;

const TITLE_PAD_MM = 9;
const LEFT_DIM_PAD_MM = 15;
const RIGHT_PAD_MM = 8;
const TOP_DIM_PAD_MM = 11;
const BOTTOM_LABEL_PAD_MM = 11;
const SPAN_DIM_OFFSET_MM = 7;
const HEIGHT_DIM_OFFSET_MM = 7;
const SPACING_DIM_OFFSET_MM = 6;
const SPACING_DIM_TEXT_MM = 2;
/** Κλάσμα ύψους για το εσωτερικό offset των άνω ράβδων στηρίξεων (ορατότητα curtailment). */
const SUPPORT_BAR_INSET_FRACTION = 0.12;

export interface BeamElevationResult {
  readonly primitives: readonly DetailPrimitive[];
  readonly caption?: string;
}

/** Κλειδί dedupe μιας διαμήκους γραμμής στην όψη (ίδιο επίπεδο+διάστημα → μία γραμμή). */
function barLineKey(bar: BeamRebarBar): string {
  return `${bar.layer}|${bar.role}|${Math.round(bar.uStartMm)}|${Math.round(bar.uEndMm)}`;
}

/** Κατακόρυφο half-extent του συνδετήρα (max |w| της διατομικής διαδρομής). */
function stirrupHalfDepthMm(pathMm: readonly Point2D[]): number {
  let m = 0;
  for (const p of pathMm) m = Math.max(m, Math.abs(p.y));
  return m;
}

/**
 * Builds the longitudinal-elevation primitives for a reinforced beam. Returns
 * empty primitives for missing reinforcement / degenerate geometry.
 */
export function buildBeamElevationRegion(
  beam: BeamEntity,
  r: BeamReinforcement | undefined,
  region: RectMm,
): BeamElevationResult {
  if (!r) return { primitives: [] };
  const layout = resolveBeamRebarLayout(buildBeamSectionContext(beam), r);
  if (!layout) return { primitives: [] };

  const spanMm = layout.spanMm;
  const depthMm = layout.depthMm;
  if (spanMm <= 0 || depthMm <= 0) return { primitives: [] };

  const availW = region.w - LEFT_DIM_PAD_MM - RIGHT_PAD_MM;
  const availH = region.h - TITLE_PAD_MM - TOP_DIM_PAD_MM - BOTTOM_LABEL_PAD_MM;
  const denom = pickScaleDenominator(spanMm, depthMm, availW, availH);
  const s = 1 / denom;

  const drawnW = spanMm * s;
  const leftX = region.x + LEFT_DIM_PAD_MM + (availW - drawnW) / 2;
  const centerY = region.y + TITLE_PAD_MM + TOP_DIM_PAD_MM + availH / 2;
  // beam-local (u ∈ [0, span], w centred ±h/2, w up) → sheet-mm (y down).
  const toSheet = (u: number, w: number): Point2D => ({ x: leftX + u * s, y: centerY - w * s });

  const halfH = depthMm / 2;
  const out: DetailPrimitive[] = [];

  // ── Faint concrete outline (span × depth) ──
  out.push({
    kind: 'polyline',
    points: [toSheet(0, -halfH), toSheet(spanMm, -halfH), toSheet(spanMm, halfH), toSheet(0, halfH)],
    closed: true,
    stroke: { colorHex: CONCRETE_OUTLINE_HEX, widthMm: CONCRETE_OUTLINE_WIDTH_MM },
  });

  // ── Longitudinal bars (deduped horizontal lines· support bars inset for visibility) ──
  const supportInset = depthMm * SUPPORT_BAR_INSET_FRACTION;
  const seen = new Set<string>();
  for (const bar of layout.longitudinalBars) {
    const key = barLineKey(bar);
    if (seen.has(key)) continue;
    seen.add(key);
    const w = bar.role === 'support' ? bar.wMm - supportInset : bar.wMm;
    out.push({
      kind: 'line',
      a: toSheet(bar.uStartMm, w), b: toSheet(bar.uEndMm, w),
      stroke: { colorHex: REBAR_HEX, widthMm: Math.max(MIN_BAR_WIDTH_MM, bar.diameterMm * s) },
    });
  }

  // ── Stirrups (vertical lines at the SSoT levels· 135° top hook for closed-hooked) ──
  const stirrupHalfH = stirrupHalfDepthMm(layout.stirrupSectionPathMm);
  const stirrupWidthMm = Math.max(MIN_STIRRUP_WIDTH_MM, layout.stirrupDiameterMm * s);
  const hooked = (r.stirrups.type ?? DEFAULT_STIRRUP_TYPE) === 'closed-hooked';
  const hookLenMm = Math.min(stirrupHalfH * 0.5, depthMm * 0.18);
  const stirrupStroke = { colorHex: REBAR_HEX, widthMm: stirrupWidthMm };
  for (const u of layout.stirrupLevelsMm) {
    out.push({ kind: 'line', a: toSheet(u, -stirrupHalfH), b: toSheet(u, stirrupHalfH), stroke: stirrupStroke });
    if (hooked) {
      out.push({ kind: 'line', a: toSheet(u, stirrupHalfH), b: toSheet(u + hookLenMm, stirrupHalfH - hookLenMm), stroke: stirrupStroke });
    }
  }

  // ── Stirrup spacing dimensions (grouped zones, above the elevation) ──
  const dimStroke = { colorHex: DIM_HEX, widthMm: DIM_WIDTH_MM };
  for (const zone of groupSpacingZones(layout.stirrupLevelsMm)) {
    out.push({
      kind: 'dim',
      p1: toSheet(zone.start, halfH), p2: toSheet(zone.end, halfH),
      offsetMm: -SPACING_DIM_OFFSET_MM, text: formatSpacingZoneLabel(zone),
      stroke: dimStroke, textHeightMm: SPACING_DIM_TEXT_MM,
    });
  }

  // ── Overall span dimension (bottom) + depth dimension (left) ──
  out.push({
    kind: 'dim',
    p1: toSheet(0, -halfH), p2: toSheet(spanMm, -halfH), offsetMm: SPAN_DIM_OFFSET_MM,
    text: String(Math.round(spanMm)), stroke: dimStroke, textHeightMm: DIM_TEXT_HEIGHT_MM,
  });
  out.push({
    kind: 'dim',
    p1: toSheet(0, -halfH), p2: toSheet(0, halfH), offsetMm: -HEIGHT_DIM_OFFSET_MM,
    text: String(Math.round(depthMm)), stroke: dimStroke, textHeightMm: DIM_TEXT_HEIGHT_MM,
  });

  // ── Stirrup label (Ø8/100-200) below the elevation ──
  out.push({
    kind: 'text',
    position: { x: leftX + drawnW / 2, y: toSheet(0, -halfH).y + BOTTOM_LABEL_PAD_MM * 0.7 },
    text: formatBeamStirrupsLabel(r), heightMm: LABEL_HEIGHT_MM, colorHex: LABEL_HEX, align: 'center',
  });

  return { primitives: out, caption: `1:${denom}` };
}
