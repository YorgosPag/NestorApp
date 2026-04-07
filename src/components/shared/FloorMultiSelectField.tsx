'use client';

/**
 * FloorMultiSelectField — Multi-floor selector for multi-level units (ADR-236)
 *
 * Shows quick-add chips for existing building floors (not yet selected),
 * plus FloorInlineCreateForm for creating new floors when needed.
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
  /** Building ID to fetch floors for — null/undefined = disabled */
  buildingId: string | null | undefined;
  /** Project ID for FloorInlineCreateForm (server policy) */
  projectId?: string | null;
  /** Current levels (from unit data) */
  value: PropertyLevel[];
  /** Callback when levels change */
  onChange: (levels: PropertyLevel[]) => void;
  /** Field label */
  label: string;
  /** Hint shown when no building is linked */
  noBuildingHint: string;
  /** Disable the field */
  disabled?: boolean;
  /** Open the create form immediately (e.g. after "no next floor" warning) */
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

  // Sync initiallyOpen prop → show create form
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

  // Available floors = building floors NOT already selected as levels
  const selectedFloorIds = useMemo(() => new Set(value.map(l => l.floorId)), [value]);
  const availableFloors = useMemo(
    () => allFloors.filter(f => !selectedFloorIds.has(f.id)),
    [allFloors, selectedFloorIds],
  );

  // Quick-add an existing floor as a new level
  const handleQuickAdd = useCallback((floor: FloorOption) => {
    const selectedFloors: FloorOption[] = [
      ...value.map(l => ({ id: l.floorId, number: l.floorNumber, name: l.name })),
      floor,
    ];
    const primary = value[0]?.floorId ?? floor.id;
    onChange(buildLevelsFromSelection(selectedFloors, primary));
  }, [value, onChange]);

  // Direct add: when floor is created via inline form
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
        <section className="space-y-2">
          {/* Quick-add chips for existing unselected floors */}
          {availableFloors.length > 0 && (
            <section className="flex flex-wrap gap-1">
              {availableFloors.map((f) => (
                <Button
                  key={f.id}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-xs gap-1"
                  onClick={() => handleQuickAdd(f)}
                >
                  <Plus className="h-3 w-3" />
                  {f.name}
                </Button>
              ))}
            </section>
          )}
          {/* Create new floor — secondary action */}
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
        </section>
      ) : null}
    </fieldset>
  );
}
