/**
 * @module wall-ghost-build
 * @description SSoT για το ΧΤΙΣΙΜΟ ενός wall-ghost entity + την επίλυση κατάστασης
 * (overlap / opening-conflict / footprint-overlap). Split από `wall-preview-helpers.ts`
 * (N.7.1) — ΕΝΑ leaf module που το καλούν ΟΛΑ τα `makeWall*Ghost` (μηδέν circular import).
 *
 * Preview ≡ commit by construction: ο `buildWallEntity` (ίδιος builder με το commit) +
 * ο 🔴 status colour (`resolveGhostStatusColor`) ζουν σε ΕΝΑ σημείο, ώστε καμία διαδρομή
 * ghost να μην ξεχάσει τον overlap/conflict έλεγχο (το bug που έλυσε: έλειπε από το
 * footprint path).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-508-*.md §overlap §opening-conflict
 * @see docs/centralized-systems/reference/adrs/ADR-567-structural-no-overlap-placement.md
 * @see ./wall-preview-helpers.ts (preview state-machine — καλεί αυτό το module)
 */

import type { Point2D } from '../../rendering/types/Types';
import type { ExtendedSceneEntity } from './drawing-types';
import {
  buildWallEntity,
  resolveWallThicknessMm,
  type WallParamOverrides,
} from './wall-completion';
import { sceneSnapTargetsStore } from '../../bim/framing/scene-snap-targets';
import type { WallKind, WallParams, WallEntity } from '../../bim/types/wall-types';
import { mmToSceneUnits } from '../../utils/scene-units';
import { getDefaultLayerId } from '../../stores/LayerStore';
import {
  isMemberCollinearOverlap,
  type LinearMemberSnapTarget,
} from '../../bim/framing/linear-member-face-snap';
import type { GhostFaceDimensionsMeta } from '../../bim/framing/ghost-face-dim-references';
import { resolveGhostStatusColor } from '../../bim/ghosts/ghost-status-color';
import { resolveWallOpeningConflictForHost } from '../../bim/walls/wall-opening-conflict';
// ADR-567 — no-overlap: 🔴 ghost όταν το footprint επικαλύπτει υπάρχουσα δομική (SSoT, preview ≡ commit).
import { structuralFootprintOf, findStructuralOverlap } from '../../bim/placement/structural-placement-overlap';
import type { Entity } from '../../types/entities';
import type { OpeningEntity } from '../../bim/types/opening-types';
import type { SceneUnits } from '../../utils/scene-units';
import { toWysiwygPreviewEntity } from './wysiwyg-preview-shared';
import { buildSegmentHudMeta, type WallHudMeta } from '../../canvas-v2/preview-canvas/wall-hud-paint';

/**
 * ADR-508 §wall-hud — εξαγωγή των αριθμητικών HUD δεδομένων από τον ΧΤΙΣΜΕΝΟ τοίχο (μήκος/γωνία/
 * πάχος/ύψος). Καθαρά νούμερα (N.11-clean)· η μετάφραση/μορφοποίηση γίνεται στον renderer/handler.
 */
function buildWallHudMeta(entity: WallEntity, sceneUnits: SceneUnits): WallHudMeta {
  const p = entity.params;
  // SSoT: ίδια length/angle μηχανή με τη γραμμή — ο τοίχος προσθέτει μόνο πάχος/ύψος.
  return buildSegmentHudMeta(p.start, p.end, sceneUnits, p.thickness, p.height);
}

// TEMP ADR-567 debug — throttle state (module-level· αφαιρείται μετά το διαγνωστικό).
let lastGhostDbg = '';

/**
 * ADR-508 — SSoT overlap decision for EVERY wall-ghost path: 🔴 when the ghost lies
 * collinearly / on-top of (or whose body overlaps, incl. face-anchored) an existing member.
 * `extra` short-circuits to true (e.g. snap short-end `status==='overlap'`). Curved → never.
 * One owner so no path can forget the check (the bug it fixes: it was missing from the
 * footprint path).
 */
export function isWallGhostOverlap(
  start: Readonly<Point2D>,
  end: Readonly<Point2D>,
  memberTargets: readonly LinearMemberSnapTarget[],
  overrides: WallParamOverrides,
  sceneUnits: SceneUnits,
  kind: WallKind,
  extra = false,
): boolean {
  if (extra) return true;
  if (kind === 'curved') return false;
  const newHalfScene = (resolveWallThicknessMm(overrides) / 2) * mmToSceneUnits(sceneUnits);
  return isMemberCollinearOverlap(start, end, memberTargets, newHalfScene);
}

/**
 * ADR-508 §opening-conflict — context για τον έλεγχο «κόβει άνοιγμα host;». Όταν δοθεί, ο builder
 * τρέχει το `resolveWallStartOpeningConflict` πάνω στην ΧΤΙΣΜΕΝΗ οντότητα (reuse `getEntityZExtents`)
 * και, σε conflict, κάνει το ghost 🔴 + κρύβει τις listening dims + επισυνάπτει το `openingConflict`
 * meta (κατακόρυφο εύρος σύγκρουσης → tooltip). `null` → η συμπεριφορά μένει αμετάβλητη.
 */
export interface WallGhostConflictCtx {
  /** Σημείο επαφής του ghost στην παρειά host (centerline start). */
  readonly contactPt: Readonly<Point2D>;
  readonly thicknessMm: number;
  /** Ο host τοίχος που ΗΔΗ επέλεξε το snap (`targetId`) — μηδέν re-derive. `null` = free placement. */
  readonly host: WallEntity | null;
  readonly openings: readonly OpeningEntity[];
}

/**
 * ADR-508 — SSoT build for EVERY wall-ghost path: build the WYSIWYG entity (same `buildWallEntity`
 * as commit), apply the 🔴 overlap status colour, attach optional listening dimensions. Returns
 * null on a degenerate frame. The ONE place that owns build + status, so the overlap→red look
 * stays identical everywhere (mirror του κόκκινου φαντάσματος κολώνας).
 */
export function buildWallGhostEntity(
  id: string,
  params: WallParams,
  kind: WallKind,
  sceneUnits: SceneUnits,
  isOverlap: boolean,
  faceDimensions: GhostFaceDimensionsMeta | null = null,
  conflictCtx: WallGhostConflictCtx | null = null,
  wantHud = false,
): ExtendedSceneEntity | null {
  const built = buildWallEntity(params, getDefaultLayerId(), kind, sceneUnits);
  if (!built.ok) return null;
  // ADR-508 §opening-conflict — 🔴 + block όταν ο κάθετος τοίχος κόβει άνοιγμα του host τοίχου.
  const conflict = conflictCtx
    ? resolveWallOpeningConflictForHost(
        conflictCtx.contactPt, built.entity, conflictCtx.thicknessMm,
        conflictCtx.host, conflictCtx.openings,
      )
    : null;
  // ADR-567 — 🔴 όταν το footprint του φαντάσματος επικαλύπτει ουσιαστικά ΟΠΟΙΑΔΗΠΟΤΕ υπάρχουσα
  // δομική (τοίχο/κολόνα/δοκό/πλάκα/θεμελίωση), σε κάθε γωνία — ΟΧΙ μόνο ομοαξονική (πιάνει ό,τι το
  // στενό `isMemberCollinearOverlap` έχανε). Ίδιο SSoT + κατώφλι με τον commit/append guard → preview
  // ≡ commit. Γωνίες/ενώσεις/διασταυρώσεις (μικρό κοινό εμβαδό) μένουν 🟢.
  const ghostFootprint = structuralFootprintOf(built.entity as unknown as Entity);
  const structuralEntities = sceneSnapTargetsStore.get().structuralEntities;
  const overlapHit = ghostFootprint
    ? findStructuralOverlap(ghostFootprint, structuralEntities, { excludeIds: new Set([built.entity.id]) })
    : null;
  const footprintOverlap = overlapHit !== null;
  const overlap = isOverlap || conflict !== null || footprintOverlap;
  // TEMP ADR-567 debug (αφαιρείται) — throttled: logάρει μόνο όταν αλλάζει η κατάσταση.
  const dbg = `struct=${structuralEntities.length} fp=${ghostFootprint ? ghostFootprint.length : 'NULL'} fpOverlap=${footprintOverlap} collinear=${isOverlap} ratio=${overlapHit ? overlapHit.ratio.toFixed(3) : '-'}`;
  if (dbg !== lastGhostDbg) {
    lastGhostDbg = dbg;
    // eslint-disable-next-line no-console
    console.warn('[ADR-567 ghost]', dbg);
  }
  const ghostStatusColor = overlap ? resolveGhostStatusColor('overlap') : null;
  // 🔴 → ποτέ listening dims (mirror short-end overlap).
  const dims = overlap ? null : faceDimensions;
  // ADR-508 §wall-hud — ζωντανή ταυτότητα (μήκος/γωνία/πάχος/ύψος) μόνο σε ευθύ τοίχο που σχεδιάζεται.
  const wallHud = wantHud && kind === 'straight' ? buildWallHudMeta(built.entity, sceneUnits) : null;
  return toWysiwygPreviewEntity(
    built.entity, id, ghostStatusColor, dims,
    conflict ? { bandMm: conflict.bandMm } : null,
    wallHud,
  );
}
