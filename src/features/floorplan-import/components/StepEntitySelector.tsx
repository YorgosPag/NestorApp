'use client';

/**
 * =============================================================================
 * SPEC-237D: Generic Entity Selector (Steps 1-4)
 * =============================================================================
 *
 * Renders either radio buttons (≤5 items) or Radix Select (>5 items).
 * Used for: Company, Project, Building, Floor selection.
 *
 * Steps 2-4 include an optional shortcut card above the list — a large
 * clickable card with icon (same style as the old type cards from step 5).
 *
 * @module features/floorplan-import/components/StepEntitySelector
 */

import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { EntityOption } from '../hooks/useFloorplanImportState';
import '@/lib/design-system';

// =============================================================================
// TYPES
// =============================================================================

interface StepEntitySelectorProps {
  items: EntityOption[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading: boolean;
  placeholder: string;
  emptyMessage: string;
  /** Optional shortcut card label (e.g. "Γενική Κάτοψη Έργου") */
  shortcutLabel?: string;
  /** Icon for shortcut card */
  shortcutIcon?: React.ElementType;
  /** Called when shortcut card is clicked → jumps to upload */
  onShortcutClick?: () => void;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const RADIO_THRESHOLD = 5;

// =============================================================================
// COMPONENT
// =============================================================================

export function StepEntitySelector({
  items,
  selectedId,
  onSelect,
  loading,
  placeholder,
  emptyMessage,
  shortcutLabel,
  shortcutIcon: ShortcutIcon,
  onShortcutClick,
}: StepEntitySelectorProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="medium" />
      </div>
    );
  }

  // ── Empty state ──
  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className={`text-sm ${colors.text.muted}`}>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 py-4">
      {/* ── Shortcut card — large clickable card with icon ── */}
      {shortcutLabel && ShortcutIcon && onShortcutClick && (
        <button
          type="button"
          onClick={onShortcutClick}
          className="flex w-full cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-border bg-card px-4 py-6 shadow-sm transition-all hover:border-primary hover:bg-primary/5 hover:shadow-md"
        >
          <ShortcutIcon className={`${iconSizes.xl2} text-foreground`} />
          <span className="text-center text-sm font-semibold text-foreground">{shortcutLabel}</span>
        </button>
      )}

      {/* ── Radio list (≤5 items) ── */}
      {items.length <= RADIO_THRESHOLD ? (
        <fieldset className="space-y-2">
          {items.map((item) => {
            const isSelected = item.id === selectedId;
            return (
              <label
                key={item.id}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50 hover:bg-muted/30'
                }`}
              >
                <input
                  type="radio"
                  name="entity-selector"
                  value={item.id}
                  checked={isSelected}
                  onChange={() => onSelect(item.id)}
                  className="sr-only"
                />
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                    isSelected ? 'border-primary' : 'border-muted-foreground/40'
                  }`}
                >
                  {isSelected && (
                    <span className="h-2 w-2 rounded-full bg-primary" />
                  )}
                </span>
                <span className={`text-sm ${isSelected ? 'font-medium' : ''}`}>
                  {item.label}
                </span>
              </label>
            );
          })}
        </fieldset>
      ) : (
        /* ── Dropdown (>5 items) — ADR-001 Radix Select ── */
        <Select value={selectedId ?? ''} onValueChange={onSelect}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {items.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
