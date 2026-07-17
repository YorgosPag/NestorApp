'use client';
/**
 * SelectionCyclingPopover — ADR-357 Phase 15 (G13 Selection Cycling).
 *
 * Mini floating list that appears when multiple entities overlap at the cursor.
 * Rendered via React portal at document.body — safe for z-index stacking.
 * ADR-040 compliant: subscribes ONLY to SelectionCyclingStore (low-freq).
 *
 * Interaction:
 *   Shift+Space  → cycleNext (handled by use-selection-cycling)
 *   Click item   → select that entity + dismiss
 *   Enter        → confirm highlighted item (handled by use-selection-cycling)
 *   Escape       → cancel (handled by use-selection-cycling)
 */

import React, { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { SelectionCyclingStore } from './SelectionCyclingStore';
// Bug fix (2026-07-17) — Revit-grade row label (role/thickness/elevation for slabs,
// generic entity-type fallback otherwise). Never the raw internal `lvl_…` id again.
import { buildCandidateLabel } from './candidate-label';
// ADR-659 — canvas pre-highlight of the hovered/cycled candidate (zero-React, ADR-040).
import { setHoveredEntity } from '../hover/HoverStore';

interface SelectionCyclingPopoverProps {
  onSelectEntity: (entityId: string) => void;
}

export function SelectionCyclingPopover({ onSelectEntity }: SelectionCyclingPopoverProps) {
  const { t } = useTranslation('dxf-viewer');
  // Generic entity-type fallback labels live in the shared 'bim3d' namespace
  // (entityTypes.* — same SSoT as the accessibility status bar / ARIA live region).
  const { t: tEntityType } = useTranslation('bim3d');
  const state = useSyncExternalStore(
    SelectionCyclingStore.subscribe,
    SelectionCyclingStore.getSnapshot,
    SelectionCyclingStore.getSnapshot,
  );

  if (!state.active || state.candidates.length === 0) return null;
  if (typeof document === 'undefined') return null;

  // ADR-659 — the candidate that Enter/repeated-click would confirm; canvas falls back to it
  // when the pointer leaves the list, so the pre-highlight never goes stale.
  const currentId = state.candidates[state.currentIndex]?.id ?? null;

  return createPortal(
    <ul
      role="listbox"
      aria-label={t('selectionCycling.label')}
      style={{ left: state.clientX + 14, top: state.clientY + 14 }}
      className="fixed z-[2500] min-w-[180px] max-h-56 overflow-y-auto rounded border border-border bg-popover shadow-lg text-xs py-0.5"
      onMouseLeave={() => setHoveredEntity(currentId)}
    >
      {state.candidates.map((candidate, idx) => {
        const label = buildCandidateLabel(candidate, t, tEntityType);
        return (
          <li
            key={candidate.id}
            role="option"
            aria-selected={idx === state.currentIndex}
            onMouseDown={(e) => {
              // preventDefault keeps input focus; selection happens on click.
              e.preventDefault();
            }}
            // ADR-659 — hovering a row pre-highlights that entity ON THE CANVAS (Revit/AutoCAD),
            // so the user sees exactly WHAT they will select before committing.
            onMouseEnter={() => setHoveredEntity(candidate.id)}
            onClick={() => {
              onSelectEntity(candidate.id);
              SelectionCyclingStore.cancel();
              SelectionCyclingStore.clearArmed();
              setHoveredEntity(null);
            }}
            className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer select-none ${
              idx === state.currentIndex
                ? 'bg-accent text-accent-foreground'
                : 'hover:bg-muted'
            }`}
          >
            <span className="font-semibold shrink-0">{label.primary}</span>
            {label.secondary && (
              <span className="text-muted-foreground truncate">{label.secondary}</span>
            )}
            {label.tertiary && (
              <span className="font-mono text-[10px] text-muted-foreground ml-auto shrink-0">
                {label.tertiary}
              </span>
            )}
          </li>
        );
      })}
    </ul>,
    document.body,
  );
}
