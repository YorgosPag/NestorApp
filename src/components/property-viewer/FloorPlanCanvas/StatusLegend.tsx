'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { interactionUtilities, colors as tokenColors, borderColors } from '@/styles/design-tokens';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { PROPERTY_STATUS_LABELS } from '@/constants/property-statuses-enterprise';

interface ValidationError {
  type: string;
  message: string;
}

interface StatusLegendProps {
  className?: string;
  validationErrors?: ValidationError[];
}

export function StatusLegend({
  className,
  validationErrors = []
}: StatusLegendProps) {
  const iconSizes = useIconSizes();
  const { quick, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('properties');
  
  // ✅ CENTRALIZED: Labels from PROPERTY_STATUS_LABELS, colors from design-tokens
  const statusItems = [
    { color: borderColors.success.light, label: PROPERTY_STATUS_LABELS['for-sale'], count: 0 },
    { color: tokenColors.blue['500'], label: PROPERTY_STATUS_LABELS['for-rent'], count: 0 },
    { color: tokenColors.red['500'], label: PROPERTY_STATUS_LABELS.sold, count: 0 },
    { color: tokenColors.severity.medium.icon, label: PROPERTY_STATUS_LABELS.rented, count: 0 },
    { color: tokenColors.purple['500'], label: PROPERTY_STATUS_LABELS.reserved, count: 0 }
  ];

  return (
    <div 
      className={cn(
        `${colors.bg.primary} opacity-95 backdrop-blur-sm ${quick.card} p-3 shadow-lg`,
        'select-none', // Prevent text selection
        className
      )}
      style={interactionUtilities.nonInteractive}
    >
      <div className={`text-xs font-medium ${colors.text.primary} mb-2`}>
        {t('statusLegend.title')}
      </div>
      
      <div className="space-y-1">
        {statusItems.map((item, index) => (
          <div 
            key={index} 
            className="flex items-center gap-2 text-xs"
            style={interactionUtilities.pointerEvents.none}
          >
            <div
              className={`${iconSizes.xs} ${quick.input} rounded-full`}
              style={{ backgroundColor: item.color }}
            />
            <span className={`${colors.text.secondary} flex-1`}>{item.label}</span>
            <span className={`${colors.text.muted} font-mono`}>{item.count}</span>
          </div>
        ))}
      </div>

      <div className={`mt-2 pt-2 ${quick.separatorH} text-xs ${colors.text.muted}`}>
        {t('statusLegend.propertiesOnFloor')}
      </div>

      {validationErrors.length > 0 && (
        <div className="mt-2 pt-2 border-t ${getStatusBorder('error')}">
          <div className={`text-xs font-medium ${colors.text.danger} mb-1`}>{t('statusLegend.errors')}</div>
          {validationErrors.slice(0, 3).map((error, index) => (
            <div key={index} className={`text-xs ${colors.text.danger}`}>
              {error.message.substring(0, 30)}...
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
