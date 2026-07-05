/**
 * Beam → DERIVED T-beam / L-beam flange context (ADR-534 Φ3b + Φ3c-B2).
 *
 * Geometry-is-SSoT bridge: «καλύπτει μονολιθική πλάκα αυτή τη δοκό;» → αν ναι, η δοκός
 * είναι **πλακοδοκός** και το `b_eff` (EC2 §5.3.2.1) υπολογίζεται μέσω του SSoT
 * `computeEffectiveFlangeWidthMm`. Αν όχι (γυμνή δοκός χωρίς πέλμα) → `undefined` →
 * ορθογώνια διατομή `b_w` (μηδέν regression).
 *
 * **Φ3c-B2 (edge/L-beam):** το πλήθος πελμάτων DERIVED από τη γεωμετρία — η πλάκα
 * δειγματοληπτείται **εκατέρωθεν του άξονα** (offset ±perp έξω από τον κορμό μέσω
 * `buildMemberAxisFrame`): κάλυψη μία πλευρά = περιμετρική **L-beam** (`flangeSides:1`)·
 * εκατέρωθεν = εσωτερική **T-beam** (`flangeSides:2`).
 *
 * **FULL SSoT reuse** — ΜΗΝ ξαναγραφτεί boolean/point-in-slab:
 *   · `hostUndersideAt` (`host-footprint-eval`) — point-in-footprint → soffit, η ΙΔΙΑ
 *     που κόβει τα attached μέλη στο soffit (§monolithic-cut)·
 *   · `polygon2DCentroid` (`polygon-utils`) — δειγματοληψία κέντρου footprint.
 * Ο caller (scene access) χτίζει τα `coveringHosts` μέσω `buildCeilingSlabHosts`
 * (`monolithic-slab-clip`) ώστε αυτό το module να μένει pure (zero scene/bim-3d import).
 *
 * @see ./codes/effective-flange-width.ts — b_eff SSoT (EC2 §5.3.2.1)
 * @see ../../bim-3d/scene/monolithic-slab-clip.ts — buildCeilingSlabHosts (ο caller το χτίζει)
 * @see docs/centralized-systems/reference/adrs/ADR-534-auto-ceiling-slab-per-bay.md §Φ3b
 */

import type { Point2D } from '../../rendering/types/Types';
import type { BeamEntity, BeamSupportType } from '../types/beam-types';
import type { HostFootprintInput, Pt2 } from '../geometry/wall-host-plan-builder';
import { hostUndersideAt } from '../geometry/host-footprint-eval';
import { polygon2DCentroid, projectVerticesTo2D } from '../geometry/shared/polygon-utils';
import {
  buildMemberAxisFrame,
  type MemberAxisFrame,
} from '../columns/column-face-snap-helpers';
import { computeEffectiveFlangeWidthMm } from './codes/effective-flange-width';

const M_TO_MM = 1000;

/** Δείγματα κατά μήκος του άξονα (κλάσματα της διαμήκους έκτασης) — αποφυγή ψευδο-αρνητικού σε μερική κάλυψη. */
const ALONG_SAMPLE_FRACTIONS = [0.25, 0.5, 0.75] as const;

/** Απόσταση δείγματος από τον άξονα = factor × ημι-πάχος → καθαρά **έξω** από τον κορμό, μέσα στο πέλμα. */
const PERP_PROBE_FACTOR = 1.5;

/** True αν οποιοδήποτε δείγμα (κέντρο + κορυφές) του footprint πέφτει κάτω από host πλάκα. */
function isFootprintCoveredBySlab(
  footprint: readonly Pt2[],
  coveringHosts: readonly HostFootprintInput[],
): boolean {
  const samples: Pt2[] = [polygon2DCentroid(footprint), ...footprint];
  for (const h of coveringHosts) {
    for (const pt of samples) {
      if (hostUndersideAt(h, pt) !== null) return true;
    }
  }
  return false;
}

/**
 * Άξονας δοκού (2 σημεία) **από το footprint**: κέντρο + κατεύθυνση της μεγαλύτερης ακμής
 * (κύριος άξονας ορθογώνιας διατομής). Source-agnostic (καμία εξάρτηση από `axisPolyline`)
 * → ορθό και για λοξές/justified δοκούς, ίδιο coordinate space με τους hosts.
 */
function deriveBeamAxis2D(footprint: readonly Pt2[]): Point2D[] {
  const c = polygon2DCentroid(footprint);
  let bestLen = -1;
  let ux = 1;
  let uy = 0;
  for (let i = 0; i < footprint.length; i++) {
    const p = footprint[i];
    const q = footprint[(i + 1) % footprint.length];
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const len = Math.hypot(dx, dy);
    if (len > bestLen && len > 1e-9) {
      bestLen = len;
      ux = dx / len;
      uy = dy / len;
    }
  }
  return [c, { x: c.x + ux, y: c.y + uy }];
}

/** True αν κάποιο δείγμα στη μία πλευρά του άξονα (offset ±perp έξω από τον κορμό) πέφτει κάτω από host. */
function isAxisSideCovered(
  frame: MemberAxisFrame,
  side: 1 | -1,
  hosts: readonly HostFootprintInput[],
): boolean {
  const perpX = frame.u.y * side;
  const perpY = -frame.u.x * side;
  const dist = frame.halfThickness * PERP_PROBE_FACTOR;
  const span = frame.alongMax - frame.alongMin;
  for (const t of ALONG_SAMPLE_FRACTIONS) {
    const along = frame.alongMin + t * span;
    const sx = frame.a.x + frame.u.x * along + perpX * dist;
    const sy = frame.a.y + frame.u.y * along + perpY * dist;
    for (const h of hosts) {
      if (hostUndersideAt(h, { x: sx, y: sy }) !== null) return true;
    }
  }
  return false;
}

/**
 * Edge/L-beam ανίχνευση (ADR-534 Φ3c-B2): πόσες πλευρές του άξονα καλύπτει η πλάκα.
 * Περιμετρική/ακραία δοκός (πλάκα **μία** πλευρά) → `1` (L-beam, ένα πέλμα)· εσωτερική
 * (πλάκα **εκατέρωθεν**) → `2` (T-beam). Εκφυλισμένος άξονας ή `0` καλυμμένες πλευρές
 * (η πλάκα ταυτίζεται με τον κορμό — οριακό) → `2` (συντηρητικό, μηδέν regression).
 */
function resolveFlangeSides(
  footprint: readonly Pt2[],
  coveringHosts: readonly HostFootprintInput[],
): 1 | 2 {
  const frame = buildMemberAxisFrame(deriveBeamAxis2D(footprint), footprint);
  if (!frame || frame.halfThickness <= 0) return 2;
  const left = isAxisSideCovered(frame, 1, coveringHosts) ? 1 : 0;
  const right = isAxisSideCovered(frame, -1, coveringHosts) ? 1 : 0;
  return left + right === 1 ? 1 : 2;
}

/**
 * DERIVED `b_eff` (mm) μιας δοκού που καλύπτεται από μονολιθική πλάκα οροφής/δαπέδου.
 * `undefined` όταν δεν την καλύπτει πλάκα (γυμνή ορθογώνια δοκός) ή εκφυλισμένη γεωμετρία
 * → ο consumer πέφτει στο `b_w` (μηδέν regression). `supportType` = topology-aware (caller).
 *
 * Πλήθος πελμάτων DERIVED μέσω {@link resolveFlangeSides}: περιμετρική δοκός (πλάκα μία
 * πλευρά) = **L-beam** (`flangeSides:1`)· εσωτερική (πλάκα εκατέρωθεν) = **T-beam** (`2`).
 */
export function resolveBeamEffectiveFlangeWidthMm(
  beam: Pick<BeamEntity, 'params' | 'geometry'>,
  coveringHosts: readonly HostFootprintInput[],
  supportType: BeamSupportType,
): number | undefined {
  const verts = beam.geometry.outline.vertices;
  if (verts.length < 3 || coveringHosts.length === 0 || beam.params.width <= 0) return undefined;
  const footprint: Pt2[] = projectVerticesTo2D(verts);
  if (!isFootprintCoveredBySlab(footprint, coveringHosts)) return undefined;
  return computeEffectiveFlangeWidthMm({
    webWidthMm: beam.params.width,
    spanMm: beam.geometry.length * M_TO_MM,
    supportType,
    flangeSides: resolveFlangeSides(footprint, coveringHosts),
  });
}
