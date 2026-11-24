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
 * 🔗 **Αμφίδρομη επισήμανση** (§14.11 «Ζ4 — αμφίδρομη επισήμανση»): ο προ-τονισμός (`peekedId`) έρχεται απ' έξω — από τον δείκτη
 *    εδώ, την εστίαση ενός σχήματος, ή το πέρασμα πάνω από μια ΚΑΡΤΑ της λίστας. Μία κατάσταση, δύο όψεις.
 * 📏 Ύψος ≤ 45vh: η όψη μένει κολλημένη πάνω από τη λίστα (`PlotDrawingImport`), άρα αφήνει χώρο να φαίνονται οι κάρτες.
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
import { listingFocusStrength, type ListingFocusStrength } from '@/lib/listings/listing-focus';
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
  /** Εφήμερο: το υποψήφιο κάτω από τον δείκτη/την εστίαση — εδώ ή στη λίστα. */
  readonly peekedId: string | null;
  readonly onSelect: (candidateId: string) => void;
  readonly onPeek: (candidateId: string | null) => void;
}

/**
 * Πώς φαίνεται ένα υποψήφιο: επιλεγμένο · προ-τονισμένο (ό,τι ΘΑ διάλεγε το κλικ, ή η κάρτα κάτω από τον δείκτη) · σε ηρεμία.
 * Η ένταση την κρίνει το ΙΔΙΟ λεξιλόγιο με τη λίστα (`listingFocusStrength`, ADR-777): η επιλογή υπερισχύει του εφήμερου.
 */
type CandidateLook = ListingFocusStrength;

const CANDIDATE_LOOK = {
  selected: { className: TERRAIN_PLOT_OUTLINE_CLASS.outline, strokeWidth: TERRAIN_PLOT_OUTLINE_STROKE_PX.outline },
  peeked: { className: TERRAIN_PLOT_OUTLINE_CLASS.candidateHover, strokeWidth: TERRAIN_PLOT_OUTLINE_STROKE_PX.outline },
  none: { className: TERRAIN_PLOT_OUTLINE_CLASS.candidate, strokeWidth: TERRAIN_PLOT_OUTLINE_STROKE_PX.candidate },
} as const;

/**
 * Τα τονισμένα, ΞΑΝΑ, πάνω από όλα: προ-τονισμένο → επιλεγμένο (μόνο ΟΨΗ — το κλικ το κρίνει η γεωμετρία).
 * 🔴 **Τα κουμπιά-σχήματα ΔΕΝ αλλάζουν σειρά στο DOM**: με την εστίαση να ανάβει το σχήμα (ίδια κατάσταση με τον δείκτη), η
 *    αναδιάταξη θα ΜΕΤΑΚΙΝΟΥΣΕ τον εστιασμένο κόμβο ⇒ ο browser χάνει την εστίαση ⇒ σβήνει ο τονισμός ⇒ γυρίζει η σειρά — βρόχος,
 *    και το Tab δεν θα προχωρούσε ποτέ. Γι' αυτό η σειρά ζωγραφικής ζει σε ΧΩΡΙΣΤΗ, αμίλητη στρώση.
 */
function EmphasisLayer({ candidates, box, selectedId, peekedId }: {
  readonly candidates: readonly PlotOutlineCandidate[];
  readonly box: PlanViewBox;
  readonly selectedId: string | null;
  readonly peekedId: string | null;
}) {
  const peeked = peekedId === selectedId ? undefined : candidates.find((candidate) => candidate.id === peekedId);
  const selected = candidates.find((candidate) => candidate.id === selectedId);
  return (
    <g aria-hidden="true" className="pointer-events-none">
      {peeked !== undefined && <path d={planPathData(peeked.ringWorldMm, true, box)} {...NON_SCALING} {...CANDIDATE_LOOK.peeked} />}
      {selected !== undefined && (
        <>
          <path d={planPathData(selected.ringWorldMm, true, box)} className={TERRAIN_PLOT_OUTLINE_CLASS.outlineArea} />
          <path d={planPathData(selected.ringWorldMm, true, box)} {...NON_SCALING} {...CANDIDATE_LOOK.selected} />
        </>
      )}
    </g>
  );
}

function CandidateShape({ candidate, box, look, onSelect, onPeek }: {
  readonly candidate: PlotOutlineCandidate;
  readonly box: PlanViewBox;
  readonly look: CandidateLook;
  readonly onSelect: (candidateId: string) => void;
  readonly onPeek: (candidateId: string | null) => void;
}) {
  const { t } = useTranslation(['terrain-survey']);
  const d = planPathData(candidate.ringWorldMm, true, box);
  const choose = () => onSelect(candidate.id);
  return (
    <g role="button" tabIndex={0} aria-pressed={look === 'selected'}
      aria-label={t(`${NS}.view.candidate`, { area: formatNumber(candidate.areaM2, { maximumFractionDigits: 0 }) })}
      // Μόνο το «κλικ» χωρίς θέση (πληκτρολόγιο / βοηθητική τεχνολογία)· το κλικ του δείκτη το κρίνει η γεωμετρία, στο SVG.
      onClick={(event) => { if (event.detail === 0) choose(); }}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(); } }}
      // Η εστίαση πληκτρολογίου είναι το «πέρασμα» του πληκτρολογίου: ανάβει και την κάρτα (ίδια κατάσταση με τον δείκτη).
      onFocus={() => onPeek(candidate.id)} onBlur={() => onPeek(null)}>
      <path d={d} {...NON_SCALING} {...CANDIDATE_LOOK[look]} />
    </g>
  );
}

export function PlotDxfDrawingView({ fileKey, drawing, scaleToMm, ranking, selectedId, peekedId, onSelect, onPeek }: PlotDxfDrawingViewProps) {
  const { t } = useTranslation(['terrain-survey']);
  const svgRef = useRef<SVGSVGElement>(null);
  const context = useMemo(() => dxfContextLines(drawing, scaleToMm), [drawing, scaleToMm]);
  const box = useMemo(() => planViewBoxOf(context.map((line) => line.points)), [context]);
  const candidates = useMemo(() => ranking.ranked.map(({ candidate }) => candidate), [ranking]);
  const pointer = usePlotCandidatePointer({ svgRef, box, candidates, selectedId, onSelect, onPeek });
  if (box === null) return null;
  const focus = { peeked: peekedId, selected: selectedId };
  return (
    <ListingZoomStage contentKey={`${fileKey}:${scaleToMm}`}>
      {() => (
        <svg ref={svgRef} viewBox={viewBoxAttribute(box)} role="group" aria-label={t(`${NS}.view.label`)} {...pointer.handlers}
          className={cn('block h-auto max-h-[45vh] w-full', peekedId !== null && 'cursor-pointer')}>
          <rect x={0} y={0} width={box.width} height={box.height} className={TERRAIN_PAPER_CLASS} />
          <g aria-hidden="true">
            {context.map((line, index) => (
              <path key={index} d={planPathData(line.points, line.closed, box)} {...NON_SCALING}
                className={TERRAIN_PLOT_OUTLINE_CLASS.drawing} strokeWidth={TERRAIN_PLOT_OUTLINE_STROKE_PX.drawing} />
            ))}
          </g>
          {candidates.map((candidate) => (
            <CandidateShape key={candidate.id} candidate={candidate} box={box} look={listingFocusStrength(focus, candidate.id)}
              onSelect={onSelect} onPeek={onPeek} />
          ))}
          <EmphasisLayer candidates={candidates} box={box} selectedId={selectedId} peekedId={peekedId} />
        </svg>
      )}
    </ListingZoomStage>
  );
}

