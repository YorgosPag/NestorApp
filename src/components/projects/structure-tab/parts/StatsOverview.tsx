'use client';

import React from 'react';

interface StatsOverviewProps {
  totalUnits: number;
  soldUnits: number;
  totalArea: number;
  soldPct: number;
}

export function StatsOverview({ totalUnits, soldUnits, totalArea, soldPct }: StatsOverviewProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border">
        <div className="text-sm text-gray-500 dark:text-gray-400">Σύνολο Μονάδων</div>
        <div className="text-2xl font-bold text-blue-600">{totalUnits}</div>
      </div>
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border">
        <div className="text-sm text-gray-500 dark:text-gray-400">Πωλημένες</div>
        <div className="text-2xl font-bold text-green-600">{soldUnits}</div>
      </div>
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border">
        <div className="text-sm text-gray-500 dark:text-gray-400">Συνολική Επιφάνεια</div>
        <div className="text-2xl font-bold text-purple-600">{totalArea.toFixed(1)} m²</div>
      </div>
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border">
        <div className="text-sm text-gray-500 dark:text-gray-400">% Πωλήσεων</div>
        <div className="text-2xl font-bold text-orange-600">
          {soldPct.toFixed(1)}%
        </div>
      </div>
    </div>
  );
}
