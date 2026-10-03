'use client';

/**
 * @fileoverview **«ΠΟΥ ΑΝΗΚΕΙ ΑΥΤΟ ΤΟ ΠΑΝΟΡΑΜΑ;»** — όροφος + νέο σημείο / δίπλα σε υπάρχον / ίδιο σημείο με υπάρχον
 * (ADR-884 Φ2δ · §4.10, πρότυπο Matterport «360° Views»).
 * @related `lib/spatial-tour/tour-graph-edit.ts` (`TourPlacementTarget` — ο γραφέας κρίνει) · `useTourEditorActions.ts`
 * @module components/spatial-tour/editor/TourPlacementForm
 *
 * 🔑 **«Δίπλα σε…»** = νέο σημείο **συνδεδεμένο** με το υπάρχον από τη γέννησή του (ο γραφέας το κάνει σε μία συναλλαγή)·
 *   το βελάκι μπαίνει μετά, μέσα στη φωτογραφία. **«Ίδιο σημείο με…»** = νεότερη λήψη του ίδιου σημείου (χρονολόγιο, §12 Δ6).
 * 🔑 **Νέος όροφος** = ο επόμενος τοπικός αριθμός· ο γραφέας τον γεννά με κάτοψη `none` (Δ5). Όροφος BIM **δεν** επινοείται.
 * 🔑 **Πρόταση φωτογράφου** (ADR-904 Κ8): ο προτεινόμενος όροφος είναι **προεπιλεγμένος** — και αν είναι νέος τοπικός (π.χ.
 *   υπόγειο `-1`), προσφέρεται ως επιλογή. Η τοποθέτηση μένει **πράξη του υπευθύνου**: ένα κλικ αποδοχής, ποτέ αυτόματη.
 * 🔑 **Σημείο της πρότασης** (Κ9): αν πέφτει στην ίδια βαθμονομημένη κάτοψη, το «νέο σημείο» γεννιέται **με** τη θέση του — μία
 *   εντολή (`new-node.position`), μία συναλλαγή· ο γραφέας ξανακρίνει «πάνω στην κάτοψη;».
 */

import { type FormEvent, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { levelKeyId } from '@/lib/spatial-tour/spatial-tour-graph';
import { imagePixelToPlan } from '@/lib/spatial-tour/tour-plan-frame';
import type { TourPlacementTarget } from '@/lib/spatial-tour/tour-graph-edit';
import type { TourViewerGraph, TourViewerLevel } from '@/lib/spatial-tour/viewer/tour-viewer-graph';
import type { TourCapturePlacementHint as PlacementHint, TourLevelKey } from '@/types/spatial-tour';

import { LabeledSelect, type SelectOption } from '../LabeledSelect';
import { SPATIAL_TOUR_NS } from '../spatial-tour-namespace';
import { TourCapturePlacementHint } from '../TourCapturePlacementHint';
import { TOUR_VIEWER_KEYS } from '../viewer/tour-viewer-labels';
import { useLevelLabel } from '../viewer/useLevelLabel';
import type { TourPanoramaSource } from '../viewer/tour-panorama-source';
import { useStopNames } from '../viewer/useStopNames';
import { TOUR_EDITOR_KEYS } from './tour-editor-labels';
import { TourHintSpotChoice, useHintSpot, type HintSpot } from './TourHintSpotChoice';

type PlacementMode = 'new' | 'next-to' | 'same-as';

interface TourPlacementFormProps {
  readonly captureId: string;
  readonly levels: readonly TourViewerLevel[];
  readonly graph: TourViewerGraph;
  readonly busy: boolean;
  readonly onPlace: (target: TourPlacementTarget) => void;
  /** Η πρόταση θέσης της λήψης — απούσα ⇒ καμία. */
  readonly hint?: PlacementHint;
  /** Η πηγή μέσων του επεξεργαστή — η εικόνα της κάτοψης για το σημείο της πρότασης (Κ9). */
  readonly source: TourPanoramaSource;
}

/** Το σημείο της πρότασης σε μέτρα κάτοψης — το πλαίσιο της εντολής `position`. */
function spotPosition(spot: HintSpot): { readonly x: number; readonly y: number } {
  const { x, y } = imagePixelToPlan(spot.pixel, spot.plan.metresPerPixel);
  return { x, y };
}

/** Νέοι τοπικοί όροφοι που προσφέρονται: ο επόμενος, και ο **προτεινόμενος** αν είναι άλλος (όροφος BIM δεν επινοείται). */
type LocalLevelKey = Extract<TourLevelKey, { readonly kind: 'local' }>;

function freshLocals(levels: readonly TourViewerLevel[], hinted: TourLevelKey | undefined): LocalLevelKey[] {
  const locals = levels.flatMap((level) => (level.key.kind === 'local' ? [level.key.ordinal] : []));
  const next: LocalLevelKey = { kind: 'local', ordinal: locals.length === 0 ? 0 : Math.max(...locals) + 1 };
  const known = new Set(levels.map((level) => levelKeyId(level.key)));
  const proposed = hinted?.kind === 'local' && !known.has(levelKeyId(hinted)) && levelKeyId(hinted) !== levelKeyId(next) ? [hinted] : [];
  return [...proposed, next];
}

/** Οι όροφοι της περιήγησης + οι νέοι τοπικοί· προεπιλογή = ο προτεινόμενος, αν προσφέρεται. */
function useFloorChoices(levels: readonly TourViewerLevel[], hinted: TourLevelKey | undefined) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const labelOf = useLevelLabel();
  return useMemo(() => {
    const fresh = freshLocals(levels, hinted);
    const keys = new Map<string, TourLevelKey>([...levels, ...fresh.map((key) => ({ key }))].map((l) => [levelKeyId(l.key), l.key] as const));
    const options: SelectOption<string>[] = [
      ...levels.map((level) => ({ value: levelKeyId(level.key), label: labelOf(level) })),
      ...fresh.map((key) => ({ value: levelKeyId(key), label: t(TOUR_EDITOR_KEYS.newFloor, { ordinal: key.ordinal }) })),
    ];
    const suggested = hinted === undefined ? undefined : levelKeyId(hinted);
    return { options, keys, initial: suggested !== undefined && keys.has(suggested) ? suggested : options[0].value };
  }, [levels, hinted, labelOf, t]);
}

/** Τα σημεία που μπορούν να είναι «γείτονας» (ίδιος όροφος) ή «ίδιο σημείο» (οποιοσδήποτε όροφος). */
function usePointChoices(graph: TourViewerGraph, levelId: string, mode: PlacementMode): SelectOption<string>[] {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const labelOf = useLevelLabel();
  const nameOf = useStopNames(graph);
  return useMemo(() => graph.levels
    .filter((level) => mode === 'same-as' || level.id === levelId)
    .flatMap((level) => level.nodeIds.map((nodeId) => ({
      value: nodeId,
      label: t(TOUR_VIEWER_KEYS.placeOnFloor, { name: nameOf(nodeId), floor: labelOf(level) }),
    }))), [graph, levelId, mode, t, labelOf, nameOf]);
}

export function TourPlacementForm({ captureId, levels, graph, busy, onPlace, hint, source }: TourPlacementFormProps) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const floors = useFloorChoices(levels, hint?.level);
  const { captureLevels, spot } = useHintSpot(levels, hint);
  const [atSpot, setAtSpot] = useState(true);
  const [levelId, setLevelId] = useState(floors.initial);
  const [mode, setMode] = useState<PlacementMode>('new');
  const points = usePointChoices(graph, levelId, mode);
  const [chosen, setChosen] = useState<string | null>(null);
  const nodeId = points.some((p) => p.value === chosen) ? chosen : points[0]?.value ?? null;
  const modes: SelectOption<PlacementMode>[] = [
    { value: 'new', label: t(TOUR_EDITOR_KEYS.modeNew) },
    { value: 'next-to', label: t(TOUR_EDITOR_KEYS.modeNextTo) },
    { value: 'same-as', label: t(TOUR_EDITOR_KEYS.modeSameAs) },
  ];
  const needsPoint = mode !== 'new';
  const spotHere = spot !== null && mode !== 'same-as' && levelId === levelKeyId(spot.level.key) ? spot : null;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const levelKey = floors.keys.get(levelId);
    if (levelKey === undefined || (needsPoint && nodeId === null)) return;
    const position = spotHere !== null && atSpot ? { position: spotPosition(spotHere) } : {};
    onPlace(mode === 'same-as' && nodeId !== null ? { kind: 'node', nodeId }
      : { kind: 'new-node', levelKey, linkFrom: mode === 'next-to' ? nodeId : null, ...position });
  };
  return (
    <form onSubmit={submit} className="space-y-3" aria-labelledby={`place-${captureId}`}>
      <h3 id={`place-${captureId}`} className="text-sm font-semibold">{t(TOUR_EDITOR_KEYS.placeHeading)}</h3>
      {hint !== undefined && <TourCapturePlacementHint hint={hint} levels={captureLevels} />}
      {mode !== 'same-as' && <LabeledSelect id="tour-place-floor" label={t(TOUR_EDITOR_KEYS.floor)} value={levelId} options={floors.options} onChange={setLevelId} disabled={busy} />}
      <LabeledSelect id="tour-place-mode" label={t(TOUR_EDITOR_KEYS.mode)} value={mode} options={modes} onChange={setMode} disabled={busy} />
      {needsPoint && nodeId !== null && <LabeledSelect id="tour-place-point" label={t(TOUR_EDITOR_KEYS.neighbour)} value={nodeId} options={points} onChange={setChosen} disabled={busy} />}
      {spotHere !== null && <TourHintSpotChoice spot={spotHere} levels={levels} source={source} checked={atSpot} busy={busy} onCheckedChange={setAtSpot} />}
      <Button type="submit" disabled={busy || (needsPoint && nodeId === null)} aria-busy={busy}>{t(TOUR_EDITOR_KEYS.place)}</Button>
    </form>
  );
}
