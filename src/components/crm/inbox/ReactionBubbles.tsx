'use client';

/**
 * =============================================================================
 * REACTION BUBBLES - ENTERPRISE OMNICHANNEL
 * =============================================================================
 *
 * Displays message reactions as compact bubbles below the message.
 * Shows emoji + count, with tooltip for users who reacted.
 *
 * 🏢 ENTERPRISE FEATURES:
 * - Accessible (ARIA, keyboard support)
 * - Tooltips with user names
 * - Click to toggle own reaction
 * - Responsive design
 * - Real-time count updates
 *
 * @module components/crm/inbox/ReactionBubbles
 * @enterprise Omnichannel Communications
 */

import React, { useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { TRANSITION_PRESETS } from '@/components/ui/effects';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { MessageReactionsMap } from '@/types/conversations';

// ============================================================================
// TYPES
// ============================================================================

export interface ReactionBubblesProps {
  /** Message ID */
  messageId: string;
  /** Reactions map (emoji -> reaction data) */
  reactions: MessageReactionsMap;
  /** Emojis the current user has reacted with */
  userReactions?: Set<string>;
  /** Callback when a reaction bubble is clicked (toggle) */
  onReactionClick?: (messageId: string, emoji: string) => void;
  /** Whether message is from current user (outbound) - affects styling */
  isOutbound?: boolean;
  /** Whether reactions are loading */
  isLoading?: boolean;
  /** Additional className */
  className?: string;
  /** Maximum reactions to show before "+X more" */
  maxVisible?: number;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * 🏢 ENTERPRISE: Reaction bubbles display
 *
 * Shows all reactions for a message in a compact format.
 * Each bubble shows emoji + count, and is clickable to toggle.
 *
 * @example
 * ```tsx
 * <ReactionBubbles
 *   messageId={message.id}
 *   reactions={reactions}
 *   userReactions={userReactions}
 *   onReactionClick={handleToggleReaction}
 *   isOutbound={message.direction === 'outbound'}
 * />
 * ```
 */
export function ReactionBubbles({
  messageId,
  reactions,
  userReactions = new Set(),
  onReactionClick,
  isOutbound = false,
  isLoading = false,
  className,
  maxVisible = 6,
}: ReactionBubblesProps) {
  const { t } = useTranslation('crm');
  const colors = useSemanticColors();

  // Sort reactions by count (most popular first)
  const sortedReactions = useMemo(() => {
    return Object.entries(reactions)
      .filter(([_, reaction]) => reaction.count > 0)
      .sort((a, b) => b[1].count - a[1].count);
  }, [reactions]);

  // Handle bubble click
  const handleClick = useCallback((emoji: string) => {
    if (isLoading || !onReactionClick) return;
    onReactionClick(messageId, emoji);
  }, [messageId, onReactionClick, isLoading]);

  // Handle keyboard
  const handleKeyDown = useCallback((e: React.KeyboardEvent, emoji: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick(emoji);
    }
  }, [handleClick]);

  // No reactions - don't render
  if (sortedReactions.length === 0) {
    return null;
  }

  // Split visible and hidden reactions
  const visibleReactions = sortedReactions.slice(0, maxVisible);
  const hiddenCount = sortedReactions.length - maxVisible;
  const hiddenReactions = sortedReactions.slice(maxVisible);

  // Calculate total count for hidden reactions
  const hiddenTotalCount = hiddenReactions.reduce((sum, [_, r]) => sum + r.count, 0);

  return (
    <div
      className={cn(
        'flex flex-wrap gap-1 mt-1',
        // Alignment based on message direction
        isOutbound ? 'justify-end' : 'justify-start',
        className
      )}
      role="group"
      aria-label={t('inbox.reactions.messageReactions', 'Αντιδράσεις μηνύματος')}
    >
      {visibleReactions.map(([emoji, reaction]) => {
        const isUserReacted = userReactions.has(emoji);
        const userNames = reaction.userNames || [];
        const displayCount = reaction.count;

        // Tooltip content showing who reacted
        const tooltipContent = userNames.length > 0
          ? userNames.slice(0, 10).join(', ') + (userNames.length > 10 ? ` +${userNames.length - 10}` : '')
          : t('inbox.reactions.reactedWith', { emoji, count: displayCount });

        return (
          <Tooltip key={emoji}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => handleClick(emoji)}
                onKeyDown={(e) => handleKeyDown(e, emoji)}
                disabled={isLoading || !onReactionClick}
                className={cn(
                  'inline-flex items-center gap-1',
                  'px-2 py-0.5 rounded-full',
                  'text-sm',
                  'border',
                  TRANSITION_PRESETS.STANDARD_COLORS,
                  'hover:scale-105',
                  'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  // User reacted - highlight
                  isUserReacted
                    ? 'bg-primary/15 border-primary/40 text-primary'
                    : 'bg-muted/50 border-border/50 hover:bg-muted',
                )}
                aria-label={`${emoji} ${displayCount}`}
                aria-pressed={isUserReacted}
              >
                <span role="img" aria-hidden="true" className="text-base">
                  {emoji}
                </span>
                <span className="font-medium text-xs">
                  {displayCount}
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <p className="text-xs">{tooltipContent}</p>
            </TooltipContent>
          </Tooltip>
        );
      })}

      {/* Show "+X more" if there are hidden reactions */}
      {hiddenCount > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={cn(
                'inline-flex items-center',
                'px-2 py-0.5 rounded-full',
                'text-xs',
                'bg-muted/50 border border-border/50',
                colors.text.muted,
              )}
            >
              +{hiddenCount}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <div className="flex flex-wrap gap-1">
              {hiddenReactions.map(([emoji, reaction]) => (
                <span key={emoji}>
                  {emoji} {reaction.count}
                </span>
              ))}
            </div>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

export default ReactionBubbles;
