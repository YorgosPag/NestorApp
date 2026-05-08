'use client';

/**
 * =============================================================================
 * VOICE MIC BUTTON — Reusable inline microphone button (ADR-342)
 * =============================================================================
 *
 * SSoT component for voice-to-text input fields across the application.
 * Wraps useVoiceInput and renders a small icon button with state feedback.
 *
 * States:
 *   idle       → Mic icon, click to start recording
 *   recording  → Pulsing red MicOff icon, click to stop
 *   transcribing/polishing → Spinner, disabled
 *   done       → Mic icon (ready for next recording)
 *   error      → Red mic icon, tooltip shows error message
 *
 * @module components/voice-input/VoiceMicButton
 * @enterprise ADR-342 - Voice Input Field SSoT
 */

import { cn } from '@/lib/utils';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useVoiceInput } from '@/hooks/useVoiceInput';

// =============================================================================
// PROPS
// =============================================================================

interface VoiceMicButtonProps {
  onResult: (text: string) => void;
  disabled?: boolean;
  className?: string;
  skipPolish?: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function VoiceMicButton({
  onResult,
  disabled = false,
  className,
  skipPolish = false,
}: VoiceMicButtonProps) {
  const { t } = useTranslation('crm-inbox');
  const { status, toggle, error } = useVoiceInput({ onResult, skipPolish });

  const isProcessing = status === 'transcribing' || status === 'polishing';
  const isRecording = status === 'recording';
  const isError = status === 'error';
  const isDisabled = disabled || isProcessing;

  const tooltipLabel = (() => {
    if (isError) {
      if (error === 'PERMISSION_DENIED')
        return t('calendarPage.dialog.voiceInput.errorPermission');
      return t('calendarPage.dialog.voiceInput.errorGeneric');
    }
    if (isRecording) return t('calendarPage.dialog.voiceInput.stopRecording');
    if (status === 'transcribing') return t('calendarPage.dialog.voiceInput.transcribing');
    if (status === 'polishing') return t('calendarPage.dialog.voiceInput.polishing');
    return t('calendarPage.dialog.voiceInput.startRecording');
  })();

  const icon = (() => {
    if (isProcessing) return <Loader2 className="h-4 w-4 animate-spin" />;
    if (isRecording) return <MicOff className="h-4 w-4" />;
    return <Mic className="h-4 w-4" />;
  })();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={toggle}
            disabled={isDisabled}
            aria-label={tooltipLabel}
            className={cn(
              'h-7 w-7 shrink-0',
              isRecording && 'text-destructive animate-pulse',
              isError && 'text-destructive',
              className
            )}
          >
            {icon}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">
          {tooltipLabel}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
