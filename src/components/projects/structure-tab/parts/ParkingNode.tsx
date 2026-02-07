'use client';

/**
 * 🏢 ENTERPRISE: Parking Node Component
 *
 * Displays a parking spot in the project structure.
 * Uses centralized NAVIGATION_ENTITIES for icons/colors.
 *
 * @module components/projects/structure-tab/parts/ParkingNode
 */

import React from 'react';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config/navigation-entities';
import { cn } from '@/lib/utils';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useTypography } from '@/hooks/useTypography';
import { useIconSizes } from '@/hooks/useIconSizes';
import { HOVER_BACKGROUND_EFFECTS, TRANSITION_PRESETS } from '@/components/ui/effects';
import type { ParkingModel } from '../types';
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface ParkingNodeProps {
  parking: ParkingModel;
}

export const ParkingNode = ({ parking }: ParkingNodeProps) => {
  const { t } = useTranslation('projects');
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();
  const spacing = useSpacingTokens();
  const typography = useTypography();
  const iconSizes = useIconSizes();

  // Status badge color
  const statusColors: Record<string, string> = {
    available: colors.text.success,
    sold: colors.text.error,
    reserved: colors.text.warning,
    owner: colors.text.info
  };

  const statusLabels: Record<string, string> = {
    available: t('status.available', 'Διαθέσιμη'),
    sold: t('status.sold', 'Πωλημένη'),
    reserved: t('status.reserved', 'Κρατημένη'),
    owner: t('status.owner', 'Ιδιοκτήτη')
  };

  // Type labels
  const typeLabels: Record<string, string> = {
    underground: t('parking.types.underground', 'Υπόγεια'),
    covered: t('parking.types.covered', 'Καλυμμένη'),
    open: t('parking.types.open', 'Ανοιχτή')
  };

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-2 rounded-md',
        quick.card,
        colors.bg.primary,
        HOVER_BACKGROUND_EFFECTS.LIGHT,
        TRANSITION_PRESETS.STANDARD_COLORS
      )}
    >
      <NAVIGATION_ENTITIES.parking.icon
        className={cn(iconSizes.sm, NAVIGATION_ENTITIES.parking.color)}
      />
      <div className="flex-1 min-w-0">
        <div className={cn(typography.label.sm, colors.text.foreground, "truncate")}>
          {t('structure.parkingSpot', 'Θέση')} {parking.code}
        </div>
        <div className={cn(typography.body.xs, colors.text.muted)}>
          {parking.type && <span>{typeLabels[parking.type] || parking.type}</span>}
          {parking.level && <span> • {t('structure.level', 'Επίπεδο')}: {parking.level}</span>}
          {parking.area && <span> • {parking.area} m²</span>}
        </div>
      </div>
      {parking.status && (
        <span className={cn(typography.label.xs, statusColors[parking.status] || colors.text.muted)}>
          {statusLabels[parking.status] || parking.status}
        </span>
      )}
    </div>
  );
};
