'use client';

/**
 * 🏢 ENTERPRISE: Storage Node Component
 *
 * Displays a storage unit in the project structure.
 * Uses centralized NAVIGATION_ENTITIES for icons/colors.
 *
 * @module components/projects/structure-tab/parts/StorageNode
 */

import React from 'react';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config/navigation-entities';
import { cn } from '@/lib/utils';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { HOVER_BACKGROUND_EFFECTS, TRANSITION_PRESETS } from '@/components/ui/effects';
import type { StorageModel } from '../types';
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface StorageNodeProps {
  storage: StorageModel;
}

export const StorageNode = ({ storage }: StorageNodeProps) => {
  const { t } = useTranslation('projects');
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();

  // Status badge color
  const statusColors: Record<string, string> = {
    available: colors.text.success,
    sold: colors.text.error,
    reserved: colors.text.warning,
    occupied: colors.text.info,
    maintenance: colors.text.muted
  };

  const statusLabels: Record<string, string> = {
    available: t('status.available', 'Διαθέσιμη'),
    sold: t('status.sold', 'Πωλημένη'),
    reserved: t('status.reserved', 'Κρατημένη'),
    occupied: t('status.occupied', 'Κατειλημμένη'),
    maintenance: t('status.maintenance', 'Συντήρηση')
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
      <NAVIGATION_ENTITIES.storage.icon
        size={16}
        className={NAVIGATION_ENTITIES.storage.color}
      />
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium ${colors.text.foreground} truncate`}>
          {storage.name}
        </div>
        <div className={`text-xs ${colors.text.muted}`}>
          {storage.type && <span className="capitalize">{storage.type}</span>}
          {storage.floor && <span> • {t('structure.floor', 'Όροφος')}: {storage.floor}</span>}
          {storage.area && <span> • {storage.area} m²</span>}
        </div>
      </div>
      {storage.status && (
        <span className={`text-xs font-medium ${statusColors[storage.status] || colors.text.muted}`}>
          {statusLabels[storage.status] || storage.status}
        </span>
      )}
    </div>
  );
};
