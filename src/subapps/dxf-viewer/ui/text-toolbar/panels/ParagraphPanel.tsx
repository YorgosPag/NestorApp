'use client';

/**
 * ADR-344 Phase 5.D — Paragraph panel.
 *
 * Justification 3×3 grid + line spacing menu. Indent / tabs / columns
 * remain deferred to Phase 6 commands (geometry layout) — keys exist
 * but no UI surface here yet.
 */

import React from 'react';
import {
  useTextToolbarStore,
  type TextToolbarValues,
} from '../../../state/text-toolbar';
import {
  JustificationGrid,
  LineSpacingMenu,
} from '../controls';

interface ParagraphPanelProps {
  readonly disabled?: boolean;
}

export function ParagraphPanel({ disabled }: ParagraphPanelProps) {
  const justification = useTextToolbarStore((s) => s.justification);
  const lineSpacingMode = useTextToolbarStore((s) => s.lineSpacingMode);
  const lineSpacingFactor = useTextToolbarStore((s) => s.lineSpacingFactor);
  const setValue = useTextToolbarStore((s) => s.setValue);
  const setMany = useTextToolbarStore((s) => s.setMany);

  const set = <K extends keyof TextToolbarValues>(key: K) => (next: TextToolbarValues[K]) => {
    setValue(key, next);
  };

  return (
    <section className="flex flex-wrap items-start gap-3">
      <JustificationGrid
        value={justification}
        onChange={set('justification')}
        disabled={disabled}
      />
      <LineSpacingMenu
        mode={lineSpacingMode}
        factor={lineSpacingFactor}
        onChange={(mode, factor) => setMany({ lineSpacingMode: mode, lineSpacingFactor: factor })}
        disabled={disabled}
      />
    </section>
  );
}
