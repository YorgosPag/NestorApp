/**
 * Beam rebar LAYOUT — geometry SSoT (ADR-471 Slice 1, mirror του `column-rebar-layout`).
 *
 * Pure functions: `BeamReinforcement` (intent: κάτω/άνω Ø+πλήθος, συνδετήρες Ø/βήμα/cover)
 * + `BeamSectionContext` (b×h×span) → οι **ΘΕΣΕΙΣ** των ράβδων/συνδετήρων. Όπως στην
 * κολόνα, οι θέσεις ΠΟΤΕ δεν αποθηκεύονται — re-derived on-demand και από το 2Δ
 * (`beam-rebar-2d`) ΚΑΙ από το 3Δ (`beam-rebar-3d`) ΚΑΙ από το detail-sheet, ώστε κάτοψη,
 * όψη, τομή και 3Δ να δείχνουν την ΙΔΙΑ διάταξη (geometry-is-SSoT, μηδέν διπλή τοποθέτηση).
 *
 * Σύστημα συντεταγμένων: **BEAM-LOCAL mm**.
 *   - u = κατά μήκος του άξονα (0 = αρχή → spanMm = τέλος).
 *   - (v, w) = επίπεδο **διατομής**, κεντραρισμένο στο centroid: v = εγκάρσια (+ κατά το
 *     πλάτος b), w = κατακόρυφα (+ προς τα πάνω, καθ' ύψος h). Τα cross-section paths
 *     εκφράζονται ως `Point2D` με `x = v`, `y = w`. Ο caller (renderers) τα μεταφέρει σε
 *     world κατά μήκος του άξονα start→end της δοκού (Slice 2/3).
 *
 * Σε αντίθεση με την κολόνα (η κάτοψη ΕΙΝΑΙ η διατομή), η δοκός είναι **longitudinal**:
 * δύο στρώσεις διαμήκων (κάτω εφελκυσμός μέσου ανοίγματος + άνω αναρτήρες/στηρίξεων) +
 * συνδετήρες πυκνωμένοι στις κρίσιμες ζώνες άκρων (EC8 §5.4.3.1.2). Επαναχρησιμοποιεί τη
 * γεωμετρία κάμψης συνδετήρα της κολόνας (στρογγυλεμένο path + γάντζοι 135°) — μηδέν διπλό.
 *
 * Πεδίο (Slice 1): ορθογωνική δοκός, μία σειρά ανά παρειά. I-shape/steel + multi-layer → DEFER.
 *
 * @see ./column-rebar-layout.ts — ο δίδυμος της κολόνας (geometry helpers reuse)
 * @see ./beam-reinforcement-types.ts · ./beam-reinforcement-compute.ts
 * @see docs/centralized-systems/reference/adrs/ADR-471-unified-member-reinforcement.md §3
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { BeamReinforcement } from './beam-reinforcement-types';
import type { BeamSectionContext } from '../codes/structural-code-types';
import {
  STIRRUP_BEND_CL_FACTOR,
  STIRRUP_BEND_ARC_SEGMENTS,
  buildRoundedStirrupPath,
  buildStirrupHookEndsMm,
  closedPolylineLengthMm,
} from './column-rebar-layout';

/**
 * Κλάσμα ανοίγματος για το μήκος των άνω ράβδων **στηρίξεων** (curtailment από την παρειά,
 * EC2 §9.2.1.3 — top steel σε στηρίξεις/συνέχεια). Revit/Tekla σύμβαση ≈ 0.25·Leff ανά άκρο.
 */
const SUPPORT_BAR_SPAN_FRACTION = 0.25;

/** Μία διαμήκης ράβδος δοκού σε beam-local mm (θέση διατομής + διάστημα κατά μήκος). */
export interface BeamRebarBar {
  /** Εγκάρσια θέση στη διατομή (mm, centered +v κατά το πλάτος). */
  readonly vMm: number;
  /** Κατακόρυφη θέση στη διατομή (mm, centered +w προς τα πάνω). */
  readonly wMm: number;
  /** Αρχή της ράβδου κατά μήκος (mm από την αρχή του άξονα). */
  readonly uStartMm: number;
  /** Τέλος της ράβδου κατά μήκος (mm). */
  readonly uEndMm: number;
  /** Διάμετρος ράβδου (mm). */
  readonly diameterMm: number;
  /** Στρώση. */
  readonly layer: 'bottom' | 'top';
  /** Ρόλος: συνεχής (όλο το άνοιγμα) ή στήριξης (curtailed κοντά στα άκρα). */
  readonly role: 'continuous' | 'support';
}

/** Διάταξη οπλισμού δοκού σε beam-local mm (κεντραρισμένη διατομή + στάθμες συνδετήρων). */
export interface BeamRebarLayout {
  /** Άνοιγμα (mm). */
  readonly spanMm: number;
  /** Πλάτος διατομής b (mm). */
  readonly widthMm: number;
  /** Ύψος διατομής h (mm). */
  readonly depthMm: number;
  /** Διαμήκεις ράβδοι (κάτω/άνω, συνεχείς/στηρίξεων). */
  readonly longitudinalBars: readonly BeamRebarBar[];
  /** Κλειστή **στρογγυλεμένη** διαδρομή ΕΝΟΣ συνδετήρα στο επίπεδο διατομής (x=v, y=w),
   *  centerline στο cover. Ίδια σε κάθε στάθμη (σταθερή διατομή) — ΕΝΑ path. */
  readonly stirrupSectionPathMm: readonly Point2D[];
  /** Τα δύο άκρα γάντζου 135° του συνδετήρα (πολυγραμμές, επίπεδο διατομής). Άδειο για
   *  `closed-welded` (το draw gate-άρεται στον τύπο από τον renderer). */
  readonly stirrupHookEndsMm: readonly (readonly Point2D[])[];
  /** Θέσεις u (mm κατά μήκος) όπου τοποθετείται συνδετήρας — πυκνό βήμα στις κρίσιμες
   *  ζώνες άκρων (lcr ≈ h), αραιό στη μέση. Συνεπές με `beamStirrupCount` (ίδιες ζώνες). */
  readonly stirrupLevelsMm: readonly number[];
  /** Ακτίνα άξονα κάμψης γωνίας συνδετήρα (mm). */
  readonly stirrupCornerRadiusMm: number;
  /** Διάμετρος συνδετήρα (mm) — για πάχος γραμμής / ακτίνα κυλίνδρου. */
  readonly stirrupDiameterMm: number;
  /** Μήκος centerline ενός κλειστού συνδετήρα (mm) — geometry truth (3Δ ράβδος). */
  readonly stirrupCenterlineLengthMm: number;
}

/** Εγκάρσιες θέσεις `count` ράβδων ομοιόμορφα στο [-halfWidth, +halfWidth] (γωνίες στα άκρα). */
function distributeAcrossWidthMm(halfWidthMm: number, count: number): number[] {
  const n = Math.max(0, Math.floor(count));
  if (n <= 0) return [];
  if (n === 1) return [0];
  const out: number[] = [];
  const step = (2 * halfWidthMm) / (n - 1);
  for (let i = 0; i < n; i++) out.push(-halfWidthMm + i * step);
  return out;
}

/**
 * Στάθμες u (mm από την αρχή) των συνδετήρων κατά το άνοιγμα: πυκνό βήμα
 * `spacingCriticalMm` στις κρίσιμες ζώνες άκρων (lcr ≈ h, EC8 §5.4.3.1.2(6)), αραιό
 * `spacingMm` στη μέση. Πρόβολος → μία κρίσιμη ζώνη (στο πακτωμένο άκρο u=0).
 * Συνεπές με το `beamStirrupCount` του compute. [] για εκφυλισμένο άνοιγμα/βήμα.
 */
export function computeBeamStirrupLevelsMm(ctx: BeamSectionContext, r: BeamReinforcement): number[] {
  const { spacingMm, spacingCriticalMm } = r.stirrups;
  if (ctx.spanMm <= 0 || spacingMm <= 0) return [];
  const sCrit = spacingCriticalMm && spacingCriticalMm > 0 ? spacingCriticalMm : spacingMm;
  const lcr = Math.min(Math.max(0, ctx.depthMm), ctx.spanMm / 2);
  const cantilever = ctx.supportType === 'cantilever';

  const levels: number[] = [0];
  let u = 0;
  let guard = 0;
  while (u < ctx.spanMm && guard++ < 100000) {
    const nearStart = u < lcr - 1e-6;
    const nearEnd = !cantilever && u > ctx.spanMm - lcr + 1e-6;
    const step = nearStart || nearEnd ? sCrit : spacingMm;
    u += step;
    if (u < ctx.spanMm - 1e-6) levels.push(u);
  }
  levels.push(ctx.spanMm);
  return levels;
}

/**
 * Υπολογίζει τη διάταξη οπλισμού ορθογωνικής δοκού σε beam-local mm. Επιστρέφει `null`
 * αν η διατομή/άνοιγμα είναι εκφυλισμένα (≤0) ή δεν υπάρχει τίποτα να σχεδιαστεί.
 *
 * Διαμήκεις: κάτω = όλες συνεχείς (εφελκυσμός μέσου ανοίγματος)· άνω = 2 γωνιακοί
 * αναρτήρες συνεχείς + οι υπόλοιπες ως ράβδοι στηρίξεων (curtailed `SUPPORT_BAR_SPAN_FRACTION`
 * ανά άκρο). Πρόβολος → όλες οι άνω συνεχείς (άνω = κύριος εφελκυσμός). Το πλήθος τηρεί
 * πιστά το `BeamReinforcement` (ο suggester/χρήστης το έχει ήδη αποφασίσει — geometry-is-SSoT).
 */
export function resolveBeamRebarLayout(
  ctx: BeamSectionContext,
  r: BeamReinforcement,
): BeamRebarLayout | null {
  const widthMm = Math.max(0, ctx.widthMm);
  const depthMm = Math.max(0, ctx.depthMm);
  const spanMm = Math.max(0, ctx.spanMm);
  if (widthMm <= 0 || depthMm <= 0 || spanMm <= 0) return null;

  const cover = Math.max(0, r.coverMm);
  const dbw = Math.max(0, r.stirrups.diameterMm);
  const halfB = widthMm / 2;
  const halfH = depthMm / 2;

  // ── Διαμήκεις: επίπεδα w κάτω/άνω (inset = cover + Ø_συνδ + μισή Ø_διαμήκους) ──
  const dbBottom = Math.max(0, r.bottom.diameterMm);
  const dbTop = Math.max(0, r.top.diameterMm);
  const bottomW = -halfH + cover + dbw + dbBottom / 2;
  const topW = halfH - cover - dbw - dbTop / 2;
  const bottomHalfV = Math.max(0, halfB - (cover + dbw + dbBottom / 2));
  const topHalfV = Math.max(0, halfB - (cover + dbw + dbTop / 2));
  const bottomVs = distributeAcrossWidthMm(bottomHalfV, r.bottom.count);
  const topVs = distributeAcrossWidthMm(topHalfV, r.top.count);

  const longitudinalBars: BeamRebarBar[] = [];
  for (const v of bottomVs) {
    longitudinalBars.push({ vMm: v, wMm: bottomW, uStartMm: 0, uEndMm: spanMm, diameterMm: dbBottom, layer: 'bottom', role: 'continuous' });
  }

  const cantilever = ctx.supportType === 'cantilever';
  if (cantilever || topVs.length <= 2) {
    // Πρόβολος ή μόνο γωνιακοί → όλες οι άνω συνεχείς.
    for (const v of topVs) {
      longitudinalBars.push({ vMm: v, wMm: topW, uStartMm: 0, uEndMm: spanMm, diameterMm: dbTop, layer: 'top', role: 'continuous' });
    }
  } else {
    // Γωνιακοί αναρτήρες (πρώτος+τελευταίος) συνεχείς· ενδιάμεσοι = στηρίξεων ανά άκρο.
    const corners = [topVs[0], topVs[topVs.length - 1]];
    const interior = topVs.slice(1, -1);
    for (const v of corners) {
      longitudinalBars.push({ vMm: v, wMm: topW, uStartMm: 0, uEndMm: spanMm, diameterMm: dbTop, layer: 'top', role: 'continuous' });
    }
    const lSup = Math.min(spanMm / 2, Math.max(SUPPORT_BAR_SPAN_FRACTION * spanMm, depthMm));
    for (const v of interior) {
      longitudinalBars.push({ vMm: v, wMm: topW, uStartMm: 0, uEndMm: lSup, diameterMm: dbTop, layer: 'top', role: 'support' });
      longitudinalBars.push({ vMm: v, wMm: topW, uStartMm: spanMm - lSup, uEndMm: spanMm, diameterMm: dbTop, layer: 'top', role: 'support' });
    }
  }

  // ── Συνδετήρας: κλειστό ορθογ. στο cover (centerline inset = cover + dbw/2) ──
  const stirrupInset = cover + dbw / 2;
  const halfVs = Math.max(0, halfB - stirrupInset);
  const halfWs = Math.max(0, halfH - stirrupInset);
  const stirrupRing: Point2D[] = [
    { x: -halfVs, y: -halfWs },
    { x: halfVs, y: -halfWs },
    { x: halfVs, y: halfWs },
    { x: -halfVs, y: halfWs },
  ];
  if (longitudinalBars.length === 0 && (halfVs <= 0 || halfWs <= 0)) return null;

  const stirrupCornerRadiusMm = Math.min(STIRRUP_BEND_CL_FACTOR * dbw, halfVs, halfWs);
  const stirrupSectionPathMm = buildRoundedStirrupPath(stirrupRing, stirrupCornerRadiusMm, STIRRUP_BEND_ARC_SEGMENTS);
  // Γάντζος 135° τυλιγμένος γύρω από το κάτω-γωνιακό κολωνοσίδερο (ίδια γωνία BL με το ring).
  const hookBar = bottomVs.length > 0 ? { x: bottomVs[0], y: bottomW } : stirrupRing[0];
  const stirrupHookEndsMm = buildStirrupHookEndsMm(
    stirrupRing,
    hookBar,
    { x: 0, y: 0 },
    dbw,
    Math.max(dbBottom, dbTop),
    STIRRUP_BEND_ARC_SEGMENTS,
  );

  return {
    spanMm,
    widthMm,
    depthMm,
    longitudinalBars,
    stirrupSectionPathMm,
    stirrupHookEndsMm,
    stirrupLevelsMm: computeBeamStirrupLevelsMm(ctx, r),
    stirrupCornerRadiusMm,
    stirrupDiameterMm: dbw,
    stirrupCenterlineLengthMm: closedPolylineLengthMm(stirrupSectionPathMm),
  };
}
