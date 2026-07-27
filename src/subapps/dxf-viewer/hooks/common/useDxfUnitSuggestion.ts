'use client';

/**
 * ADR-362 Round 20 / ADR-716 — import-wizard units verdict.
 *
 * Reads ONLY the DXF header (a small top-of-file slice — the `$HEADER` section, with
 * `$INSUNITS` + `$EXTMIN/$EXTMAX`, always sits at the very start) and returns the FULL
 * unit decision the importer will make, **with its evidence** (ADR-716 §8): which rung of
 * the ladder spoke, and how big the drawing comes out in metres.
 *
 * Reuses the SAME parser (`DxfEntityParser.parseHeader`) and the SAME resolution SSoT
 * (`resolveImportSourceUnitsWithEvidence`) the real import path uses — no parallel
 * heuristic, so what the screen shows IS what the importer executes, by construction.
 * Fully ADR-462-safe: it only MIRRORS the decision, never overrides it.
 */

import { useEffect, useState } from 'react';
import { DxfEntityParser } from '../../utils/dxf-entity-parser';
import type { DetectionBounds, SceneUnits } from '../../utils/scene-units';
import {
  resolveImportSourceUnitsWithEvidence,
  type UnitDecision,
} from '../../utils/import-unit-decision';

// The header is tiny and top-of-file; a generous slice covers it without reading (or
// decoding) a multi-MB entity section. Numeric header values are pure ASCII, so a plain
// UTF-8 text decode is safe even for cp1253 / ISO-8859-7 Greek files — only layer NAMES
// would garble, and the header check never reads those. If a pathological header exceeds
// the slice, the extents are simply absent → no false warning (graceful degradation).
const HEADER_SLICE_BYTES = 256 * 1024;

/**
 * @param file          the DXF being imported (header slice is read; entities are not)
 * @param unitsOverride the engineer's explicit pill choice, so the readout reflects what
 *                      WILL happen — not what auto would have done and been overridden.
 */
export function useDxfUnitSuggestion(
  file: File | null | undefined,
  unitsOverride?: SceneUnits,
): UnitDecision | null {
  const [decision, setDecision] = useState<UnitDecision | null>(null);

  useEffect(() => {
    if (!file) {
      setDecision(null);
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
        setDecision(
          resolveImportSourceUnitsWithEvidence(header.insunits, declaredExtents, null, unitsOverride),
        );
      })
      .catch(() => {
        if (!cancelled) setDecision(null);
      });
    return () => {
      cancelled = true;
    };
  }, [file, unitsOverride]);

  return decision;
}
