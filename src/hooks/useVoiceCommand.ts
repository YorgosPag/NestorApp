/**
 * =============================================================================
 * USE VOICE COMMAND — ADR-164
 * =============================================================================
 *
 * Hook that orchestrates the voice → pipeline flow:
 *   submitCommand(text) → POST /api/voice/command → opens panel
 *
 * @module hooks/useVoiceCommand
 * @see ADR-164 (In-App Voice AI Pipeline)
 */

'use client';

import { useCallback, useState } from 'react';
import { useVoiceCommandStore } from '@/stores/voiceCommandStore';
import type { SubmitCommandResult } from '@/types/voice-command';

// ============================================================================
// TYPES
// ============================================================================

interface UseVoiceCommandReturn {
  /** Submit transcribed text to AI pipeline */
  submitCommand: (text: string) => Promise<SubmitCommandResult>;
  /** Whether submission is in progress */
  isSubmitting: boolean;
  /** Last submitted command ID (for tracking) */
  commandId: string | null;
  /** Error from last submission attempt */
  error: string | null;
}

// ============================================================================
// HOOK
// ============================================================================

export function useVoiceCommand(): UseVoiceCommandReturn {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [commandId, setCommandId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const openPanel = useVoiceCommandStore((s) => s.openPanel);

  const submitCommand = useCallback(
    async (text: string): Promise<SubmitCommandResult> => {
      const trimmed = text.trim();
      if (!trimmed) {
        const result: SubmitCommandResult = { success: false, error: 'Empty text' };
        setError(result.error ?? null);
        return result;
      }

      setIsSubmitting(true);
      setError(null);

      try {
        const response = await fetch('/api/voice/command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: trimmed }),
        });

        const result: SubmitCommandResult = await response.json();

        if (result.success && result.commandId) {
          setCommandId(result.commandId);
          // Open the AI panel with the new command
          openPanel(result.commandId, trimmed);
        } else {
          setError(result.error ?? 'Submission failed');
        }

        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Network error';
        setError(message);
        return { success: false, error: message };
      } finally {
        setIsSubmitting(false);
      }
    },
    [openPanel]
  );

  return { submitCommand, isSubmitting, commandId, error };
}
