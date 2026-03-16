'use client';

/**
 * MultiLevelNavigation — Displays and manages floors for multi-level units (ADR-236)
 *
 * Shows existing levels with navigation + optional FloorMultiSelectField for editing.
 * Renders with rounded corners (enterprise design tokens).
 *
 * @module components/property-viewer/details/MultiLevelNavigation
 * @since ADR-236 — Multi-Level Property Management
 */

import React from 'react';
import { ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Property } from '@/types/property-viewer';
import type { UnitLevel } from '@/types/unit';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { FloorMultiSelectField } from '@/components/shared/FloorMultiSelectField';

interface MultiLevelNavigationProps {
  property: Property;
  onSelectFloor: (floorId: string | null) => void;
  currentFloorId: string | null;
  /** Enable floor editing (add/remove floors) */
  isEditing?: boolean;
  /** Building ID for floor subscription */
  buildingId?: string | null;
  /** Callback when levels change (edit mode) */
  onLevelsChange?: (levels: UnitLevel[]) => void;
}

export function MultiLevelNavigation({
  property,
  onSelectFloor,
  currentFloorId,
  isEditing = false,
  buildingId,
  onLevelsChange,
}: MultiLevelNavigationProps) {
  const iconSizes = useIconSizes();
  const { getStatusBorder, radius } = useBorderTokens();
  const colors = useSemanticColors();
  const { t } = useTranslation(['properties', 'units']);

  const levels = property.levels;
  const hasLevels = levels && levels.length > 0;

  return (
    <section
      className={cn(
        'p-3 space-y-2 rounded-xl border',
        colors.bg.info,
        getStatusBorder('info'),
      )}
    >
      <h4 className={cn('text-xs font-semibold flex items-center gap-2', colors.text.info)}>
        <ChevronsUpDown className={iconSizes.sm} />
        {t('properties:multiLevel.title', { defaultValue: 'Επίπεδα Ακινήτου' })}
      </h4>

      {/* Existing levels — navigation buttons */}
      {hasLevels && levels.map((level) => (
        <article
          key={level.floorId}
          className={cn(
            'p-2 rounded-lg flex items-center justify-between transition-colors',
            currentFloorId === level.floorId ? colors.bg.info : colors.bg.secondary,
          )}
        >
          <span className="text-sm font-medium">{level.name}</span>
          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={() => onSelectFloor(level.floorId)}
          >
            {t('properties:multiLevel.goTo', { defaultValue: 'Μετάβαση' })}
          </Button>
        </article>
      ))}

      {/* Edit mode — add/remove floors */}
      {isEditing && onLevelsChange && (
        <FloorMultiSelectField
          buildingId={buildingId ?? null}
          value={levels ?? []}
          onChange={onLevelsChange}
          label={t('units:multiLevel.floors', { defaultValue: 'Όροφοι' })}
          noBuildingHint={t('units:fields.location.noFloorHint', { defaultValue: 'Συνδέστε πρώτα κτίριο' })}
          disabled={false}
        />
      )}

      {/* No levels yet — show hint */}
      {!hasLevels && !isEditing && (
        <p className="text-xs text-muted-foreground italic">
          {t('units:multiLevel.noFloors', { defaultValue: 'Επιλέξτε τουλάχιστον 2 ορόφους' })}
        </p>
      )}
    </section>
  );
}
