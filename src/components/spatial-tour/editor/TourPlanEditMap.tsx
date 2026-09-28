'use client';

/**
 * @fileoverview **Ο ΧΑΡΤΗΣ ΤΟΠΟΘΕΤΗΣΗΣ** — η κάτοψη του ορόφου με τα σημεία του· κλικ ⇒ το επιλεγμένο σημείο πάει εκεί
 * (ADR-884 Φ2στ-β · §4.13 · πρότυπο Kuula/3DVista/CloudPano: «κλικ πάνω στην εικόνα»).
 * @related `TourPlanPane.tsx` (ο κάτοχος) · `lib/spatial-tour/tour-plan-frame.ts` (pixel ⟷ μέτρα) ·
 *   `lib/spatial-tour/viewer/tour-viewer-plan.ts` (`conePath` — ο ΙΔΙΟΣ κώνος με τον θεατή)
 * @module components/spatial-tour/editor/TourPlanEditMap
 *
 * 📏 **Σε pixel της εικόνας** (`viewBox` = η εικόνα): το κλικ γυρίζει σε pixel με τον αντίστροφο πίνακα οθόνης του SVG —
 *   καμία δική μας αριθμητική κλίμακας/μετατόπισης που θα μπορούσε να αποκλίνει από ό,τι ζωγράφισε ο browser.
 * ⌨️ **Και χωρίς ποντίκι** (WCAG 2.1.1): τα βελάκια μετακινούν ένα **πρόχειρο** σημείο (0,1 m · Shift = 1 m), το Enter το
 *   αποθηκεύει, το Escape το ακυρώνει — μία αποθήκευση ανά απόφαση, όχι μία ανά πάτημα.
 * 🎯 Ο κώνος δείχνει την **κατεύθυνση της λήψης** (το κέντρο της φωτογραφίας) — αυτό που ευθυγραμμίζει ο άνθρωπος.
 */

import { type KeyboardEvent, type MouseEvent, useState } from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { radToDeg } from '@/lib/geometry/angle';
import type { PixelPoint } from '@/lib/geometry/scale-calibration';
import { planToImagePixel } from '@/lib/spatial-tour/tour-plan-frame';
import { handleInlineRenameKey } from '@/lib/ui/inline-rename-keyboard';
import { PLAN_CONE_RADIUS_M, conePath } from '@/lib/spatial-tour/viewer/tour-viewer-plan';
import type { FloorPlanImage, TourNode } from '@/types/spatial-tour';

import { SPATIAL_TOUR_NS } from '../spatial-tour-namespace';
import { TOUR_EDITOR_KEYS } from './tour-editor-labels';

/** Ακτίνα τελείας σε μέτρα — ίδια με τον θεατή. */
const NODE_RADIUS_M = 0.28;
/** Άνοιγμα του κώνου της κατεύθυνσης (μισή γωνία) — ένδειξη, όχι οπτικό πεδίο. */
const DIRECTION_HALF_ANGLE_RAD = Math.PI / 6;
/** Βήμα πληκτρολογίου σε μέτρα: λεπτό · με Shift. */
const NUDGE_M = 0.1;
const NUDGE_FAST_M = 1;

const ARROWS: Readonly<Record<string, PixelPoint>> = {
  ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 },
};

export interface TourPlanEditMapProps {
  readonly imageUrl: string;
  readonly image: FloorPlanImage;
  readonly metresPerPixel: number;
  readonly nodes: readonly TourNode[];
  readonly selectedNodeId: string;
  /** Η κατεύθυνση της λήψης του επιλεγμένου σημείου (ακτίνια κόσμου) — `null` ⇒ κανένας κώνος. */
  readonly headingRad: number | null;
  readonly nameOf: (nodeId: string) => string;
  readonly onPlace: (pixel: PixelPoint) => void;
}

/** Το κλικ σε pixel της εικόνας — `null` όταν ο browser δεν δίνει πίνακα οθόνης (το SVG δεν έχει ζωγραφιστεί). */
function clickToImagePixel(event: MouseEvent<SVGSVGElement>): PixelPoint | null {
  const matrix = event.currentTarget.getScreenCTM();
  if (matrix === null) return null;
  const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
  return { x: point.x, y: point.y };
}

const clamp = (value: number, max: number) => Math.min(max, Math.max(0, value));

/** Πρόχειρο σημείο πληκτρολογίου: ξεκινά από τη θέση του σημείου, ή από το κέντρο της κάτοψης. */
function useKeyboardDraft(props: TourPlanEditMapProps, at: PixelPoint | null) {
  const [draft, setDraft] = useState<PixelPoint | null>(null);
  const onKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    if (draft !== null) {
      handleInlineRenameKey(event, { onConfirm: () => { props.onPlace(draft); setDraft(null); }, onCancel: () => setDraft(null) });
      if (event.defaultPrevented) return;
    }
    const arrow = ARROWS[event.key];
    if (arrow === undefined) return;
    event.preventDefault();
    const step = (event.shiftKey ? NUDGE_FAST_M : NUDGE_M) / props.metresPerPixel;
    const from = draft ?? at ?? { x: props.image.width / 2, y: props.image.height / 2 };
    setDraft({ x: clamp(from.x + arrow.x * step, props.image.width), y: clamp(from.y + arrow.y * step, props.image.height) });
  };
  return { draft, onKeyDown, clear: () => setDraft(null) };
}

function PlanNodes({ nodes, selectedNodeId, metresPerPixel, radius, nameOf }: Pick<TourPlanEditMapProps, 'nodes' | 'selectedNodeId' | 'metresPerPixel' | 'nameOf'> & { readonly radius: number }) {
  return (
    <>
      {nodes.flatMap((node) => {
        if (node.position === null) return [];
        const { x, y } = planToImagePixel(node.position, metresPerPixel);
        const here = node.id === selectedNodeId;
        return [(
          <circle key={node.id} cx={x} cy={y} r={radius} strokeWidth={radius / 4}
            className={here ? 'fill-chart-1 stroke-background' : 'fill-card stroke-foreground'}>
            <title>{nameOf(node.id)}</title>
          </circle>
        )];
      })}
    </>
  );
}

export function TourPlanEditMap(props: TourPlanEditMapProps) {
  const { imageUrl, image, metresPerPixel, nodes, selectedNodeId, headingRad, nameOf, onPlace } = props;
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const radius = NODE_RADIUS_M / metresPerPixel;
  const selected = nodes.find((node) => node.id === selectedNodeId);
  const at = selected?.position == null ? null : planToImagePixel(selected.position, metresPerPixel);
  const keyboard = useKeyboardDraft(props, at);
  const cone = keyboard.draft ?? at;
  const place = (event: MouseEvent<SVGSVGElement>) => {
    const pixel = clickToImagePixel(event);
    keyboard.clear();
    if (pixel !== null) onPlace(pixel);
  };
  return (
    <svg viewBox={`0 0 ${image.width} ${image.height}`} role="application" tabIndex={0}
      aria-label={t(TOUR_EDITOR_KEYS.planMap)} aria-describedby="tour-plan-place-hint"
      onClick={place} onKeyDown={keyboard.onKeyDown}
      className="h-auto w-full cursor-crosshair rounded-md border border-border bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <image href={imageUrl} x={0} y={0} width={image.width} height={image.height} aria-hidden />
      {cone !== null && headingRad !== null && (
        <path d={conePath(DIRECTION_HALF_ANGLE_RAD, PLAN_CONE_RADIUS_M / metresPerPixel)}
          transform={`translate(${cone.x} ${cone.y}) rotate(${radToDeg(headingRad)})`}
          className="fill-chart-1/30 stroke-chart-1" strokeWidth={radius / 5} aria-hidden />
      )}
      <PlanNodes nodes={nodes} selectedNodeId={selectedNodeId} metresPerPixel={metresPerPixel} radius={radius} nameOf={nameOf} />
      {keyboard.draft !== null && (
        <circle cx={keyboard.draft.x} cy={keyboard.draft.y} r={radius} strokeWidth={radius / 4} strokeDasharray={`${radius / 2} ${radius / 3}`}
          className="fill-none stroke-chart-1" aria-hidden />
      )}
    </svg>
  );
}
