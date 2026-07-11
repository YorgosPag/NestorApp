'use client';

/**
 * StairOverrideRowShell — shared `<tr>` chrome for a per-sub-element override row
 * (ADR-358 Q19 Φ5/Φ7). The index cell, click-into active styling + scroll-into-view,
 * and the `−` remove cell are IDENTICAL for the per-tread and per-riser tables, so
 * they live here ONCE (N.18); each table injects its own middle cells as children
 * (tread: material + nosing · riser: material).
 *
 * `labelKeyBase` selects the i18n namespace, e.g.
 * `stairAdvancedPanel.sections.perTread` → `.rowAriaLabel` / `.selectedRowAriaLabel`
 * / `.removeOverride` (all present in el + en).
 */

import React, { useEffect, useRef } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';

export interface StairOverrideRowShellProps {
  readonly index: number;
  /** True when this index is a persisted override (vs a transient click-into row). */
  readonly persisted: boolean;
  /** The clicked-into sub-element: highlighted + scrolled into view. */
  readonly isActive: boolean;
  /** i18n key base, e.g. `stairAdvancedPanel.sections.perRiser`. */
  readonly labelKeyBase: string;
  readonly onRemove: (index: number) => void;
  /** The editable middle cells (already wrapped in their own `<td>`s). */
  readonly children: React.ReactNode;
}

export function StairOverrideRowShell({
  index,
  persisted,
  isActive,
  labelKeyBase,
  onRemove,
  children,
}: StairOverrideRowShellProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const rowRef = useRef<HTMLTableRowElement>(null);
  // Bring the clicked-into row into view (a 2D/3D click may target a row scrolled away).
  useEffect(() => {
    if (isActive) rowRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [isActive]);

  // Display is 1-based (humans count from 1); the key stays 0-based (geometry/tag/resolver SSoT).
  const displayIndex = index + 1;
  return (
    <tr
      ref={rowRef}
      aria-current={isActive ? 'true' : undefined}
      aria-label={t(`${labelKeyBase}.${isActive ? 'selectedRowAriaLabel' : 'rowAriaLabel'}`, {
        index: displayIndex,
      })}
      className={isActive ? 'bg-accent/60 ring-1 ring-primary' : undefined}
    >
      <td className="py-1 align-middle font-medium">{displayIndex}</td>
      {children}
      <td className="py-1 text-right align-middle">
        {/* Transient active rows (not yet persisted) have nothing to remove. */}
        {persisted ? (
          <button
            type="button"
            onClick={() => onRemove(index)}
            aria-label={t(`${labelKeyBase}.removeOverride`)}
            className="rounded border border-border bg-card px-1.5 py-0.5 text-xs text-foreground hover:bg-accent"
          >
            −
          </button>
        ) : null}
      </td>
    </tr>
  );
}
