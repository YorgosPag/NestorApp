/**
 * ADR-471 — Beam reinforcement detail · SECTION view builder (pure SSoT).
 *
 * Παράγει την **εγκάρσια διατομή** (πλάτος b × ύψος h) της δοκού σε sheet-mm: λεπτό
 * περίγραμμα σκυροδέματος, ο συνδετήρας ως κλειστή στρογγυλεμένη διαδρομή στο cover
 * και οι διαμήκεις ράβδοι ως κουκκίδες στις θέσεις (v, w) της διατομής — συν τις
 * διαστάσεις πλάτους/ύψους και την κλίμακα. Είναι η «τυπική διατομή» (Section A-A):
 * δείχνει ΟΛΕΣ τις διακριτές θέσεις ράβδων (κάτω συνεχείς + άνω αναρτήρες/στηρίξεων),
 * γι' αυτό η ένωση όλων των (v, w) — οι στηρίξεων μοιράζονται θέση με την άνω σειρά.
 *
 * Geometry-is-SSoT: η διάταξη προέρχεται από το ΕΝΑ `resolveBeamRebarLayout` (ίδιο
 * mm space με την 2Δ κάτοψη / 3Δ κλωβό / όψη) — ΠΟΤΕ ξανα-υπολογισμένη εδώ. Mirror
 * του `column-detail-plan.ts` (η κάτοψη της κολόνας ΕΙΝΑΙ η διατομή της).
 *
 * @module subapps/dxf-viewer/bim/structural/detail-sheet/beam-detail-section
 * @see docs/centralized-systems/reference/adrs/ADR-471-unified-member-reinforcement.md §3
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { BeamEntity } from '../../types/beam-types';
import { buildBeamSectionContext } from '../section-context';
import { resolveBeamRebarLayout, type BeamRebarBar } from '../reinforcement/beam-rebar-layout';
import type { BeamReinforcement } from '../reinforcement/beam-reinforcement-types';
import { pickScaleDenominator } from './detail-sheet-fit';
import type { DetailPrimitive, RectMm } from './detail-sheet-types';
// ADR-471 Slice 6 — χρώμα οπλισμού από το ΕΝΑ SSoT (πρώην inline literal σε 10 αρχεία).
import { REBAR_COLOR_HEX as REBAR_HEX } from '../rebar-catalog';

const CONCRETE_OUTLINE_HEX = '#b0b0b0';
const DIM_HEX = '#333333';
const CONCRETE_OUTLINE_WIDTH_MM = 0.18;
const MIN_BAR_RADIUS_MM = 0.7;
const MIN_STIRRUP_WIDTH_MM = 0.3;
const DIM_WIDTH_MM = 0.13;
const DIM_TEXT_HEIGHT_MM = 2.6;

const TITLE_PAD_MM = 9;
const LEFT_DIM_PAD_MM = 14;
const RIGHT_DIM_PAD_MM = 8;
const BOTTOM_PAD_MM = 9;
const WIDTH_DIM_OFFSET_MM = 6;
const DEPTH_DIM_OFFSET_MM = 6;
/** Ανοχή ταύτισης θέσης ράβδου (mm) — dedupe επικαλυπτόμενων (v, w). */
const BAR_DEDUP_TOL_MM = 3;

export interface BeamSectionResult {
  readonly primitives: readonly DetailPrimitive[];
  readonly caption?: string;
}

/** Διακριτές θέσεις διατομής (v, w) όλων των διαμήκων ράβδων (dedup ανοχής). */
function distinctBarPositions(bars: readonly BeamRebarBar[]): BeamRebarBar[] {
  const out: BeamRebarBar[] = [];
  for (const bar of bars) {
    const dup = out.some((o) => Math.abs(o.vMm - bar.vMm) < BAR_DEDUP_TOL_MM && Math.abs(o.wMm - bar.wMm) < BAR_DEDUP_TOL_MM);
    if (!dup) out.push(bar);
  }
  return out;
}

/**
 * Builds the section-region primitives for a reinforced beam. The active
 * reinforcement is injected (host resolves it store-aware → PDF === live).
 * Returns empty primitives for missing reinforcement / degenerate geometry.
 */
export function buildBeamSectionRegion(
  beam: BeamEntity,
  r: BeamReinforcement | undefined,
  region: RectMm,
): BeamSectionResult {
  if (!r) return { primitives: [] };
  const layout = resolveBeamRebarLayout(buildBeamSectionContext(beam), r);
  if (!layout) return { primitives: [] };

  const widthMm = layout.widthMm;
  const depthMm = layout.depthMm;
  if (widthMm <= 0 || depthMm <= 0) return { primitives: [] };

  const availW = region.w - LEFT_DIM_PAD_MM - RIGHT_DIM_PAD_MM;
  const availH = region.h - TITLE_PAD_MM - BOTTOM_PAD_MM;
  const denom = pickScaleDenominator(widthMm, depthMm, availW, availH);
  const s = 1 / denom;

  const centerX = region.x + LEFT_DIM_PAD_MM + availW / 2;
  const centerY = region.y + TITLE_PAD_MM + availH / 2;
  // beam-local cross-section (v centred ±b/2, w centred ±h/2, w up) → sheet-mm (y down).
  const toSheet = (vMm: number, wMm: number): Point2D => ({ x: centerX + vMm * s, y: centerY - wMm * s });

  const halfB = widthMm / 2;
  const halfH = depthMm / 2;
  const out: DetailPrimitive[] = [];

  // ── Faint concrete outline (b × h) ──
  out.push({
    kind: 'polyline',
    points: [toSheet(-halfB, -halfH), toSheet(halfB, -halfH), toSheet(halfB, halfH), toSheet(-halfB, halfH)],
    closed: true,
    stroke: { colorHex: CONCRETE_OUTLINE_HEX, widthMm: CONCRETE_OUTLINE_WIDTH_MM },
  });

  // ── Stirrup (closed rounded path at the cover, x=v y=w) ──
  if (layout.stirrupSectionPathMm.length >= 2) {
    out.push({
      kind: 'polyline',
      points: layout.stirrupSectionPathMm.map((p) => toSheet(p.x, p.y)),
      closed: true,
      stroke: { colorHex: REBAR_HEX, widthMm: Math.max(MIN_STIRRUP_WIDTH_MM, layout.stirrupDiameterMm * s) },
    });
  }

  // ── Longitudinal bars as dots at every distinct cross-section position ──
  for (const bar of distinctBarPositions(layout.longitudinalBars)) {
    out.push({
      kind: 'circle',
      center: toSheet(bar.vMm, bar.wMm),
      radiusMm: Math.max(MIN_BAR_RADIUS_MM, (bar.diameterMm / 2) * s),
      fillHex: REBAR_HEX,
    });
  }

  // ── Dimensions: width (bottom), depth (left) ──
  const dimStroke = { colorHex: DIM_HEX, widthMm: DIM_WIDTH_MM };
  out.push({
    kind: 'dim',
    p1: toSheet(-halfB, -halfH), p2: toSheet(halfB, -halfH), offsetMm: WIDTH_DIM_OFFSET_MM,
    text: String(Math.round(widthMm)), stroke: dimStroke, textHeightMm: DIM_TEXT_HEIGHT_MM,
  });
  out.push({
    kind: 'dim',
    p1: toSheet(-halfB, -halfH), p2: toSheet(-halfB, halfH), offsetMm: -DEPTH_DIM_OFFSET_MM,
    text: String(Math.round(depthMm)), stroke: dimStroke, textHeightMm: DIM_TEXT_HEIGHT_MM,
  });

  return { primitives: out, caption: `1:${denom}` };
}
