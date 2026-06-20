/**
 * ADR-505 (finish/rebar phase D) — 3Δ rebar SEGMENTS κολώνας + γραμμικού μέλους (pure SSoT).
 *
 * Mirror της segment-assembly των 3Δ mesh builders (`column-rebar-3d` / `linear-member-rebar-3d`)
 * αλλά σε **scene units + zMm σχετικό με τη βάση** (DXF pseudo-3D χώρος) αντί για three.js
 * μέτρα + baseY + AXIS_FLIP. Reuse ΟΛΟΥ του rebar **math** (resolveActive*Reinforcement +
 * layout + levels + columnLocalMmToWorld + samplePolylineFrame) — καμία νέα γεωμετρική μαθηματική·
 * μόνο η σύνδεση σε segments εκφράζεται στον DXF χώρο. Καταναλώνεται από τον DXF export collector.
 *
 * @see ../../../bim-3d/converters/column-rebar-3d.ts — ο 3Δ mesh δίδυμος (ίδιο math SSoT)
 * @see ../../../bim-3d/converters/linear-member-rebar-3d.ts — ο 3Δ mesh δίδυμος δοκού
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { SceneUnits } from '../../../utils/scene-units';
import { mmToSceneUnits } from '../../../utils/scene-units';
import type { ColumnEntity } from '../../types/column-types';
import type { BeamEntity } from '../../types/beam-types';
import { columnLocalMmToWorld } from '../../geometry/column-geometry';
import { samplePolylineFrame } from '../../geometry/shared/polyline-frame';
import { computeStirrupLevelsMm } from './column-rebar-layout';
import { resolveColumnRebarLayout, resolveColumnCrossTies } from './column-rebar-layout-resolve';
import { resolveColumnReinforcementSection } from './column-section-outline';
import { resolveActiveColumnReinforcementForEntity, resolveActiveBeamRebarLayout } from '../active-reinforcement';
import { DEFAULT_STIRRUP_TYPE as COLUMN_DEFAULT_STIRRUP } from './column-reinforcement-types';
import { DEFAULT_STIRRUP_TYPE as BEAM_DEFAULT_STIRRUP, type StirrupType } from './beam-reinforcement-types';
import type { BeamRebarLayout } from './beam-rebar-layout';
import type { RebarSeg3D, RebarPoint3D } from './rebar-plan-geometry-types';

const pt = (p: Point2D, zMm: number): RebarPoint3D => ({ x: p.x, y: p.y, zMm });

/** Κλειστά δαχτυλίδια (στρογγυλεμένων γωνιών polyline) σε κάθε στάθμη zMm. */
function ringAtLevels(ringXY: readonly Point2D[], levelsMm: readonly number[], out: RebarSeg3D[]): void {
  for (const z of levelsMm) {
    for (let i = 0; i < ringXY.length; i++) {
      out.push({ a: pt(ringXY[i], z), b: pt(ringXY[(i + 1) % ringXY.length], z) });
    }
  }
}

/** Ανοιχτή αλυσίδα (cross-tie / γάντζος) σε κάθε στάθμη — ΧΩΡΙΣ κλείσιμο last→first. */
function chainAtLevels(chainXY: readonly Point2D[], levelsMm: readonly number[], out: RebarSeg3D[]): void {
  if (chainXY.length < 2) return;
  for (const z of levelsMm) {
    for (let i = 1; i < chainXY.length; i++) out.push({ a: pt(chainXY[i - 1], z), b: pt(chainXY[i], z) });
  }
}

/** Γάντζοι 135° (precomputed πολυγραμμές) σε κάθε στάθμη. */
function hooksAtLevels(hookEndsXY: readonly (readonly Point2D[])[], levelsMm: readonly number[], out: RebarSeg3D[]): void {
  for (const end of hookEndsXY) chainAtLevels(end, levelsMm, out);
}

/** Σπείρα (θώρακας): ΜΙΑ συνεχής ανερχόμενη έλικα στις γωνίες του ring. */
function spiral(ringXY: readonly Point2D[], levelsMm: readonly number[], out: RebarSeg3D[]): void {
  if (ringXY.length < 3 || levelsMm.length < 2) return;
  const n = ringXY.length;
  const pts: RebarPoint3D[] = [];
  for (let L = 0; L < levelsMm.length - 1; L++) {
    const z0 = levelsMm[L];
    const z1 = levelsMm[L + 1];
    for (let c = 0; c < n; c++) pts.push(pt(ringXY[c], z0 + (z1 - z0) * (c / n)));
  }
  pts.push(pt(ringXY[0], levelsMm[levelsMm.length - 1]));
  for (let i = 1; i < pts.length; i++) out.push({ a: pts[i - 1], b: pts[i] });
}

/**
 * 3Δ segments οπλισμού κολώνας (scene units + zMm 0..heightMm). `[]` αν δεν έχει οπλισμό
 * ή εκφυλισμένο ύψος. Mirror του `buildColumnRebarCage` (ίδιο math SSoT, χωρίς tilt — DEFER).
 */
export function collectColumnRebarSegments3D(column: ColumnEntity, heightMm: number): RebarSeg3D[] {
  const p = column.params;
  const r = resolveActiveColumnReinforcementForEntity(column);
  if (!r || heightMm <= 0) return [];
  const section = resolveColumnReinforcementSection(p);
  const layout = resolveColumnRebarLayout(r, section);
  if (!layout) return [];
  const worldXY = (local: readonly Point2D[]): Point2D[] => columnLocalMmToWorld(p, local);

  const out: RebarSeg3D[] = [];
  // Διαμήκεις = κατακόρυφες ράβδοι (0 → heightMm).
  for (const b of worldXY(layout.longitudinalBarsMm)) out.push({ a: pt(b, 0), b: pt(b, heightMm) });

  // Στεφάνια ανά στάθμη (EC8 κρίσιμες ζώνες).
  const levels = computeStirrupLevelsMm(r, section.bboxWidthMm, section.bboxDepthMm, heightMm);
  const type = r.stirrups.type ?? COLUMN_DEFAULT_STIRRUP;
  const pathXY = worldXY(layout.stirrupPathMm);
  if (type === 'spiral') spiral(pathXY, levels, out);
  else ringAtLevels(pathXY, levels, out);
  if (type === 'closed-hooked') hooksAtLevels(layout.stirrupHookEndsMm.map(worldXY), levels, out);

  const extraHoops = layout.extraStirrupPathsMm ?? [];
  for (let i = 0; i < extraHoops.length; i++) {
    ringAtLevels(worldXY(extraHoops[i]), levels, out);
    if (type === 'closed-hooked' && layout.extraStirrupHookEndsMm?.[i]) {
      hooksAtLevels(layout.extraStirrupHookEndsMm[i].map(worldXY), levels, out);
    }
  }

  // Εσωτερικά συνδετήρια (cross-ties / διαμάντι).
  for (const tie of resolveColumnCrossTies(layout, section, r)) {
    const tieXY = worldXY(tie.pathMm);
    if (tie.closed) ringAtLevels(tieXY, levels, out);
    else chainAtLevels(tieXY, levels, out);
    if (type === 'closed-hooked') hooksAtLevels(tie.hookEndsMm.map(worldXY), levels, out);
  }

  return out;
}

/** Είσοδος του γραμμικού core (mirror `LinearMemberRebarCageInput` χωρίς το three datum). */
export interface LinearMemberRebarSegments3DInput {
  readonly axisPts: readonly Point2D[];
  readonly sceneUnits: SceneUnits | undefined;
  readonly layout: BeamRebarLayout;
  readonly stirrupType: StirrupType;
}

/**
 * 3Δ segments οπλισμού γραμμικού μέλους (scene units + zMm σχετικό με κάτω παρειά,
 * 0..depth). Mirror του `buildLinearMemberRebarCage`: διαμήκεις κατά τον άξονα +
 * συνδετήρες ως κλειστά loops στο επίπεδο διατομής (v,w) σε κάθε στάθμη.
 */
export function collectLinearMemberRebarSegments3D(input: LinearMemberRebarSegments3DInput): RebarSeg3D[] {
  const { axisPts, sceneUnits, layout, stirrupType } = input;
  if (axisPts.length < 2) return [];
  const s = mmToSceneUnits(sceneUnits ?? 'mm');
  const centerMm = Math.max(0, layout.depthMm) / 2; // zMm κέντρο διατομής (σχετικό κάτω παρειάς)

  const local = (uMm: number, vMm: number, wMm: number): RebarPoint3D | null => {
    const frame = samplePolylineFrame(axisPts, uMm * s);
    if (!frame) return null;
    return {
      x: frame.point.x + vMm * s * frame.normal.x,
      y: frame.point.y + vMm * s * frame.normal.y,
      zMm: centerMm + wMm,
    };
  };

  const out: RebarSeg3D[] = [];

  // Διαμήκεις: κατά τον άξονα (curve-aware sampling).
  const subdivisions = axisPts.length <= 2 ? 1 : Math.max(8, axisPts.length * 2);
  for (const bar of layout.longitudinalBars) {
    const pts: RebarPoint3D[] = [];
    for (let k = 0; k <= subdivisions; k++) {
      const u = bar.uStartMm + ((bar.uEndMm - bar.uStartMm) * k) / subdivisions;
      const q = local(u, bar.vMm, bar.wMm);
      if (q) pts.push(q);
    }
    for (let i = 1; i < pts.length; i++) out.push({ a: pts[i - 1], b: pts[i] });
  }

  // Συνδετήρες: κλειστά loops στο επίπεδο διατομής (v,w) σε κάθε στάθμη + γάντζοι.
  const ring = layout.stirrupSectionPathMm;
  if (ring.length >= 2) {
    const hooked = stirrupType === 'closed-hooked';
    for (const u of layout.stirrupLevelsMm) {
      for (let i = 0; i < ring.length; i++) {
        const a = local(u, ring[i].x, ring[i].y);
        const b = local(u, ring[(i + 1) % ring.length].x, ring[(i + 1) % ring.length].y);
        if (a && b) out.push({ a, b });
      }
      if (hooked) {
        for (const hook of layout.stirrupHookEndsMm) {
          for (let i = 1; i < hook.length; i++) {
            const a = local(u, hook[i - 1].x, hook[i - 1].y);
            const b = local(u, hook[i].x, hook[i].y);
            if (a && b) out.push({ a, b });
          }
        }
      }
    }
  }

  return out;
}

/** 3Δ segments οπλισμού δοκού (resolve auto/FEM-aware → linear core). `[]` αν χωρίς οπλισμό. */
export function collectBeamRebarSegments3D(beam: Pick<BeamEntity, 'id' | 'params' | 'geometry'>): RebarSeg3D[] {
  const rebar = resolveActiveBeamRebarLayout(beam);
  if (!rebar) return [];
  return collectLinearMemberRebarSegments3D({
    axisPts: beam.geometry.axisPolyline.points,
    sceneUnits: beam.params.sceneUnits,
    layout: rebar.layout,
    stirrupType: rebar.reinforcement.stirrups.type ?? BEAM_DEFAULT_STIRRUP,
  });
}
