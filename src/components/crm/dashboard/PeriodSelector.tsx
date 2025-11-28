
'use client';

import React from 'react';
import { getSortedPeriods } from '@/config/period-selector-config';

interface PeriodSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  // Get periods from centralized config
  const periods = getSortedPeriods();

  return (
    <div className="flex items-center bg-gray-100 rounded-lg p-1">
      {periods.map(period => (
        <button
          key={period.id}
          onClick={() => onChange(period.value)}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            value === period.value
              ? 'bg-white shadow text-blue-600 font-medium'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          {period.label}
        </button>
      ))}
    </div>
  );
}
