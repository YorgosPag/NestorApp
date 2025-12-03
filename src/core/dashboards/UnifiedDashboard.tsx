'use client';

import React from 'react';
import { StatsCard } from '@/components/property-management/dashboard/StatsCard';

interface DashboardStat {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: 'blue' | 'green' | 'purple' | 'orange' | 'cyan' | 'pink' | 'gray' | 'red';
}

interface UnifiedDashboardProps {
  stats: DashboardStat[];
  columns?: number; // Default grid layout columns
  className?: string;
  additionalContainers?: React.ReactNode; // Optional additional containers below stats
  onCardClick?: (stat: DashboardStat, index: number) => void; // 🔥 NEW: Click handler για filtering
}

export function UnifiedDashboard({
  stats,
  columns = 6,
  className = "p-4 border-b bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20",
  additionalContainers,
  onCardClick
}: UnifiedDashboardProps) {

  // Dynamic grid class based on columns
  const getGridClass = (cols: number) => {
    switch (cols) {
      case 5: return "grid-cols-1 md:grid-cols-2 lg:grid-cols-5";
      case 6: return "grid-cols-2 md:grid-cols-3 lg:grid-cols-6";
      default: return "grid-cols-2 md:grid-cols-3 lg:grid-cols-6";
    }
  };

  return (
    <div className={className}>
      <div className={`grid ${getGridClass(columns)} gap-4`}>
        {stats.map((stat, index) => (
          <StatsCard
            key={`${stat.title}-${index}`}
            title={stat.title}
            value={stat.value}
            icon={stat.icon}
            color={stat.color}
            onClick={onCardClick ? () => onCardClick(stat, index) : undefined}
          />
        ))}
      </div>

      {/* Additional containers section */}
      {additionalContainers && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          {additionalContainers}
        </div>
      )}
    </div>
  );
}

// Export type for external use
export type { DashboardStat };