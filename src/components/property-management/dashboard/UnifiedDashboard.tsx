'use client';

import React, { useState, useEffect } from 'react';
import { StatsCard } from './StatsCard';

interface DashboardStat {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ElementType;
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'cyan' | 'pink' | 'gray' | 'red' | 'yellow' | 'indigo';
  trend?: {
    value: number;
    label: string;
  };
}

interface UnifiedDashboardProps {
  stats: DashboardStat[];
  columns?: number; // Default grid layout columns
  className?: string;
  additionalContainers?: React.ReactNode; // Optional additional containers below stats
  onCardClick?: (stat: DashboardStat, index: number) => void; // 🔥 NEW: Click handler για filtering
  title?: string; // Optional title
  variant?: string; // Optional variant (not used but accepted for compatibility)
}

export function UnifiedDashboard({
  stats,
  columns = 6,
  className = "p-4 border-b bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20",
  additionalContainers,
  onCardClick,
  title,
  variant
}: UnifiedDashboardProps) {

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Dynamic grid class based on columns - Mobile-First Responsive
  const getGridClass = (cols: number) => {
    switch (cols) {
      case 4: return "sm:grid-cols-2 lg:grid-cols-4"; // 🔥 MOBILE: 2 on small, 4 on large
      case 5: return "sm:grid-cols-3 lg:grid-cols-5"; // 🔥 MOBILE: 3, then 5
      case 6: return "sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"; // 🔥 MOBILE: 3→4→6
      default: return "sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"; // 🔥 MOBILE: 3→4→6
    }
  };

  // Get dynamic grid template columns for mobile
  const getGridStyle = () => {
    if (isMobile) {
      return { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' };
    }
    return {};
  };

  return (
    <div className={className}>
      <div
        className={`grid ${getGridClass(columns)} gap-1 sm:gap-4 w-full min-w-0 overflow-hidden`}
        style={getGridStyle()}
      >
        {stats.map((stat, index) => (
          <StatsCard
            key={`${stat.title}-${index}`}
            title={stat.title}
            value={stat.value}
            icon={stat.icon}
            color={stat.color || 'blue'}
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