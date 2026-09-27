'use client';

/**
 * @fileoverview **ΤΑ ΕΡΓΑΛΕΙΑ ΤΩΝ ΒΕΛΑΚΙΩΝ** — για κάθε σημείο: τσιπ που σέρνεται πάνω στη φωτογραφία (πρότυπο Kuula «Fast
 * Hotspot») **και** «Βελάκι εδώ» με το στόχαστρο (ADR-884 Φ2δ · §4.10).
 * @related `viewer/TourPanoramaStage.tsx` (`TourStageAim` — η διόπτευση κάτω από τον δείκτη / στο κέντρο) ·
 *   `viewer/usePointerDragRelease.ts` · `lib/spatial-tour/tour-editor-model.ts` (ποιοι γείτονες δεν έχουν βελάκι)
 * @module components/spatial-tour/editor/TourArrowTools
 *
 * ♿ **Το σύρσιμο ΔΕΝ είναι ο μόνος δρόμος** (WCAG 2.2 · 2.5.7): ο άνθρωπος στρέφει την εικόνα (βελάκια πληκτρολογίου ή
 *   σύρσιμο ματιάς) ώστε ο κύκλος στο κέντρο να δείχνει την πόρτα, και πατά «Βελάκι εδώ» — ένα κλικ, ή Enter.
 * 🔑 Βελάκι σε **μη συνδεδεμένο** σημείο = σύνδεση + βελάκι, σε **μία** εντολή (`link` είναι upsert στον γραφέα).
 */

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { TourViewerGraph } from '@/lib/spatial-tour/viewer/tour-viewer-graph';
import { neighboursOf } from '@/lib/spatial-tour/viewer/tour-viewer-graph';

import { SPATIAL_TOUR_NS } from '../spatial-tour-namespace';
import type { TourStageAim } from '../viewer/TourPanoramaStage';
import { useStopNames } from '../viewer/useStopNames';
import { usePointerDragRelease } from '../viewer/usePointerDragRelease';
import { TOUR_EDITOR_KEYS } from './tour-editor-labels';

interface ArrowTarget {
  readonly nodeId: string;
  /** `true` σε συνδεδεμένο σημείο χωρίς βελάκι · `false` με βελάκι · `null` όταν δεν είναι συνδεδεμένο. */
  readonly missing: boolean | null;
}

interface TourArrowToolsProps {
  readonly aim: TourStageAim;
  readonly graph: TourViewerGraph;
  readonly nodeId: string;
  readonly onPlaceArrow: (toNodeId: string, bearingRad: number) => void;
  readonly onUnlink: (toNodeId: string) => void;
}

function targetsOf(graph: TourViewerGraph, nodeId: string): { readonly linked: ArrowTarget[]; readonly others: ArrowTarget[] } {
  const neighbours = neighboursOf(graph, nodeId);
  const linkedIds = new Set(neighbours.map((n) => n.nodeId));
  const linked = neighbours.map((n) => ({ nodeId: n.nodeId, missing: n.bearing === null }));
  const others = [...graph.stops.keys()]
    .filter((id) => id !== nodeId && !linkedIds.has(id))
    .map((id) => ({ nodeId: id, missing: null }));
  return { linked, others };
}

function ArrowTargetRow({ target, name, aim, onPlaceArrow, onUnlink }: {
  readonly target: ArrowTarget;
  /** Το όνομα του σημείου-στόχου (`useStopNames`) — «Γραφείο», αλλιώς «Σημείο N». */
  readonly name: string;
  readonly aim: TourStageAim;
  readonly onPlaceArrow: (toNodeId: string, bearingRad: number) => void;
  readonly onUnlink?: (toNodeId: string) => void;
}) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const place = (bearing: number | null) => { if (bearing !== null) onPlaceArrow(target.nodeId, bearing); };
  const drag = usePointerDragRelease((x, y) => place(aim.bearingAtClient(x, y)));
  return (
    <li className="flex flex-wrap items-center gap-2 py-1 text-sm">
      <Button type="button" variant="outline" size="sm" {...drag} aria-label={t(TOUR_EDITOR_KEYS.dragArrow, { name })}
        className="cursor-grab touch-none active:cursor-grabbing">{name}</Button>
      {target.missing === true && <Badge variant="outline">{t(TOUR_EDITOR_KEYS.arrowMissing)}</Badge>}
      <Button type="button" variant="secondary" size="sm" onClick={() => place(aim.centerBearing())}
        aria-label={t(TOUR_EDITOR_KEYS.arrowHereFor, { name })}>{t(TOUR_EDITOR_KEYS.arrowHere)}</Button>
      {onUnlink !== undefined && (
        <Button type="button" variant="ghost" size="sm" onClick={() => onUnlink(target.nodeId)}>
          {t(TOUR_EDITOR_KEYS.unlink, { name })}
        </Button>
      )}
    </li>
  );
}

export function TourArrowTools({ aim, graph, nodeId, onPlaceArrow, onUnlink }: TourArrowToolsProps) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const nameOf = useStopNames(graph);
  const { linked, others } = targetsOf(graph, nodeId);
  return (
    <section className="space-y-2" aria-labelledby="tour-arrows-heading">
      <h3 id="tour-arrows-heading" className="text-sm font-semibold">{t(TOUR_EDITOR_KEYS.arrows)}</h3>
      <p className="text-sm text-muted-foreground">{t(TOUR_EDITOR_KEYS.arrowsHint)}</p>
      {linked.length > 0 && (
        <ul className="m-0 list-none divide-y p-0">
          {linked.map((target) => <ArrowTargetRow key={target.nodeId} target={target} name={nameOf(target.nodeId)} aim={aim} onPlaceArrow={onPlaceArrow} onUnlink={onUnlink} />)}
        </ul>
      )}
      {others.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm font-medium">{t(TOUR_EDITOR_KEYS.otherPoints)}</summary>
          <ul className="m-0 list-none divide-y p-0">
            {others.map((target) => <ArrowTargetRow key={target.nodeId} target={target} name={nameOf(target.nodeId)} aim={aim} onPlaceArrow={onPlaceArrow} />)}
          </ul>
        </details>
      )}
    </section>
  );
}
