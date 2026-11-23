'use client';

/**
 * @fileoverview **Το DXF του τοπογράφου με τα υποψήφια περιγράμματα τονισμένα** — κλικ πάνω στη γραμμή για επιλογή (ADR-920 §14.11 Ζ4 · Π4).
 * @related lib/terrain/plot-outline/plot-drawing-view (κουτί, διαδρομές, πλαίσιο σχεδίου) ·
 *   components/listing-detail/media/ListingZoomStage (η ΜΙΑ σκηνή μεγέθυνσης σχεδίων) ·
 *   components/listing-detail/terrain/terrain-map-palette (`TERRAIN_PLOT_OUTLINE_CLASS`, η ΙΔΙΑ γραφή με τον χάρτη, Ζ5)
 * @module components/terrain/plot-outline/PlotDxfDrawingView
 *
 * 🔑 **Πάνω από το Revit**: εκεί το property line «Pick Lines» ο άνθρωπος, γραμμή-γραμμή, πάνω σε ένα αμίλητο CAD· εδώ το
 *    σχέδιο έρχεται με τα κλειστά σχήματα ήδη βρεμένα, το προτεινόμενο τονισμένο, και ένα κλικ πάνω στη γραμμή αλλάζει
 *    την επιλογή. Η λίστα δίπλα (με τα τεκμήρια) είναι ο δρόμος του πληκτρολογίου — εδώ τα σχήματα είναι και κουμπιά.
 * 🔑 **Το κλικ το κρίνει η γεωμετρία, όχι η σειρά ζωγραφικής** (`usePlotCandidatePointer` → `plot-candidate-pick`): πλησιέστερη
 *    ακμή → αλλιώς το πιο μέσα σχήμα → ξανά κλικ = το επόμενο. Ό,τι ΘΑ διαλεχτεί προ-τονίζεται πριν από το κλικ.
 * 🔑 Όλα από το ίδιο WORLD mm, με την ίδια κλίμακα που έδωσε τα υποψήφια ⇒ το τονισμένο πέφτει πάνω στη γραμμή του σχεδίου.
 * 🔑 Στο SVG γράφονται **σχετικά προς την αρχή του πλαισίου** (`box`) — απόλυτο ΕΓΣΑ δεν ζωγραφίζεται (float32, βλ. plot-drawing-view).
 */

import React, { useMemo, useRef } from 'react';

import { ListingZoomStage } from '@/components/listing-detail/media/ListingZoomStage';
import {
  TERRAIN_PAPER_CLASS,
  TERRAIN_PLOT_OUTLINE_CLASS,
  TERRAIN_PLOT_OUTLINE_STROKE_PX,
} from '@/components/listing-detail/terrain/terrain-map-palette';
import { NON_SCALING } from '@/components/listing-detail/terrain/terrain-map-symbols';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatNumber } from '@/lib/intl-formatting';
import type { DxfPlotDrawing } from '@/lib/terrain/plot-outline/dxf-plot-outline-candidates';
import {
  dxfContextLines,
  planPathData,
  planViewBoxOf,
  viewBoxAttribute,
  type PlanViewBox,
} from '@/lib/terrain/plot-outline/plot-drawing-view';
import type { PlotOutlineCandidate, PlotOutlineRanking } from '@/lib/terrain/plot-outline/plot-outline-types';
import { cn } from '@/lib/utils';

import { usePlotCandidatePointer } from './usePlotCandidatePointer';

const NS = 'terrain-survey:plotOutline';

export interface PlotDxfDrawingViewProps {
  readonly fileKey: string;
  readonly drawing: DxfPlotDrawing;
  readonly scaleToMm: number;
  readonly ranking: PlotOutlineRanking;
  readonly selectedId: string | null;
  readonly onSelect: (candidateId: string) => void;
}

/** Πώς φαίνεται ένα υποψήφιο: επιλεγμένο · αυτό που ΘΑ διάλεγε το κλικ (προ-τονισμός) · σε ηρεμία. */
type CandidateLook = 'selected' | 'hovered' | 'idle';

const CANDIDATE_LOOK = {
  selected: { className: TERRAIN_PLOT_OUTLINE_CLASS.outline, strokeWidth: TERRAIN_PLOT_OUTLINE_STROKE_PX.outline },
  hovered: { className: TERRAIN_PLOT_OUTLINE_CLASS.candidateHover, strokeWidth: TERRAIN_PLOT_OUTLINE_STROKE_PX.outline },
  idle: { className: TERRAIN_PLOT_OUTLINE_CLASS.candidate, strokeWidth: TERRAIN_PLOT_OUTLINE_STROKE_PX.candidate },
} as const;

/** Σειρά ζωγραφικής (μόνο ΟΨΗ — το κλικ το κρίνει η γεωμετρία): ηρεμία → προ-τονισμένο → επιλεγμένο πάνω από όλα. */
const PAINT_ORDER: Readonly<Record<CandidateLook, number>> = { idle: 0, hovered: 1, selected: 2 };

function lookOf(candidateId: string, selectedId: string | null, hoveredId: string | null): CandidateLook {
  if (candidateId === selectedId) return 'selected';
  return candidateId === hoveredId ? 'hovered' : 'idle';
}

function CandidateShape({ candidate, box, look, onSelect }: {
  readonly candidate: PlotOutlineCandidate;
  readonly box: PlanViewBox;
  readonly look: CandidateLook;
  readonly onSelect: (candidateId: string) => void;
}) {
  const { t } = useTranslation(['terrain-survey']);
  const d = planPathData(candidate.ringWorldMm, true, box);
  const choose = () => onSelect(candidate.id);
  return (
    <g role="button" tabIndex={0} aria-pressed={look === 'selected'}
      aria-label={t(`${NS}.view.candidate`, { area: formatNumber(candidate.areaM2, { maximumFractionDigits: 0 }) })}
      // Μόνο το «κλικ» χωρίς θέση (πληκτρολόγιο / βοηθητική τεχνολογία)· το κλικ του δείκτη το κρίνει η γεωμετρία, στο SVG.
      onClick={(event) => { if (event.detail === 0) choose(); }}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(); } }}>
      {look === 'selected' && <path d={d} className={TERRAIN_PLOT_OUTLINE_CLASS.outlineArea} />}
      <path d={d} {...NON_SCALING} {...CANDIDATE_LOOK[look]} />
    </g>
  );
}

export function PlotDxfDrawingView({ fileKey, drawing, scaleToMm, ranking, selectedId, onSelect }: PlotDxfDrawingViewProps) {
  const { t } = useTranslation(['terrain-survey']);
  const svgRef = useRef<SVGSVGElement>(null);
  const context = useMemo(() => dxfContextLines(drawing, scaleToMm), [drawing, scaleToMm]);
  const box = useMemo(() => planViewBoxOf(context.map((line) => line.points)), [context]);
  const candidates = useMemo(() => ranking.ranked.map(({ candidate }) => candidate), [ranking]);
  const pointer = usePlotCandidatePointer({ svgRef, box, candidates, selectedId, onSelect });
  if (box === null) return null;
  const shapes = candidates
    .map((candidate) => ({ candidate, look: lookOf(candidate.id, selectedId, pointer.hoveredId) }))
    .sort((a, b) => PAINT_ORDER[a.look] - PAINT_ORDER[b.look]);
  return (
    <ListingZoomStage contentKey={`${fileKey}:${scaleToMm}`}>
      {() => (
        <svg ref={svgRef} viewBox={viewBoxAttribute(box)} role="group" aria-label={t(`${NS}.view.label`)} {...pointer.handlers}
          className={cn('block h-auto max-h-[70vh] w-full', pointer.hoveredId !== null && 'cursor-pointer')}>
          <rect x={0} y={0} width={box.width} height={box.height} className={TERRAIN_PAPER_CLASS} />
          <g aria-hidden="true">
            {context.map((line, index) => (
              <path key={index} d={planPathData(line.points, line.closed, box)} {...NON_SCALING}
                className={TERRAIN_PLOT_OUTLINE_CLASS.drawing} strokeWidth={TERRAIN_PLOT_OUTLINE_STROKE_PX.drawing} />
            ))}
          </g>
          {shapes.map(({ candidate, look }) => (
            <CandidateShape key={candidate.id} candidate={candidate} box={box} look={look} onSelect={onSelect} />
          ))}
        </svg>
      )}
    </ListingZoomStage>
  );
}

