'use client';

/**
 * FloorMultiSelectField — Multi-floor selector for multi-level units (ADR-236)
 *
 * Allows selecting multiple floors for maisonettes, penthouses, lofts, etc.
 * Pattern: Follows LinkedSpacesCard (Select + Add → Badges with remove).
 *
 * @module components/shared/FloorMultiSelectField
 * @pattern Radix Select (ADR-001) + Badge list
 * @since ADR-236 — Multi-Level Property Management
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Plus, X, Star } from 'lucide-react';
import { collection, query, where, onSnapshot, type QueryConstraint } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { formatFloorLabel } from '@/lib/intl-utils';
import { useAuth } from '@/auth/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { useIconSizes } from '@/hooks/useIconSizes';
import type { UnitLevel } from '@/types/unit';
import type { FloorOption } from '@/services/multi-level.service';
import { buildLevelsFromSelection } from '@/services/multi-level.service';

// =============================================================================
// TYPES
// =============================================================================

export interface FloorMultiSelectFieldProps {
  /** Building ID to fetch floors for — null/undefined = disabled */
  buildingId: string | null | undefined;
  /** Current levels (from unit data) */
  value: UnitLevel[];
  /** Callback when levels change */
  onChange: (levels: UnitLevel[]) => void;
  /** Field label */
  label: string;
  /** Hint shown when no building is linked */
  noBuildingHint: string;
  /** Disable the field */
  disabled?: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

const NONE_VALUE = '__none__';

export function FloorMultiSelectField({
  buildingId,
  value,
  onChange,
  label,
  noBuildingHint,
  disabled = false,
}: FloorMultiSelectFieldProps) {
  const { t } = useTranslation(['units']);
  const { user } = useAuth();
  const iconSizes = useIconSizes();

  // Floor options from Firestore
  const [allFloors, setAllFloors] = useState<FloorOption[]>([]);
  const [loading, setLoading] = useState(false);

  // Selection state for the dropdown
  const [selectValue, setSelectValue] = useState(NONE_VALUE);

  // Real-time Firestore subscription for floors
  useEffect(() => {
    if (!buildingId || !user) {
      setAllFloors([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const floorsCol = collection(db, COLLECTIONS.FLOORS);
    const constraints: QueryConstraint[] = [
      where('buildingId', '==', buildingId),
    ];

    // ADR-232: Skip companyId filter for super admin
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
              number: num,
              name: (data.name as string) || formatFloorLabel(num),
            };
          })
          .sort((a, b) => a.number - b.number);

        setAllFloors(options);
        setLoading(false);
      },
      () => {
        setAllFloors([]);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [buildingId, user]);

  // Selected floor IDs (from current value)
  const selectedIds = new Set(value.map((l) => l.floorId));

  // Available floors (exclude already selected)
  const availableFloors = allFloors.filter((f) => !selectedIds.has(f.id));

  // Primary floor ID
  const primaryId = value.find((l) => l.isPrimary)?.floorId ?? value[0]?.floorId;

  // ── Add floor handler ──
  const handleAddFloor = useCallback(() => {
    if (selectValue === NONE_VALUE) return;

    const floor = allFloors.find((f) => f.id === selectValue);
    if (!floor) return;

    const isFirst = value.length === 0;
    const selectedFloors: FloorOption[] = [
      ...value.map((l) => ({
        id: l.floorId,
        number: l.floorNumber,
        name: l.name,
      })),
      floor,
    ];

    const newPrimary = isFirst ? floor.id : (primaryId ?? floor.id);
    const newLevels = buildLevelsFromSelection(selectedFloors, newPrimary);
    onChange(newLevels);
    setSelectValue(NONE_VALUE);
  }, [selectValue, allFloors, value, primaryId, onChange]);

  // ── Remove floor handler ──
  const handleRemoveFloor = useCallback(
    (floorId: string) => {
      const remaining = value.filter((l) => l.floorId !== floorId);

      // If we removed the primary, reassign to first remaining
      if (floorId === primaryId && remaining.length > 0) {
        remaining[0] = { ...remaining[0], isPrimary: true };
      }

      onChange(remaining);
    },
    [value, primaryId, onChange]
  );

  // ── Set primary handler ──
  const handleSetPrimary = useCallback(
    (floorId: string) => {
      const updated = value.map((l) => ({
        ...l,
        isPrimary: l.floorId === floorId,
      }));
      onChange(updated);
    },
    [value, onChange]
  );

  const isDisabled = disabled || !buildingId;

  return (
    <fieldset className="space-y-2">
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
        <>
          {/* Dropdown + Add button */}
          {!isDisabled && (
            <section className="flex items-center gap-2">
              <Select
                value={selectValue}
                onValueChange={setSelectValue}
                disabled={isDisabled || availableFloors.length === 0}
              >
                <SelectTrigger className="h-8 text-sm flex-1">
                  <SelectValue
                    placeholder={t('units:multiLevel.addFloor', { defaultValue: 'Προσθήκη ορόφου' })}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>—</SelectItem>
                  {availableFloors.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0 shrink-0"
                disabled={selectValue === NONE_VALUE}
                onClick={handleAddFloor}
                aria-label={t('units:multiLevel.addFloor', { defaultValue: 'Προσθήκη ορόφου' })}
              >
                <Plus className={iconSizes.sm} />
              </Button>
            </section>
          )}

          {/* Selected floors as badges */}
          {value.length > 0 ? (
            <section className="flex flex-wrap gap-1.5" aria-label={t('units:multiLevel.floors', { defaultValue: 'Όροφοι' })}>
              {value.map((level) => (
                <Badge
                  key={level.floorId}
                  variant={level.isPrimary ? 'default' : 'secondary'}
                  className={cn(
                    'flex items-center gap-1 text-xs',
                    !isDisabled && 'cursor-pointer'
                  )}
                  onClick={
                    !isDisabled && !level.isPrimary
                      ? () => handleSetPrimary(level.floorId)
                      : undefined
                  }
                  title={
                    level.isPrimary
                      ? t('units:multiLevel.primaryFloor', { defaultValue: 'Κύριος όροφος' })
                      : t('units:multiLevel.setPrimary', { defaultValue: 'Ορισμός ως κύριος' })
                  }
                >
                  {level.isPrimary && <Star className="h-3 w-3" />}
                  {level.name}
                  {!isDisabled && (
                    <button
                      type="button"
                      className="ml-0.5 hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveFloor(level.floorId);
                      }}
                      aria-label={t('units:multiLevel.removeFloor', { defaultValue: 'Αφαίρεση' })}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </Badge>
              ))}
            </section>
          ) : (
            !isDisabled && (
              <p className="text-xs text-muted-foreground italic">
                {t('units:multiLevel.noFloors', { defaultValue: 'Επιλέξτε τουλάχιστον 2 ορόφους' })}
              </p>
            )
          )}
        </>
      )}
    </fieldset>
  );
}
