'use client';

/**
 * @fileoverview **Η ΣΤΗΛΗ ΤΗΣ ΟΘΟΝΗΣ ΤΟΠΟΘΕΤΗΣΗΣ** — εισερχόμενα + σημεία ανά όροφο, με «λείπουν βελάκια» (ADR-884 Φ2δ ·
 * §4.10, πρότυπο Matterport: συρτάρι «360° Views» δίπλα στον χώρο).
 * @related `lib/spatial-tour/tour-editor-model.ts` (όλη η κρίση — εδώ μόνο απεικόνιση) · `TourEditor.tsx`
 * @module components/spatial-tour/editor/TourEditorRail
 *
 * 🔑 **Λήψη που ψήνεται φαίνεται, αλλά δεν επιλέγεται**: ο γραφέας την αρνείται (`capture-not-ready`) — η οθόνη λέει
 *   «ετοιμάζεται» αντί να προσφέρει πράξη που θα αποτύχει.
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatDate } from '@/lib/intl-formatting';
import type { TourEditorModel, TourInboxEntry } from '@/lib/spatial-tour/tour-editor-model';

import { SPATIAL_TOUR_NS } from '../spatial-tour-namespace';
import { PANEL_KEYS } from '../spatial-tour-labels';
import { TOUR_VIEWER_KEYS } from '../viewer/tour-viewer-labels';
import { useLevelLabel } from '../viewer/TourViewerNavigation';
import { TOUR_EDITOR_KEYS } from './tour-editor-labels';

export type TourEditorSelection =
  | { readonly kind: 'capture'; readonly captureId: string }
  | { readonly kind: 'point'; readonly nodeId: string };

interface TourEditorRailProps {
  readonly model: TourEditorModel;
  readonly selection: TourEditorSelection | null;
  readonly onSelect: (selection: TourEditorSelection) => void;
}

const isSelected = (selection: TourEditorSelection | null, other: TourEditorSelection) =>
  selection !== null && selection.kind === other.kind
  && (selection.kind === 'capture' ? other.kind === 'capture' && selection.captureId === other.captureId
    : other.kind === 'point' && selection.nodeId === other.nodeId);

function InboxRow({ entry, selected, onSelect }: { readonly entry: TourInboxEntry; readonly selected: boolean; readonly onSelect: () => void }) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const date = t(PANEL_KEYS.capturedAt, { date: formatDate(entry.capture.capturedAt) });
  return (
    <li className="flex items-center gap-2">
      <Button type="button" variant={selected ? 'secondary' : 'ghost'} size="sm" className="flex-1 justify-start"
        aria-current={selected ? 'true' : undefined} onClick={onSelect}>{date}</Button>
      {entry.readiness === 'baking' && <Badge variant="outline">{t(TOUR_EDITOR_KEYS.baking)}</Badge>}
      {entry.readiness === 'failed' && <Badge variant="destructive">{t(TOUR_EDITOR_KEYS.failed)}</Badge>}
    </li>
  );
}

function PointsSection({ model, selection, onSelect }: TourEditorRailProps) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const labelOf = useLevelLabel();
  if (model.graph.levels.length === 0) return <p className="text-sm text-muted-foreground">{t(TOUR_EDITOR_KEYS.noPoints)}</p>;
  return (
    <>
      {model.graph.levels.map((level) => (
        <section key={level.id} aria-label={labelOf(level)} className="space-y-1">
          <h4 className="m-0 text-xs font-medium uppercase text-muted-foreground">{labelOf(level)}</h4>
          <ul className="m-0 list-none space-y-1 p-0">
            {level.nodeIds.map((nodeId) => {
              const target = { kind: 'point', nodeId } as const;
              const missing = model.missingArrows.get(nodeId)?.length ?? 0;
              return (
                <li key={nodeId} className="flex items-center gap-2">
                  <Button type="button" variant={isSelected(selection, target) ? 'secondary' : 'ghost'} size="sm" className="flex-1 justify-start"
                    aria-current={isSelected(selection, target) ? 'true' : undefined} onClick={() => onSelect(target)}>
                    {t(TOUR_VIEWER_KEYS.point, { number: model.graph.stops.get(nodeId)?.number ?? 0 })}
                  </Button>
                  {missing > 0 && <Badge variant="outline">{t(TOUR_EDITOR_KEYS.missingArrows, { count: missing })}</Badge>}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );
}

export function TourEditorRail({ model, selection, onSelect }: TourEditorRailProps) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  return (
    <nav aria-label={t(TOUR_EDITOR_KEYS.title)} className="space-y-4 overflow-y-auto">
      <section aria-labelledby="tour-editor-inbox" className="space-y-1">
        <h3 id="tour-editor-inbox" className="text-sm font-semibold">{t(TOUR_EDITOR_KEYS.inbox)}</h3>
        {model.inbox.length === 0
          ? <p className="text-sm text-muted-foreground">{t(TOUR_EDITOR_KEYS.inboxEmpty)}</p>
          : (
            <ul className="m-0 list-none space-y-1 p-0">
              {model.inbox.map((entry) => {
                const target = { kind: 'capture', captureId: entry.capture.id } as const;
                return <InboxRow key={entry.capture.id} entry={entry} selected={isSelected(selection, target)} onSelect={() => onSelect(target)} />;
              })}
            </ul>
          )}
      </section>
      <section aria-labelledby="tour-editor-points" className="space-y-2">
        <h3 id="tour-editor-points" className="text-sm font-semibold">{t(TOUR_EDITOR_KEYS.points)}</h3>
        <PointsSection model={model} selection={selection} onSelect={onSelect} />
      </section>
    </nav>
  );
}
