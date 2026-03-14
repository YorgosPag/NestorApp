'use client';

/**
 * FloorSelectField — Reusable floor dropdown (Radix Select — ADR-001 canonical)
 *
 * Real-time Firestore subscription for floors of a given buildingId.
 * When no building is linked, shows a disabled state with a hint.
 *
 * @module components/shared/FloorSelectField
 * @pattern onSnapshot — same as useContactEmailWatch, useRealtimeBuildings
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { collection, query, where, onSnapshot, type QueryConstraint } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { formatFloorLabel } from '@/lib/intl-utils';
import { cn } from '@/lib/utils';
import { useAuth } from '@/auth/contexts/AuthContext';

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

export interface FloorSelectFieldProps {
  /** Building ID to fetch floors for — null/undefined = disabled */
  buildingId: string | null | undefined;
  /** Current floor document ID (Firestore doc ID) */
  value: string;
  /** Callback when floor selection changes — returns both floor number and floorId */
  onChange: (floorValue: string, payload?: FloorChangePayload) => void;
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
  const [floors, setFloors] = useState<FloorOption[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  // Keep floors ref for lookup in onChange
  const floorsRef = useRef<FloorOption[]>([]);
  floorsRef.current = floors;

  // Real-time Firestore subscription for floors
  useEffect(() => {
    if (!buildingId || !user) {
      setFloors([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const floorsCol = collection(db, COLLECTIONS.FLOORS);
    const constraints: QueryConstraint[] = [
      where('buildingId', '==', buildingId),
    ];

    // 🏢 ADR-232: Skip companyId filter for super admin (entities may have null companyId)
    const isSuperAdmin = user.globalRole === 'super_admin';
    if (!isSuperAdmin && user.companyId) {
      constraints.push(where('companyId', '==', user.companyId));
    }

    const q = query(floorsCol, ...constraints);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const options: FloorOption[] = snapshot.docs
          .map((doc) => {
            const data = doc.data();
            const num = typeof data.number === 'number' ? data.number : 0;
            return {
              id: doc.id,
              value: String(num),
              label: (data.name as string) || formatFloorLabel(num),
            };
          })
          .sort((a, b) => Number(a.value) - Number(b.value));

        setFloors(options);
        setLoading(false);
      },
      () => {
        // On error, clear floors (non-blocking)
        setFloors([]);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [buildingId, user]);

  const isDisabled = disabled || !buildingId;
  const selectValue = value || NONE_VALUE;

  const handleValueChange = (v: string) => {
    if (v === NONE_VALUE) {
      onChange('');
      return;
    }

    // v = floor doc ID (since SelectItem value={f.id})
    // Find the floor option to get the floor number for display
    const selectedFloor = floorsRef.current.find((f) => f.id === v);
    if (selectedFloor) {
      onChange(selectedFloor.value, {
        floor: Number(selectedFloor.value),
        floorId: v,
      });
    }
  };

  return (
    <fieldset className="space-y-1.5">
      <Label className="text-muted-foreground text-xs">{label}</Label>

      {!buildingId ? (
        <p className="text-xs text-muted-foreground italic h-8 flex items-center">
          {noBuildingHint}
        </p>
      ) : loading ? (
        <section className="flex items-center gap-2 text-muted-foreground h-8">
          <Spinner size="small" />
        </section>
      ) : (
        <Select
          value={selectValue}
          onValueChange={handleValueChange}
          disabled={isDisabled}
        >
          <SelectTrigger className="h-8 text-sm">
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
