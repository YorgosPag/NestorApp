'use client';

import React from 'react';
import { Home, Euro, User } from 'lucide-react';
import type { UnitModel } from '../types';
import { getStatusColor } from '../utils/status';
import { getStatusLabel } from '@/constants/property-statuses-enterprise';
import { formatCurrency } from '@/lib/intl-utils';
import { HOVER_SHADOWS } from '@/components/ui/effects';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

export const UnitNode = ({ unit }: { unit: UnitModel }) => {
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();
  const showCustomerInfo = unit.status === 'sold' || unit.status === 'reserved' || unit.status === 'rented';

  return (
    <div className={`border-l-2 ${quick.table} pl-4`}>
      <div className={`p-4 ${colors.bg.primary} ${quick.card} ${HOVER_SHADOWS.MEDIUM} transition-all`}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <Home size={18} className={`${colors.text.muted} mt-1`} />
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`font-semibold ${colors.text.foreground}`}>{unit.name}</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(unit.status)}`}>
                  {getStatusLabel(unit.status)}
                </span>
              </div>
              <div className={`flex items-center gap-4 text-sm ${colors.text.muted}`}>
                <span className="flex items-center gap-1">
                  <Home size={14} />
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
                  <span className={`font-medium ${colors.text.success}`}>Πελάτης</span>
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
                    {unit.soldTo ? 
                      `Πελάτης (ID: ${unit.soldTo}) - Δεν βρέθηκαν στοιχεία` : 
                      'Δεν έχει καταχωρηθεί πελάτης'
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
