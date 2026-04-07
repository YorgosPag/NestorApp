'use client';

/**
 * FloorMultiSelectField — Multi-floor selector for multi-level units (ADR-236)
 *
 * Contiguity rule: a maisonette spans consecutive floors (2→3→4, not 2→3→5).
 * Only the NEXT contiguous floor (above highest level) can be added.
 * If that floor exists in the building → one-click add button.
 * If it doesn't → FloorInlineCreateForm to create it.
 *
 * @module components/shared/FloorMultiSelectField
 * @since ADR-236 — Multi-Level Property Management
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Plus } from 'lucide-react';
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

  // Contiguity: find the next floor above the highest current level
  const nextContiguousFloor = useMemo<FloorOption | null>(() => {
    if (value.length < 2) return null;
    const maxNumber = Math.max(...value.map(l => l.floorNumber));
    const nextNumber = maxNumber + 1;
    return allFloors.find(f => f.number === nextNumber) ?? null;
  }, [value, allFloors]);

  // Does the next contiguous floor need to be CREATED (doesn't exist in building)?
  const needsNewFloor = useMemo(() => {
    if (value.length < 2) return false;
    const maxNumber = Math.max(...value.map(l => l.floorNumber));
    return !allFloors.some(f => f.number === maxNumber + 1);
  }, [value, allFloors]);

  // Add the next contiguous existing floor as a level
  const handleAddNextFloor = useCallback(() => {
    if (!nextContiguousFloor) return;
    const selectedFloors: FloorOption[] = [
      ...value.map(l => ({ id: l.floorId, number: l.floorNumber, name: l.name })),
      nextContiguousFloor,
    ];
    const primary = value[0]?.floorId ?? nextContiguousFloor.id;
    onChange(buildLevelsFromSelection(selectedFloors, primary));
  }, [value, onChange, nextContiguousFloor]);

  // When a new floor is created via inline form, add it as level
  const handleFloorCreated = useCallback((floorId?: string, floorData?: { number: number; name: string }) => {
    setShowCreateForm(false);
    if (!floorId || !floorData) return;
    const newFloor: FloorOption = { id: floorId, number: floorData.number, name: floorData.name };
    const selectedFloors: FloorOption[] = [
      ...value.map(l => ({ id: l.floorId, number: l.floorNumber, name: l.name })),
      newFloor,
    ];
    const primary = value[0]?.floorId ?? floorId;
    onChange(buildLevelsFromSelection(selectedFloors, primary));
  }, [value, onChange]);

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
        <section className="flex flex-wrap gap-2">
          {/* Case A: next contiguous floor EXISTS in building → one-click add */}
          {nextContiguousFloor && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={handleAddNextFloor}
            >
              <Plus className="h-3.5 w-3.5" />
              {t('multiLevel.addExistingFloor')}: {nextContiguousFloor.name}
            </Button>
          )}
          {/* Case B: next contiguous floor DOES NOT exist → create new */}
          {needsNewFloor && (
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
