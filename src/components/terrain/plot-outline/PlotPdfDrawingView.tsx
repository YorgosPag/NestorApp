'use client';

/**
 * @fileoverview **Το PDF του τοπογράφου: η σελίδα με τονισμένο τον πίνακα συντεταγμένων, και δίπλα το περίγραμμα που δίνει**
 * (ADR-920 §14.11 Ζ4 · Π5).
 * @related components/file-manager/PdfCanvasViewer (ο ΕΝΑΣ θεατής PDF — `pageOverlay`) · lib/terrain/plot-outline/plot-drawing-view
 *   (`pdfTableBandOf` · διαδρομές) · components/listing-detail/terrain/terrain-map-palette (η ΙΔΙΑ γραφή περιγράμματος)
 * @module components/terrain/plot-outline/PlotPdfDrawingView
 *
 * 🔑 **Απόδειξη, όχι ισχυρισμός**: ο άνθρωπος βλέπει ΠΟΥ στη σελίδα διαβάστηκαν οι κορυφές (η ζώνη του πίνακα) και ΤΙ σχήμα
 *    δίνουν — με τα ίδια γράμματα κορυφών (Α, Β, Γ…) που γράφει το διάγραμμα.
 * 🔑 **Καμία επικάλυψη στη σελίδα** (Π5): το PDF δεν έχει γεωαναφορά, άρα το περίγραμμα δεν «κολλάει» πάνω στο σχέδιο — θα
 *    ήταν μαντεμένη θέση (παγίδα ADR-718). Ζωγραφίζεται **δίπλα**, από τις συντεταγμένες, και αυτό λέγεται ρητά.
 * 🔑 **Το αρχείο δεν φεύγει από τη συσκευή**: ο θεατής το διαβάζει από `blob:` URL (`urlDelivery: 'direct'` = «φέρε το ως
 *    έχει, χωρίς διαμεσολαβητή»), που ανακαλείται όταν φύγει το σχέδιο.
 */

import React, { useEffect, useId, useMemo, useState } from 'react';

import { PdfCanvasViewer } from '@/components/file-manager/PdfCanvasViewer';
import {
  TERRAIN_PAPER_CLASS,
  TERRAIN_PLOT_OUTLINE_CLASS,
  TERRAIN_PLOT_OUTLINE_STROKE_PX,
} from '@/components/listing-detail/terrain/terrain-map-palette';
import { NON_SCALING } from '@/components/listing-detail/terrain/terrain-map-symbols';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { PdfPositionedPage } from '@/lib/pdf/pdf-page-text';
import {
  pdfTableBandOf,
  planPathData,
  planSvgPoint,
  planViewBoxOf,
  viewBoxAttribute,
} from '@/lib/terrain/plot-outline/plot-drawing-view';
import type { PlotOutlineCandidate } from '@/lib/terrain/plot-outline/plot-outline-types';

const NS = 'terrain-survey:plotOutline';

export interface PlotPdfDrawingViewProps {
  readonly file: File;
  readonly pages: readonly PdfPositionedPage[];
  readonly selected: PlotOutlineCandidate | null;
}

/** Ένα `blob:` URL για όσο ζει το αρχείο στην οθόνη — ανακαλείται όταν αλλάξει ή φύγει. */
function useObjectUrl(file: File): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const created = URL.createObjectURL(file);
    setUrl(created);
    return () => URL.revokeObjectURL(created);
  }, [file]);
  return url;
}

/** Το περίγραμμα του πίνακα, σχεδιασμένο από τις συντεταγμένες του — με τα γράμματα των κορυφών. */
function TableRingDiagram({ candidate }: { readonly candidate: PlotOutlineCandidate }) {
  const { t } = useTranslation(['terrain-survey']);
  const box = useMemo(() => planViewBoxOf([candidate.ringWorldMm]), [candidate]);
  if (box === null) return null;
  const labelSize = box.width * 0.035;
  return (
    <svg viewBox={viewBoxAttribute(box)} role="img" aria-label={t(`${NS}.view.ringLabel`)} className="block h-auto w-full">
      <rect x={0} y={0} width={box.width} height={box.height} className={TERRAIN_PAPER_CLASS} />
      <path d={planPathData(candidate.ringWorldMm, true, box)} className={TERRAIN_PLOT_OUTLINE_CLASS.outlineArea} />
      <path d={planPathData(candidate.ringWorldMm, true, box)} {...NON_SCALING} className={TERRAIN_PLOT_OUTLINE_CLASS.outline}
        strokeWidth={TERRAIN_PLOT_OUTLINE_STROKE_PX.outline} />
      {candidate.corners.map((corner, index) => corner.label === null ? null : (
        <text key={index} {...planSvgPoint(corner.at, box)} fontSize={labelSize} textAnchor="middle" dominantBaseline="middle"
          className={TERRAIN_PLOT_OUTLINE_CLASS.cornerLabel}>{corner.label}</text>
      ))}
    </svg>
  );
}

export function PlotPdfDrawingView({ file, pages, selected }: PlotPdfDrawingViewProps) {
  const { t } = useTranslation(['terrain-survey']);
  const noteId = useId();
  const url = useObjectUrl(file);
  const band = useMemo(() => (selected === null ? null : pdfTableBandOf(pages, selected)), [pages, selected]);
  const page = selected?.origin.source === 'pdf-table' ? selected.origin.page : 1;
  const overlay = (shown: number) => band === null || shown !== page ? null : (
    <svg viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full">
      <rect x={0} y={band.top} width={1} height={band.bottom - band.top} className={TERRAIN_PLOT_OUTLINE_CLASS.outlineArea} />
    </svg>
  );
  return (
    <section className="grid gap-3 md:grid-cols-2" aria-describedby={noteId}>
      <figure className="m-0 flex min-w-0 flex-col gap-1">
        {url !== null && (
          <PdfCanvasViewer title={file.name} url={url} urlDelivery="direct" page={page} pageOverlay={overlay} />
        )}
        {band !== null && <figcaption className="text-xs text-muted-foreground">{t(`${NS}.pdf.tableBand`)}</figcaption>}
      </figure>
      {selected !== null && (
        <figure className="m-0 flex min-w-0 flex-col gap-1">
          <TableRingDiagram candidate={selected} />
          <figcaption className="text-xs text-muted-foreground">{t(`${NS}.view.ringLabel`)}</figcaption>
        </figure>
      )}
      <p id={noteId} className="m-0 text-xs text-muted-foreground md:col-span-2">{t(`${NS}.pdf.noOverlay`)}</p>
    </section>
  );
}
