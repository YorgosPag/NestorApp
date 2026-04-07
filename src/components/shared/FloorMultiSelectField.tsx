'use client';

/**
 * FloorMultiSelectField — Multi-floor selector for multi-level units (ADR-236)
 *
 * Contiguity rule: a maisonette spans consecutive floors (1→2→3, not 1→3→5).
 * Expansion allowed in BOTH directions:
 *   - UP:   floor with number = max(current) + 1
 *   - DOWN: floor with number = min(current) - 1
 * If the adjacent floor exists → "Add existing floor" button.
 * If not → "Create new floor" (does NOT auto-add as level; user must
 * then click the contiguous add button once the floor appears).
 *
 * @module components/shared/FloorMultiSelectField
 * @since ADR-236 — Multi-Level Property Management
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { ChevronUp, ChevronDown, Plus } from 'lucide-react';
import { collection, query, where, onSnapshot, type QueryConstraint } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { formatFloorLabel } from '@/lib/intl-utils';
import { useAuth } from '@/auth/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { PropertyLevel } from '@/types/property';
import type { FloorOption } from '@/services/multi-level.service';
import { buildLevelsFromSelection } from '@/services/multi-level.service';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { FloorInlineCreateForm } from '@/components/building-management/tabs/FloorInlineCreateForm';

// =============================================================================
// TYPES
// =============================================================================

export interface FloorMultiSelectFieldProps {
  buildingId: string | null | undefined;
  projectId?: string | null;
  value: PropertyLevel[];
  onChange: (levels: PropertyLevel[]) => void;
  label: string;
  noBuildingHint: string;
  disabled?: boolean;
  initiallyOpen?: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function FloorMultiSelectField({
  buildingId,
  projectId,
  value,
  onChange,
  label,
  noBuildingHint,
  disabled = false,
  initiallyOpen = false,
}: FloorMultiSelectFieldProps) {
  const { t } = useTranslation(['properties']);
  const { user } = useAuth();
  const colors = useSemanticColors();

  const [allFloors, setAllFloors] = useState<FloorOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(initiallyOpen);

  useEffect(() => { if (initiallyOpen) setShowCreateForm(true); }, [initiallyOpen]);

  // Real-time Firestore subscription for building floors
  useEffect(() => {
    if (!buildingId || !user) { setAllFloors([]); setLoading(false); return; }
    setLoading(true);
    const floorsCol = collection(db, COLLECTIONS.FLOORS);
    const constraints: QueryConstraint[] = [where('buildingId', '==', buildingId)];
    const isSuperAdmin = user.globalRole === 'super_admin';
    if (!isSuperAdmin && user.companyId) {
      constraints.push(where('companyId', '==', user.companyId));
    }
    const unsubscribe = onSnapshot(
      query(floorsCol, ...constraints),
      (snapshot) => {
        const options: FloorOption[] = snapshot.docs
          .map((doc) => {
            const data = doc.data();
            const num = typeof data.number === 'number' ? data.number : 0;
            return { id: doc.id, number: num, name: (data.name as string) || formatFloorLabel(num) };
          })
          .sort((a, b) => a.number - b.number);
        setAllFloors(options);
        setLoading(false);
      },
      () => { setAllFloors([]); setLoading(false); }
    );
    return () => unsubscribe();
  }, [buildingId, user]);

  const isDisabled = disabled || !buildingId;
  const existingFloorNumbers = useMemo(() => new Set(allFloors.map(f => f.number)), [allFloors]);

  // Contiguity: find adjacent floors (UP = max+1, DOWN = min-1)
  const { floorAbove, floorBelow, canCreateAbove, canCreateBelow } = useMemo(() => {
    if (value.length < 2) return { floorAbove: null, floorBelow: null, canCreateAbove: false, canCreateBelow: false };
    const numbers = value.map(l => l.floorNumber);
    const maxNum = Math.max(...numbers);
    const minNum = Math.min(...numbers);
    const above = allFloors.find(f => f.number === maxNum + 1) ?? null;
    const below = allFloors.find(f => f.number === minNum - 1) ?? null;
    return {
      floorAbove: above,
      floorBelow: below,
      canCreateAbove: !above,  // next floor up doesn't exist → can create
      canCreateBelow: !below,  // next floor down doesn't exist → can create
    };
  }, [value, allFloors]);

  // Add an existing adjacent floor as a level
  const handleAddFloor = useCallback((floor: FloorOption) => {
    const selectedFloors: FloorOption[] = [
      ...value.map(l => ({ id: l.floorId, number: l.floorNumber, name: l.name })),
      floor,
    ];
    const primary = value[0]?.floorId ?? floor.id;
    onChange(buildLevelsFromSelection(selectedFloors, primary));
  }, [value, onChange]);

  // Floor created via inline form — do NOT auto-add as level.
  // The new floor will appear in allFloors via subscription,
  // then the contiguous "add" button will show it.
  const handleFloorCreated = useCallback(() => {
    setShowCreateForm(false);
  }, []);

  const hasAdjacentExisting = !!floorAbove || !!floorBelow;
  const hasAdjacentMissing = canCreateAbove || canCreateBelow;

  return (
    <fieldset className="space-y-2">
      <Label className={cn("text-xs", colors.text.muted)}>{label}</Label>

      {!buildingId ? (
        <p className={cn("text-xs italic h-8 flex items-center", colors.text.muted)}>
          {noBuildingHint}
        </p>
      ) : loading ? (
        <section className={cn("flex items-center gap-2 h-8", colors.text.muted)}>
          <Spinner size="small" />
        </section>
      ) : showCreateForm && !isDisabled && buildingId ? (
        <FloorInlineCreateForm
          buildingId={buildingId}
          projectId={projectId ?? undefined}
          onCreated={handleFloorCreated}
          onCancel={() => setShowCreateForm(false)}
          existingFloorNumbers={existingFloorNumbers}
        />
      ) : !isDisabled && value.length >= 2 ? (
        <section className="flex flex-col gap-1.5">
          {/* Add existing adjacent floors (UP and/or DOWN) */}
          {hasAdjacentExisting && (
            <section className="flex gap-1.5">
              {floorBelow && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1 flex-1"
                  onClick={() => handleAddFloor(floorBelow)}
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                  {floorBelow.name}
                </Button>
              )}
              {floorAbove && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1 flex-1"
                  onClick={() => handleAddFloor(floorAbove)}
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                  {floorAbove.name}
                </Button>
              )}
            </section>
          )}
          {/* Create new floor — only when adjacent floor doesn't exist */}
          {hasAdjacentMissing && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => setShowCreateForm(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              {t('multiLevel.createFloor')}
            </Button>
          )}
        </section>
      ) : null}
    </fieldset>
  );
}
