'use client';

/**
 * @fileoverview **ΔΙΑΛΕΞΕ ΤΗΝ ΚΑΤΟΨΗ ΤΟΥ ΟΡΟΦΟΥ** — από τα αρχεία του ακινήτου, με δηλωμένη πηγή (ADR-884 Φ2στ-β · §4.13 ·
 * §12 Δ7.1).
 * @related `services/spatial-tour/spatial-tour-graph.client.ts` (`listTourPlanFilesFromScreen` — ο ΙΔΙΟΣ κριτής με τον
 *   γραφέα) · `TourPlanPane.tsx` (ο κάτοχος) · `LabeledSelect` (η πηγή, χωρίς σιωπηλή προεπιλογή)
 * @module components/spatial-tour/editor/TourPlanPicker
 *
 * 🔑 **Η οθόνη δείχνει ό,τι θα δεχτεί ο γραφέας**: η λίστα έρχεται από τον ίδιο κριτή (`tour-plan-files.ts`) — ποτέ αρχείο
 *   που η εντολή `floorplan` θα αρνηθεί.
 * 🔑 **Η πηγή δηλώνεται** (Δ5: «η πηγή δηλώνεται πάντα»): κανένα «μηχανικός» επειδή ήταν πρώτο στη λίστα.
 * 🔑 **Κάτοψη του ίδιου ορόφου πρώτη** (`levelFloorId`, ADR-236) — στη μεζονέτα ο άνθρωπος δεν ψάχνει.
 */

import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { FLOOR_PLAN_DECLARABLE_SOURCES, type FloorPlanDeclarableSource } from '@/constants/spatial-tour-vocabulary';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { TourFloorPlanPick, TourPlanCandidate } from '@/lib/spatial-tour/tour-graph-edit';
import { listTourPlanFilesFromScreen } from '@/services/spatial-tour/spatial-tour-graph.client';
import type { TourLevelKey, TourSubject } from '@/types/spatial-tour';

import { LabeledSelect } from '../LabeledSelect';
import { SPATIAL_TOUR_NS } from '../spatial-tour-namespace';
import { TOUR_EDITOR_KEYS } from './tour-editor-labels';

const SOURCE_KEY: Readonly<Record<FloorPlanDeclarableSource, string>> = {
  engineer: TOUR_EDITOR_KEYS.planSourceEngineer,
  'user-sketch': TOUR_EDITOR_KEYS.planSourceUserSketch,
};

type PlansLoad = { readonly kind: 'loading' } | { readonly kind: 'failed' } | { readonly kind: 'loaded'; readonly plans: readonly TourPlanCandidate[] };

/** Οι κατόψεις του ιδίου ορόφου πρώτες, μετά οι υπόλοιπες — σταθερή σειρά μέσα σε κάθε ομάδα. */
function ordered(plans: readonly TourPlanCandidate[], levelKey: TourLevelKey): TourPlanCandidate[] {
  const floorId = levelKey.kind === 'floor' ? levelKey.floorId : null;
  return [...plans].sort((a, b) => Number(b.levelFloorId === floorId && floorId !== null) - Number(a.levelFloorId === floorId && floorId !== null));
}

function usePlanFiles(subject: TourSubject): PlansLoad {
  const [load, setLoad] = useState<PlansLoad>({ kind: 'loading' });
  useEffect(() => {
    let alive = true;
    void listTourPlanFilesFromScreen(subject).then((result) => {
      if (alive) setLoad(result.kind === 'ok' ? { kind: 'loaded', plans: result.value.plans } : { kind: 'failed' });
    });
    return () => { alive = false; };
  }, [subject]);
  return load;
}

export interface TourPlanPickerProps {
  readonly subject: TourSubject;
  readonly levelKey: TourLevelKey;
  readonly busy: boolean;
  readonly onPick: (pick: TourFloorPlanPick) => void;
  /** Όταν αλλάζει υπάρχουσα κάτοψη: η προειδοποίηση για τις θέσεις + «Άκυρο». */
  readonly onCancel?: () => void;
}

function PlanOption({ plan, selected, onSelect }: { readonly plan: TourPlanCandidate; readonly selected: boolean; readonly onSelect: () => void }) {
  return (
    <li>
      <Button type="button" variant={selected ? 'secondary' : 'outline'} aria-pressed={selected} onClick={onSelect}
        className="flex h-auto w-full flex-col items-stretch gap-1 p-2 text-left">
        {plan.previewUrl !== null && (
          // eslint-disable-next-line @next/next/no-img-element -- ιδιωτικό αρχείο πίσω από το proxy αρχείων, εκτός optimizer
          <img src={plan.previewUrl} alt="" loading="lazy" className="aspect-[4/3] w-full rounded bg-muted object-contain" />
        )}
        <span className="truncate text-xs">{plan.name}</span>
      </Button>
    </li>
  );
}

export function TourPlanPicker({ subject, levelKey, busy, onPick, onCancel }: TourPlanPickerProps) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const load = usePlanFiles(subject);
  const [fileId, setFileId] = useState<string | null>(null);
  const [source, setSource] = useState<FloorPlanDeclarableSource | null>(null);
  const use = useCallback(() => {
    if (fileId !== null && source !== null) onPick({ fileId, source });
  }, [fileId, source, onPick]);
  if (load.kind === 'loading') return <p className="text-sm text-muted-foreground" aria-busy>{t(TOUR_EDITOR_KEYS.planHint)}</p>;
  if (load.kind === 'failed') return <p className="text-sm text-destructive" role="alert">{t(TOUR_EDITOR_KEYS.planLoadFailed)}</p>;
  if (load.plans.length === 0) return <p className="text-sm text-muted-foreground">{t(TOUR_EDITOR_KEYS.planNone)}</p>;
  return (
    <section className="flex flex-col gap-3">
      <p className="m-0 text-sm text-muted-foreground">{t(onCancel === undefined ? TOUR_EDITOR_KEYS.planHint : TOUR_EDITOR_KEYS.planChangeWarning)}</p>
      <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0">
        {ordered(load.plans, levelKey).map((plan) => (
          <PlanOption key={plan.fileId} plan={plan} selected={plan.fileId === fileId} onSelect={() => setFileId(plan.fileId)} />
        ))}
      </ul>
      <LabeledSelect id="tour-plan-source" label={t(TOUR_EDITOR_KEYS.planSource)} value={source}
        placeholder={t(TOUR_EDITOR_KEYS.planSourcePlaceholder)} onChange={setSource} disabled={busy}
        options={FLOOR_PLAN_DECLARABLE_SOURCES.map((value) => ({ value, label: t(SOURCE_KEY[value]) }))} />
      <footer className="flex gap-2">
        <Button type="button" size="sm" disabled={busy || fileId === null || source === null} onClick={use}>{t(TOUR_EDITOR_KEYS.planUse)}</Button>
        {onCancel !== undefined && <Button type="button" size="sm" variant="ghost" onClick={onCancel}>{t(TOUR_EDITOR_KEYS.planCancel)}</Button>}
      </footer>
    </section>
  );
}
