'use client';

import React from 'react';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import '@/lib/design-system';

const connectionTypeColors = {
  sameBuilding: 'bg-blue-500',
  sameFloor: 'bg-green-500',
  related: 'bg-purple-500',
  parking: 'bg-yellow-500'
} as const;

// 🏢 ENTERPRISE: Type-safe connection type keys
type ConnectionTypeKey = keyof typeof connectionTypeColors;

export function Legend() {
    const { radius } = useBorderTokens();
    const colors = useSemanticColors();
    // 🏢 ENTERPRISE: i18n hook
    const { t } = useTranslation(['properties', 'properties-detail', 'properties-enums', 'properties-viewer']);

    return (
        <div className="border-t pt-3">
            <h5 className="text-xs font-medium mb-2">
                {t('connectionPanel.legend.title')}
            </h5>
            <div className={cn("space-y-1 text-xs", colors.text.muted)}>
                {(Object.entries(connectionTypeColors) as [ConnectionTypeKey, string][]).map(([type, colorClass]) => (
                    <div key={type} className="flex items-center gap-2">
                        <div className={`w-3 h-3 ${radius.sm} ${colorClass}`} />
                        <span>{t(`connectionPanel.connectionTypes.${type}`)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}