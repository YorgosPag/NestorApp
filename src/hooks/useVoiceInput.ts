'use client';

/**
 * =============================================================================
 * USE VOICE INPUT — SSoT hook for voice-to-text field input (ADR-342)
 * =============================================================================
 *
 * Orchestrates: recording (useVoiceRecorder) → Whisper transcription → AI polish.
 * Single hook used by VoiceMicButton across the entire application.
 *
 * Status flow:
 *   idle → recording → transcribing → polishing → done
 *                                   ↘ done (skipPolish=true)
 *   Any stage → error (with fallback to raw text where possible)
 *
 * @module hooks/useVoiceInput
 * @enterprise ADR-342 - Voice Input Field SSoT
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { polishVoiceTextWithPolicy } from '@/services/voice/voice-mutation-gateway';

// =============================================================================
// TYPES
// =============================================================================

export type VoiceInputStatus =
  | 'idle'
  | 'recording'
  | 'transcribing'
  | 'polishing'
  | 'done'
  | 'error';

export interface UseVoiceInputOptions {
  onResult: (text: string) => void;
  skipPolish?: boolean;
}

export interface UseVoiceInputReturn {
  status: VoiceInputStatus;
  toggle: () => Promise<void>;
  reset: () => void;
  error: string | null;
}

// =============================================================================
// HOOK
// =============================================================================

/**
 * Wraps useVoiceRecorder and adds optional AI polish step.
 * Calls onResult(text) with the final formatted text.
 *
 * @example
 * ```tsx
 * const { status, toggle, reset } = useVoiceInput({
 *   onResult: (text) => setDescription(prev => prev ? `${prev}\n${text}` : text),
 * });
 * ```
 */
export function useVoiceInput({
  onResult,
  skipPolish = false,
}: UseVoiceInputOptions): UseVoiceInputReturn {
  const [isPolishing, setIsPolishing] = useState(false);
  const [polishError, setPolishError] = useState<string | null>(null);
  const resultFiredRef = useRef(false);

  // Stable ref so polish useEffect never closes over stale onResult
  const onResultRef = useRef(onResult);
  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  const {
    status: recStatus,
    transcribedText,
    error: recError,
    startRecording,
    stopRecording,
    reset: resetRecorder,
  } = useVoiceRecorder();

  // ==========================================================================
  // Polish step — fires when transcription completes
  // ==========================================================================

  useEffect(() => {
    if (recStatus !== 'done' || !transcribedText || resultFiredRef.current) return;
    resultFiredRef.current = true;

    if (skipPolish) {
      onResultRef.current(transcribedText);
      return;
    }

    setIsPolishing(true);
    setPolishError(null);

    polishVoiceTextWithPolicy(transcribedText)
      .then((result) => {
        onResultRef.current(
          result.success && result.text ? result.text : transcribedText
        );
      })
      .catch(() => {
        // Belt-and-suspenders: deliver raw text even if polish fails
        onResultRef.current(transcribedText);
      })
      .finally(() => {
        setIsPolishing(false);
      });
  }, [recStatus, transcribedText, skipPolish]);

  // ==========================================================================
  // Derived status
  // ==========================================================================

  const computedStatus = ((): VoiceInputStatus => {
    if (isPolishing) return 'polishing';
    if (recStatus === 'error') return 'error';
    if (recStatus === 'done') return 'done';
    // idle | recording | transcribing map directly
    return recStatus as VoiceInputStatus;
  })();

  // ==========================================================================
  // Controls
  // ==========================================================================

  const toggle = useCallback(async () => {
    if (computedStatus === 'recording') {
      await stopRecording();
    } else if (
      computedStatus === 'idle' ||
      computedStatus === 'done' ||
      computedStatus === 'error'
    ) {
      resultFiredRef.current = false;
      setPolishError(null);
      await startRecording();
    }
    // transcribing / polishing states: ignore clicks (button will be disabled)
  }, [computedStatus, startRecording, stopRecording]);

  const reset = useCallback(() => {
    resultFiredRef.current = false;
    setIsPolishing(false);
    setPolishError(null);
    resetRecorder();
  }, [resetRecorder]);

  return {
    status: computedStatus,
    toggle,
    reset,
    error: polishError ?? recError,
  };
}
