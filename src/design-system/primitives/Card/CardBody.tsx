'use client';

/**
 * 🏢 ENTERPRISE CARD BODY - Primitive Component
 *
 * Everything a card shell renders below its header: the stats strip, then any
 * caller-supplied content. Single Source of Truth for the rhythm between them.
 *
 * @fileoverview Reusable below-header content region for card components.
 * @enterprise Fortune 500 compliant - Uses centralized spacing tokens
 * @see CardStats for the stats primitive
 * @see GridCard, ListCard for consumers
 * @author Enterprise Architecture Team
 * @since 2026-07-16
 */

import React from 'react';
import type { ReactNode } from 'react';

// 🏢 CENTRALIZED HOOKS
import { useSpacingTokens } from '@/hooks/useSpacingTokens';

import { CardStats } from './CardStats';
import type { StatItem, StatsLayout } from './types';
import '@/lib/design-system';

/**
 * Props for CardBody
 */
export interface CardBodyProps {
  /** Stats to display - empty or omitted renders no stats strip */
  stats?: readonly StatItem[];
  /** Stats layout - the axis along which grid and list genuinely differ */
  statsLayout: StatsLayout;
  /** Compact mode - smaller text and spacing */
  compact?: boolean;
  /** Additional content below the stats */
  children?: ReactNode;
}

/**
 * 🏢 CardBody Component
 *
 * @example
 * ```tsx
 * <CardBody stats={hideStats ? undefined : stats} statsLayout="vertical" compact={compact}>
 *   {children}
 * </CardBody>
 * ```
 */
export function CardBody({ stats, statsLayout, compact = false, children }: CardBodyProps) {
  const spacing = useSpacingTokens();

  return (
    <>
      {/* ================================================================== */}
      {/* 🏢 STATS SECTION */}
      {/* ================================================================== */}
      {stats && stats.length > 0 && (
        <CardStats
          stats={[...stats]}
          layout={statsLayout}
          compact={compact}
          className={spacing.margin.top.sm}
        />
      )}

      {/* ================================================================== */}
      {/* 🏢 CUSTOM CONTENT */}
      {/* ================================================================== */}
      {children && <div className={spacing.margin.top.sm}>{children}</div>}
    </>
  );
}

CardBody.displayName = 'CardBody';

export default CardBody;
