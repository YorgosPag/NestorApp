'use client';

import React from 'react';
import { Home, Euro, User } from 'lucide-react';
import type { UnitModel } from '../types';
import { getStatusColor, getStatusText } from '../utils/status';
import { formatCurrency } from '@/lib/project-utils';

export const UnitNode = ({ unit }: { unit: UnitModel }) => {
  const showCustomerInfo = unit.status === 'sold' || unit.status === 'reserved' || unit.status === 'rented';

  return (
    <div className="border-l-2 border-gray-200 dark:border-gray-700 pl-4">
      <div className="p-4 bg-white dark:bg-gray-800/50 border rounded-lg hover:shadow-md transition-all">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <Home size={18} className="text-gray-500 mt-1" />
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-gray-800 dark:text-gray-200">{unit.name}</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(unit.status)}`}>
                  {getStatusText(unit.status)}
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
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
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            {unit.customerName ? (
              <div className="bg-green-50 dark:bg-green-900/10 p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <User size={16} className="text-green-600" />
                  <span className="font-medium text-green-800 dark:text-green-400">Πελάτης</span>
                </div>
                <div className="ml-6">
                  <div className="font-medium text-gray-800 dark:text-gray-200">
                    {unit.customerName}
                  </div>
                  {unit.soldTo && (
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      ID: {unit.soldTo}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-orange-50 dark:bg-orange-900/10 p-3 rounded-lg">
                <div className="flex items-center gap-2">
                  <User size={16} className="text-orange-600" />
                  <span className="text-orange-800 dark:text-orange-400">
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
