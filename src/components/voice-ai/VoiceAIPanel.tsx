'use client';

/**
 * =============================================================================
 * VOICE AI PANEL — Right-Side Chat Panel (ADR-164)
 * =============================================================================
 *
 * Enterprise Pattern: Right-side conversational AI panel.
 * Industry standard: SAP Joule, Microsoft Copilot, Google Gemini, Salesforce Einstein.
 *
 * Features:
 * - Sheet (side="right") using existing Radix Sheet component
 * - Conversation history (user bubbles + AI response bubbles)
 * - Real-time status updates via Firestore onSnapshot
 * - Semantic HTML structure
 * - Enterprise design system integration
 *
 * @module components/voice-ai/VoiceAIPanel
 * @enterprise ADR-164 - In-App Voice AI Pipeline
 */

import * as React from 'react';
import { Loader2, Mic, Bot, Trash2, MessageSquare } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { useVoiceCommandStore } from '@/stores/voiceCommandStore';
import { useVoiceCommandSubscription } from '@/hooks/useVoiceCommandSubscription';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useIconSizes } from '@/hooks/useIconSizes';
import { cn } from '@/lib/utils';
import { TRANSITION_PRESETS } from '@/components/ui/effects';

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

/** User message bubble */
function UserBubble({ text, timestamp }: { text: string; timestamp: string }) {
  const colors = useSemanticColors();

  return (
    <article className="flex justify-end mb-3">
      <div
        className={cn(
          'max-w-[85%] rounded-2xl rounded-br-sm px-4 py-2.5',
          colors.bg.accent,
          'text-sm leading-relaxed'
        )}
      >
        <header className="flex items-center gap-1.5 mb-1">
          <Mic className="h-3 w-3 text-muted-foreground" />
          <time className="text-xs text-muted-foreground">
            {new Date(timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </time>
        </header>
        <p className="whitespace-pre-wrap">{text}</p>
      </div>
    </article>
  );
}

/** AI response bubble */
function AIBubble({
  text,
  intent,
}: {
  text: string;
  intent: string | null;
}) {
  return (
    <article className="flex justify-start mb-3">
      <div
        className={cn(
          'max-w-[85%] rounded-2xl rounded-bl-sm px-4 py-2.5',
          'bg-muted',
          'text-sm leading-relaxed'
        )}
      >
        <header className="flex items-center gap-1.5 mb-1">
          <Bot className="h-3 w-3 text-primary" />
          <span className="text-xs font-medium text-primary">AI</span>
          {intent && (
            <span className="text-xs text-muted-foreground">
              ({intent})
            </span>
          )}
        </header>
        <p className="whitespace-pre-wrap">{text}</p>
      </div>
    </article>
  );
}

/** Processing indicator */
function ProcessingIndicator({ t }: { t: (key: string, fallback: string) => string }) {
  return (
    <article className="flex justify-start mb-3">
      <div
        className={cn(
          'max-w-[85%] rounded-2xl rounded-bl-sm px-4 py-3',
          'bg-muted',
          'text-sm'
        )}
      >
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-muted-foreground">
            {t('voiceAssistant.aiProcessing', 'Processing your command...')}
          </span>
        </div>
      </div>
    </article>
  );
}

/** Error bubble */
function ErrorBubble({ message }: { message: string }) {
  return (
    <article className="flex justify-start mb-3">
      <div
        className={cn(
          'max-w-[85%] rounded-2xl rounded-bl-sm px-4 py-2.5',
          'bg-destructive/10 border border-destructive/20',
          'text-sm text-destructive'
        )}
      >
        <p>{message}</p>
      </div>
    </article>
  );
}

// =============================================================================
// CONVERSATION ENTRY
// =============================================================================

/** Renders a single command + response pair */
function ConversationEntry({ commandId }: { commandId: string }) {
  const { t } = useTranslation('common');
  const entry = useVoiceCommandStore((s) =>
    s.commandHistory.find((c) => c.commandId === commandId)
  );

  // Subscribe to real-time updates for this command
  useVoiceCommandSubscription(commandId);

  if (!entry) return null;

  return (
    <div>
      <UserBubble text={entry.transcript} timestamp={entry.createdAt} />

      {(entry.status === 'pending' || entry.status === 'processing') && (
        <ProcessingIndicator t={t} />
      )}

      {entry.status === 'completed' && entry.aiResponse && (
        <AIBubble text={entry.aiResponse} intent={entry.intent} />
      )}

      {entry.status === 'failed' && entry.error && (
        <ErrorBubble
          message={entry.error}
        />
      )}
    </div>
  );
}

// =============================================================================
// MAIN PANEL
// =============================================================================

export function VoiceAIPanel() {
  const { t } = useTranslation('common');
  const iconSizes = useIconSizes();
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const isOpen = useVoiceCommandStore((s) => s.isOpen);
  const closePanel = useVoiceCommandStore((s) => s.closePanel);
  const commandHistory = useVoiceCommandStore((s) => s.commandHistory);
  const clearHistory = useVoiceCommandStore((s) => s.clearHistory);

  // Auto-scroll to bottom when new commands are added
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0; // newest is at top
    }
  }, [commandHistory.length]);

  const handleOpenChange = React.useCallback(
    (open: boolean) => {
      if (!open) closePanel();
    },
    [closePanel]
  );

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          'w-full sm:w-[420px] sm:max-w-[420px]',
          'flex flex-col',
          TRANSITION_PRESETS.SMOOTH_ALL
        )}
      >
        <SheetHeader className="flex-shrink-0 pb-3 border-b">
          <SheetTitle
            className="flex items-center gap-2"
            suppressHydrationWarning
          >
            <Bot className={iconSizes.md} />
            {t('voiceAssistant.panelTitle', 'Voice AI Assistant')}
          </SheetTitle>
          <SheetDescription suppressHydrationWarning>
            {t('voiceAssistant.panelDescription', 'AI responses to your voice commands')}
          </SheetDescription>
        </SheetHeader>

        {/* Conversation Area */}
        <aside className="flex-1 min-h-0 py-4">
          {commandHistory.length === 0 ? (
            <section className="flex flex-col items-center justify-center h-full text-center gap-3">
              <MessageSquare className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground" suppressHydrationWarning>
                {t(
                  'voiceAssistant.emptyHistory',
                  'No voice commands yet. Use the microphone button to start.'
                )}
              </p>
            </section>
          ) : (
            <ScrollArea className="h-full pr-2" ref={scrollRef}>
              <div className="space-y-1">
                {commandHistory.map((entry) => (
                  <ConversationEntry
                    key={entry.commandId}
                    commandId={entry.commandId}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </aside>

        {/* Footer Actions */}
        {commandHistory.length > 0 && (
          <footer className="flex-shrink-0 pt-3 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={clearHistory}
              className="w-full"
              suppressHydrationWarning
            >
              <Trash2 className={cn(iconSizes.sm, 'mr-1.5')} />
              {t('voiceAssistant.clearHistory', 'Clear history')}
            </Button>
          </footer>
        )}
      </SheetContent>
    </Sheet>
  );
}
