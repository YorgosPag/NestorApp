'use client';

/**
 * ADR-345 Fase 6 — Justification grid widget for the Text Editor contextual tab.
 *
 * Leaf component: reads/writes `justification` directly from
 * `useTextToolbarStore` (ADR-040 compliant micro-leaf). Reuses the
 * existing `JustificationGrid` control (ADR-344 Phase 5.C, SSoT).
 */

import React, { useCallback } from 'react';
import { useTextToolbarStore } from '../../../state/text-toolbar';
import { JustificationGrid } from '../../text-toolbar/controls/JustificationGrid';
import type { TextJustification } from '../../../text-engine/types';

export function RibbonJustificationGridWidget() {
  const justification = useTextToolbarStore((s) => s.justification);
  const setValue = useTextToolbarStore((s) => s.setValue);

  const handleChange = useCallback(
    (next: TextJustification) => setValue('justification', next),
    [setValue],
  );

  return (
    <JustificationGrid
      value={justification}
      onChange={handleChange}
    />
  );
}
