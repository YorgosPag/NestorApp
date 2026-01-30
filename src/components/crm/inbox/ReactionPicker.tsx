'use client';

/**
 * =============================================================================
 * REACTION PICKER - ENTERPRISE OMNICHANNEL
 * =============================================================================
 *
 * Telegram-style quick reaction picker that appears on message hover.
 * Shows 6 quick emojis for instant reactions.
 *
 * 🏢 ENTERPRISE FEATURES:
 * - Accessible (keyboard navigation, ARIA labels)
 * - Animated transitions
 * - Touch-friendly (works on mobile)
 * - Centralized emoji constants
 *
 * @module components/crm/inbox/ReactionPicker
 * @enterprise Omnichannel Communications
 */

import React, { useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { QUICK_REACTION_EMOJIS, type QuickReactionEmoji } from '@/types/conversations';
import { TRANSITION_PRESETS } from '@/components/ui/effects';

// ============================================================================
// TYPES
// ============================================================================

export interface ReactionPickerProps {
  /** Message ID to react to */
  messageId: string;
  /** Emojis the current user has already reacted with */
  userReactions?: Set<string>;
  /** Callback when a reaction is selected */
  onReaction: (messageId: string, emoji: string) => void;
  /** Whether the picker is visible */
  visible?: boolean;
  /** Position relative to message */
  position?: 'top' | 'bottom';
  /** Additional className */
  className?: string;
  /** Whether reactions are loading */
  isLoading?: boolean;
}

// ============================================================================
// EMOJI LABELS (for accessibility)
// ============================================================================

const EMOJI_LABELS: Record<QuickReactionEmoji, string> = {
  '👍': 'thumbs_up',
  '❤️': 'heart',
  '😂': 'laughing',
  '😮': 'surprised',
  '😢': 'sad',
  '😡': 'angry',
};

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * 🏢 ENTERPRISE: Quick reaction picker
 *
 * Displays a row of emoji buttons for quick reactions.
 * Appears on message hover (desktop) or long-press (mobile).
 *
 * @example
 * ```tsx
 * <ReactionPicker
 *   messageId={message.id}
 *   userReactions={userReactions}
 *   onReaction={handleToggleReaction}
 *   visible={isHovered}
 *   position="top"
 * />
 * ```
 */
export function ReactionPicker({
  messageId,
  userReactions = new Set(),
  onReaction,
  visible = true,
  position = 'top',
  className,
  isLoading = false,
}: ReactionPickerProps) {
  const { t } = useTranslation('crm');
  const colors = useSemanticColors();

  // Handle reaction click
  const handleClick = useCallback((emoji: string) => {
    if (isLoading) return;
    onReaction(messageId, emoji);
  }, [messageId, onReaction, isLoading]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent, emoji: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick(emoji);
    }
  }, [handleClick]);

  if (!visible) return null;

  return (
    <div
      className={cn(
        'absolute z-50',
        'flex items-center gap-0.5',
        'px-2 py-1 rounded-full',
        'bg-background/95 backdrop-blur-sm',
        'border shadow-lg',
        TRANSITION_PRESETS.STANDARD_COLORS,
        // Position
        position === 'top' ? 'bottom-full mb-1' : 'top-full mt-1',
        // Animation
        'animate-in fade-in-0 zoom-in-95',
        'duration-150',
        className
      )}
      role="group"
      aria-label={t('inbox.reactions.pickReaction', 'Επιλέξτε αντίδραση')}
    >
      {QUICK_REACTION_EMOJIS.map((emoji) => {
        const isSelected = userReactions.has(emoji);
        const label = EMOJI_LABELS[emoji];

        return (
          <button
            key={emoji}
            type="button"
            onClick={() => handleClick(emoji)}
            onKeyDown={(e) => handleKeyDown(e, emoji)}
            disabled={isLoading}
            className={cn(
              'w-8 h-8 flex items-center justify-center',
              'rounded-full',
              'text-xl',
              TRANSITION_PRESETS.STANDARD_COLORS,
              'hover:scale-125 hover:bg-accent',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              // Selected state
              isSelected && 'bg-primary/10 ring-2 ring-primary/30',
            )}
            aria-label={t(`inbox.reactions.${label}`, emoji)}
            aria-pressed={isSelected}
            title={t(`inbox.reactions.${label}`, emoji)}
          >
            <span role="img" aria-hidden="true">
              {emoji}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default ReactionPicker;
