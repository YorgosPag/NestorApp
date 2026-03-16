'use client';

/**
 * MultiLevelNavigation — Displays and manages floors for multi-level units (ADR-236)
 *
 * Shows existing levels with navigation + optional FloorMultiSelectField for editing.
 * Compact design with 8px spacing to match application standard.
 *
 * @module components/property-viewer/details/MultiLevelNavigation
 * @since ADR-236 — Multi-Level Property Management
 */

import React, { useState } from 'react';
import { ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { Property } from '@/types/property-viewer';
import type { UnitLevel } from '@/types/unit';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useTypography } from '@/hooks/useTypography';
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
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();
  const spacing = useSpacingTokens();
  const typography = useTypography();
  const { t } = useTranslation(['properties', 'units']);

  const levels = property.levels;
  const hasLevels = levels && levels.length > 0;

  // Track which floor the user clicked — defaults to primary floor or first level
  const [selectedFloorId, setSelectedFloorId] = useState<string | null>(
    currentFloorId ?? (hasLevels ? levels[0].floorId : null)
  );

  const handleSelectFloor = (floorId: string) => {
    setSelectedFloorId(floorId);
    onSelectFloor(floorId);
  };

  return (
    <Card className={cn(quick.card, colors.bg.card)}>
      <CardHeader className="!p-2 flex flex-col space-y-2">
        <CardTitle className={cn('flex items-center', spacing.gap.sm, typography.card.titleCompact)}>
          <ChevronsUpDown className={cn(iconSizes.md, 'text-emerald-500')} />
          {t('properties:multiLevel.title', { defaultValue: 'Επίπεδα Ακινήτου' })}
        </CardTitle>
      </CardHeader>
      <CardContent className="!p-2 !pt-0">
        {/* Existing levels — compact rows with 8px gaps */}
        {hasLevels && (
          <nav className="flex flex-col gap-2">
            {levels.map((level) => (
              <article
                key={level.floorId}
                className={cn(
                  'px-2 py-1.5 rounded-lg flex items-center justify-between transition-colors cursor-pointer',
                  selectedFloorId === level.floorId ? colors.bg.info : colors.bg.secondary,
                )}
                onClick={() => handleSelectFloor(level.floorId)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSelectFloor(level.floorId); }}
              >
                <span className="text-xs font-medium">{level.name}</span>
                <Button
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={(e) => { e.stopPropagation(); handleSelectFloor(level.floorId); }}
                >
                  {t('properties:multiLevel.goTo', { defaultValue: 'Μετάβαση' })}
                </Button>
              </article>
            ))}
          </nav>
        )}

        {/* Edit mode — add/remove floors */}
        {isEditing && onLevelsChange && (
          <div className={hasLevels ? 'mt-2' : ''}>
            <FloorMultiSelectField
              buildingId={buildingId ?? null}
              value={levels ?? []}
              onChange={onLevelsChange}
              label={t('units:multiLevel.floors', { defaultValue: 'Όροφοι' })}
              noBuildingHint={t('units:fields.location.noFloorHint', { defaultValue: 'Συνδέστε πρώτα κτίριο' })}
              disabled={false}
            />
          </div>
        )}

        {/* No levels yet — show hint */}
        {!hasLevels && !isEditing && (
          <p className="text-xs text-muted-foreground italic">
            {t('units:multiLevel.noFloors', { defaultValue: 'Επιλέξτε τουλάχιστον 2 ορόφους' })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
