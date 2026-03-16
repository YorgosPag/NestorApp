'use client';

/**
 * =============================================================================
 * SPEC-237D: Generic Entity Selector (Steps 1-4)
 * =============================================================================
 *
 * Renders either radio buttons (≤5 items) or Radix Select (>5 items).
 * Used for: Company, Project, Building, Floor selection.
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
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { EntityOption } from '../hooks/useFloorplanImportState';

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
}: StepEntitySelectorProps) {
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

  // ── Radio list (≤5 items) ──
  if (items.length <= RADIO_THRESHOLD) {
    return (
      <fieldset className="space-y-2 py-4">
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
    );
  }

  // ── Dropdown (>5 items) — ADR-001 Radix Select ──
  return (
    <div className="py-4">
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
    </div>
  );
}
