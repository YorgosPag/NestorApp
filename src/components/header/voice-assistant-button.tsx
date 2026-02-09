'use client';

/**
 * =============================================================================
 * VOICE ASSISTANT BUTTON — Global Header Voice Input (ADR-161)
 * =============================================================================
 *
 * Enterprise Pattern: Global voice input accessible from every page.
 * Following ChatGPT/Google/Microsoft voice assistant UX patterns.
 *
 * Features:
 * - Cross-browser MediaRecorder (Chrome, Firefox, Safari, iOS, Android)
 * - Whisper API transcription (excellent Greek support)
 * - Animated recording state with pulse effect
 * - Copy-to-clipboard result action
 *
 * @module components/header/voice-assistant-button
 * @enterprise ADR-161 - Global Voice Assistant
 */

import * as React from 'react';
import { Mic, MicOff, Loader2, Square, Copy, Check, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useAuth } from '@/auth/contexts/AuthContext';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { useVoiceCommand } from '@/hooks/useVoiceCommand';
import { cn } from '@/lib/utils';
import { TRANSITION_PRESETS } from '@/components/ui/effects';

// =============================================================================
// COMPONENT
// =============================================================================

export function VoiceAssistantButton() {
  const iconSizes = useIconSizes();
  const { t } = useTranslation('common');
  const { user } = useAuth();

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const {
    status,
    transcribedText,
    error,
    startRecording,
    stopRecording,
    reset,
  } = useVoiceRecorder();

  const { submitCommand, isSubmitting } = useVoiceCommand();

  // Reset state when dialog closes
  const handleDialogChange = React.useCallback(
    (open: boolean) => {
      if (!open) {
        reset();
        setCopied(false);
      }
      setDialogOpen(open);
    },
    [reset]
  );

  // Handle button click — open dialog or start recording
  const handleButtonClick = React.useCallback(() => {
    if (!user) return; // Auth required
    setDialogOpen(true);
  }, [user]);

  // Handle record/stop toggle
  const handleRecordToggle = React.useCallback(async () => {
    if (status === 'recording') {
      await stopRecording();
    } else {
      await startRecording();
    }
  }, [status, startRecording, stopRecording]);

  // Submit transcribed text to AI pipeline (ADR-164)
  const handleSubmitCommand = React.useCallback(async () => {
    if (!transcribedText) return;
    await submitCommand(transcribedText);
    // Close dialog — panel will open automatically via store
    setDialogOpen(false);
    reset();
    setCopied(false);
  }, [transcribedText, submitCommand, reset]);

  // Copy transcribed text to clipboard
  const handleCopy = React.useCallback(async () => {
    if (!transcribedText) return;
    try {
      await navigator.clipboard.writeText(transcribedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: textarea-based copy for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = transcribedText;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [transcribedText]);

  // Get error message from error code
  const errorMessage = React.useMemo(() => {
    if (!error) return null;
    if (error === 'PERMISSION_DENIED') {
      return t('voiceAssistant.permissionDenied', 'Microphone access denied. Please allow microphone access in your browser settings.');
    }
    if (error === 'EMPTY_RECORDING') {
      return t('voiceAssistant.emptyRecording', 'No audio was recorded. Please try again.');
    }
    if (error === 'TRANSCRIPTION_FAILED') {
      return t('voiceAssistant.transcriptionFailed', 'Transcription failed. Please try again.');
    }
    return t('voiceAssistant.genericError', 'An error occurred. Please try again.');
  }, [error, t]);

  // Determine if MediaRecorder is supported
  const isSupported =
    typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined';

  return (
    <>
      {/* Header Button */}
      <Button
        variant="outline"
        size="icon"
        onClick={handleButtonClick}
        disabled={!user}
        aria-label={t('voiceAssistant.tooltip', 'Voice command')}
        suppressHydrationWarning
      >
        <Mic className={iconSizes.sm} />
        <span className="sr-only" suppressHydrationWarning>
          {t('voiceAssistant.tooltip', 'Voice command')}
        </span>
      </Button>

      {/* Voice Recording Dialog */}
      <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle suppressHydrationWarning>
              {t('voiceAssistant.title', 'Voice Command')}
            </DialogTitle>
            <DialogDescription suppressHydrationWarning>
              {status === 'idle' &&
                t('voiceAssistant.description', 'Press the button to start recording')}
              {status === 'recording' &&
                t('voiceAssistant.recording', 'Listening...')}
              {status === 'transcribing' &&
                t('voiceAssistant.transcribing', 'Transcribing...')}
              {status === 'done' &&
                t('voiceAssistant.done', 'Transcription complete')}
              {status === 'error' && (errorMessage ?? '')}
            </DialogDescription>
          </DialogHeader>

          {/* Recording Area */}
          <section className="flex flex-col items-center gap-4 py-6">
            {/* Not Supported Message */}
            {!isSupported && (
              <p className="text-sm text-destructive text-center" suppressHydrationWarning>
                {t('voiceAssistant.notSupported', 'Voice recording is not supported in this browser.')}
              </p>
            )}

            {/* Mic Button — idle/recording/error states */}
            {isSupported && status !== 'transcribing' && status !== 'done' && (
              <button
                type="button"
                onClick={handleRecordToggle}
                className={cn(
                  'relative flex items-center justify-center rounded-full',
                  'h-20 w-20',
                  TRANSITION_PRESETS.SMOOTH_ALL,
                  status === 'recording'
                    ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
                )}
                aria-label={
                  status === 'recording'
                    ? t('voiceAssistant.stop', 'Stop recording')
                    : t('voiceAssistant.start', 'Start recording')
                }
              >
                {/* Pulse ring for recording state */}
                {status === 'recording' && (
                  <span
                    className="absolute inset-0 rounded-full bg-destructive/30 animate-ping"
                    aria-hidden="true"
                  />
                )}
                {status === 'recording' ? (
                  <Square className="h-8 w-8 relative z-10" />
                ) : (
                  <Mic className="h-8 w-8" />
                )}
              </button>
            )}

            {/* Transcribing Spinner */}
            {status === 'transcribing' && (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground" suppressHydrationWarning>
                  {t('voiceAssistant.processing', 'Processing audio...')}
                </p>
              </div>
            )}

            {/* Status Label */}
            {status === 'recording' && (
              <p className="text-sm font-medium text-destructive animate-pulse" suppressHydrationWarning>
                {t('voiceAssistant.recording', 'Listening...')}
              </p>
            )}

            {/* Transcription Result */}
            {status === 'done' && transcribedText && (
              <div className="w-full rounded-lg border bg-muted/50 p-4">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {transcribedText}
                </p>
              </div>
            )}

            {/* Error with retry */}
            {status === 'error' && (
              <div className="flex flex-col items-center gap-2">
                <MicOff className="h-10 w-10 text-destructive" />
                <p className="text-sm text-destructive text-center">
                  {errorMessage}
                </p>
              </div>
            )}
          </section>

          {/* Footer Actions */}
          <DialogFooter className="flex-row gap-2 sm:justify-between">
            {/* Left: Cancel */}
            <Button
              variant="outline"
              onClick={() => handleDialogChange(false)}
              suppressHydrationWarning
            >
              {status === 'done'
                ? t('voiceAssistant.close', 'Close')
                : t('voiceAssistant.cancel', 'Cancel')}
            </Button>

            {/* Right: Copy (when done) or Retry (when error) */}
            <div className="flex gap-2">
              {status === 'error' && (
                <Button onClick={() => reset()} variant="outline" suppressHydrationWarning>
                  {t('voiceAssistant.retry', 'Retry')}
                </Button>
              )}
              {status === 'done' && transcribedText && (
                <>
                  <Button
                    onClick={handleCopy}
                    variant="outline"
                    suppressHydrationWarning
                  >
                    {copied ? (
                      <>
                        <Check className={cn(iconSizes.sm, 'mr-1')} />
                        {t('voiceAssistant.copied', 'Copied!')}
                      </>
                    ) : (
                      <>
                        <Copy className={cn(iconSizes.sm, 'mr-1')} />
                        {t('voiceAssistant.copy', 'Copy text')}
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={handleSubmitCommand}
                    disabled={isSubmitting}
                    suppressHydrationWarning
                  >
                    {isSubmitting ? (
                      <Loader2 className={cn(iconSizes.sm, 'mr-1 animate-spin')} />
                    ) : (
                      <Send className={cn(iconSizes.sm, 'mr-1')} />
                    )}
                    {t('voiceAssistant.sendCommand', 'Send command')}
                  </Button>
                </>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
