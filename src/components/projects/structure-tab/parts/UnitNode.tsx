'use client';

import React from 'react';
import { Euro, User } from 'lucide-react';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import type { UnitModel } from '../types';

import { getStatusColor } from '../utils/status';
import { getStatusLabel } from '@/constants/property-statuses-enterprise';
import { formatCurrency } from '@/lib/intl-utils';
import { HOVER_SHADOWS } from '@/components/ui/effects';

import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

// 🏢 ENTERPRISE: Centralized Unit Icon & Color
const UnitIcon = NAVIGATION_ENTITIES.unit.icon;
const unitColor = NAVIGATION_ENTITIES.unit.color;

export const UnitNode = ({ unit }: { unit: UnitModel }) => {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('projects');
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();
  const showCustomerInfo = unit.status === 'sold' || unit.status === 'reserved' || unit.status === 'rented';

  return (
    <div className={`border-l-2 ${quick.table} pl-4`}>
      <div className={`p-4 ${colors.bg.primary} ${quick.card} ${HOVER_SHADOWS.MEDIUM} transition-all`}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <UnitIcon size={18} className={`${unitColor} mt-1`} />
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`font-semibold ${colors.text.foreground}`}>{unit.name}</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(unit.status)}`}>
                  {getStatusLabel(unit.status)}
                </span>
              </div>
              <div className={`flex items-center gap-4 text-sm ${colors.text.muted}`}>
                <span className="flex items-center gap-1">
                  <UnitIcon size={14} className={unitColor} />
                  {unit.area} m²
                </span>
                {unit.price && (
                  <span className="flex items-center gap-1">
                    <Euro size={14} />
                    {formatCurrency(unit.price)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {showCustomerInfo && (
          <div className={`mt-3 pt-3 border-t ${quick.table}`}>
            {unit.customerName ? (
              <div className={`${colors.bg.success} p-3 ${quick.card}`}>
                <div className="flex items-center gap-2 mb-2">
                  <User size={16} className={`${colors.text.success}`} />
                  <span className={`font-medium ${colors.text.success}`}>{t('structure.customer')}</span>
                </div>
                <div className="ml-6">
                  <div className={`font-medium ${colors.text.foreground}`}>
                    {unit.customerName}
                  </div>
                  {unit.soldTo && (
                    <div className={`text-sm ${colors.text.muted} mt-1`}>
                      ID: {unit.soldTo}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className={`${colors.bg.warning} p-3 ${quick.card}`}>
                <div className="flex items-center gap-2">
                  <User size={16} className={`${colors.text.warning}`} />
                  <span className={`${colors.text.warning}`}>
                    {unit.soldTo
                      ? t('structure.customerNotFound', { id: unit.soldTo })
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
