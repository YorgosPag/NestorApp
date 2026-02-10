'use client';

/**
 * =============================================================================
 * MESSAGE CONTEXT MENU - ENTERPRISE OMNICHANNEL
 * =============================================================================
 *
 * Right-click context menu for message actions (delete, copy, etc.).
 * Designed for reuse across all communication channels.
 *
 * Uses Radix ContextMenu for native right-click support across all browsers.
 *
 * @module components/crm/inbox/MessageContextMenu
 * @enterprise Omnichannel Communications
 * @reusable Works with Telegram, Email, WhatsApp, SMS, etc.
 */

import React, { useCallback } from 'react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Trash2, Copy, CheckSquare, Square, Reply, Forward, Pencil, Pin, PinOff } from 'lucide-react';
import { QUICK_REACTION_EMOJIS } from '@/types/conversations';

// ============================================================================
// TYPES
// ============================================================================

export interface MessageContextMenuProps {
  /** Message ID */
  messageId: string;
  /** Message text content for copy */
  messageText: string;
  /** Whether message is selected */
  isSelected: boolean;
  /** Whether selection mode is active */
  isSelectionMode: boolean;
  /** Callback when delete is clicked */
  onDelete: (messageId: string) => void;
  /** Callback when select is toggled */
  onToggleSelect: (messageId: string) => void;
  /** Callback to enter selection mode */
  onEnterSelectionMode: () => void;
  /** Callback when copy is clicked */
  onCopy?: (text: string) => void;
  /** Callback when reply is clicked (optional) */
  onReply?: (messageId: string) => void;
  /** Callback when forward is clicked (optional) */
  onForward?: (messageId: string) => void;
  /** Callback when edit is clicked (optional - only for own messages) */
  onEdit?: (messageId: string) => void;
  /** Whether message is pinned */
  isPinned?: boolean;
  /** Callback when pin/unpin is clicked (optional) */
  onTogglePin?: (messageId: string, pinned: boolean) => void;
  /** Whether this is user's own message (for edit permission) */
  isOwnMessage?: boolean;
  /** Callback when a reaction is selected */
  onReaction?: (messageId: string, emoji: string) => void;
  /** Emojis the current user has reacted with */
  userReactions?: Set<string>;
  /** Children to wrap */
  children: React.ReactNode;
  /** Additional className */
  className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * 🏢 ENTERPRISE: Message context menu
 *
 * Provides right-click actions for messages:
 * - Reply / Forward
 * - Edit (own messages only)
 * - Pin / Unpin
 * - Copy text
 * - Select/Deselect
 * - Delete message
 *
 * @example
 * ```tsx
 * <MessageContextMenu
 *   messageId={message.id}
 *   messageText={message.content.text}
 *   isSelected={isSelected(message.id)}
 *   isSelectionMode={isSelectionMode}
 *   onDelete={handleDelete}
 *   onToggleSelect={toggleSelect}
 *   onEnterSelectionMode={enterSelectionMode}
 *   onReply={handleReply}
 *   onForward={handleForward}
 *   onEdit={handleEdit}
 *   isPinned={isPinned(message.id)}
 *   onTogglePin={handleTogglePin}
 *   isOwnMessage={isOutbound}
 * >
 *   <MessageBubble ... />
 * </MessageContextMenu>
 * ```
 */
export function MessageContextMenu({
  messageId,
  messageText,
  isSelected,
  isSelectionMode,
  onDelete,
  onToggleSelect,
  onEnterSelectionMode,
  onCopy,
  onReply,
  onForward,
  onEdit,
  isPinned = false,
  onTogglePin,
  isOwnMessage = false,
  onReaction,
  userReactions = new Set(),
  children,
  className,
}: MessageContextMenuProps) {
  const { t } = useTranslation('crm');
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleCopy = useCallback(() => {
    if (onCopy) {
      onCopy(messageText);
    } else {
      navigator.clipboard.writeText(messageText).catch(console.error);
    }
  }, [messageText, onCopy]);

  const handleDelete = useCallback(() => {
    onDelete(messageId);
  }, [messageId, onDelete]);

  const handleToggleSelect = useCallback(() => {
    if (!isSelectionMode) {
      onEnterSelectionMode();
    }
    onToggleSelect(messageId);
  }, [messageId, isSelectionMode, onToggleSelect, onEnterSelectionMode]);

  const handleReply = useCallback(() => {
    console.log('[MessageContextMenu] Reply clicked for:', messageId);
    if (onReply) {
      onReply(messageId);
    }
  }, [messageId, onReply]);

  const handleForward = useCallback(() => {
    console.log('[MessageContextMenu] Forward clicked for:', messageId);
    if (onForward) {
      onForward(messageId);
    }
  }, [messageId, onForward]);

  const handleEdit = useCallback(() => {
    console.log('[MessageContextMenu] Edit clicked for:', messageId);
    if (onEdit) {
      onEdit(messageId);
    }
  }, [messageId, onEdit]);

  const handleTogglePin = useCallback(() => {
    console.log('[MessageContextMenu] Pin/Unpin clicked for:', messageId, 'current isPinned:', isPinned);
    if (onTogglePin) {
      onTogglePin(messageId, !isPinned);
    }
  }, [messageId, isPinned, onTogglePin]);

  const handleReaction = useCallback((emoji: string) => {
    console.log('[MessageContextMenu] Reaction clicked:', emoji, 'for:', messageId);
    if (onReaction) {
      onReaction(messageId, emoji);
    }
  }, [messageId, onReaction]);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild className={className}>
        <div>{children}</div>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-56">
        {/* 🏢 ENTERPRISE: Quick Reactions Row (Telegram-style) */}
        {onReaction && (
          <>
            <div className="flex items-center justify-between px-2 py-1.5">
              {QUICK_REACTION_EMOJIS.map((emoji) => {
                const isReacted = userReactions.has(emoji);
                return (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleReaction(emoji)}
                    className={`
                      w-8 h-8 flex items-center justify-center
                      rounded-full text-lg
                      transition-all duration-150
                      hover:scale-125 hover:bg-accent
                      focus:outline-none focus:ring-2 focus:ring-ring
                      ${isReacted ? 'bg-primary/15 ring-1 ring-primary/30' : ''}
                    `}
                    aria-label={emoji}
                    aria-pressed={isReacted}
                  >
                    {emoji}
                  </button>
                );
              })}
            </div>
            <ContextMenuSeparator />
          </>
        )}

        {/* Reply */}
        <ContextMenuItem onClick={handleReply} className="gap-2 cursor-pointer">
          <Reply className={iconSizes.sm} />
          <span>{t('inbox.contextMenu.reply', 'Απάντηση')}</span>
        </ContextMenuItem>

        {/* Forward */}
        <ContextMenuItem onClick={handleForward} className="gap-2 cursor-pointer">
          <Forward className={iconSizes.sm} />
          <span>{t('inbox.contextMenu.forward', 'Προώθηση')}</span>
        </ContextMenuItem>

        {/* Edit - only for own messages */}
        {isOwnMessage && (
          <ContextMenuItem onClick={handleEdit} className="gap-2 cursor-pointer">
            <Pencil className={iconSizes.sm} />
            <span>{t('inbox.contextMenu.edit', 'Επεξεργασία')}</span>
          </ContextMenuItem>
        )}

        {/* Pin/Unpin */}
        <ContextMenuItem onClick={handleTogglePin} className="gap-2 cursor-pointer">
          {isPinned ? (
            <>
              <PinOff className={iconSizes.sm} />
              <span>{t('inbox.contextMenu.unpin', 'Ξεκαρφίτσωμα')}</span>
            </>
          ) : (
            <>
              <Pin className={iconSizes.sm} />
              <span>{t('inbox.contextMenu.pin', 'Καρφίτσωμα')}</span>
            </>
          )}
        </ContextMenuItem>

        <ContextMenuSeparator />

        {/* Select/Deselect */}
        <ContextMenuItem onClick={handleToggleSelect} className="gap-2 cursor-pointer">
          {isSelected ? (
            <>
              <CheckSquare className={iconSizes.sm} />
              <span>{t('inbox.contextMenu.deselect', 'Αποεπιλογή')}</span>
            </>
          ) : (
            <>
              <Square className={iconSizes.sm} />
              <span>{t('inbox.contextMenu.select', 'Επιλογή')}</span>
            </>
          )}
        </ContextMenuItem>

        {/* Copy */}
        <ContextMenuItem onClick={handleCopy} className="gap-2 cursor-pointer">
          <Copy className={iconSizes.sm} />
          <span>{t('inbox.contextMenu.copy', 'Αντιγραφή')}</span>
        </ContextMenuItem>

        <ContextMenuSeparator />

        {/* Delete */}
        <ContextMenuItem
          onClick={handleDelete}
          className={`gap-2 cursor-pointer ${colors.text.error}`}
        >
          <Trash2 className={iconSizes.sm} />
          <span>{t('inbox.contextMenu.delete', 'Διαγραφή')}</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export default MessageContextMenu;
