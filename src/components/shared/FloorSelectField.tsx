'use client';

/**
 * FloorSelectField / FloorSelect — ο ΕΝΑΣ επιλογέας ορόφου (Radix Select — ADR-001 canonical)
 *
 * ADR-903 §6 — όπως το Revit `LevelId`: η τιμή είναι **πάντα** το `floorId` (η αυθεντία). Ο αριθμός
 * και το είδος του ορόφου **δεν** επιλέγονται — παράγονται από το έγγραφο ορόφου (εδώ για την
 * οθόνη, στον server για την αποθήκευση).
 *
 * Δεδομένα: η **κοινή** realtime συνδρομή `useFloorsByBuilding` (μία ανά κτίριο, ADR-329/399) —
 * ίδια πηγή με κάθε άλλο σημείο που δείχνει ορόφους, και ο νέος όροφος εμφανίζεται αμέσως.
 * Ετικέτα: `floorOptionLabel` (όνομα ορόφου, αλλιώς `useFloorLabel`).
 *
 * - `FloorSelect` — σκέτος επιλογέας (κελί πίνακα, inline φόρμα).
 * - `FloorSelectField` — ο ίδιος, με ετικέτα και υπόδειξη «χωρίς κτίριο» (κάρτες, φόρμες).
 *
 * @module components/shared/FloorSelectField
 */

import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useFloorLabel, type FloorLabelInput } from '@/hooks/useFloorLabel';
import { useFloorsByBuilding, type FloorOption } from '@/components/properties/shared/useFloorsByBuilding';
import { floorOptionLabel } from '@/components/properties/shared/floor-option-label';
import type { FloorKind } from '@/utils/floor-naming';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import '@/lib/design-system';

// =============================================================================
// TYPES
// =============================================================================

/** Ό,τι επιλέχθηκε — `floorId` είναι η αυθεντία· αριθμός/είδος για **αισιόδοξη** προβολή μόνο. */
export interface FloorSelection {
  readonly floorId: string;
  readonly floor: number;
  readonly floorKind: FloorKind | null;
}

export interface FloorSelectProps {
  /** Building ID to list floors for — null/undefined = disabled */
  buildingId: string | null | undefined;
  /** Current floor document ID (`''` = none) */
  value: string;
  /** The new selection, or `null` when cleared. */
  onChange: (selection: FloorSelection | null) => void;
  /**
   * Async guard called BEFORE committing a floor change.
   * Receives the floor number about to be set. Return `true` to allow,
   * `false` to cancel (e.g. user dismissed a warning dialog).
   */
  onBeforeChange?: (floor: number) => Promise<boolean>;
  /** Placeholder for the select */
  placeholder?: string;
  /** Disable the field (e.g. not in edit mode) */
  disabled?: boolean;
  /**
   * Παλιό έγγραφο πριν τη μετανάστευση (ADR-903 §6): όροφος χωρίς `floorId` («Υπόγειο -1»).
   * Δείχνεται ως ανενεργή επιλογή μέχρι ο άνθρωπος να διαλέξει πραγματικό όροφο.
   */
  fallbackFloor?: FloorLabelInput;
  /** Trigger sizing for dense contexts (table cells). */
  triggerClassName?: string;
}

export interface FloorSelectFieldProps extends FloorSelectProps {
  /** Field label */
  label: string;
  /** Hint shown when no building is linked */
  noBuildingHint: string;
}

// =============================================================================
// COMPONENTS
// =============================================================================

const NONE_VALUE = '__none__';
const FALLBACK_VALUE = '__fallback__';

function selectionOf(floor: FloorOption): FloorSelection {
  return { floorId: floor.id, floor: floor.number, floorKind: floor.kind ?? null };
}

/** Ο σκέτος επιλογέας — φόρτωση, κενό, σφάλμα και λίστα από την κοινή συνδρομή. */
export function FloorSelect({
  buildingId,
  value,
  onChange,
  onBeforeChange,
  placeholder = '—',
  disabled = false,
  fallbackFloor,
  triggerClassName,
}: FloorSelectProps) {
  const colors = useSemanticColors();
  const { t } = useTranslation('floors');
  const floorLabel = useFloorLabel();
  const { floors, loading, error } = useFloorsByBuilding(buildingId);

  const matched = value ? floors.find((f) => f.id === value) ?? null : null;
  const fallbackLabel = !matched && !loading ? floorLabel(fallbackFloor) || null : null;
  const selectValue = matched ? matched.id : fallbackLabel ? FALLBACK_VALUE : NONE_VALUE;

  const handleValueChange = async (v: string) => {
    if (v === NONE_VALUE || v === FALLBACK_VALUE) {
      onChange(null);
      return;
    }
    const selected = floors.find((f) => f.id === v);
    if (!selected) return;
    // Guard: let consumer veto the change (e.g. "basement for apartment?" warning)
    if (onBeforeChange && !(await onBeforeChange(selected.number))) return;
    onChange(selectionOf(selected));
  };

  if (loading) {
    return (
      <span className={cn('flex items-center gap-2 h-8', colors.text.muted)}>
        <Spinner size="small" />
      </span>
    );
  }
  if (buildingId && (error || floors.length === 0)) {
    return (
      <p role={error ? 'alert' : undefined} className={cn('text-xs italic h-8 flex items-center', error ? colors.text.error : colors.text.muted)}>
        {t(error ? 'picker.loadError' : 'picker.empty')}
      </p>
    );
  }
  return (
    <Select value={selectValue} onValueChange={handleValueChange} disabled={disabled || !buildingId}>
      <SelectTrigger size="sm" className={triggerClassName}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE_VALUE}>—</SelectItem>
        {fallbackLabel && (
          <SelectItem value={FALLBACK_VALUE} disabled>
            {fallbackLabel}
          </SelectItem>
        )}
        {floors.map((f) => (
          <SelectItem key={f.id} value={f.id}>
            {floorOptionLabel(f, floorLabel)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Ο επιλογέας με ετικέτα — χωρίς κτίριο δείχνει την υπόδειξη αντί για ανενεργό πεδίο. */
export function FloorSelectField({ label, noBuildingHint, ...selectProps }: FloorSelectFieldProps) {
  const colors = useSemanticColors();
  return (
    <fieldset className="space-y-1.5">
      <Label className={cn('text-xs', colors.text.muted)}>{label}</Label>
      {selectProps.buildingId ? (
        <FloorSelect {...selectProps} />
      ) : (
        <p className={cn('text-xs italic h-8 flex items-center', colors.text.muted)}>{noBuildingHint}</p>
      )}
    </fieldset>
  );
}
