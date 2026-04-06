'use client';

/**
 * FloorSelectField — Reusable floor dropdown (Radix Select — ADR-001 canonical)
 *
 * Loads floors via API (Admin SDK) — consistent with every other entity in the app.
 * When no building is linked, shows a disabled state with a hint.
 *
 * @module components/shared/FloorSelectField
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { formatFloorLabel } from '@/lib/intl-utils';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import '@/lib/design-system';

// =============================================================================
// TYPES
// =============================================================================

interface FloorOption {
  /** Floor document ID (Firestore doc ID) */
  id: string;
  /** Floor number as string (value for Select) */
  value: string;
  /** Human-readable label */
  label: string;
}

export interface FloorChangePayload {
  /** Floor number (persisted on unit document) */
  floor: number;
  /** Floor document ID (foreign key on unit document) */
  floorId: string;
}

interface FloorsApiResponse {
  floors: Array<{
    id: string;
    number: number;
    name?: string;
    buildingId: string;
    [key: string]: unknown;
  }>;
}

export interface FloorSelectFieldProps {
  /** Building ID to fetch floors for — null/undefined = disabled */
  buildingId: string | null | undefined;
  /** Current floor document ID (Firestore doc ID) */
  value: string;
  /** Callback when floor selection changes — returns both floor number and floorId */
  onChange: (floorValue: string, payload?: FloorChangePayload) => void;
  /**
   * Async guard called BEFORE committing a floor change.
   * Receives the floor number about to be set. Return `true` to allow,
   * `false` to cancel (e.g. user dismissed a warning dialog).
   */
  onBeforeChange?: (floor: number) => Promise<boolean>;
  /** Field label */
  label: string;
  /** Hint shown when no building is linked */
  noBuildingHint: string;
  /** Placeholder for the select */
  placeholder?: string;
  /** Disable the field (e.g. not in edit mode) */
  disabled?: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

const NONE_VALUE = '__none__';

export function FloorSelectField({
  buildingId,
  value,
  onChange,
  onBeforeChange,
  label,
  noBuildingHint,
  placeholder = '—',
  disabled = false,
}: FloorSelectFieldProps) {
  const colors = useSemanticColors();
  const [floors, setFloors] = useState<FloorOption[]>([]);
  const [loading, setLoading] = useState(false);

  // Keep floors ref for lookup in onChange
  const floorsRef = useRef<FloorOption[]>([]);
  floorsRef.current = floors;

  // 🏢 GOOGLE-LEVEL: Load floors via API (Admin SDK) — same pattern as every other entity.
  // No client-side Firestore dependency. Works regardless of security rules.
  const loadFloors = useCallback(async (bId: string) => {
    setLoading(true);
    try {
      const result = await apiClient.get<FloorsApiResponse>(`${API_ROUTES.FLOORS.LIST}?buildingId=${bId}`);
      const options: FloorOption[] = (result?.floors ?? [])
        .map((f) => ({
          id: f.id,
          value: String(typeof f.number === 'number' ? f.number : 0),
          label: f.name || formatFloorLabel(typeof f.number === 'number' ? f.number : 0),
        }))
        .sort((a, b) => Number(a.value) - Number(b.value));

      setFloors(options);
    } catch {
      setFloors([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!buildingId) {
      setFloors([]);
      return;
    }
    loadFloors(buildingId);
  }, [buildingId, loadFloors]);

  const isDisabled = disabled || !buildingId;
  const selectValue = value || NONE_VALUE;

  const handleValueChange = async (v: string) => {
    if (v === NONE_VALUE) {
      onChange('');
      return;
    }

    // v = floor doc ID (since SelectItem value={f.id})
    const selectedFloor = floorsRef.current.find((f) => f.id === v);
    if (!selectedFloor) return;

    const floorNumber = Number(selectedFloor.value);

    // Guard: let consumer veto the change (e.g. "basement for apartment?" warning)
    if (onBeforeChange) {
      const allowed = await onBeforeChange(floorNumber);
      if (!allowed) return;
    }

    onChange(selectedFloor.value, {
      floor: floorNumber,
      floorId: v,
    });
  };

  return (
    <fieldset className="space-y-1.5">
      <Label className={cn("text-xs", colors.text.muted)}>{label}</Label>

      {!buildingId ? (
        <p className={cn("text-xs italic h-8 flex items-center", colors.text.muted)}>
          {noBuildingHint}
        </p>
      ) : loading ? (
        <section className={cn("flex items-center gap-2 h-8", colors.text.muted)}>
          <Spinner size="small" />
        </section>
      ) : (
        <Select
          value={selectValue}
          onValueChange={handleValueChange}
          disabled={isDisabled}
        >
          <SelectTrigger size="sm">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE_VALUE}>—</SelectItem>
            {floors.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </fieldset>
  );
}
