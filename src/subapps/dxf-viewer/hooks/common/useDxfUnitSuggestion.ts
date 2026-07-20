'use client';

/**
 * ADR-362 Round 20 — import-wizard units sanity check.
 *
 * Reads ONLY the DXF header (a small top-of-file slice — the `$HEADER` section, with
 * `$INSUNITS` + `$EXTMIN/$EXTMAX`, always sits at the very start) and returns what the
 * auto importer will pick versus what the file declares, so `DrawingUnitsStep` can warn
 * on a mismatch ("declares mm but looks like metres"). Reuses the SAME parser
 * (`DxfEntityParser.parseHeader`) and the SAME resolution SSoT
 * (`computeUnitSuggestion` → `resolveImportSourceUnits`) the real import path uses — no
 * parallel heuristic. Fully ADR-462-safe: it only MIRRORS the auto decision, never
 * overrides it.
 */

import { useEffect, useState } from 'react';
import { DxfEntityParser } from '../../utils/dxf-entity-parser';
import { computeUnitSuggestion, type UnitSuggestion, type DetectionBounds } from '../../utils/scene-units';

// The header is tiny and top-of-file; a generous slice covers it without reading (or
// decoding) a multi-MB entity section. Numeric header values are pure ASCII, so a plain
// UTF-8 text decode is safe even for cp1253 / ISO-8859-7 Greek files — only layer NAMES
// would garble, and the header check never reads those. If a pathological header exceeds
// the slice, the extents are simply absent → no false warning (graceful degradation).
const HEADER_SLICE_BYTES = 256 * 1024;

export function useDxfUnitSuggestion(file: File | null | undefined): UnitSuggestion | null {
  const [suggestion, setSuggestion] = useState<UnitSuggestion | null>(null);

  useEffect(() => {
    if (!file) {
      setSuggestion(null);
      return;
    }
    let cancelled = false;
    file
      .slice(0, HEADER_SLICE_BYTES)
      .text()
      .then((text) => {
        if (cancelled) return;
        const header = DxfEntityParser.parseHeader(text.split('\n'));
        const declaredExtents: DetectionBounds | null =
          header.extmin && header.extmax ? { min: header.extmin, max: header.extmax } : null;
        setSuggestion(computeUnitSuggestion(header.insunits, declaredExtents));
      })
      .catch(() => {
        if (!cancelled) setSuggestion(null);
      });
    return () => {
      cancelled = true;
    };
  }, [file]);

  return suggestion;
}
