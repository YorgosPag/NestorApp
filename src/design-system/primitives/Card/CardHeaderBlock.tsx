'use client';

/**
 * 🏢 ENTERPRISE CARD HEADER - Primitive Component
 *
 * A card's identity region: the icon/title/subtitle block, followed by the
 * status badges. Single Source of Truth for the header's clipping and for the
 * rule that a card shows at most two badges — one when they ride inline with
 * the title.
 *
 * @fileoverview Reusable header region for card components.
 * @enterprise Fortune 500 compliant - Uses centralized spacing tokens
 * @see CardTitleBlock, CardBadges for the composed primitives
 * @see GridCard, ListCard for consumers
 * @author Enterprise Architecture Team
 * @since 2026-07-16
 */

import React from 'react';
import { cn } from '@/lib/utils';

// 🏢 CENTRALIZED HOOKS
import { useSpacingTokens } from '@/hooks/useSpacingTokens';

import { CardTitleBlock } from './CardTitleBlock';
import { CardBadges } from './CardBadges';
import type { CardBadge, CardIdentityProps } from './types';
import '@/lib/design-system';

/** Maximum badges on a card, per Enterprise spec */
const MAX_BADGES_STACKED = 2;
/** Maximum badges when they share the title's row */
const MAX_BADGES_INLINE = 1;

/**
 * Props for CardHeaderBlock
 */
export interface CardHeaderBlockProps extends CardIdentityProps {
  /** Status badges, in priority order */
  badges?: readonly CardBadge[];
  /**
   * Render the leading badge on the title's row instead of a row of its own.
   * Inline mode shows one badge; the stacked row shows two.
   */
  inlineBadges?: boolean;
  /**
   * Layout delta for the stacked badge row — how the row handles badges that
   * exceed the card's width (e.g. `flex-wrap` for tiles, `overflow-hidden` for rows).
   */
  badgeRowClassName?: string;
}

/**
 * 🏢 CardHeaderBlock Component
 *
 * @example
 * ```tsx
 * <CardHeaderBlock
 *   entityType="parking"
 *   title="P-001"
 *   subtitle="Τυπική Θέση"
 *   badges={badges}
 *   badgeRowClassName="flex-wrap"
 * />
 * ```
 */
export function CardHeaderBlock({
  entityType,
  customIcon,
  customIconColor,
  title,
  subtitle,
  compact = false,
  hideIcon = false,
  badges = [],
  inlineBadges = false,
  badgeRowClassName,
}: CardHeaderBlockProps) {
  const spacing = useSpacingTokens();

  const hasBadges = badges.length > 0;
  const showInlineBadges = inlineBadges && hasBadges;
  const showStackedBadges = !inlineBadges && hasBadges;

  return (
    <header className={cn('overflow-hidden', spacing.margin.bottom.sm)}>
      {/* Row 1: Icon + Title (+ inline badges if enabled) */}
      <CardTitleBlock
        entityType={entityType}
        customIcon={customIcon}
        customIconColor={customIconColor}
        title={title}
        subtitle={subtitle}
        compact={compact}
        hideIcon={hideIcon}
        inlineSlot={
          showInlineBadges ? (
            <CardBadges
              badges={badges}
              max={MAX_BADGES_INLINE}
              keyPrefix="inline-"
              badgeClassName="flex-shrink-0"
            />
          ) : undefined
        }
      />

      {/* Row 2: Badges (separate row when NOT inline) */}
      {showStackedBadges && (
        <div
          className={cn(
            'flex items-center',
            spacing.gap.sm,
            spacing.margin.top.sm,
            badgeRowClassName
          )}
        >
          <CardBadges badges={badges} max={MAX_BADGES_STACKED} />
        </div>
      )}
    </header>
  );
}

CardHeaderBlock.displayName = 'CardHeaderBlock';

export default CardHeaderBlock;
