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
import { COLOR_BRIDGE } from '@/design-system/color-bridge';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatDate } from '@/lib/intl-formatting';
import { cn } from '@/lib/utils';
import type { TourEditorModel, TourInboxEntry } from '@/lib/spatial-tour/tour-editor-model';

import { SPATIAL_TOUR_NS } from '../spatial-tour-namespace';
import { PANEL_KEYS } from '../spatial-tour-labels';
import { useLevelLabel } from '../viewer/useLevelLabel';
import { useOffGraphPointName, useStopNames } from '../viewer/useStopNames';
import { TOUR_EDITOR_KEYS } from './tour-editor-labels';
import { TOUR_REDACTION_KEYS } from './tour-redaction-labels';

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
      <Button type="button" variant="ghost" size="sm" className={cn('flex-1 justify-start', selected && COLOR_BRIDGE.selectionControl.pressed)}
        aria-current={selected ? 'true' : undefined} onClick={onSelect}>{date}</Button>
      {entry.readiness === 'baking' && <Badge variant="outline">{t(TOUR_EDITOR_KEYS.baking)}</Badge>}
      {entry.readiness === 'failed' && <Badge variant="destructive">{t(TOUR_EDITOR_KEYS.failed)}</Badge>}
    </li>
  );
}

function PointsSection({ model, selection, onSelect }: TourEditorRailProps) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const labelOf = useLevelLabel();
  const nameOf = useStopNames(model.graph);
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
                  <Button type="button" variant="ghost" size="sm" className={cn('flex-1 justify-start', isSelected(selection, target) && COLOR_BRIDGE.selectionControl.pressed)}
                    aria-current={isSelected(selection, target) ? 'true' : undefined} onClick={() => onSelect(target)}>
                    {nameOf(nodeId)}
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

/** Σημεία που ξαναψήνονται (θόλωμα, ζ3) — εκτός γράφου, αλλά **ποτέ** εξαφανισμένα από τη στήλη. */
function RebakingSection({ model, selection, onSelect }: TourEditorRailProps) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const nameOf = useOffGraphPointName();
  if (model.rebaking.length === 0) return null;
  return (
    <section aria-labelledby="tour-editor-rebaking" className="space-y-1">
      <h3 id="tour-editor-rebaking" className="text-sm font-semibold">{t(TOUR_REDACTION_KEYS.rebakingSection)}</h3>
      <ul className="m-0 list-none space-y-1 p-0">
        {model.rebaking.map((entry) => {
          const target = { kind: 'point', nodeId: entry.nodeId } as const;
          const selected = isSelected(selection, target);
          return (
            <li key={entry.nodeId} className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="sm" className={cn('flex-1 justify-start', selected && COLOR_BRIDGE.selectionControl.pressed)}
                aria-current={selected ? 'true' : undefined} onClick={() => onSelect(target)}>
                {nameOf(entry.node, entry.levelPeers) ?? t(PANEL_KEYS.capturedAt, { date: formatDate(entry.capture.capturedAt) })}
              </Button>
              <Badge variant={entry.readiness === 'failed' ? 'destructive' : 'outline'}>
                {t(entry.readiness === 'failed' ? TOUR_EDITOR_KEYS.failed : TOUR_REDACTION_KEYS.rebaking)}
              </Badge>
            </li>
          );
        })}
      </ul>
    </section>
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
      <RebakingSection model={model} selection={selection} onSelect={onSelect} />
    </nav>
  );
}
