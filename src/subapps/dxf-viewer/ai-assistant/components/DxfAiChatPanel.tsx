/**
 * @module ai-assistant/components/DxfAiChatPanel
 * @description Chat panel UI for the DXF AI Drawing Assistant
 *
 * Semantic HTML structure:
 * <aside> — panel container
 *   <header> — title + close button
 *   <ScrollArea> — message list
 *     <ol> — ordered messages
 *       <li> — individual message
 *   <footer> — input form
 *
 * Zero inline styles — Tailwind only.
 * Reuses centralized UI components (Button, Input, ScrollArea).
 *
 * @see ADR-185 (AI Drawing Assistant)
 * @since 2026-02-17
 */

'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import { Bot, Loader2, Send, Sparkles, Trash2, User, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useDxfAiChat } from '../hooks/useDxfAiChat';
import type { DxfAiMessage } from '../types';
import type { SceneModel } from '../../types/entities';

// ============================================================================
// PROPS
// ============================================================================

export interface DxfAiChatPanelProps {
  /** Whether the panel is open */
  isOpen: boolean;
  /** Callback to close the panel */
  onClose: () => void;
  /** Get current scene for a level */
  getScene: (levelId: string) => SceneModel | null;
  /** Set scene for a level */
  setScene: (levelId: string, scene: SceneModel) => void;
  /** Current level ID */
  levelId: string;
}

// ============================================================================
// MESSAGE COMPONENT
// ============================================================================

interface MessageItemProps {
  message: DxfAiMessage;
}

const MessageItem = React.memo<MessageItemProps>(({ message }) => {
  const colors = useSemanticColors();
  const isUser = message.role === 'user';
  const isError = message.status === 'error';

  return (
    <li
      className={`flex gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
    >
      <span
        className={`flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full ${
          isUser ? 'bg-primary text-primary-foreground' : `${colors.bg.surface} ${colors.text.secondary}`
        }`}
        aria-hidden="true"
      >
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </span>
      <article
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words ${
          isUser
            ? 'bg-primary text-primary-foreground'
            : isError
              ? `${colors.bg.error} ${colors.text.primary}`
              : `${colors.bg.secondary} ${colors.text.primary}`
        }`}
      >
        {message.content}
      </article>
    </li>
  );
});

MessageItem.displayName = 'MessageItem';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

function DxfAiChatPanelInner({
  isOpen,
  onClose,
  getScene,
  setScene,
  levelId,
}: DxfAiChatPanelProps) {
  const colors = useSemanticColors();
  const { t } = useTranslation('dxf-viewer');
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const { messages, isLoading, sendMessage, clearChat } = useDxfAiChat({
    getScene,
    setScene,
    levelId,
  });

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      // Small delay to let animation finish
      const timer = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const input = inputRef.current;
    if (!input || !input.value.trim() || isLoading) return;

    const text = input.value;
    input.value = '';
    sendMessage(text);
  }, [isLoading, sendMessage]);

  if (!isOpen) return null;

  return (
    <aside
      className={`fixed right-0 top-0 z-50 flex h-full w-80 flex-col ${colors.bg.card} ${colors.border.default} border-l shadow-lg`}
      role="complementary"
      aria-label={t('aiAssistant.title')}
    >
      {/* Header */}
      <header
        className={`flex items-center justify-between px-3 py-2 ${colors.border.default} border-b`}
      >
        <span className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h2 className={`text-sm font-semibold ${colors.text.primary}`}>
            {t('aiAssistant.title')}
          </h2>
        </span>
        <span className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={clearChat}
            className="h-7 w-7"
            aria-label={t('aiAssistant.clear')}
            title={t('aiAssistant.clear')}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-7 w-7"
            aria-label={t('aiAssistant.toggleClose')}
          >
            <X className="w-4 h-4" />
          </Button>
        </span>
      </header>

      {/* Messages */}
      <ScrollArea className="flex-1 px-3 py-2">
        <div ref={scrollRef} className="flex flex-col">
          {messages.length === 0 ? (
            <p className={`text-center text-xs ${colors.text.muted} py-8`}>
              {t('aiAssistant.placeholder')}
            </p>
          ) : (
            <ol className="flex flex-col gap-3" aria-label="Chat messages">
              {messages.map((msg) => (
                <MessageItem key={msg.id} message={msg} />
              ))}
              {isLoading && (
                <li className="flex items-center gap-2">
                  <Loader2 className={`w-4 h-4 animate-spin ${colors.text.muted}`} />
                  <span className={`text-xs ${colors.text.muted}`}>
                    {t('aiAssistant.thinking')}
                  </span>
                </li>
              )}
            </ol>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <footer className={`px-3 py-2 ${colors.border.default} border-t`}>
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="flex items-center gap-2"
        >
          <Input
            ref={inputRef}
            type="text"
            placeholder={t('aiAssistant.inputPlaceholder')}
            disabled={isLoading}
            className="flex-1 text-sm"
            maxLength={500}
            autoComplete="off"
          />
          <Button
            type="submit"
            size="icon"
            disabled={isLoading}
            className="h-8 w-8 flex-shrink-0"
            aria-label={t('aiAssistant.send')}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </form>
      </footer>
    </aside>
  );
}

export const DxfAiChatPanel = React.memo(DxfAiChatPanelInner);
DxfAiChatPanel.displayName = 'DxfAiChatPanel';

export default DxfAiChatPanel;
