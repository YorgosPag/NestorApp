'use client';

/**
 * FloorSelectField — Reusable floor dropdown (Radix Select — ADR-001 canonical)
 *
 * Fetches floors for a given buildingId and renders a Radix Select dropdown.
 * When no building is linked, shows a disabled state with a hint.
 *
 * @module components/shared/FloorSelectField
 */

import React, { useState, useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { formatFloorLabel } from '@/lib/intl-utils';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

interface FloorOption {
  /** Floor number as string (value for Select) */
  value: string;
  /** Human-readable label */
  label: string;
}

interface FloorDocument {
  id: string;
  number: number;
  name?: string;
}

interface FloorsAPIResponse {
  success: boolean;
  floors: FloorDocument[];
}

export interface FloorSelectFieldProps {
  /** Building ID to fetch floors for — null/undefined = disabled */
  buildingId: string | null | undefined;
  /** Current floor value (string representation of floor number) */
  value: string;
  /** Callback when floor selection changes */
  onChange: (floorValue: string) => void;
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
  label,
  noBuildingHint,
  placeholder = '—',
  disabled = false,
}: FloorSelectFieldProps) {
  const iconSizes = useIconSizes();
  const [floors, setFloors] = useState<FloorOption[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch floors when buildingId changes
  useEffect(() => {
    if (!buildingId) {
      setFloors([]);
      return;
    }

    let cancelled = false;
    const fetchFloors = async () => {
      setLoading(true);
      try {
        const data = await apiClient.get<FloorsAPIResponse>(
          `/api/floors?buildingId=${encodeURIComponent(buildingId)}`
        );
        if (!cancelled && data?.floors) {
          const options: FloorOption[] = data.floors.map((f) => ({
            value: String(f.number),
            label: f.name || formatFloorLabel(f.number),
          }));
          setFloors(options);
        }
      } catch {
        if (!cancelled) setFloors([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchFloors();
    return () => { cancelled = true; };
  }, [buildingId]);

  const isDisabled = disabled || !buildingId;
  const selectValue = value || NONE_VALUE;

  return (
    <fieldset className="space-y-1.5">
      <Label className="text-muted-foreground text-xs">{label}</Label>

      {!buildingId ? (
        <p className="text-xs text-muted-foreground italic h-8 flex items-center">
          {noBuildingHint}
        </p>
      ) : loading ? (
        <section className="flex items-center gap-2 text-muted-foreground h-8">
          <Loader2 className={cn(iconSizes.sm, 'animate-spin')} />
        </section>
      ) : (
        <Select
          value={selectValue}
          onValueChange={(v) => onChange(v === NONE_VALUE ? '' : v)}
          disabled={isDisabled}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE_VALUE}>—</SelectItem>
            {floors.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </fieldset>
  );
}
