
'use client';

import React from 'react';

interface PeriodSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  return (
    <div className="flex items-center bg-gray-100 rounded-lg p-1">
      {['day', 'week', 'month', 'year'].map(period => (
        <button
          key={period}
          onClick={() => onChange(period)}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            value === period 
              ? 'bg-white shadow text-blue-600 font-medium' 
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          {period === 'day' ? 'Ημέρα' :
           period === 'week' ? 'Εβδομάδα' :
           period === 'month' ? 'Μήνας' : 'Έτος'}
        </button>
      ))}
    </div>
  );
}
