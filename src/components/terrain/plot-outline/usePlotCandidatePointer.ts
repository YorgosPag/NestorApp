'use client';

/**
 * @fileoverview **Δείκτης και δάχτυλο πάνω στο σχέδιο του τοπογράφου** — μετατρέπει συμβάντα του SVG σε ερώτηση προς τον ΕΝΑ
 * κριτή επιλογής (ADR-920 §14.11 Ζ4 «επιλογή πάνω στο σχέδιο»).
 * @related lib/terrain/plot-outline/plot-candidate-pick (ο κριτής: ακμή → εσωτερικό → κύκλος) ·
 *   lib/terrain/plot-outline/plot-drawing-view (`planWorldPoint`, το αντίστροφο του `planSvgPoint`) ·
 *   components/listing-detail/media/ListingZoomStage (καταπίνει το κλικ μετά από σύρσιμο — γι' αυτό εδώ `onClick`, όχι `pointerdown`)
 * @module components/terrain/plot-outline/usePlotCandidatePointer
 *
 * 📐 Οθόνη → σχέδιο με το `getScreenCTM()` του ίδιου του SVG: περιέχει μεγέθυνση, μετατόπιση ΚΑΙ περιστροφή της σκηνής, άρα η
 *    ανοχή μένει σταθερή σε **css px** (στόχος 24 px, WCAG 2.5.8) σε κάθε ζουμ — όπως το pick box του CAD.
 * 🖱️ Ποντίκι/γραφίδα: η κίνηση προ-τονίζει ό,τι ΘΑ διάλεγε το κλικ (Revit pre-highlight). 👆 Αφή: δεν υπάρχει hover· το άγγιγμα διαλέγει.
 * ⌨️ Το πληκτρολόγιο ΔΕΝ περνά από εδώ: κάθε σχήμα είναι κουμπί με δικό του Enter/Space (`PlotDxfDrawingView`).
 */

import { useCallback, useState, type MouseEvent, type PointerEvent, type RefObject } from 'react';

import { TERRAIN_PLOT_OUTLINE_STROKE_PX } from '@/components/listing-detail/terrain/terrain-map-palette';
import { pickPlotCandidate, plotCandidatesAt, type PlotCandidateHit } from '@/lib/terrain/plot-outline/plot-candidate-pick';
import { planWorldPoint, type PlanViewBox } from '@/lib/terrain/plot-outline/plot-drawing-view';
import type { PlotOutlineCandidate } from '@/lib/terrain/plot-outline/plot-outline-types';

/** Η ακτίνα του στόχου: ο μισός στόχος των 24 px γύρω από τη γραμμή. */
const PICK_TOLERANCE_PX = TERRAIN_PLOT_OUTLINE_STROKE_PX.hitArea / 2;

/** Τα υποψήφια κάτω από ένα σημείο οθόνης — κενό όταν το SVG δεν έχει (ακόμη) μετασχηματισμό. */
function hitsAtClient(
  svg: SVGSVGElement,
  box: PlanViewBox,
  candidates: readonly PlotOutlineCandidate[],
  clientX: number,
  clientY: number,
): PlotCandidateHit[] {
  const matrix = svg.getScreenCTM();
  if (matrix === null) return [];
  const pxPerMm = Math.hypot(matrix.a, matrix.b);
  if (!(pxPerMm > 0)) return [];
  const at = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
  return plotCandidatesAt(planWorldPoint(at, box), candidates, PICK_TOLERANCE_PX / pxPerMm);
}

export interface PlotCandidatePointerInput {
  readonly svgRef: RefObject<SVGSVGElement | null>;
  readonly box: PlanViewBox | null;
  readonly candidates: readonly PlotOutlineCandidate[];
  readonly selectedId: string | null;
  readonly onSelect: (candidateId: string) => void;
}

export interface PlotCandidatePointer {
  /** Το υποψήφιο που θα διάλεγε ένα κλικ ΤΩΡΑ (`null` = τίποτα κάτω από τον δείκτη). */
  readonly hoveredId: string | null;
  readonly handlers: {
    readonly onClick: (event: MouseEvent<SVGSVGElement>) => void;
    readonly onPointerMove: (event: PointerEvent<SVGSVGElement>) => void;
    readonly onPointerLeave: () => void;
  };
}

export function usePlotCandidatePointer({ svgRef, box, candidates, selectedId, onSelect }: PlotCandidatePointerInput): PlotCandidatePointer {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const hitsAt = useCallback((x: number, y: number) => {
    const svg = svgRef.current;
    return svg === null || box === null ? [] : hitsAtClient(svg, box, candidates, x, y);
  }, [svgRef, box, candidates]);

  const onClick = useCallback((event: MouseEvent<SVGSVGElement>) => {
    // `detail === 0` = «κλικ» από πληκτρολόγιο ή βοηθητική τεχνολογία: χωρίς θέση· το χειρίζεται το ίδιο το κουμπί-σχήμα.
    if (event.detail === 0) return;
    const hits = hitsAt(event.clientX, event.clientY);
    const picked = pickPlotCandidate(hits, selectedId);
    if (picked === null) return;
    if (picked !== selectedId) onSelect(picked);
    // Ο προ-τονισμός δείχνει ήδη το ΕΠΟΜΕΝΟ του κύκλου — ο άνθρωπος βλέπει ότι ένα ακόμη κλικ αλλάζει κάτι.
    setHoveredId(pickPlotCandidate(hits, picked));
  }, [hitsAt, selectedId, onSelect]);

  const onPointerMove = useCallback((event: PointerEvent<SVGSVGElement>) => {
    if (event.pointerType === 'touch') return;
    setHoveredId(pickPlotCandidate(hitsAt(event.clientX, event.clientY), selectedId));
  }, [hitsAt, selectedId]);

  const onPointerLeave = useCallback(() => setHoveredId(null), []);

  return { hoveredId, handlers: { onClick, onPointerMove, onPointerLeave } };
}
