'use client';

/**
 * @fileoverview **ΟΙ ΧΩΡΟΙ ΠΑΝΩ ΣΤΗΝ ΚΑΤΟΨΗ** — κίτρινος ο χώρος όπου βρίσκεσαι, απαλός ο ενιαίος γείτονας, γκρι ο χώρος χωρίς
 * σημείο λήψης· όνομα + εμβαδόν στο πιο «ευρύχωρο» σημείο κάθε χώρου (ADR-884 Φ2στ-γ Γ3γ-1 · §4.14 σημείο 4 · §12 Δ8.2–Δ8.6).
 * @related `lib/spatial-tour/viewer/tour-space-view.ts` (όλη η λογική — καθαρή) · `tour-plan-overlay-palette.ts` (τα χρώματα) ·
 *   `TourPlanMap.tsx` (ο κάτοχος: τα σχήματα κάθονται **κάτω** από συνδέσμους, κώνο και τελείες)
 * @module components/spatial-tour/viewer/TourPlanSpaces
 *
 * 🔑 **Μη διαδραστικοί**: το κλικ ανήκει στις τελείες (ένα σημείο = ένα πανόραμα)· ένα κλικ-σε-χώρο θα έστελνε σε «ποιο από τα
 *   δύο σημεία του σαλονιού;». Τα πολύγωνα είναι `aria-hidden`· οι ετικέτες είναι κείμενο που διαβάζεται.
 * 🔑 **Μέγεθος σε px, όχι σε μέτρα** (πρότυπο Γ2): γράμματα ίδια σε κάθε ζουμ και κάθε επιφάνεια· όσο μεγεθύνεις, χωρούν
 *   ετικέτες σε όλο και μικρότερους χώρους — όπως στους χάρτες.
 * 🔑 **Ετικέτα που δεν χωρά ΔΕΝ γράφεται** (`labelFits`): πρώτα όνομα + εμβαδόν, μετά μόνο εμβαδόν, μετά τίποτα.
 */

import { useMemo } from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatNumber } from '@/lib/intl-formatting';
import { plainRoomDisplay } from '@/lib/spatial-tour/tour-room';
import type { TourSpaceAreaDisplay } from '@/constants/spatial-tour-vocabulary';
import type { ViewerLevelEntry } from '@/lib/spatial-tour/viewer/tour-viewer-graph';
import { toPlanSvg, type PlacedStop } from '@/lib/spatial-tour/viewer/tour-viewer-plan';
import {
  LABEL_LINE_EM,
  labelFits,
  planSpaces,
  spaceArea,
  spaceLabelPoint,
  type PlanSpace,
  type TourSpaceArea,
  type TourSpaceTone,
} from '@/lib/spatial-tour/viewer/tour-space-view';
import type { PolygonLabelPoint } from '@/lib/geometry/polygon-label-point';

import { SPATIAL_TOUR_NS } from '../spatial-tour-namespace';
import {
  SPACE_LABEL_CLASS,
  SPACE_LABEL_UNCAPTURED_CLASS,
  SPACE_TONE_CLASS,
} from './tour-plan-overlay-palette';
import { TOUR_DECLARED_SOURCE_KEY, TOUR_VIEWER_KEYS } from './tour-viewer-labels';
import { roomDisplayText } from './useStopNames';

const SPACE_STROKE_PX = 1.5;
const LABEL_FONT_PX = 11;
const LABEL_HALO_PX = 3;

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** «≈ 12 τ.μ.» (μετρημένο, ακέραιο) ή «12,40 τ.μ.» (δηλωμένο, δύο δεκαδικά) — Δ8.4. */
export function spaceAreaText(t: Translate, area: TourSpaceArea): string {
  if (area.kind === 'measured') {
    return t(TOUR_VIEWER_KEYS.spaceAreaMeasured, { area: formatNumber(area.areaM2, { maximumFractionDigits: 0 }) });
  }
  return t(TOUR_VIEWER_KEYS.spaceAreaDeclared, {
    area: formatNumber(area.areaM2, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  });
}

export const ringPath = (points: PlanSpace['space']['points']): string =>
  `${points.map((p, i) => { const s = toPlanSvg(p); return `${i === 0 ? 'M' : 'L'}${s.x} ${s.y}`; }).join(' ')} Z`;

/** Ένας χώρος έτοιμος για ζωγραφική — το σημείο ετικέτας και το εμβαδόν υπολογίζονται **μία** φορά, όχι σε κάθε ζουμ. */
interface DrawnSpace {
  readonly item: PlanSpace;
  readonly label: PolygonLabelPoint;
  readonly area: TourSpaceArea;
  readonly name: string | null;
}

interface LabelProps {
  readonly drawn: DrawnSpace;
  readonly areas: TourSpaceAreaDisplay;
  readonly scale: number;
}

function SpaceLabel({ drawn, areas, scale }: LabelProps) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const { item, label: { point, clearance }, area, name } = drawn;
  const areaLine = areas === 'shown' ? spaceAreaText(t, area) : null;
  const fontSize = LABEL_FONT_PX * scale;
  const candidates = [[name, areaLine], [areaLine]].map((set) => set.filter((line): line is string => line !== null && line !== ''));
  const lines = candidates.find((set) => set.length > 0 && labelFits(clearance, set, fontSize));
  if (lines === undefined) return null;
  const { x, y } = toPlanSvg(point);
  const firstDy = -((lines.length - 1) * LABEL_LINE_EM * fontSize) / 2;
  return (
    <text x={x} y={y} fontSize={fontSize} strokeWidth={LABEL_HALO_PX * scale} textAnchor="middle" dominantBaseline="central"
      className={item.tone === 'uncaptured' ? SPACE_LABEL_UNCAPTURED_CLASS : SPACE_LABEL_CLASS}>
      {area.kind === 'declared' && areaLine !== null && (
        <title>{t(TOUR_VIEWER_KEYS.spaceDeclaredFrom, { source: t(TOUR_DECLARED_SOURCE_KEY[area.source]) })}</title>
      )}
      {lines.map((line, i) => (
        // eslint-disable-next-line react/no-array-index-key -- ≤ 2 γραμμές, σταθερή θέση: η θέση ΕΙΝΑΙ η ταυτότητα
        <tspan key={i} x={x} dy={i === 0 ? firstDy : LABEL_LINE_EM * fontSize}>{line}</tspan>
      ))}
    </text>
  );
}

export interface TourPlanSpacesProps {
  readonly level: ViewerLevelEntry;
  readonly stops: readonly PlacedStop[];
  readonly currentNodeId: string | null;
  readonly nameOf: (nodeId: string) => string;
  readonly areas: TourSpaceAreaDisplay;
  /** Μέτρα ανά css pixel της επιφάνειας (`planMetresPerPixel`). */
  readonly scale: number;
  /** Χρώματα ανά ρόλο — ο επεξεργαστής χώρων δείχνει **κάθε** εγκεκριμένο χώρο (`SPACE_EDITOR_TONE_CLASS`, Γ3γ-2β). */
  readonly toneClass?: Readonly<Record<TourSpaceTone, string>>;
  /** Χώρος που ζωγραφίζεται αλλού (υπό επεξεργασία) — λείπει από εδώ, ώστε να μη φαίνεται διπλός. */
  readonly hiddenSpaceId?: string | null;
}

/**
 * **Η σημείωση κάτω από την κάτοψη** (Δ8.4, πρακτική Matterport/αγγελιών): εμφανίζεται όταν φαίνεται **έστω ένα** μετρημένο
 * εμβαδόν — εξηγεί το «≈» αντί να κρύβει την απόκλιση από το εμβαδόν της αγγελίας (μικτό ≠ καθαρό).
 */
export function TourPlanAreaNote({ level, areas }: { readonly level: ViewerLevelEntry; readonly areas: TourSpaceAreaDisplay }) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const anyMeasured = areas === 'shown' && level.spaces.some((space) => spaceArea(space).kind === 'measured');
  if (!anyMeasured) return null;
  return <p className="m-0 text-xs text-muted-foreground">{t(TOUR_VIEWER_KEYS.spaceAreaNote)}</p>;
}

/**
 * **Το όνομα ενός χώρου** (Δ8.5): το όνομα του πρώτου σημείου μέσα του **που έχει δηλωμένο χώρο** υπερισχύει· αλλιώς το δικό του
 * όνομα· αλλιώς κανένα (ποτέ «Σημείο 3» ως όνομα δωματίου — μόνο το εμβαδόν).
 */
function useSpaceNames(stops: readonly PlacedStop[], nameOf: (nodeId: string) => string) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  return useMemo(() => {
    const named = new Set(stops.filter((s) => s.entry.node.room != null).map((s) => s.entry.node.id));
    return (item: PlanSpace): string | null => {
      const nodeId = item.nodeIds.find((id) => named.has(id));
      if (nodeId !== undefined) return nameOf(nodeId);
      const room = item.space.room ?? null;
      return room === null ? null : roomDisplayText(t, plainRoomDisplay(room));
    };
  }, [stops, nameOf, t]);
}

export function TourPlanSpaces(props: TourPlanSpacesProps) {
  const { level, stops, currentNodeId, nameOf, areas, scale, toneClass = SPACE_TONE_CLASS, hiddenSpaceId = null } = props;
  const nameOfSpace = useSpaceNames(stops, nameOf);
  const drawn = useMemo((): readonly DrawnSpace[] => planSpaces(
    level.spaces, level.separations, stops.map((s) => ({ nodeId: s.entry.node.id, point: s.point })), currentNodeId,
  ).map((item) => ({ item, label: spaceLabelPoint(item.space), area: spaceArea(item.space), name: nameOfSpace(item) })),
  [level.spaces, level.separations, stops, currentNodeId, nameOfSpace]);
  const shown = hiddenSpaceId === null ? drawn : drawn.filter((d) => d.item.space.id !== hiddenSpaceId);
  if (shown.length === 0) return null;
  return (
    <g data-plan-spaces="" className="pointer-events-none select-none">
      <g aria-hidden strokeWidth={SPACE_STROKE_PX * scale} strokeLinejoin="round">
        {shown.map(({ item }) => (
          <path key={item.space.id} d={ringPath(item.space.points)} data-tone={item.tone} className={toneClass[item.tone]} />
        ))}
      </g>
      {shown.map((space) => <SpaceLabel key={space.item.space.id} drawn={space} areas={areas} scale={scale} />)}
    </g>
  );
}
