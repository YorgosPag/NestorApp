'use client';

/**
 * @fileoverview **Η ΛΙΣΤΑ ΧΩΡΩΝ ΚΑΙ ΠΡΟΤΑΣΕΩΝ** — ο δρόμος προς κάθε σχήμα **χωρίς** ποντίκι πάνω στην κάτοψη (ADR-884 Φ2στ-γ
 * Γ3γ-2β · WCAG 2.1.1 · πρότυπο Revit Project Browser / Figma Layers).
 * @related `space-editor-store.ts` (επιλογή) · `lib/spatial-tour/viewer/tour-space-view.ts` (`spaceArea`) · `viewer/useStopNames.ts`
 * @module components/spatial-tour/editor/spaces/TourSpaceList
 *
 * 🔑 **Πρώτα οι προτάσεις** (περιμένουν απόφαση), μετά οι εγκεκριμένοι χώροι· η επιλεγμένη γραμμή έχει `aria-pressed`.
 * 🔑 **Εμβαδόν από το ΤΡΕΧΟΝ περίγραμμα** (όπως το πάνελ) — όχι το `areaM2` της ανίχνευσης, που παλιώνει με το πρώτο σύρσιμο
 *   (μετρήθηκε ζωντανά: λίστα ≈ 9, πάνελ ≈ 10 μετά από σύρσιμο γωνίας).
 */

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatNumber } from '@/lib/intl-formatting';
import { pointInPolygon, polygonArea, type PlanarPoint } from '@/lib/geometry/planar-polygon';
import { plainRoomDisplay } from '@/lib/spatial-tour/tour-room';
import { spaceArea } from '@/lib/spatial-tour/viewer/tour-space-view';
import type { TourViewerSpace } from '@/lib/spatial-tour/viewer/tour-viewer-shapes';
import type { PlacedStop } from '@/lib/spatial-tour/viewer/tour-viewer-plan';

import { SPATIAL_TOUR_NS } from '../../spatial-tour-namespace';
import { roomDisplayText } from '../../viewer/useStopNames';
import { spaceAreaText } from '../../viewer/TourPlanSpaces';
import {
  selectTarget,
  selectionKey,
  updateSpaceEditor,
  useSpaceEditor,
  type SpaceEditorState,
  type SpaceEditorStore,
  type SpaceSelection,
} from './space-editor-store';
import { TOUR_SPACE_EDITOR_KEYS } from './tour-space-editor-labels';

export interface TourSpaceListProps {
  readonly store: SpaceEditorStore;
  readonly spaces: readonly TourViewerSpace[];
  readonly stops: readonly PlacedStop[];
  readonly nameOf: (nodeId: string) => string;
}

const readProposals = (s: SpaceEditorState) => s.proposals;
const readSelection = (s: SpaceEditorState) => s.selection;

interface Row {
  readonly selection: Exclude<SpaceSelection, null>;
  readonly title: string;
  readonly detail: string;
}

function useRowName(stops: readonly PlacedStop[], nameOf: (id: string) => string) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  return (points: readonly PlanarPoint[], space: TourViewerSpace | null): string => {
    const stop = stops.find((s) => pointInPolygon(s.point, points));
    if (stop !== undefined) return nameOf(stop.entry.node.id);
    const room = space?.room ?? null;
    return room === null ? t(TOUR_SPACE_EDITOR_KEYS.unnamed) : roomDisplayText(t, plainRoomDisplay(room));
  };
}

export function TourSpaceList({ store, spaces, stops, nameOf }: TourSpaceListProps) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const proposals = useSpaceEditor(store, readProposals);
  const selection = useSpaceEditor(store, readSelection);
  const nameOfRow = useRowName(stops, nameOf);
  const rows: Row[] = [
    ...proposals.map((p): Row => ({
      selection: { kind: 'proposal', key: p.key }, title: nameOfRow(p.outline, null),
      detail: `${t(TOUR_SPACE_EDITOR_KEYS.proposal)} · ${t(TOUR_SPACE_EDITOR_KEYS.measuredValue, { area: formatNumber(polygonArea(p.outline), { maximumFractionDigits: 0 }) })}`,
    })),
    ...spaces.map((s): Row => ({
      selection: { kind: 'space', id: s.id }, title: nameOfRow(s.points, s), detail: spaceAreaText(t, spaceArea(s)),
    })),
  ];
  const selected = selectionKey(selection);
  return (
    <nav aria-labelledby="tour-space-list-title" className="flex flex-col gap-1">
      <h3 id="tour-space-list-title" className="m-0 text-sm font-semibold">{t(TOUR_SPACE_EDITOR_KEYS.listTitle)}</h3>
      {rows.length === 0 && <p className="m-0 text-sm text-muted-foreground">{t(TOUR_SPACE_EDITOR_KEYS.listEmpty)}</p>}
      <ul className="m-0 list-none space-y-1 p-0">
        {rows.map((row) => {
          const key = selectionKey(row.selection);
          return (
            <li key={key}>
              <Button type="button" variant={key === selected ? 'secondary' : 'ghost'} aria-pressed={key === selected}
                className="h-auto w-full flex-col items-start gap-0 py-1 text-left"
                onClick={() => updateSpaceEditor(store, (s) => selectTarget(s, row.selection))}>
                <span className="text-sm font-medium">{row.title}</span>
                <span className="text-xs text-muted-foreground">{row.detail}</span>
              </Button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
