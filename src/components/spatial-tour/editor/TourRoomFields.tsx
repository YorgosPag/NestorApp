'use client';

/**
 * @fileoverview **ΤΑ ΠΕΔΙΑ ΕΝΟΣ ΟΝΟΜΑΤΟΣ ΧΩΡΟΥ** — τύπος (έως τρεις, ενιαίος χώρος) + προαιρετικό όνομα (ADR-884 Φ2στ · §4.12 ·
 * Γ3γ-2β · §12 Δ8.5).
 * @related `TourRoomForm.tsx` (όνομα **σημείου**) · `spaces/TourSpacePanel.tsx` (όνομα **χώρου** χωρίς σημείο — η αποθήκη) ·
 *   `lib/spatial-tour/tour-room.ts` (η ΜΙΑ κανονικοποίηση)
 * @module components/spatial-tour/editor/TourRoomFields
 *
 * 🔑 **Εξήχθη ΠΡΙΝ γραφτεί δεύτερη φορά** (N.0.2): σημείο και χώρος ονομάζονται με το ίδιο λεξιλόγιο — δύο φόρμες θα απέκλιναν
 *   (η μία θα μάθαινε τρίτο τύπο και η άλλη όχι).
 * 🔑 **Κανένας τύπος δεν προεπιλέγεται σιωπηλά** (Matterport): χωρίς επιλογή, το πρόχειρο είναι `null`.
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
import { normalizeTourRoom } from '@/lib/spatial-tour/tour-room';
import type { TourRoom } from '@/types/spatial-tour';

import { LabeledSelect, type SelectOption } from '../LabeledSelect';
import { SPATIAL_TOUR_NS } from '../spatial-tour-namespace';
import { TOUR_ROOM_TYPE_KEY } from '../viewer/tour-viewer-labels';
import { TOUR_EDITOR_KEYS } from './tour-editor-labels';

type Slot = TourRoomType | null;
const chosen = (slots: readonly Slot[]): TourRoomType[] => slots.filter((slot): slot is TourRoomType => slot !== null);

export interface RoomDraftState {
  readonly slots: readonly Slot[];
  readonly setSlots: (slots: Slot[]) => void;
  readonly label: string;
  readonly setLabel: (label: string) => void;
  /** Το κανονικοποιημένο πρόχειρο — `null` όταν δεν επιλέχθηκε τύπος (ή είναι άκυρο). */
  readonly draft: TourRoom | null;
}

/** ⚠️ Ο κάτοχος δίνει `key`: άλλο σημείο/χώρος ⇒ νέο πρόχειρο από τα αποθηκευμένα, ποτέ υπόλειμμα του προηγούμενου. */
export function useRoomDraft(saved: TourRoom | null): RoomDraftState {
  const [slots, setSlots] = useState<Slot[]>(() => (saved === null ? [null] : [...saved.types]));
  const [label, setLabel] = useState(saved?.label ?? '');
  return { slots, setSlots, label, setLabel, draft: normalizeTourRoom({ types: chosen(slots), label }) };
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
        // eslint-disable-next-line react/no-array-index-key -- θέσεις επιλογέων: η σειρά ΕΙΝΑΙ η ταυτότητα (πρώτος = κύριος τύπος)
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

/** Τύποι + όνομα — ελεγχόμενα από το {@link useRoomDraft} του κατόχου. */
export function TourRoomFields({ idBase, room }: { readonly idBase: string; readonly room: RoomDraftState }) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const options = TOUR_ROOM_TYPES.map((value) => ({ value, label: t(TOUR_ROOM_TYPE_KEY[value]) }));
  const ids = { label: `${idBase}-label`, hint: `${idBase}-hint` };
  return (
    <>
      <TypeRows idBase={`${idBase}-type`} slots={room.slots} options={options} onChange={room.setSlots} />
      <p className="m-0 space-y-1">
        <Label htmlFor={ids.label}>{t(TOUR_EDITOR_KEYS.roomLabel)}</Label>
        <Input id={ids.label} value={room.label} maxLength={TOUR_ROOM_LABEL_MAX} aria-describedby={ids.hint} onChange={(e) => room.setLabel(e.target.value)} />
        <span id={ids.hint} className="block text-xs text-muted-foreground">{t(TOUR_EDITOR_KEYS.roomLabelHint)}</span>
      </p>
    </>
  );
}
