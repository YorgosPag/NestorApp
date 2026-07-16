'use client';

/**
 * 🏢 ENTERPRISE CARD TITLE BLOCK - Primitive Component
 *
 * The identity row every card shell leads with: entity icon, truncating title,
 * optional subtitle. Single Source of Truth for card title typography and for
 * the truncation contract that keeps long names from blowing out the layout.
 *
 * @fileoverview Reusable icon + title + subtitle block for card components.
 * @enterprise Fortune 500 compliant - Uses centralized typography tokens
 * @see CardIcon for the icon primitive
 * @see GridCard, ListCard for consumers
 * @author Enterprise Architecture Team
 * @since 2026-07-16
 */

import React from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// 🏢 CENTRALIZED HOOKS
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTypography } from '@/hooks/useTypography';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';

import { CardIcon } from './CardIcon';
import type { CardIdentityProps } from './types';
import '@/lib/design-system';

/**
 * Props for CardTitleBlock
 */
export interface CardTitleBlockProps extends CardIdentityProps {
  /**
   * Content rendered on the title's own row, after the title.
   * When present the title shares the row and yields space to this slot.
   */
  inlineSlot?: ReactNode;
  /** Additional className for the block container */
  className?: string;
}

/**
 * 🏢 CardTitleBlock Component
 *
 * @example
 * ```tsx
 * <CardTitleBlock
 *   entityType="parking"
 *   title="P-001"
 *   subtitle="Τυπική Θέση"
 *   compact={compact}
 * />
 * ```
 */
export function CardTitleBlock({
  entityType,
  customIcon,
  customIconColor,
  title,
  subtitle,
  compact = false,
  hideIcon = false,
  inlineSlot,
  className,
}: CardTitleBlockProps) {
  // ==========================================================================
  // 🏢 CENTRALIZED HOOKS
  // ==========================================================================
  const colors = useSemanticColors();
  const typography = useTypography();
  const spacing = useSpacingTokens();

  const heading = (
    <h3
      className={cn(
        'truncate',
        compact ? typography.card.titleCompact : typography.card.title,
        colors.text.primary,
        // Only meaningful inside the inline row, where the slot competes for space
        inlineSlot && 'flex-shrink'
      )}
    >
      {title}
    </h3>
  );

  return (
    <div className={cn('flex items-center', spacing.gap.sm, className)}>
      {/* Entity Icon */}
      {!hideIcon && (entityType || customIcon) && (
        <CardIcon
          entityType={entityType}
          icon={customIcon}
          color={customIconColor}
          size={compact ? 'sm' : 'md'}
        />
      )}

      {/* Title & Subtitle - 🏢 ENTERPRISE: Using centralized typography */}
      <div className="flex-1 min-w-0 overflow-hidden">
        {inlineSlot ? (
          <div className={cn('flex items-center', spacing.gap.sm)}>
            {heading}
            {inlineSlot}
          </div>
        ) : (
          heading
        )}

        {subtitle && (
          <p
            className={cn(
              'truncate',
              compact ? typography.card.subtitleCompact : typography.card.subtitle,
              colors.text.muted
            )}
          >
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

CardTitleBlock.displayName = 'CardTitleBlock';

export default CardTitleBlock;
