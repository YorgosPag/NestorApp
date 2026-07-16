'use client';

/**
 * 🏢 ENTERPRISE CARD BADGES - Primitive Component
 *
 * Renders a card's status badges through the centralized Badge component.
 * Owns the "how many badges may a card show" cap; the surrounding layout (a
 * wrapped row, an inline slot next to the title) stays with the card shell,
 * because that layout is what genuinely differs between grid and list.
 *
 * @fileoverview Reusable badge list for card components.
 * @enterprise Fortune 500 compliant - Single source of truth for card badges
 * @see GridCard, ListCard for consumers
 * @author Enterprise Architecture Team
 * @since 2026-07-16
 */

import React from 'react';
import { cn } from '@/lib/utils';
// 🏢 ENTERPRISE: Centralized Badge component (single source of truth for all badges)
import { Badge } from '@/components/ui/badge';

import type { CardBadge } from './types';
import '@/lib/design-system';

/**
 * Props for CardBadges
 */
export interface CardBadgesProps {
  /** Badges to render, in priority order */
  badges: readonly CardBadge[];
  /** Maximum number of badges rendered; the rest are dropped */
  max: number;
  /** Key prefix - disambiguates when a card renders two badge groups */
  keyPrefix?: string;
  /** Additional className applied to every badge */
  badgeClassName?: string;
}

/**
 * 🏢 CardBadges Component
 *
 * Returns a fragment, not a container — the caller supplies the row layout.
 *
 * @example
 * ```tsx
 * <div className="flex items-center flex-wrap gap-2">
 *   <CardBadges badges={badges} max={2} />
 * </div>
 * ```
 */
export function CardBadges({ badges, max, keyPrefix = '', badgeClassName }: CardBadgesProps) {
  return (
    <>
      {badges.slice(0, max).map((badge, index) => (
        <Badge
          key={`${keyPrefix}${badge.label}-${index}`}
          variant={badge.variant}
          className={cn('whitespace-nowrap', badgeClassName, badge.className)}
        >
          {badge.label}
        </Badge>
      ))}
    </>
  );
}

CardBadges.displayName = 'CardBadges';

export default CardBadges;
