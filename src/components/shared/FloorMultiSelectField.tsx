'use client';

/**
 * FloorMultiSelectField — Multi-floor selector for multi-level units (ADR-236)
 *
 * SSoT: Uses FloorInlineCreateForm (canonical 3-field form from Buildings→Floors)
 * for creating new floors. Available existing floors shown as quick-add chips.
 *
 * @module components/shared/FloorMultiSelectField
 * @since ADR-236 — Multi-Level Property Management
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  /** Minimum number of levels — hides remove buttons when at minimum */
  minLevels?: number;
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
  minLevels = 0,
}: FloorMultiSelectFieldProps) {
  const { t } = useTranslation(['properties']);
  const { user } = useAuth();
  const colors = useSemanticColors();

  const [allFloors, setAllFloors] = useState<FloorOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const pendingFloorIdRef = useRef<string | null>(null);

  // Real-time Firestore subscription for building floors
  useEffect(() => {
    if (!buildingId || !user) {
      setAllFloors([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const floorsCol = collection(db, COLLECTIONS.FLOORS);
    const constraints: QueryConstraint[] = [where('buildingId', '==', buildingId)];
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

  // Auto-add newly created floor when it appears in subscription
  useEffect(() => {
    if (!pendingFloorIdRef.current) return;
    const found = allFloors.find(f => f.id === pendingFloorIdRef.current);
    if (found) {
      const selectedFloors: FloorOption[] = [
        ...value.map(l => ({ id: l.floorId, number: l.floorNumber, name: l.name })),
        found,
      ];
      const primary = value[0]?.floorId ?? found.id;
      onChange(buildLevelsFromSelection(selectedFloors, primary));
      pendingFloorIdRef.current = null;
    }
  }, [allFloors, value, onChange]);

  const primaryId = value.find((l) => l.isPrimary)?.floorId ?? value[0]?.floorId;
  const isDisabled = disabled || !buildingId;
  const canRemove = !isDisabled && value.length > minLevels;

  const handleRemoveFloor = useCallback((floorId: string) => {
    const remaining = value.filter((l) => l.floorId !== floorId);
    if (floorId === primaryId && remaining.length > 0) {
      remaining[0] = { ...remaining[0], isPrimary: true };
    }
    onChange(remaining);
  }, [value, primaryId, onChange]);

  const handleSetPrimary = useCallback((floorId: string) => {
    onChange(value.map((l) => ({ ...l, isPrimary: l.floorId === floorId })));
  }, [value, onChange]);

  // SSoT: FloorInlineCreateForm callback — auto-add when Firestore updates
  const handleFloorCreated = useCallback((floorId?: string) => {
    if (floorId) pendingFloorIdRef.current = floorId;
    setShowCreateForm(false);
  }, []);

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
      ) : (
        <>
          {/* Selected floors as badges */}
          {value.length > 0 && (
            <section className="flex flex-wrap gap-1.5" aria-label={t('multiLevel.floors')}>
              {value.map((level) => (
                <Badge
                  key={level.floorId}
                  variant={level.isPrimary ? 'default' : 'secondary'}
                  className={cn('flex items-center gap-1 text-xs', !isDisabled && 'cursor-pointer')}
                  onClick={!isDisabled && !level.isPrimary ? () => handleSetPrimary(level.floorId) : undefined}
                  title={level.isPrimary ? t('multiLevel.primaryFloor') : t('multiLevel.setPrimary')}
                >
                  {level.isPrimary && <Star className="h-3 w-3" />}
                  {level.name}
                  {canRemove && (
                    <button
                      type="button"
                      className="ml-0.5 hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); handleRemoveFloor(level.floorId); }}
                      aria-label={t('multiLevel.removeFloor')}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </Badge>
              ))}
            </section>
          )}

          {/* SSoT: FloorInlineCreateForm — only after levels exist (for 3+ floors) */}
          {!isDisabled && value.length >= 2 && (
            <>
              {!showCreateForm ? (
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
              ) : buildingId && (
                <FloorInlineCreateForm
                  buildingId={buildingId}
                  projectId={projectId ?? undefined}
                  onCreated={handleFloorCreated}
                  onCancel={() => setShowCreateForm(false)}
                />
              )}
            </>
          )}
        </>
      )}
    </fieldset>
  );
}
