'use client';

/**
 * @fileoverview **ΤΟ ΠΙΝΕΛΟ ΠΑΝΩ ΣΤΗ ΦΩΤΟΓΡΑΦΙΑ** — η προεπισκόπηση του προχείρου στη GPU, η επιφάνεια που σχεδιάζει κύκλους και οι
 * λαβές του επιλεγμένου (ADR-884 Φ2ζ ζ3 · §4.15, πρότυπα Matterport Blur Brush · Figma).
 * @related `useRedactionTool.ts` (η κατάσταση) · `useRedactionBrush.ts` (οι χειρονομίες) · `viewer/TourPanoramaStage.tsx`
 *   (`TourStageScene` — προβολή, καρέ, προεπισκόπηση) · `lib/spatial-tour/viewer/tour-redaction-preview.ts` (συσκευασία για τον shader)
 * @module components/spatial-tour/editor/redaction/TourRedactionOverlay
 *
 * 🔑 **Η προεπισκόπηση είναι ο shader, όχι DOM**: ό,τι σχεδιάζεται θολώνει **αμέσως**, με τη γεωμετρία και τα κελιά του ψήστη.
 *   Φαίνεται όσο το πινέλο είναι ανοιχτό, υπάρχει επιλογή ή εκκρεμεί πρόχειρο — αλλιώς τα εργαλεία βελακιών δουλεύουν πάνω σε
 *   καθαρή φωτογραφία.
 * 🔑 **Οι λαβές είναι πραγματικά `<button>`** (Tab · βελάκια = μετακίνηση · `+`/`−` = μέγεθος · Delete = αφαίρεση) με θέση που
 *   γράφεται imperative σε κάθε καρέ (ADR-040 — όχι 60 re-render/δευτ.). Λαβή πίσω από τον θεατή ⇒ `hidden`.
 */

import { type KeyboardEvent, type RefObject, useEffect, useRef } from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  redactionKeyAction,
  redactionPreviewOf,
  type TourDraftRedaction,
} from '@/lib/spatial-tour/tour-redaction-draft';
import { packRedactionPreview } from '@/lib/spatial-tour/viewer/tour-redaction-preview';

import { SPATIAL_TOUR_NS } from '../../spatial-tour-namespace';
import type { TourStageScene } from '../../viewer/TourPanoramaStage';
import { TOUR_REDACTION_KEYS } from '../tour-redaction-labels';
import { type BrushHandlers, useRedactionBrush } from './useRedactionBrush';
import type { RedactionTool } from './useRedactionTool';

const HANDLE_CLASS = 'absolute left-0 top-0 h-4 w-4 cursor-grab touch-none rounded-full border-2 border-background bg-foreground shadow ring-1 ring-ring focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring active:cursor-grabbing';

/** Το σημείο της λαβής μεγέθους: πάνω από το κέντρο κατά την ακτίνα (κάτω, αν ο κύκλος ακουμπά τον ζενίθ). */
function rimOf(item: TourDraftRedaction): { readonly yaw: number; readonly pitch: number } {
  const up = item.pitchRad + item.radiusRad;
  return { yaw: item.yawRad, pitch: up <= Math.PI / 2 ? up : item.pitchRad - item.radiusRad };
}

function place(el: HTMLElement | null, at: { readonly x: number; readonly y: number } | null): void {
  if (el === null) return;
  el.hidden = at === null;
  if (at !== null) el.style.transform = `translate(${at.x}px, ${at.y}px) translate(-50%, -50%)`;
}

/** Οι λαβές ακολουθούν τον κύκλο σε κάθε καρέ **και** σε κάθε αλλαγή του προχείρου. */
function useHandlePlacement(scene: TourStageScene, item: TourDraftRedaction | undefined, refs: {
  readonly center: RefObject<HTMLButtonElement | null>;
  readonly rim: RefObject<HTMLButtonElement | null>;
}): void {
  useEffect(() => {
    if (item === undefined) return;
    const update = () => {
      place(refs.center.current, scene.project({ yaw: item.yawRad, pitch: item.pitchRad }));
      place(refs.rim.current, scene.project(rimOf(item)));
    };
    update();
    return scene.onFrame(update);
  }, [scene, item, refs]);
}

/** Η προεπισκόπηση στη GPU — κενή όταν το εργαλείο «κοιμάται». */
function usePreview(scene: TourStageScene, tool: RedactionTool): void {
  const { draft, brush, edits } = tool;
  const shown = brush || edits.length > 0 || draft.selectedId !== null;
  useEffect(() => {
    scene.setRedactionPreview(packRedactionPreview(shown ? redactionPreviewOf(draft) : []));
  }, [scene, draft, shown]);
}

function Handles({ scene, tool, item, bind }: {
  readonly scene: TourStageScene;
  readonly tool: RedactionTool;
  readonly item: TourDraftRedaction;
  readonly bind: (target: 'move' | 'resize') => BrushHandlers;
}) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const center = useRef<HTMLButtonElement | null>(null);
  const rim = useRef<HTMLButtonElement | null>(null);
  const refs = useRef({ center, rim }).current;
  useHandlePlacement(scene, item, refs);
  const number = tool.draft.working.findIndex((r) => r.id === item.id) + 1;
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const action = redactionKeyAction(e.key, item.id, scene.camera.get().view.fov);
    if (action === null) return;
    e.preventDefault();
    tool.dispatch(action);
  };
  return (
    <>
      <button type="button" hidden ref={center} className={HANDLE_CLASS} aria-label={t(TOUR_REDACTION_KEYS.handleMove, { number })}
        onKeyDown={onKeyDown} {...bind('move')} />
      <button type="button" hidden ref={rim} className={HANDLE_CLASS} aria-label={t(TOUR_REDACTION_KEYS.handleResize, { number })}
        onKeyDown={onKeyDown} {...bind('resize')} />
    </>
  );
}

export function TourRedactionOverlay({ scene, tool }: { readonly scene: TourStageScene; readonly tool: RedactionTool }) {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const getDraft = useRef(() => tool.draft);
  getDraft.current = () => tool.draft;
  usePreview(scene, tool);
  const bind = useRedactionBrush(
    { scene, getDraft: () => getDraft.current(), dispatch: tool.dispatch, newId: tool.newId }, surfaceRef, tool.brush,
  );
  const selected = tool.draft.working.find((r) => r.id === tool.draft.selectedId);
  if (tool.captureId === null) return null;
  return (
    <>
      {tool.brush && <div ref={surfaceRef} aria-hidden className="absolute inset-0 cursor-crosshair touch-none" {...bind('surface')} />}
      {selected !== undefined && <Handles scene={scene} tool={tool} item={selected} bind={bind} />}
    </>
  );
}
