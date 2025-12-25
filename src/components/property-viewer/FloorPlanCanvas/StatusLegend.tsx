'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { layoutUtilities, chartComponents, interactionUtilities } from '@/styles/design-tokens';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';

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
  
  const statusItems = [
    { color: '#10b981', label: 'Προς Πώληση', count: 0 },
    { color: '#3b82f6', label: 'Προς Ενοικίαση', count: 0 },
    { color: '#ef4444', label: 'Πουλημένο', count: 0 },
    { color: '#f59e0b', label: 'Ενοικιασμένο', count: 0 },
    { color: '#8b5cf6', label: 'Δεσμευμένο', count: 0 }
  ];

  return (
    <div 
      className={cn(
        `bg-white/95 backdrop-blur-sm ${quick.card} p-3 shadow-lg`,
        'select-none', // Prevent text selection
        className
      )}
      style={interactionUtilities.nonInteractive}
    >
      <div className="text-xs font-medium text-gray-900 mb-2">
        Κατάσταση Ακινήτων
      </div>
      
      <div className="space-y-1">
        {statusItems.map((item, index) => (
          <div 
            key={index} 
            className="flex items-center gap-2 text-xs"
            style={interactionUtilities.pointerEvents.none}
          >
            <div
              className={`${iconSizes.xs} border border-border`}
              style={{
                ...chartComponents.legend.indicator.withColor(item.color),
                borderRadius: '50%'
              }}
            />
            <span className="text-gray-700 flex-1">{item.label}</span>
            <span className="text-gray-500 font-mono">{item.count}</span>
          </div>
        ))}
      </div>

      <div className={`mt-2 pt-2 ${quick.separatorH} text-xs text-gray-600`}>
        ακίνητα στον όροφο
      </div>

      {validationErrors.length > 0 && (
        <div className="mt-2 pt-2 border-t ${getStatusBorder('error')}">
          <div className="text-xs font-medium text-red-700 mb-1">Errors:</div>
          {validationErrors.slice(0, 3).map((error, index) => (
            <div key={index} className="text-xs text-red-600">
              {error.message.substring(0, 30)}...
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
