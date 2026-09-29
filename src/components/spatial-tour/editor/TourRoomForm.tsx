'use client';

/**
 * @fileoverview **Ο ΧΩΡΟΣ ΕΝΟΣ ΣΗΜΕΙΟΥ** — τύπος (έως τρεις, ενιαίος χώρος) + προαιρετικό όνομα, με προεπισκόπηση του τι
 * θα δουν οι επισκέπτες (ADR-884 Φ2στ · §4.12).
 * @related `lib/spatial-tour/tour-room.ts` (κανονικοποίηση + εμφάνιση — ΙΔΙΑ με τον γραφέα και τον θεατή) ·
 *   `useTourEditorActions.ts` (`name` — αισιόδοξα, με «Αναίρεση») · `TourRoomFields.tsx` (τα πεδία — κοινά με τον χώρο)
 * @module components/spatial-tour/editor/TourRoomForm
 *
 * 🏆 **Όπως οι μεγάλοι**: Matterport — τύπος από κλειστό λεξιλόγιο, `label` που υπερισχύει· Zillow 3D Home — «Edit
 *   details → title». 🔑 **Κανένας τύπος δεν προεπιλέγεται σιωπηλά**: χωρίς επιλογή, ο επισκέπτης βλέπει «Σημείο N».
 * 🔑 **Η προεπισκόπηση ρωτά το ΙΔΙΟ `tourRoomDisplay`** με τους επισκέπτες — ό,τι λέει εδώ, αυτό θα δουν (και η αρίθμηση
 *   όμοιων χώρων του ορόφου).
 */

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { sameTourRoom, tourRoomDisplay, type TourRoomInput } from '@/lib/spatial-tour/tour-room';
import type { TourViewerGraph } from '@/lib/spatial-tour/viewer/tour-viewer-graph';
import type { TourNode, TourRoom } from '@/types/spatial-tour';

import { SPATIAL_TOUR_NS } from '../spatial-tour-namespace';
import { roomDisplayText } from '../viewer/useStopNames';
import { TOUR_EDITOR_KEYS } from './tour-editor-labels';
import { TourRoomFields, useRoomDraft } from './TourRoomFields';

/** Ό,τι θα δουν οι επισκέπτες — με τα ΑΛΛΑ σημεία του ορόφου όπως είναι (για την αρίθμηση όμοιων χώρων). */
function previewOf(graph: TourViewerGraph, nodeId: string, draft: TourRoom | null) {
  const stop = graph.stops.get(nodeId);
  if (stop === undefined || draft === null) return null;
  const node = { ...stop.node, room: draft };
  const level = graph.levels.find((l) => l.id === stop.levelId)?.nodeIds ?? [];
  const levelNodes = level.map((id) => (id === nodeId ? node : graph.stops.get(id)?.node)).filter((n): n is TourNode => n !== undefined);
  return tourRoomDisplay(node, levelNodes);
}

export interface TourRoomFormProps {
  readonly graph: TourViewerGraph;
  readonly nodeId: string;
  readonly onSave: (room: TourRoomInput | null) => void;
}

/** ⚠️ Ο κάτοχος δίνει `key={nodeId}`: άλλο σημείο ⇒ νέα φόρμα από τα αποθηκευμένα, ποτέ υπόλειμμα του προηγούμενου. */
export function TourRoomForm({ graph, nodeId, onSave }: TourRoomFormProps) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const saved = graph.stops.get(nodeId)?.node.room ?? null;
  const room = useRoomDraft(saved);
  const { draft } = room;
  const preview = previewOf(graph, nodeId, draft);
  const heading = `tour-room-${nodeId}`;
  return (
    <section aria-labelledby={heading} className="space-y-3 rounded-lg border border-border p-3">
      <h3 id={heading} className="m-0 text-sm font-semibold">{t(TOUR_EDITOR_KEYS.roomTitle)}</h3>
      <TourRoomFields idBase={heading} room={room} />
      {preview !== null && <p className="m-0 text-sm" aria-live="polite">{t(TOUR_EDITOR_KEYS.roomPreview, { name: roomDisplayText(t, preview) })}</p>}
      <footer className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={draft === null || sameTourRoom(draft, saved)}
          onClick={() => draft !== null && onSave({ types: draft.types, label: draft.label })}>{t(TOUR_EDITOR_KEYS.roomSave)}</Button>
        {saved !== null && <Button type="button" size="sm" variant="ghost" onClick={() => onSave(null)}>{t(TOUR_EDITOR_KEYS.roomClear)}</Button>}
      </footer>
    </section>
  );
}
