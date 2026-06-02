'use client';

/**
 * SSoT dropdowns for BIM line-style ribbon panels (ADR-001 + ADR-375).
 *
 * Wraps the canonical Radix `@/components/ui/select` so every BIM style panel
 * (Visibility/Graphics, Object Styles, Pen Table) shares ONE pen / pattern /
 * lineweight dropdown instead of duplicating native `<select>` elements (which
 * violate ADR-001 — native `<select>` opens the OS picker, ignores the design
 * system).
 *
 * - `BimPenSelect`        — pen index 1–16 (monospace, compact).
 * - `BimPatternSelect`    — line pattern (solid/dashed/dotted/…), i18n labels.
 * - `BimLineweightSelect` — concrete ISO lineweight in mm (Pen Table cells),
 *                           with "modified" highlight + right-click reset.
 */

import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { type LinePatternKey } from '../../../config/bim-line-patterns';
import { LINEWEIGHT_ISO_VALUES } from '../../../config/lineweight-iso-catalog';

/** Pen indices 1–16 (ISO lineweight slots — ADR-358). */
export const PEN_OPTIONS = Array.from({ length: 16 }, (_, i) => i + 1);

/** Line patterns exposed in the BIM style panels. */
export const PATTERN_OPTIONS: LinePatternKey[] = [
  'solid', 'dashed', 'dashed2', 'dotted', 'center', 'hidden', 'dashdot', 'phantom',
];

/** Concrete (printable) ISO lineweights in mm — the positive catalog values. */
export const LINEWEIGHT_MM_OPTIONS: readonly number[] = (
  LINEWEIGHT_ISO_VALUES as readonly number[]
).filter((v) => v > 0);

interface BimPenSelectProps {
  value: number;
  onChange: (pen: number) => void;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}

/** Canonical pen-index dropdown (1–16) — replaces native `<select>`. */
export const BimPenSelect: React.FC<BimPenSelectProps> = ({
  value,
  onChange,
  disabled,
  className,
  'aria-label': ariaLabel,
}) => (
  <Select
    value={String(value)}
    onValueChange={(v) => onChange(parseInt(v, 10))}
    disabled={disabled}
  >
    <SelectTrigger size="sm" className={cn('font-mono', className)} aria-label={ariaLabel}>
      <SelectValue />
    </SelectTrigger>
    {/* w-auto overrides the popper's trigger-width lock so items are never clipped. */}
    <SelectContent className="w-auto min-w-[4rem]">
      {PEN_OPTIONS.map((p) => (
        <SelectItem key={p} value={String(p)} className="font-mono whitespace-nowrap">
          {p}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
);

interface BimPatternSelectProps {
  value: LinePatternKey;
  onChange: (pattern: LinePatternKey) => void;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}

/** Canonical line-pattern dropdown — replaces native `<select>`. */
export const BimPatternSelect: React.FC<BimPatternSelectProps> = ({
  value,
  onChange,
  disabled,
  className,
  'aria-label': ariaLabel,
}) => {
  const { t } = useTranslation('dxf-viewer-shell');
  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(v as LinePatternKey)}
      disabled={disabled}
    >
      <SelectTrigger size="sm" className={className} aria-label={ariaLabel}>
        <SelectValue />
      </SelectTrigger>
      {/* w-auto overrides the popper's trigger-width lock so long Greek labels
          (e.g. «Διακεκομμένη ×0.5», «Γραμμή-Τελεία») are never clipped. */}
      <SelectContent className="w-auto min-w-[13rem]">
        {PATTERN_OPTIONS.map((p) => (
          <SelectItem key={p} value={p} className="whitespace-nowrap">
            {t(`ribbon.commands.visibilityGraphics.patterns.${p}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

interface BimLineweightSelectProps {
  /** Current concrete mm value. */
  value: number;
  onChange: (mm: number) => void;
  /** Highlight as a per-cell override (amber). */
  modified?: boolean;
  /** Right-click handler (e.g. reset the cell). */
  onContextMenu?: (e: React.MouseEvent) => void;
  className?: string;
  'aria-label'?: string;
}

/** Canonical ISO-lineweight (mm) dropdown — replaces native `<select>` in the Pen Table. */
export const BimLineweightSelect: React.FC<BimLineweightSelectProps> = ({
  value,
  onChange,
  modified,
  onContextMenu,
  className,
  'aria-label': ariaLabel,
}) => {
  const colors = useSemanticColors();
  return (
    <Select
      value={String(value)}
      onValueChange={(v) => onChange(parseFloat(v))}
    >
      <SelectTrigger
        size="sm"
        onContextMenu={onContextMenu}
        aria-label={ariaLabel}
        className={cn(
          'font-mono',
          modified && `${colors.bg.warningLight} ${colors.text.warningLight}`,
          className,
        )}
      >
        <SelectValue />
      </SelectTrigger>
      {/* w-auto overrides the popper's trigger-width lock so items are never clipped. */}
      <SelectContent className="w-auto min-w-[5rem]">
        {LINEWEIGHT_MM_OPTIONS.map((v) => (
          <SelectItem key={v} value={String(v)} className="font-mono whitespace-nowrap">
            {v.toFixed(2)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
