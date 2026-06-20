/**
 * ADR-505 (finish/rebar export) — Γεωμετρία οπλισμού ΚΟΛΩΝΑΣ σε κάτοψη (pure SSoT).
 *
 * Το «σώμα» του πρώην `drawColumnRebar2D` ΠΡΙΝ το ctx: διασχίζει το ΙΔΙΟ geometry
 * SSoT (`resolveColumnRebarLayout` + `resolveColumnCrossTies`) και μετατρέπει τα
 * local-mm paths σε **world coords** μέσω του ΙΔΙΟΥ `columnLocalMmToWorld`. Καμία
 * νέα rebar-layout μαθηματική — μόνο η συγκέντρωση των paths/dots ως δεδομένα.
 *
 * Καταναλώνεται από: `column-rebar-2d.ts` (canvas) + `overlay-dxf-collector.ts` (DXF).
 *
 * @see ./column-rebar-layout-resolve.ts — geometry SSoT
 * @see ../../renderers/column-rebar-2d.ts — ο canvas consumer
 */

import type { ColumnParams } from '../../types/column-types';
import { columnLocalMmToWorld } from '../../geometry/column-geometry';
import { resolveColumnRebarLayout, resolveColumnCrossTies } from './column-rebar-layout-resolve';
import { resolveColumnReinforcementSection } from './column-section-outline';
import {
  resolveActiveColumnReinforcementForParams,
  resolveActiveColumnReinforcementForEntity,
} from '../active-reinforcement';
import { DEFAULT_STIRRUP_TYPE } from './column-reinforcement-types';
import type { RebarPlanGeometry, RebarPlanPath, RebarPlanDot } from './rebar-plan-geometry-types';
import type { Point2D } from '../../../rendering/types/Types';

/**
 * Γεωμετρία οπλισμού κολώνας στην κάτοψη (κάθε σχήμα). `null` όταν δεν έχει ενεργό
 * οπλισμό ή εκφυλισμένη διατομή. `columnId` (committed path) → FEM-aware ενεργός
 * οπλισμός· απών (ghost) → params-based (ίδια precedence με τον renderer, ADR-491).
 */
export function collectColumnRebarPlanGeometry(
  p: ColumnParams,
  columnId?: string,
): RebarPlanGeometry | null {
  const r = columnId
    ? resolveActiveColumnReinforcementForEntity({ id: columnId, params: p })
    : resolveActiveColumnReinforcementForParams(p);
  if (!r) return null;
  const section = resolveColumnReinforcementSection(p);
  const layout = resolveColumnRebarLayout(r, section);
  if (!layout) return null;

  const hooked = (r.stirrups.type ?? DEFAULT_STIRRUP_TYPE) === 'closed-hooked';
  const stirrupDia = layout.stirrupDiameterMm;
  const paths: RebarPlanPath[] = [];
  const toWorld = (localMm: readonly Point2D[]): Point2D[] => columnLocalMmToWorld(p, localMm);
  const pushPath = (localMm: readonly Point2D[], closed: boolean): void => {
    if (localMm.length < 2) return;
    paths.push({ points: toWorld(localMm), closed, diameterMm: stirrupDia });
  };

  // ── Στεφάνι + επιπλέον στεφάνια (boundary τοιχώματος / σκέλη multihoop) ──
  pushPath(layout.stirrupPathMm, true);
  const extraHoops = layout.extraStirrupPathsMm ?? [];
  for (let i = 0; i < extraHoops.length; i++) {
    pushPath(extraHoops[i], true);
    if (hooked && layout.extraStirrupHookEndsMm?.[i]) {
      for (const end of layout.extraStirrupHookEndsMm[i]) pushPath(end, false);
    }
  }
  if (hooked) {
    for (const end of layout.stirrupHookEndsMm) pushPath(end, false);
  }

  // ── Εσωτερικά συνδετήρια (cross-ties / διαμάντι / web S-ties) — shape-aware ──
  for (const tie of resolveColumnCrossTies(layout, section, r)) {
    pushPath(tie.pathMm, tie.closed);
    if (!hooked) continue;
    for (const end of tie.hookEndsMm) pushPath(end, false);
  }

  // ── Διαμήκεις ράβδες (γεμάτες κουκκίδες) ──
  const dots: RebarPlanDot[] = toWorld(layout.longitudinalBarsMm).map((center) => ({
    center,
    diameterMm: layout.barDiameterMm,
  }));

  return { paths, dots };
}
