'use client';

/**
 * @fileoverview **Η ΟΘΟΝΗ ΤΟΠΟΘΕΤΗΣΗΣ** — στήλη (εισερχόμενα + σημεία) · χώρος εργασίας (προεπισκόπηση + φόρμα, ή σημείο +
 * βελάκια) (ADR-884 Φ2δ · §4.10, πρότυπα Matterport «360° Views» · Kuula hotspots).
 * @related `useTourEditorData.ts` · `useTourEditorActions.ts` · `lib/spatial-tour/tour-editor-model.ts` ·
 *   `TourEditorDialog.tsx` (φορτώνει αυτό πίσω από `next/dynamic` — το `three` μόνο για τον υπεύθυνο που το ανοίγει)
 * @module components/spatial-tour/editor/TourEditor
 *
 * 🔑 **Μετά την τοποθέτηση, η οθόνη πηγαίνει στο νέο σημείο** — εκεί είναι η επόμενη δουλειά (τα βελάκια).
 * 🔑 **Επιλογή που χάθηκε** (το σημείο σβήστηκε, το πανόραμα τοποθετήθηκε) ⇒ η πρώτη διαθέσιμη, ποτέ κενός καμβάς.
 * 🔑 **Εργαλεία ΔΙΠΛΑ στη φωτογραφία** (πρότυπο Matterport Workshop), όχι από κάτω: ζωντανά (Φ2δ) η φόρμα έμενε κάτω από
 *   τη γραμμή της οθόνης και η ροδέλα πάνω στη φωτογραφία κάνει ζουμ, όχι κύλιση — ο άνθρωπος δεν θα τη έβρισκε.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { TourPlacementTarget } from '@/lib/spatial-tour/tour-graph-edit';
import { buildTourEditorModel, previewGraphOf, type TourEditorModel } from '@/lib/spatial-tour/tour-editor-model';
import { initialNode } from '@/lib/spatial-tour/viewer/tour-viewer-graph';
import type { TourSubject } from '@/types/spatial-tour';

import { PANEL_KEYS } from '../spatial-tour-labels';
import { useStopNames } from '../viewer/useStopNames';
import { SPATIAL_TOUR_NS } from '../spatial-tour-namespace';
import { createTilePanoramaSource } from '../viewer/tile-panorama-source';
import type { TourPanoramaSource } from '../viewer/tour-panorama-source';
import { TOUR_EDITOR_KEYS } from './tour-editor-labels';
import { TourEditorRail, type TourEditorSelection } from './TourEditorRail';
import { TourPlanPane } from './TourPlanPane';
import { TourPointRemoval } from './TourPointRemoval';
import { TourRoomForm } from './TourRoomForm';
import { TourPointWorkspace, TourPreviewWorkspace } from './TourEditorWorkspaces';
import { useTourEditorActions, type TourEditorActions } from './useTourEditorActions';
import { useTourEditorData, type TourEditorData } from './useTourEditorData';

function firstSelection(model: TourEditorModel): TourEditorSelection | null {
  const nodeId = initialNode(model.graph);
  if (nodeId !== null) return { kind: 'point', nodeId };
  const ready = model.inbox.find((entry) => entry.readiness === 'ready') ?? model.inbox[0];
  return ready === undefined ? null : { kind: 'capture', captureId: ready.capture.id };
}

function isLive(model: TourEditorModel, selection: TourEditorSelection): boolean {
  return selection.kind === 'point' ? model.graph.stops.has(selection.nodeId)
    : model.inbox.some((entry) => entry.capture.id === selection.captureId);
}

/** Η επιλογή ακολουθεί τα δεδομένα: νέο σημείο μετά την τοποθέτηση · η πρώτη διαθέσιμη όταν χαθεί η τρέχουσα. */
function useSelection(model: TourEditorModel, data: TourEditorData) {
  const [selection, setSelection] = useState<TourEditorSelection | null>(() => firstSelection(model));
  const [epoch, setEpoch] = useState(0);
  const pendingFocus = useRef<string | null>(null);
  useEffect(() => {
    const focus = pendingFocus.current;
    const placedAt = focus === null ? null : data.captures.find((c) => c.id === focus)?.nodeId ?? null;
    if (placedAt !== null && model.graph.stops.has(placedAt)) {
      pendingFocus.current = null;
      setSelection({ kind: 'point', nodeId: placedAt });
      return;
    }
    if (selection !== null && isLive(model, selection)) return;
    if (selection?.kind === 'point') setEpoch((e) => e + 1);
    setSelection(firstSelection(model));
  }, [model, data.captures, selection]);
  return { selection, setSelection, epoch, pendingFocus };
}

interface LoadedEditorProps {
  readonly subject: TourSubject;
  readonly data: TourEditorData;
  readonly actions: TourEditorActions;
  readonly source: TourPanoramaSource;
}

function LoadedEditor({ subject, data, actions, source }: LoadedEditorProps) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const model = useMemo(() => buildTourEditorModel(data, data.captures), [data]);
  const nameOf = useStopNames(model.graph);
  const { selection, setSelection, epoch, pendingFocus } = useSelection(model, data);
  const onArrive = useCallback((nodeId: string) => setSelection((prev) => (
    prev?.kind === 'point' && prev.nodeId === nodeId ? prev : { kind: 'point', nodeId })), [setSelection]);
  const place = async (captureId: string, target: TourPlacementTarget) => {
    pendingFocus.current = captureId;
    if (!(await actions.place(captureId, target))) pendingFocus.current = null;
  };
  const { name } = actions;
  const footer = useCallback((nodeId: string) => {
    const stop = model.graph.stops.get(nodeId)?.stop;
    return (
      <>
        <TourRoomForm key={nodeId} graph={model.graph} nodeId={nodeId} onSave={(room) => name(nodeId, room)} />
        <TourPlanPane key={`plan-${nodeId}`} subject={subject} source={source} actions={actions} nodes={data.nodes} levels={data.levels}
          nodeId={nodeId} capture={stop === undefined ? null : { id: stop.captureId, headingRad: stop.headingRad }} nameOf={nameOf} />
        <TourPointRemoval model={model} nodeId={nodeId} busy={actions.busy} onUnplace={actions.unplace} />
      </>
    );
  }, [model, actions, name, subject, source, data.nodes, data.levels, nameOf]);
  const entry = selection?.kind === 'capture' ? model.inbox.find((e) => e.capture.id === selection.captureId) : undefined;
  const preview = entry === undefined ? null : previewGraphOf(entry.capture);
  return (
    <section className="grid min-h-0 flex-1 gap-4 md:grid-cols-[16rem_1fr]">
      <TourEditorRail model={model} selection={selection} onSelect={setSelection} />
      <section className="grid min-h-0 content-start gap-3 overflow-y-auto xl:grid-cols-[minmax(0,1fr)_22rem]" aria-live="polite">
        {selection?.kind === 'point' && (
          <TourPointWorkspace key={epoch} graph={model.graph} source={source} requestedNodeId={selection.nodeId} onArrive={onArrive}
            onPlaceArrow={actions.placeArrow} onUnlink={actions.unlink} footer={footer} />
        )}
        {entry !== undefined && preview !== null && (
          <TourPreviewWorkspace key={entry.capture.id} preview={preview} source={source} captureId={entry.capture.id} levels={data.levels}
            tourGraph={model.graph} busy={actions.busy} onPlace={(target) => void place(entry.capture.id, target)} />
        )}
        {entry !== undefined && preview === null && (
          <p role="status" className="text-sm text-muted-foreground">{t(entry.readiness === 'failed' ? TOUR_EDITOR_KEYS.failedHint : TOUR_EDITOR_KEYS.notReadyHint)}</p>
        )}
        {selection === null && <p className="text-sm text-muted-foreground">{t(TOUR_EDITOR_KEYS.selectPrompt)}</p>}
      </section>
    </section>
  );
}

export function TourEditor({ subject }: { readonly subject: TourSubject }) {
  const { t, isNamespaceReady } = useTranslation(SPATIAL_TOUR_NS);
  const data = useTourEditorData(subject);
  const actions = useTourEditorActions(subject, data);
  const source = useMemo(() => createTilePanoramaSource(subject), [subject]);
  if (!isNamespaceReady || data.load.kind === 'loading') return <p className="text-sm text-muted-foreground" aria-busy>{t(TOUR_EDITOR_KEYS.title)}</p>;
  if (data.load.kind === 'failed') {
    return (
      <p className="text-sm text-destructive" role="alert">
        {t(PANEL_KEYS.loadFailed)}{' '}
        <Button type="button" variant="link" size="sm" onClick={() => void data.reload()}>{t(PANEL_KEYS.retry)}</Button>
      </p>
    );
  }
  return <LoadedEditor subject={subject} data={data.load.data} actions={actions} source={source} />;
}
