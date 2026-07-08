'use client';

/**
 * ADR-604 Φ4 — shared «Family Type» Radix `Select` dropdown (SSoT).
 *
 * Both family-type widget designs (Wall/Opening selector + Slab/Roof editor) render
 * the same Radix `Select` scaffolding (ADR-001): a «no type» clear row
 * (`SELECT_CLEAR_VALUE`, NOT '' — ADR-411) followed by the catalog items. This
 * presentational component owns that scaffolding once; each design passes its
 * pre-computed item labels and a plain `onAssign(typeId | undefined)` handler.
 *
 * @see ./create-family-type-selector-widget.tsx · ./FamilyTypeEditorWidget.tsx
 * @see docs/centralized-systems/reference/adrs/ADR-604-generic-family-type-framework.md
 */

import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SELECT_CLEAR_VALUE, isSelectClearValue } from '@/config/domain-constants';
import type { BimFamilyType } from '../../../bim/types/bim-family-type';

/**
 * Controller fields BOTH family-type widget designs (selector + editor) read.
 * Each design extends this with its own extra affordances.
 */
export interface FamilyTypeWidgetCommon {
  /** Entity-category catalog slice (built-in + user), reactive. */
  readonly types: readonly BimFamilyType[];
  /** The entity's resolved family type, or `null` when ad-hoc/untyped. */
  readonly currentType: BimFamilyType | null;
  /** Can the user create/edit types (auth ready)? */
  readonly canWrite: boolean;
  /** Assign a type (or `undefined` to detach to ad-hoc). */
  readonly assignType: (typeId: string | undefined) => void;
  /** Clone the current type to an editable user copy and assign it. */
  readonly duplicateCurrent: (displayName: string) => Promise<string | null>;
}

/** One selectable catalog row (label pre-resolved by the caller). */
export interface FamilyTypeSelectItem {
  readonly id: string;
  readonly label: string;
}

export interface FamilyTypeSelectProps {
  /** Current type id, or `undefined` for the ad-hoc «no type» row. */
  readonly value: string | undefined;
  /** Assign a type id, or `undefined` when «no type» is picked. */
  readonly onAssign: (typeId: string | undefined) => void;
  readonly ariaLabel: string;
  readonly placeholder: string;
  /** Label of the «no type (ad-hoc)» clear row. */
  readonly clearLabel: string;
  readonly items: readonly FamilyTypeSelectItem[];
}

export function FamilyTypeSelect({
  value,
  onAssign,
  ariaLabel,
  placeholder,
  clearLabel,
  items,
}: FamilyTypeSelectProps): React.JSX.Element {
  return (
    <Select
      value={value ?? SELECT_CLEAR_VALUE}
      onValueChange={(v) => onAssign(isSelectClearValue(v) ? undefined : v)}
    >
      <SelectTrigger size="sm" aria-label={ariaLabel}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="w-auto min-w-[11rem]">
        <SelectItem value={SELECT_CLEAR_VALUE} className="whitespace-nowrap">
          {clearLabel}
        </SelectItem>
        {items.map((item) => (
          <SelectItem key={item.id} value={item.id} className="whitespace-nowrap">
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
