'use client';

/**
 * 🏢 ENTERPRISE CARD STATS - Primitive Component
 *
 * Centralized stats display component for cards.
 * Eliminates duplicate stats patterns across list items.
 *
 * @fileoverview Reusable stats grid primitive for card components.
 * @enterprise Fortune 500 compliant - Uses centralized design tokens
 * @author Enterprise Architecture Team
 * @since 2026-01-08
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTypography } from '@/hooks/useTypography';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { CardStatsProps, StatItem, StatsLayout } from './types';

/**
 * 🏢 CardStats Component
 *
 * Displays a grid/list of stats with icons, labels, and values.
 *
 * @example
 * ```tsx
 * <CardStats
 *   stats={[
 *     { icon: Ruler, label: 'Εμβαδόν', value: '85 m²' },
 *     { icon: Euro, label: 'Τιμή', value: '150,000€', valueColor: 'text-green-600' },
 *     { icon: Layers, label: 'Όροφος', value: '3ος' },
 *   ]}
 *   layout="horizontal"
 *   compact
 * />
 * ```
 */
export function CardStats({
  stats,
  layout = 'horizontal',
  columns = 3,
  compact = false,
  showDividers = false,
  className,
}: CardStatsProps) {
  // 🏢 CENTRALIZED HOOKS
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const typography = useTypography();

  // Don't render if no stats
  if (!stats || stats.length === 0) {
    return null;
  }

  // Layout-specific container classes
  const layoutContainerClasses: Record<StatsLayout, string> = {
    horizontal: 'flex flex-wrap items-center gap-4 overflow-hidden w-full',
    vertical: 'flex flex-col gap-2',
    grid: cn(
      'grid gap-3',
      columns === 2 && 'grid-cols-2',
      columns === 3 && 'grid-cols-3',
      columns === 4 && 'grid-cols-4'
    ),
  };

  // 🏢 ENTERPRISE: Size-based classes using centralized typography
  const sizeClasses = {
    icon: compact ? iconSizes.xs : iconSizes.sm,
    label: compact ? typography.card.statLabel : typography.card.statLabel,  // text-xs
    value: compact ? typography.card.statLabel : typography.card.subtitle,   // text-xs / text-sm (smaller!)
    gap: compact ? 'gap-1' : 'gap-1.5',
  };

  return (
    <div className={cn(layoutContainerClasses[layout], className)}>
      {stats.map((stat, index) => (
        <React.Fragment key={`${stat.label}-${index}`}>
          <StatItemComponent
            stat={stat}
            sizeClasses={sizeClasses}
            colors={colors}
            layout={layout}
          />
          {showDividers && index < stats.length - 1 && layout === 'horizontal' && (
            <div className="h-4 w-px bg-border" aria-hidden="true" />
          )}
          {showDividers && index < stats.length - 1 && layout === 'vertical' && (
            <div className="h-px w-full bg-border" aria-hidden="true" />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

/**
 * Individual stat item component
 */
interface StatItemComponentProps {
  stat: StatItem;
  sizeClasses: {
    icon: string;
    label: string;
    value: string;
    gap: string;
  };
  colors: ReturnType<typeof useSemanticColors>;
  layout: StatsLayout;
}

function StatItemComponent({
  stat,
  sizeClasses,
  colors,
  layout,
}: StatItemComponentProps) {
  const IconComponent = stat.icon;

  const content = (
    <div
      className={cn(
        'flex items-center min-w-0',
        sizeClasses.gap,
        layout === 'vertical' && 'justify-between w-full'
      )}
    >
      {/* Icon */}
      <IconComponent
        className={cn(sizeClasses.icon, stat.iconColor || colors.text.muted)}
        aria-hidden="true"
      />

      {/* Label & Value container */}
      <div
        className={cn(
          'flex',
          layout === 'horizontal' && 'flex-col',
          layout === 'vertical' && 'flex-row items-center gap-2',
          layout === 'grid' && 'flex-col'
        )}
      >
        {/* Label - only show if layout is grid or vertical */}
        {(layout === 'grid' || layout === 'vertical') && (
          <span className={cn(sizeClasses.label, colors.text.muted)}>
            {stat.label}
          </span>
        )}

        {/* Value - 🏢 ENTERPRISE: Using muted color for secondary hierarchy */}
        <span
          className={cn(
            sizeClasses.value,
            'truncate max-w-[120px]',
            stat.valueColor || colors.text.muted
          )}
          title={String(stat.value)}
        >
          {stat.value}
        </span>
      </div>
    </div>
  );

  // Wrap with tooltip if provided
  if (stat.tooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-help">{content}</div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{stat.tooltip}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
}

CardStats.displayName = 'CardStats';

export default CardStats;
