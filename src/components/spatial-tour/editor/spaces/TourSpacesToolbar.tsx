'use client';

/**
 * @fileoverview **Η ΓΡΑΜΜΗ ΕΡΓΑΛΕΙΩΝ ΤΩΝ ΧΩΡΩΝ** — Επιλογή / Σχεδίαση, πλάτος πόρτας, κατάσταση ανίχνευσης (ADR-884 Φ2στ-γ Γ3γ-2β
 * · §12 Δ9.5 · Δ9.7).
 * @related `space-editor-store.ts` · `useSpaceProposals.ts` (`redetectSelected`) · `lib/spatial-tour/space-detect/space-detect-types.ts`
 *   (`SPACE_DOOR_WIDTH_RANGE_M`)
 * @module components/spatial-tour/editor/spaces/TourSpacesToolbar
 *
 * 🔑 **Πόρτα ⇒ ζωντανή επανανίχνευση** της επιλεγμένης πρότασης: ο ανιχνευτής κρατά ένα αίτημα σε πτήση + ένα αναμένον
 *   (`latestOnly`) — το σύρσιμο του ρυθμιστικού δεν στήνει ουρά ούτε περιμένει debounce.
 * ♿ Η άρνηση/αποτυχία ανίχνευσης είναι `role="alert"`· η «Αναζήτηση χώρων…» `role="status"`.
 */

import { MousePointer2, PenTool } from 'lucide-react';

import { Slider } from '@/components/ui/slider';
import { ToggleButton } from '@/components/ui/toggle-button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatNumber } from '@/lib/intl-formatting';
import { SPACE_DOOR_WIDTH_RANGE_M } from '@/lib/spatial-tour/space-detect/space-detect-types';

import { SPATIAL_TOUR_NS } from '../../spatial-tour-namespace';
import {
  setTool,
  updateSpaceEditor,
  useSpaceEditor,
  type SpaceEditorState,
  type SpaceEditorStore,
  type SpaceEditorTool,
} from './space-editor-store';
import { SPACE_DETECT_NOTICE_KEY, TOUR_SPACE_EDITOR_KEYS } from './tour-space-editor-labels';

const readTool = (s: SpaceEditorState) => s.tool;
const readDoor = (s: SpaceEditorState) => s.doorWidthM;
const readDetecting = (s: SpaceEditorState) => s.detecting;
const readNotice = (s: SpaceEditorState) => s.notice;
const readProposalCount = (s: SpaceEditorState) => s.proposals.length;

const TOOLS: readonly { readonly tool: SpaceEditorTool; readonly key: string; readonly Icon: typeof PenTool }[] = [
  { tool: 'select', key: TOUR_SPACE_EDITOR_KEYS.toolSelect, Icon: MousePointer2 },
  { tool: 'pen', key: TOUR_SPACE_EDITOR_KEYS.toolPen, Icon: PenTool },
];

function DoorSlider({ store, onChange }: { readonly store: SpaceEditorStore; readonly onChange: () => void }) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const door = useSpaceEditor(store, readDoor);
  const { min, max, step } = SPACE_DOOR_WIDTH_RANGE_M;
  const set = (value: number) => {
    updateSpaceEditor(store, (s) => (s.doorWidthM === value ? s : { ...s, doorWidthM: value }));
    onChange();
  };
  return (
    <section className="flex min-w-56 flex-1 items-center gap-2" aria-describedby="tour-space-door-hint">
      <span className="text-sm">{t(TOUR_SPACE_EDITOR_KEYS.door)}</span>
      <Slider className="flex-1" min={min} max={max} step={step} value={[door]} thumbAriaLabel={t(TOUR_SPACE_EDITOR_KEYS.door)}
        onValueChange={([value]) => { if (value !== undefined) set(value); }} />
      <output className="w-14 text-right text-sm tabular-nums">
        {t(TOUR_SPACE_EDITOR_KEYS.doorValue, { width: formatNumber(door, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) })}
      </output>
      <span id="tour-space-door-hint" className="sr-only">{t(TOUR_SPACE_EDITOR_KEYS.doorHint)}</span>
    </section>
  );
}

function Status({ store }: { readonly store: SpaceEditorStore }) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const detecting = useSpaceEditor(store, readDetecting);
  const notice = useSpaceEditor(store, readNotice);
  const count = useSpaceEditor(store, readProposalCount);
  return (
    <>
      <p role="status" className="m-0 text-sm text-muted-foreground">
        {detecting > 0 ? t(TOUR_SPACE_EDITOR_KEYS.detecting) : count > 0 ? t(TOUR_SPACE_EDITOR_KEYS.proposals, { count }) : null}
      </p>
      {notice !== null && <p role="alert" className="m-0 w-full text-sm text-destructive">{t(SPACE_DETECT_NOTICE_KEY[notice])}</p>}
    </>
  );
}

export function TourSpacesToolbar({ store, onDoorChange }: { readonly store: SpaceEditorStore; readonly onDoorChange: () => void }) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const tool = useSpaceEditor(store, readTool);
  return (
    <section role="toolbar" aria-label={t(TOUR_SPACE_EDITOR_KEYS.tools)} className="flex flex-wrap items-center gap-3">
      <span className="flex gap-1">
        {TOOLS.map(({ tool: value, key, Icon }) => (
          <ToggleButton key={value} type="button" size="sm" pressed={tool === value}
            onClick={() => updateSpaceEditor(store, (s) => setTool(s, value))}>
            <Icon aria-hidden className="h-4 w-4" />{t(key)}
          </ToggleButton>
        ))}
      </span>
      <DoorSlider store={store} onChange={onDoorChange} />
      <Status store={store} />
      {tool === 'pen' && <p className="m-0 w-full text-xs text-muted-foreground">{t(TOUR_SPACE_EDITOR_KEYS.toolPenHint)}</p>}
    </section>
  );
}
