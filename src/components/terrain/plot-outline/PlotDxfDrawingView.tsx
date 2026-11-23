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
 * 🔑 Όλα σε WORLD mm, με την ίδια κλίμακα που έδωσε τα υποψήφια ⇒ το τονισμένο πέφτει πάνω στη γραμμή του σχεδίου.
 */

import React, { useMemo } from 'react';

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
} from '@/lib/terrain/plot-outline/plot-drawing-view';
import type { PlotOutlineCandidate, PlotOutlineRanking } from '@/lib/terrain/plot-outline/plot-outline-types';

const NS = 'terrain-survey:plotOutline';

export interface PlotDxfDrawingViewProps {
  readonly fileKey: string;
  readonly drawing: DxfPlotDrawing;
  readonly scaleToMm: number;
  readonly ranking: PlotOutlineRanking;
  readonly selectedId: string | null;
  readonly onSelect: (candidateId: string) => void;
}

function CandidateShape({ candidate, selected, onSelect }: {
  readonly candidate: PlotOutlineCandidate;
  readonly selected: boolean;
  readonly onSelect: (candidateId: string) => void;
}) {
  const { t } = useTranslation(['terrain-survey']);
  const d = planPathData(candidate.ringWorldMm, true);
  const choose = () => onSelect(candidate.id);
  return (
    <g role="button" tabIndex={0} aria-pressed={selected}
      aria-label={t(`${NS}.view.candidate`, { area: formatNumber(candidate.areaM2, { maximumFractionDigits: 0 }) })}
      onClick={choose}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(); } }}>
      {selected && <path d={d} className={TERRAIN_PLOT_OUTLINE_CLASS.outlineArea} />}
      <path d={d} {...NON_SCALING} className={selected ? TERRAIN_PLOT_OUTLINE_CLASS.outline : TERRAIN_PLOT_OUTLINE_CLASS.candidate}
        strokeWidth={selected ? TERRAIN_PLOT_OUTLINE_STROKE_PX.outline : TERRAIN_PLOT_OUTLINE_STROKE_PX.candidate} />
      <path d={d} {...NON_SCALING} className={TERRAIN_PLOT_OUTLINE_CLASS.hitArea} strokeWidth={TERRAIN_PLOT_OUTLINE_STROKE_PX.hitArea} />
    </g>
  );
}

export function PlotDxfDrawingView({ fileKey, drawing, scaleToMm, ranking, selectedId, onSelect }: PlotDxfDrawingViewProps) {
  const { t } = useTranslation(['terrain-survey']);
  const context = useMemo(() => dxfContextLines(drawing, scaleToMm), [drawing, scaleToMm]);
  const box = useMemo(() => planViewBoxOf(context.map((line) => line.points)), [context]);
  if (box === null) return null;
  // Το επιλεγμένο ζωγραφίζεται τελευταίο: πάνω από τα άλλα, και το κλικ του κερδίζει όπου επικαλύπτονται.
  const ordered = [...ranking.ranked].sort((a, b) => Number(a.candidate.id === selectedId) - Number(b.candidate.id === selectedId));
  return (
    <ListingZoomStage contentKey={`${fileKey}:${scaleToMm}`}>
      {() => (
        <svg viewBox={viewBoxAttribute(box)} role="group" aria-label={t(`${NS}.view.label`)}
          className="block h-auto max-h-[70vh] w-full">
          <rect x={box.minX} y={box.minY} width={box.width} height={box.height} className={TERRAIN_PAPER_CLASS} />
          <g aria-hidden="true">
            {context.map((line, index) => (
              <path key={index} d={planPathData(line.points, line.closed)} {...NON_SCALING}
                className={TERRAIN_PLOT_OUTLINE_CLASS.drawing} strokeWidth={TERRAIN_PLOT_OUTLINE_STROKE_PX.drawing} />
            ))}
          </g>
          {ordered.map(({ candidate }) => (
            <CandidateShape key={candidate.id} candidate={candidate} selected={candidate.id === selectedId} onSelect={onSelect} />
          ))}
        </svg>
      )}
    </ListingZoomStage>
  );
}
