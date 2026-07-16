'use client';

/**
 * 🏢 ENTERPRISE CARD ACTIONS TOOLBAR - Primitive Component
 *
 * The reveal-on-hover toolbar every card shell carries: an optional favorite
 * toggle followed by icon actions. Single Source of Truth for the reveal
 * behaviour, the focus-within escape hatch, and the a11y labelling.
 *
 * @fileoverview Reusable hover-actions toolbar for card components.
 * @enterprise Fortune 500 compliant - Uses centralized design tokens
 * @see GridCard, ListCard for consumers
 * @author Enterprise Architecture Team
 * @since 2026-07-16
 */

import { COMMON_NAMESPACES } from '@/i18n/namespace-bundles';
import React from 'react';
import { cn } from '@/lib/utils';
import { Star } from 'lucide-react';
// 🏢 ENTERPRISE: i18n for accessibility labels
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// 🏢 CENTRALIZED HOOKS
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { usePositioningTokens } from '@/hooks/usePositioningTokens';

import type { CardAction } from './types';
import '@/lib/design-system';

/**
 * Props for CardActionsToolbar
 */
export interface CardActionsToolbarProps {
  /** Whether the item is favorite */
  isFavorite?: boolean;
  /** Favorite toggle handler - omit to hide the favorite button entirely */
  onToggleFavorite?: () => void;
  /** Icon actions rendered after the favorite button */
  actions?: readonly CardAction[];
  /**
   * Button padding density.
   * - `comfortable` (default): list rows, where the toolbar has room
   * - `compact`: grid tiles, where the toolbar competes with tile content
   */
  density?: 'comfortable' | 'compact';
  /**
   * Float the toolbar above dense content: raises the stacking order and gives
   * each button an opaque chip background so icons stay legible over the tile.
   */
  overlay?: boolean;
  /** Wrap each action in a tooltip showing its label */
  withTooltips?: boolean;
  /** Additional className for the toolbar container */
  className?: string;
}

/**
 * 🏢 CardActionsToolbar Component
 *
 * Renders nothing when there is neither a favorite toggle nor any action, so
 * callers can mount it unconditionally.
 *
 * @example
 * ```tsx
 * <CardActionsToolbar
 *   isFavorite={isFavorite}
 *   onToggleFavorite={onToggleFavorite}
 *   actions={actions}
 *   density="compact"
 *   overlay
 * />
 * ```
 */
export function CardActionsToolbar({
  isFavorite,
  onToggleFavorite,
  actions = [],
  density = 'comfortable',
  overlay = false,
  withTooltips = false,
  className,
}: CardActionsToolbarProps) {
  // ==========================================================================
  // 🏢 CENTRALIZED HOOKS
  // ==========================================================================
  const { t } = useTranslation(COMMON_NAMESPACES);
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const spacing = useSpacingTokens();
  const positioning = usePositioningTokens();

  if (!onToggleFavorite && actions.length === 0) {
    return null;
  }

  // 🏢 ENTERPRISE: Shared button chrome - density and overlay are the only axes
  const buttonPadding = density === 'compact' ? spacing.padding.xs : spacing.padding.sm;
  const buttonBase = cn(
    `${buttonPadding} rounded-md transition-colors`,
    overlay && colors.bg.card
  );

  const handleFavoriteClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    onToggleFavorite?.();
  };

  const handleActionClick = (event: React.MouseEvent, action: CardAction) => {
    event.stopPropagation();
    action.onClick(event);
  };

  return (
    <div
      role="toolbar"
      className={cn(
        `absolute ${positioning.top.sm} ${positioning.right.sm} flex ${spacing.gap.sm}`,
        'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity',
        overlay && 'z-10',
        className
      )}
      aria-label={t('a11y.cardActions')}
    >
      {/* Favorite button */}
      {onToggleFavorite && (
        <button
          type="button"
          onClick={handleFavoriteClick}
          className={cn(
            buttonBase,
            isFavorite
              ? colors.text.warning
              : cn(colors.text.muted, 'hover:text-[hsl(var(--text-warning))]')
          )}
          aria-label={isFavorite ? t('a11y.removeFavorite') : t('a11y.addFavorite')}
          aria-pressed={isFavorite}
        >
          <Star className={cn(iconSizes.sm, isFavorite && 'fill-current')} />
        </button>
      )}

      {/* Additional actions */}
      {actions.map((action) => (
        <CardActionButton
          key={action.id}
          action={action}
          className={cn(
            buttonBase,
            colors.text.muted,
            'hover:text-primary',
            action.disabled && 'opacity-50 cursor-not-allowed',
            action.className
          )}
          iconClassName={iconSizes.sm}
          withTooltip={withTooltips}
          onClick={handleActionClick}
        />
      ))}
    </div>
  );
}

/**
 * Individual action button, optionally wrapped in a tooltip
 */
interface CardActionButtonProps {
  action: CardAction;
  className: string;
  iconClassName: string;
  withTooltip: boolean;
  onClick: (event: React.MouseEvent, action: CardAction) => void;
}

function CardActionButton({
  action,
  className,
  iconClassName,
  withTooltip,
  onClick,
}: CardActionButtonProps) {
  const button = (
    <button
      type="button"
      onClick={(event) => onClick(event, action)}
      disabled={action.disabled}
      className={className}
      aria-label={action.label}
    >
      <action.icon className={iconClassName} />
    </button>
  );

  if (!withTooltip) {
    return button;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent>{action.label}</TooltipContent>
    </Tooltip>
  );
}

CardActionsToolbar.displayName = 'CardActionsToolbar';

export default CardActionsToolbar;
