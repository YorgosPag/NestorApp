/**
 * Wall host-plan builder (ADR-401 Phase B) — SSoT.
 *
 * Παράγει τα `HostUndersidePlan` (κάτω-παρειά structural host προβαλλόμενη στον
 * άξονα του τοίχου + plan-overlap span) που καταναλώνει ο `resolveWallTopProfile`
 * (Phase A). Είναι ο ΕΝΑΣ τόπος που:
 *   1. υπολογίζει την κάτω-παρειά beam/slab (§2.3 formulas, απόλυτα mm), και
 *   2. προβάλλει το footprint του host στον άξονα του τοίχου → span [t0,t1] (0..1)
 *      μέσω **segment ∩ polygon** (t-intervals).
 *
 * Reuse (SSoT): `isPointInPolygon` (GeometryUtils), `computeBeamGeometry().outline`
 * (beam footprint SSoT). Beam/slab έχουν **οριζόντια** κάτω-παρειά → `z0mm===z1mm`·
 * κεκλιμένο host (στέγη/κεκλιμένο δοκάρι) = Phase E2.
 *
 * Convention μονάδων: το footprint του host ΚΑΙ ο άξονας του τοίχου πρέπει να
 * είναι στο **ίδιο** plan space (canvas units ή mm — ο builder είναι
 * unit-agnostic γιατί το `t` είναι αδιάστατο 0..1). Τα `z*mm` είναι απόλυτα mm
 * (ίδια σύμβαση με `beam.topElevation` / `slab.levelElevation`, ADR-369 §2).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-401-bim-wall-top-base-constraints-attach-to-structural.md §2.2, §2.3
 * @see wall-top-profile.ts — ο resolver που τρώει το output
 */

import type { BeamEntity } from '../types/beam-types';
import type { SlabEntity } from '../types/slab-types';
import type { RoofEntity } from '../types/roof-types';
import { computeBeamGeometry } from './beam-geometry';
import { slabUndersideZmmAt, slabTopZmmAt } from './slab-slope';
import { beamUndersideZmmAt, beamTopZmmAt, isBeamTilted } from './beam-slope';
import { resolveEavePlanes, roofZmm } from './roof-lower-envelope';
import { mmScaleFor } from '../../utils/scene-units';
import type { HostUndersidePlan, HostTopsidePlan, WallVerticalContext } from './wall-top-profile';
import { coveredIntervals, type Pt2 } from './shared/segment-polygon-coverage';

// `Pt2` + `coveredIntervals` ζουν πλέον στο shared `segment-polygon-coverage`
// SSoT (ADR-449 N.0.2). Re-export ώστε οι υπάρχοντες importers (column/stair
// vertical-profile, section-sync, tests κ.λπ.) να μην αλλάξουν path.
export type { Pt2 };

/**
 * Host έτοιμος για projection: footprint (ίδιες μονάδες με τον άξονα τοίχου) +
 * κάτω-παρειά σε **απόλυτα mm**.
 *
 * Default = **οριζόντια** παρειά (`undersideZmm` scalar → z0mm===z1mm). Για
 * **κεκλιμένο** host (tilted στέγη/πλάκα, Phase E2) δίνεται προαιρετικά το
 * `undersideZmmAt(pt)` — αποτιμάται στα άκρα του covered span ώστε το προκύπτον
 * `HostUndersidePlan` να έχει z0mm ≠ z1mm. Το `pt` ΠΡΕΠΕΙ να είναι στο ίδιο
 * plan space (mm) με το `footprint`.
 */
export interface HostFootprintInput {
  readonly hostId: string;
  readonly hostType: HostUndersidePlan['hostType'];
  /** Plan footprint (closed polygon). */
  readonly footprint: readonly Pt2[];
  /** Κάτω-παρειά (absolute mm) — οριζόντια / nominal fallback. */
  readonly undersideZmm: number;
  /**
   * Κεκλιμένη κάτω-παρειά (absolute mm) ως συνάρτηση plan-point. Όταν δοθεί,
   * υπερισχύει του `undersideZmm` και παράγει sloped plan (z0mm ≠ z1mm). Phase E2.
   */
  readonly undersideZmmAt?: (pt: Pt2) => number;
  /**
   * ADR-401 (γ) — **άνω-παρειά** (absolute mm) για base-attach. Ένα struct
   * εξυπηρετεί ΚΑΙ τις δύο φορές. Οριζόντια / nominal fallback.
   */
  readonly topsideZmm?: number;
  /** Κεκλιμένη άνω-παρειά (absolute mm) — υπερισχύει του `topsideZmm` (tilted). */
  readonly topsideZmmAt?: (pt: Pt2) => number;
}

/**
 * Builder SSoT — προβάλλει κάθε host στον άξονα του τοίχου και επιστρέφει ένα
 * `HostUndersidePlan` ανά covered span. Host που δεν περνά πάνω από τον τοίχο →
 * μηδέν plans. Concave host που δίνει ≥2 spans → ένα plan ανά span (ίδιο hostId).
 */
export function buildHostUndersidePlans(
  wallStart: Pt2,
  wallEnd: Pt2,
  hosts: readonly HostFootprintInput[],
): HostUndersidePlan[] {
  const dx = wallEnd.x - wallStart.x;
  const dy = wallEnd.y - wallStart.y;
  /** Plan-point (mm) στον άξονα του τοίχου για παράμετρο t∈[0,1]. */
  const axisPt = (t: number): Pt2 => ({ x: wallStart.x + t * dx, y: wallStart.y + t * dy });
  const plans: HostUndersidePlan[] = [];
  for (const h of hosts) {
    if (h.footprint.length < 3) continue;
    const at = h.undersideZmmAt;
    for (const [t0, t1] of coveredIntervals(wallStart, wallEnd, h.footprint)) {
      // Sloped host → αποτίμησε την παρειά στα plan-points των άκρων του span·
      // flat host → scalar (z0mm===z1mm, byte-for-byte back-compat).
      const z0mm = at ? at(axisPt(t0)) : h.undersideZmm;
      const z1mm = at ? at(axisPt(t1)) : h.undersideZmm;
      plans.push({
        hostId: h.hostId,
        hostType: h.hostType,
        t0,
        t1,
        z0mm,
        z1mm,
      });
    }
  }
  return plans;
}

/**
 * ADR-401 (γ) — mirror του `buildHostUndersidePlans` για base-attach: προβάλλει
 * κάθε host στον άξονα του τοίχου και επιστρέφει ένα `HostTopsidePlan` (άνω-
 * παρειά) ανά covered span. Hosts χωρίς topside data (legacy inputs) → skip.
 */
export function buildHostTopsidePlans(
  wallStart: Pt2,
  wallEnd: Pt2,
  hosts: readonly HostFootprintInput[],
): HostTopsidePlan[] {
  const dx = wallEnd.x - wallStart.x;
  const dy = wallEnd.y - wallStart.y;
  const axisPt = (t: number): Pt2 => ({ x: wallStart.x + t * dx, y: wallStart.y + t * dy });
  const plans: HostTopsidePlan[] = [];
  for (const h of hosts) {
    if (h.footprint.length < 3) continue;
    if (h.topsideZmm === undefined && !h.topsideZmmAt) continue;
    const at = h.topsideZmmAt;
    const flat = h.topsideZmm ?? 0;
    for (const [t0, t1] of coveredIntervals(wallStart, wallEnd, h.footprint)) {
      const z0mm = at ? at(axisPt(t0)) : flat;
      const z1mm = at ? at(axisPt(t1)) : flat;
      plans.push({ hostId: h.hostId, hostType: h.hostType, t0, t1, z0mm, z1mm });
    }
  }
  return plans;
}

/**
 * `resolveHost` lookup (κατά `hostId`) για τον resolver. Όταν ένας host δίνει
 * ≥2 spans (concave footprint), επιστρέφεται το **μεγαλύτερο** span (dominant) —
 * το multi-span ανά host σε ένα `attachTopToIds` entry είναι Phase E refinement·
 * το συντριπτικό case (δοκάρι/κυρτή πλάκα) δίνει ένα span.
 */
export function makeResolveHost(
  wallStart: Pt2,
  wallEnd: Pt2,
  hosts: readonly HostFootprintInput[],
): (id: string) => HostUndersidePlan | null {
  const byId = new Map<string, HostUndersidePlan>();
  for (const plan of buildHostUndersidePlans(wallStart, wallEnd, hosts)) {
    const existing = byId.get(plan.hostId);
    if (!existing || plan.t1 - plan.t0 > existing.t1 - existing.t0) {
      byId.set(plan.hostId, plan);
    }
  }
  return (id: string) => byId.get(id) ?? null;
}

/**
 * Convenience: πλήρες `WallVerticalContext` με `resolveHost` δεμένο στους hosts.
 * `base` παρέχει τα floor/storey-ceiling πεδία (FFL κ.λπ.).
 */
export function makeWallTopContext(
  wallStart: Pt2,
  wallEnd: Pt2,
  hosts: readonly HostFootprintInput[],
  base: Omit<WallVerticalContext, 'resolveHost'>,
): WallVerticalContext {
  return { ...base, resolveHost: makeResolveHost(wallStart, wallEnd, hosts) };
}

/**
 * ADR-401 (γ) — mirror του `makeResolveHost` για base-attach: lookup host
 * **topside** plan κατά `hostId` (μεγαλύτερο span όταν concave → ≥2 spans).
 */
export function makeResolveHostTopside(
  wallStart: Pt2,
  wallEnd: Pt2,
  hosts: readonly HostFootprintInput[],
): (id: string) => HostTopsidePlan | null {
  const byId = new Map<string, HostTopsidePlan>();
  for (const plan of buildHostTopsidePlans(wallStart, wallEnd, hosts)) {
    const existing = byId.get(plan.hostId);
    if (!existing || plan.t1 - plan.t0 > existing.t1 - existing.t0) {
      byId.set(plan.hostId, plan);
    }
  }
  return (id: string) => byId.get(id) ?? null;
}

/**
 * Convenience: `WallVerticalContext` με `resolveHostTopside` δεμένο στους hosts
 * (mirror του `makeWallTopContext`). `base` παρέχει τα floor/storey πεδία.
 */
export function makeWallBaseContext(
  wallStart: Pt2,
  wallEnd: Pt2,
  hosts: readonly HostFootprintInput[],
  base: Omit<WallVerticalContext, 'resolveHostTopside'>,
): WallVerticalContext {
  return { ...base, resolveHostTopside: makeResolveHostTopside(wallStart, wallEnd, hosts) };
}

// ─── Entity → HostFootprintInput adapters (§2.3 underside formulas) ───────────

/**
 * Beam → host input. Footprint = `computeBeamGeometry().outline` (SSoT 4-vertex
 * ορθογώνιο). Underside = `topElevation + zOffset − depth` (mirror του
 * `section-intersect.toBeamPlan` bottomY, εδώ σε mm).
 *
 * Phase E/(β): όταν η δοκός είναι **κεκλιμένη** (`topElevationEnd` ≠
 * `topElevation`), η κάτω-παρειά γίνεται **κεκλιμένο επίπεδο** κατά μήκος του
 * άξονα (`beamUndersideZmmAt` SSoT) → ο attached τοίχος ακολουθεί την κλίση
 * (z0mm ≠ z1mm). Ίδιο pattern με τον `slabHostInput` (tilted slab/roof).
 */
export function beamHostInput(beam: BeamEntity): HostFootprintInput {
  const footprint = computeBeamGeometry(beam.params).outline.vertices.map((v) => ({ x: v.x, y: v.y }));
  const zOff = beam.params.zOffset ?? 0;
  const undersideZmm = beam.params.topElevation + zOff - beam.params.depth;
  const topsideZmm = beam.params.topElevation + zOff; // ADR-401 (γ) — άνω παρειά (χωρίς −depth).
  const tilted = isBeamTilted(beam.params);
  return {
    hostId: beam.id,
    hostType: 'beam',
    footprint,
    undersideZmm,
    topsideZmm,
    ...(tilted ? { undersideZmmAt: (pt) => beamUndersideZmmAt(beam.params, pt) } : {}),
    ...(tilted ? { topsideZmmAt: (pt) => beamTopZmmAt(beam.params, pt) } : {}),
  };
}

/**
 * Slab → host input. Footprint = `params.outline`. Underside =
 * `levelElevation + heightOffsetFromLevel − thickness` (mirror του
 * `section-intersect.toSlabPlan` bottomY).
 *
 * Phase E2: όταν η πλάκα/στέγη είναι `geometryType='tilted'`, η κάτω-παρειά
 * γίνεται **κεκλιμένο επίπεδο** (`slabUndersideZmmAt` SSoT) → ο attached τοίχος
 * ακολουθεί την κλίση (z0mm ≠ z1mm). `hostType='roof'` όταν `kind==='roof'`
 * (semantic — ο resolver χειρίζεται beam/slab/roof ομοιόμορφα).
 */
export function slabHostInput(slab: SlabEntity): HostFootprintInput {
  const footprint = slab.params.outline.vertices.map((v) => ({ x: v.x, y: v.y }));
  const topZmm = slab.params.levelElevation + (slab.params.heightOffsetFromLevel ?? 0); // άνω παρειά.
  const undersideZmm = topZmm - slab.params.thickness;
  const hostType: HostUndersidePlan['hostType'] = slab.params.kind === 'roof' ? 'roof' : 'slab';
  const tilted = slab.params.geometryType === 'tilted' && slab.params.slope !== undefined;
  return {
    hostId: slab.id,
    hostType,
    footprint,
    undersideZmm,
    topsideZmm: topZmm,
    ...(tilted ? { undersideZmmAt: (pt) => slabUndersideZmmAt(slab.params, pt) } : {}),
    ...(tilted ? { topsideZmmAt: (pt) => slabTopZmmAt(slab.params, pt) } : {}),
  };
}

/**
 * ADR-417 Φ4 — Roof → host input. Footprint = canvas-unit outline (mirror slabHostInput).
 * Underside = roofZmm(planes, basePivotZ, s, pt) − thickness: κεκλιμένη κάτω-παρειά
 * στέγης σε κάθε plan-point (SSoT roofZmm). Nominal flat fallback = basePivotZ − thickness
 * (eaves datum − πάχος). Η στέγη υποστηρίζει ΜΟΝΟ top-attach (τοίχοι κολλούν από κάτω)
 * → ΔΕΝ δίνει topsideZmm.
 */
export function roofHostInput(roof: RoofEntity): HostFootprintInput {
  const s = mmScaleFor(roof.params);
  const { planes } = resolveEavePlanes(
    roof.params.outline.vertices,
    roof.params.edges,
    roof.params.slopeUnit,
  );
  const footprint = roof.params.outline.vertices.map((v) => ({ x: v.x, y: v.y }));
  const basePivotZ = roof.params.basePivotZ;
  const thickness = roof.params.thickness;
  return {
    hostId: roof.id,
    hostType: 'roof',
    footprint,
    undersideZmm: basePivotZ - thickness,
    undersideZmmAt: (pt) => roofZmm(planes, basePivotZ, s, pt) - thickness,
  };
}

/**
 * Όλοι οι structural hosts ενός ορόφου (δοκάρια + πλάκες + στέγες) → `HostFootprintInput[]`,
 * έτοιμοι για `makeWallTopContext` / `makeResolveHost`. ΕΝΑΣ τόπος που συνθέτει το array —
 * καταναλώνεται από `BimSceneLayer.syncWalls`/`addEnvelopeShell`, `section-scene-sync`,
 * `wall-boq-feed` (Boy Scout N.0.2 — πρώην τετραπλό inline pattern).
 * ADR-417 Φ4: `roofs` optional (backward-compat — existing callers ΔΕΝ αλλάζουν τύπο).
 */
export function buildWallHostInputs(
  beams: readonly BeamEntity[],
  slabs: readonly SlabEntity[],
  roofs: readonly RoofEntity[] = [],
): HostFootprintInput[] {
  return [
    ...beams.map(beamHostInput),
    ...slabs.map(slabHostInput),
    ...roofs.map(roofHostInput),
  ];
}
