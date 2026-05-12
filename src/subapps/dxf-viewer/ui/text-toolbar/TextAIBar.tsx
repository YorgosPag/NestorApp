'use client';

/**
 * ADR-344 Phase 12 — TextAIBar: AI text command entry popup.
 *
 * Radix Popover toggle attached to the TextToolbar.
 * Input: text prompt + optional voice (ADR-161 Whisper via useVoiceRecorder).
 * On submit: resolves intent via /api/dxf/text/ai/command → dispatches ICommand
 * through onExecuteCommand (caller owns CommandHistory).
 *
 * History (localStorage, last 10) shown in popup for quick re-use.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, Mic, MicOff, Send, Clock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { route } from '../../text-engine/ai/TextAICommandRouter';
import { useVoiceRecorder } from '../../text-engine/ai/useVoiceRecorder';
import {
  getAIBarHistory,
  pushAIBarHistory,
} from './text-ai-bar-history';
import type { TextAIContext } from '../../text-engine/ai/text-ai-types';
import type { ICommand } from '../../core/commands/interfaces';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TextAIBarProps {
  readonly aiContext: TextAIContext;
  readonly onExecuteCommand: (cmd: ICommand) => void;
  readonly disabled?: boolean;
}

type SubmitState = 'idle' | 'submitting' | 'success' | 'error';

// ── Hooks ─────────────────────────────────────────────────────────────────────

function useTextAIBarState(aiContext: TextAIContext, onExecuteCommand: (c: ICommand) => void) {
  const [text, setText] = useState('');
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [history, setHistory] = useState<readonly string[]>([]);
  const [open, setOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const refreshHistory = useCallback(() => setHistory(getAIBarHistory()), []);

  useEffect(() => {
    if (open) refreshHistory();
  }, [open, refreshHistory]);

  const handleSubmit = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setSubmitState('submitting');
    setErrorMsg(null);

    const result = await route(trimmed, aiContext);
    if (result.ok) {
      onExecuteCommand(result.command);
      pushAIBarHistory(trimmed);
      setText('');
      setSubmitState('success');
      refreshHistory();
      setTimeout(() => setSubmitState('idle'), 1800);
    } else {
      setErrorMsg(result.error);
      setSubmitState('error');
    }
  }, [text, aiContext, onExecuteCommand, refreshHistory]);

  const handleHistoryClick = useCallback((entry: string) => {
    setText(entry);
    textareaRef.current?.focus();
  }, []);

  const resetError = useCallback(() => {
    setSubmitState('idle');
    setErrorMsg(null);
  }, []);

  return {
    text, setText,
    submitState, errorMsg,
    history,
    open, setOpen,
    textareaRef,
    handleSubmit,
    handleHistoryClick,
    resetError,
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface VoiceMicButtonProps {
  readonly onTranscript: (t: string) => void;
  readonly disabled: boolean;
}

function VoiceMicButton({ onTranscript, disabled }: VoiceMicButtonProps) {
  const { t } = useTranslation(['textAi']);
  const { state, transcript, startRecording, stopRecording, reset, isSupported } =
    useVoiceRecorder();

  useEffect(() => {
    if (state === 'done' && transcript) {
      onTranscript(transcript);
      reset();
    }
  }, [state, transcript, onTranscript, reset]);

  const isRecording = state === 'recording';
  const isProcessing = state === 'processing';

  if (!isSupported) return null;

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={disabled || isProcessing}
      aria-label={isRecording ? t('textAi:stopRecording') : t('textAi:startRecording')}
      aria-pressed={isRecording}
      onClick={isRecording ? stopRecording : () => void startRecording()}
      className={cn(
        'shrink-0',
        isRecording && 'border-destructive text-destructive',
        isProcessing && 'opacity-50',
      )}
    >
      {isProcessing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isRecording ? (
        <MicOff className="h-4 w-4" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
    </Button>
  );
}

interface HistoryListProps {
  readonly entries: readonly string[];
  readonly onSelect: (entry: string) => void;
}

function HistoryList({ entries, onSelect }: HistoryListProps) {
  const { t } = useTranslation(['textAi']);
  if (entries.length === 0) return null;

  return (
    <section aria-label={t('textAi:history')}>
      <p className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
        <Clock className="h-3 w-3" />
        {t('textAi:recentCommands')}
      </p>
      <ul className="space-y-0.5">
        {entries.slice(0, 5).map((entry, i) => (
          <li key={i}>
            <button
              type="button"
              onClick={() => onSelect(entry)}
              className="w-full truncate rounded px-2 py-1 text-left text-xs hover:bg-accent hover:text-accent-foreground"
            >
              {entry}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function TextAIBar({ aiContext, onExecuteCommand, disabled = false }: TextAIBarProps) {
  const { t } = useTranslation(['textAi']);
  const {
    text, setText,
    submitState, errorMsg,
    history,
    open, setOpen,
    textareaRef,
    handleSubmit,
    handleHistoryClick,
    resetError,
  } = useTextAIBarState(aiContext, onExecuteCommand);

  const isSubmitting = submitState === 'submitting';
  const isSuccess = submitState === 'success';

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isSubmitting) void handleSubmit();
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={open ? 'default' : 'outline'}
          size="sm"
          disabled={disabled}
          aria-label={t('textAi:openAI')}
          aria-expanded={open}
          className="min-h-[44px] sm:min-h-[36px]"
        >
          <Sparkles className="h-4 w-4" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        side="bottom"
        align="end"
        className="w-80 space-y-3 p-3"
      >
        <header>
          <p className="text-sm font-medium">{t('textAi:title')}</p>
          <p className="text-xs text-muted-foreground">{t('textAi:subtitle')}</p>
        </header>

        <div className="flex gap-1.5">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => { setText(e.target.value); if (submitState === 'error') resetError(); }}
            onKeyDown={handleKeyDown}
            placeholder={t('textAi:placeholder')}
            disabled={isSubmitting}
            rows={2}
            className={cn(
              'flex-1 resize-none rounded-md border border-input bg-background px-3 py-2',
              'text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring',
              'disabled:opacity-50',
            )}
          />
          <div className="flex flex-col gap-1">
            <VoiceMicButton
              disabled={isSubmitting}
              onTranscript={(tr) => setText(tr)}
            />
            <Button
              type="button"
              size="sm"
              disabled={disabled || isSubmitting || !text.trim()}
              onClick={() => void handleSubmit()}
              aria-label={t('textAi:send')}
              className="shrink-0"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {isSuccess && (
          <p className="text-xs text-green-600 dark:text-green-400">
            {t('textAi:success')}
          </p>
        )}
        {submitState === 'error' && (
          <p className="text-xs text-destructive">
            {t(`textAi:errors.${errorMsg ?? 'ai_error'}`, { defaultValue: '' }) ||
              t('textAi:errors.ai_error')}
          </p>
        )}

        <HistoryList entries={history} onSelect={handleHistoryClick} />
      </PopoverContent>
    </Popover>
  );
}
