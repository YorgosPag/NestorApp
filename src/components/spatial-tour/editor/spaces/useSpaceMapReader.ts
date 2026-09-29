'use client';

/**
 * @fileoverview **ΟΘΟΝΗ ⇒ ΜΕΤΡΑ ΚΑΤΟΨΗΣ, ΤΗ ΣΤΙΓΜΗ ΤΟΥ ΓΕΓΟΝΟΤΟΣ** — για τον χάρτη του επεξεργαστή χώρων (ADR-884 Φ2στ-γ Γ3γ-2β).
 * @related `lib/spatial-tour/viewer/tour-plan-zoom.ts` (`clientToPlan` — το ΙΔΙΟ `xMidYMid meet` του browser, `planUnitsPerPixel`)
 *   · `lib/spatial-tour/viewer/tour-viewer-plan.ts` (`fromPlanSvg`) · `lib/spatial-tour/space-edit/space-edit-point.ts`
 * @module components/spatial-tour/editor/spaces/useSpaceMapReader
 *
 * 🔑 **Getter, όχι στιγμιότυπο** (ADR-040): θέαση (ζουμ/μετακίνηση) και ορθογώνιο του `<svg>` διαβάζονται **όταν** έρθει το
 *   γεγονός — ένα σύρσιμο που κρατά 2″ ενώ ο τροχός αλλάζει ζουμ δεν δουλεύει ποτέ με παλιό πίνακα.
 */

import { useCallback, useRef } from 'react';

import { clientToPlan, planUnitsPerPixel, planViewBox } from '@/lib/spatial-tour/viewer/tour-plan-zoom';
import { fromPlanSvg, type PlanFrame } from '@/lib/spatial-tour/viewer/tour-viewer-plan';
import type { TourPlanXY } from '@/lib/spatial-tour/tour-graph-edit';

import { getPlanView, type TourPlanZoomStore } from '../../viewer/tour-plan-zoom-store';

export interface SpaceMapReading {
  readonly point: TourPlanXY;
  /** Μέτρα κάτοψης ανά css px — η ανοχή έλξης και τα μεγέθη λαβών γίνονται μέτρα με αυτό. */
  readonly metresPerPx: number;
}

export interface SpaceMapReader {
  /** Callback ref για το `<svg>`. */
  readonly bind: (svg: SVGSVGElement | null) => void;
  readonly read: (clientX: number, clientY: number) => SpaceMapReading | null;
}

export function useSpaceMapReader(frame: PlanFrame, store: TourPlanZoomStore, levelId: string): SpaceMapReader {
  const svg = useRef<SVGSVGElement | null>(null);
  const target = useRef({ frame, store, levelId });
  target.current = { frame, store, levelId };
  const bind = useCallback((node: SVGSVGElement | null) => { svg.current = node; }, []);
  const read = useCallback((clientX: number, clientY: number): SpaceMapReading | null => {
    const node = svg.current;
    if (node === null) return null;
    const { frame: f, store: s, levelId: id } = target.current;
    const box = planViewBox(f, getPlanView(s, id));
    const rect = node.getBoundingClientRect();
    const metresPerPx = planUnitsPerPixel(box, rect);
    if (metresPerPx === 0) return null;
    return { point: fromPlanSvg(clientToPlan(box, rect, clientX, clientY)), metresPerPx };
  }, []);
  return { bind, read };
}
