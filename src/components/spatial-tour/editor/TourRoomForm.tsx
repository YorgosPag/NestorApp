'use client';

/**
 * @fileoverview **Ο ΧΩΡΟΣ ΕΝΟΣ ΣΗΜΕΙΟΥ** — τύπος (έως τρεις, ενιαίος χώρος) + προαιρετικό όνομα, με προεπισκόπηση του τι
 * θα δουν οι επισκέπτες (ADR-884 Φ2στ · §4.12).
 * @related `lib/spatial-tour/tour-room.ts` (κανονικοποίηση + εμφάνιση — ΙΔΙΑ με τον γραφέα και τον θεατή) ·
 *   `useTourEditorActions.ts` (`name` — αισιόδοξα, με «Αναίρεση») · `../LabeledSelect.tsx`
 * @module components/spatial-tour/editor/TourRoomForm
 *
 * 🏆 **Όπως οι μεγάλοι**: Matterport — τύπος από κλειστό λεξιλόγιο, `label` που υπερισχύει· Zillow 3D Home — «Edit
 *   details → title». 🔑 **Κανένας τύπος δεν προεπιλέγεται σιωπηλά**: χωρίς επιλογή, ο επισκέπτης βλέπει «Σημείο N».
 * 🔑 **Η προεπισκόπηση ρωτά το ΙΔΙΟ `tourRoomDisplay`** με τους επισκέπτες — ό,τι λέει εδώ, αυτό θα δουν (και η αρίθμηση
 *   όμοιων χώρων του ορόφου).
 */

import { useState } from 'react';
import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  TOUR_ROOM_LABEL_MAX, TOUR_ROOM_MAX_TYPES, TOUR_ROOM_TYPES, type TourRoomType,
} from '@/constants/spatial-tour-vocabulary';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { normalizeTourRoom, sameTourRoom, tourRoomDisplay, type TourRoomInput } from '@/lib/spatial-tour/tour-room';
import type { TourViewerGraph } from '@/lib/spatial-tour/viewer/tour-viewer-graph';
import type { TourNode, TourRoom } from '@/types/spatial-tour';

import { LabeledSelect, type SelectOption } from '../LabeledSelect';
import { SPATIAL_TOUR_NS } from '../spatial-tour-namespace';
import { TOUR_ROOM_TYPE_KEY } from '../viewer/tour-viewer-labels';
import { roomDisplayText } from '../viewer/useStopNames';
import { TOUR_EDITOR_KEYS } from './tour-editor-labels';

type Slot = TourRoomType | null;
const chosen = (slots: readonly Slot[]): TourRoomType[] => slots.filter((slot): slot is TourRoomType => slot !== null);

/** Ό,τι θα δουν οι επισκέπτες — με τα ΑΛΛΑ σημεία του ορόφου όπως είναι (για την αρίθμηση όμοιων χώρων). */
function previewOf(graph: TourViewerGraph, nodeId: string, draft: TourRoom | null) {
  const stop = graph.stops.get(nodeId);
  if (stop === undefined || draft === null) return null;
  const node = { ...stop.node, room: draft };
  const level = graph.levels.find((l) => l.id === stop.levelId)?.nodeIds ?? [];
  const levelNodes = level.map((id) => (id === nodeId ? node : graph.stops.get(id)?.node)).filter((n): n is TourNode => n !== undefined);
  return tourRoomDisplay(node, levelNodes);
}

function TypeRows({ idBase, slots, options, onChange }: {
  readonly idBase: string; readonly slots: readonly Slot[];
  readonly options: readonly SelectOption<TourRoomType>[]; readonly onChange: (slots: Slot[]) => void;
}) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const used = new Set(chosen(slots));
  return (
    <ul className="m-0 list-none space-y-2 p-0">
      {slots.map((slot, i) => (
        <li key={i} className="flex items-end gap-2">
          <span className="flex-1">
            <LabeledSelect id={`${idBase}-${i}`} label={t(i === 0 ? TOUR_EDITOR_KEYS.roomType : TOUR_EDITOR_KEYS.roomAlsoType)}
              value={slot} placeholder={t(TOUR_EDITOR_KEYS.roomTypePlaceholder)}
              options={options.filter((o) => o.value === slot || !used.has(o.value))}
              onChange={(value) => onChange(slots.map((s, j) => (j === i ? value : s)))} />
          </span>
          {i > 0 && (
            <Button type="button" size="icon-sm" variant="ghost" aria-label={t(TOUR_EDITOR_KEYS.roomRemoveType)}
              onClick={() => onChange(slots.filter((_, j) => j !== i))}><X aria-hidden className="h-4 w-4" /></Button>
          )}
        </li>
      ))}
      {slots.length < TOUR_ROOM_MAX_TYPES && slots.every((s) => s !== null) && (
        <li><Button type="button" size="sm" variant="outline" onClick={() => onChange([...slots, null])}>{t(TOUR_EDITOR_KEYS.roomAddType)}</Button></li>
      )}
    </ul>
  );
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
  const [slots, setSlots] = useState<Slot[]>(() => (saved === null ? [null] : [...saved.types]));
  const [label, setLabel] = useState(saved?.label ?? '');
  const options = TOUR_ROOM_TYPES.map((value) => ({ value, label: t(TOUR_ROOM_TYPE_KEY[value]) }));
  const draft = normalizeTourRoom({ types: chosen(slots), label });
  const preview = previewOf(graph, nodeId, draft);
  const ids = { heading: `tour-room-${nodeId}`, label: `tour-room-label-${nodeId}`, hint: `tour-room-hint-${nodeId}` };
  return (
    <section aria-labelledby={ids.heading} className="space-y-3 rounded-lg border border-border p-3">
      <h3 id={ids.heading} className="m-0 text-sm font-semibold">{t(TOUR_EDITOR_KEYS.roomTitle)}</h3>
      <TypeRows idBase={`tour-room-type-${nodeId}`} slots={slots} options={options} onChange={setSlots} />
      <p className="m-0 space-y-1">
        <Label htmlFor={ids.label}>{t(TOUR_EDITOR_KEYS.roomLabel)}</Label>
        <Input id={ids.label} value={label} maxLength={TOUR_ROOM_LABEL_MAX} aria-describedby={ids.hint} onChange={(e) => setLabel(e.target.value)} />
        <span id={ids.hint} className="block text-xs text-muted-foreground">{t(TOUR_EDITOR_KEYS.roomLabelHint)}</span>
      </p>
      {preview !== null && <p className="m-0 text-sm" aria-live="polite">{t(TOUR_EDITOR_KEYS.roomPreview, { name: roomDisplayText(t, preview) })}</p>}
      <footer className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={draft === null || sameTourRoom(draft, saved)}
          onClick={() => draft !== null && onSave({ types: draft.types, label: draft.label })}>{t(TOUR_EDITOR_KEYS.roomSave)}</Button>
        {saved !== null && <Button type="button" size="sm" variant="ghost" onClick={() => onSave(null)}>{t(TOUR_EDITOR_KEYS.roomClear)}</Button>}
      </footer>
    </section>
  );
}
