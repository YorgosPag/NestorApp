'use client';

import React from 'react';
import { useBorderTokens } from '@/hooks/useBorderTokens';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

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
    // 🏢 ENTERPRISE: i18n hook
    const { t } = useTranslation('properties');

    return (
        <div className="border-t pt-3">
            <h5 className="text-xs font-medium mb-2">
                {t('connectionPanel.legend.title')}
            </h5>
            <div className="space-y-1 text-xs text-muted-foreground">
                {(Object.entries(connectionTypeColors) as [ConnectionTypeKey, string][]).map(([type, colorClass]) => (
                    <div key={type} className="flex items-center gap-2">
                        <div className={`w-3 h-3 ${radius.sm} ${colorClass}`}></div>
                        <span>{t(`connectionPanel.connectionTypes.${type}`)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}