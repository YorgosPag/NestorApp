'use client';

/**
 * @fileoverview **Επισήμανση περιοχών πάνω στη σελίδα PDF** (ADR-923 §5.5.1 · έλεγχος δίπλα-δίπλα).
 * @module components/file-manager/PdfHighlights
 *
 * 🔑 SVG με `viewBox` 0..1: οι περιοχές είναι κλάσματα σελίδας, άρα ακολουθούν ζουμ και ανάλυση χωρίς κανένα inline style (N.3).
 */

import React, { useEffect, type Dispatch, type SetStateAction } from 'react';

import type { PdfHighlightRegion, PdfState } from './pdf-canvas-config';

/** Η σελίδα του καλούντα νικά τη δική του πλοήγηση, και ξαναϊσχύει όταν φορτώσει το έγγραφο. Απούσα ⇒ καμία επίδραση. */
export function useControlledPdfPage(page: number | undefined, numPages: number, setState: Dispatch<SetStateAction<PdfState>>): void {
  useEffect(() => {
    if (page !== undefined && numPages > 0) setState((s) => ({ ...s, currentPage: Math.min(page, s.numPages) }));
  }, [page, numPages, setState]);
}

export function PdfHighlights({ regions = [] }: { readonly regions?: readonly PdfHighlightRegion[] }) {
  if (regions.length === 0) return null;
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
      {regions.map((region, index) => (
        <rect
          key={`${region.x}-${region.y}-${index}`}
          x={region.x}
          y={region.y}
          width={region.width}
          height={region.height}
          className="fill-primary/25 stroke-primary"
          strokeWidth={0.002}
        />
      ))}
    </svg>
  );
}
