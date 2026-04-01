'use client';

import React from 'react';
import { Euro, User } from 'lucide-react';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import type { PropertyModel } from '../types';

import { getStatusLabel } from '@/constants/property-statuses-enterprise';
import { formatCurrency } from '@/lib/intl-utils';
import { HOVER_SHADOWS } from '@/components/ui/effects';

import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useTypography } from '@/hooks/useTypography';
import { cn } from '@/lib/utils';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { getStatusColor } from '@/lib/design-system';

// 🏢 ENTERPRISE: Centralized Property Icon & Color
const PropertyIcon = NAVIGATION_ENTITIES.property.icon;
const propertyColor = NAVIGATION_ENTITIES.property.color;

export const PropertyNode = ({ property }: { property: PropertyModel }) => {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('projects');
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();
  const spacing = useSpacingTokens();
  const typography = useTypography();
  const showCustomerInfo = property.status === 'sold' || property.status === 'reserved' || property.status === 'rented';

  return (
    <div className={cn("border-l-2", quick.table, "pl-2")}>
      <div className={cn("p-2", colors.bg.infoSubtle, quick.card, HOVER_SHADOWS.MEDIUM, "transition-all")}>
        <div className={cn("flex items-start justify-between", spacing.margin.bottom.sm)}>
          <div className="flex items-center gap-2">
            <PropertyIcon size={18} className={`${propertyColor} mt-1`} />
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={cn(typography.heading.sm, colors.text.foreground)}>{property.name}</span>
                <span className={cn("px-2 py-1 rounded-full", typography.label.xs, getStatusColor(property.status))}>
                  {t(getStatusLabel(property.status))}
                </span>
              </div>
              <div className={cn("flex items-center gap-2", typography.body.sm, colors.text.muted)}>
                <span className="flex items-center gap-1">
                  <PropertyIcon size={14} className={propertyColor} />
                  {property.area} m²
                </span>
                {property.price && (
                  <span className="flex items-center gap-1">
                    <Euro size={14} />
                    {formatCurrency(property.price)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {showCustomerInfo && (
          <div className={cn(spacing.margin.top.sm, spacing.padding.top.sm, "border-t", quick.table)}>
            {property.customerName ? (
              <div className={cn(colors.bg.success, "p-2", quick.card)}>
                <div className={cn("flex items-center", spacing.gap.sm, spacing.margin.bottom.sm)}>
                  <User size={16} className={`${colors.text.success}`} />
                  <span className={cn(typography.label.sm, colors.text.success)}>{t('structure.customer')}</span>
                </div>
                <div className="ml-2">
                  <div className={cn(typography.label.sm, colors.text.foreground)}>
                    {property.customerName}
                  </div>
                  {property.soldTo && (
                    <div className={cn(typography.body.sm, colors.text.muted, spacing.margin.top.xs)}>
                      ID: {property.soldTo}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className={cn(colors.bg.warning, "p-2", quick.card)}>
                <div className={cn("flex items-center", spacing.gap.sm)}>
                  <User size={16} className={`${colors.text.warning}`} />
                  <span className={`${colors.text.warning}`}>
                    {property.soldTo
                      ? t('structure.customerNotFound', { id: property.soldTo })
                      : t('structure.noCustomer')
                    }
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
