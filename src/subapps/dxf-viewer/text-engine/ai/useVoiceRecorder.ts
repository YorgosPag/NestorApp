'use client';

/**
 * ADR-344 Phase 12 — Client-side voice recorder hook.
 *
 * MediaRecorder → Blob → POST /api/voice/transcribe (ADR-161 SSoT)
 * via transcribeVoiceWithPolicy() from voice-mutation-gateway.
 *
 * Max recording: MAX_RECORDING_MS (30s). Auto-stops on timeout.
 * Supported check: feature-detects MediaRecorder + getUserMedia.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { transcribeVoiceWithPolicy } from '@/services/voice/voice-mutation-gateway';

export type VoiceRecorderState = 'idle' | 'recording' | 'processing' | 'done' | 'error';

export interface UseVoiceRecorderReturn {
  readonly state: VoiceRecorderState;
  readonly transcript: string;
  readonly error: string | null;
  readonly isSupported: boolean;
  readonly startRecording: () => Promise<void>;
  readonly stopRecording: () => void;
  readonly reset: () => void;
}

const MAX_RECORDING_MS = 30_000;

function buildAudioFormData(blob: Blob): FormData {
  const ext = blob.type.includes('ogg') ? 'ogg' : 'webm';
  const file = new File([blob], `voice.${ext}`, { type: blob.type });
  const form = new FormData();
  form.append('file', file);
  return form;
}

export function useVoiceRecorder(): UseVoiceRecorderReturn {
  const [state, setState] = useState<VoiceRecorderState>('idle');
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isSupported =
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== 'undefined';

  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  }, []);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
  }, []);

  const processBlob = useCallback(async (blob: Blob) => {
    setState('processing');
    try {
      const result = await transcribeVoiceWithPolicy(buildAudioFormData(blob));
      if (result.success && result.text) {
        setTranscript(result.text);
        setState('done');
      } else {
        setError(result.error ?? 'transcription_empty');
        setState('error');
      }
    } catch {
      setError('transcription_failed');
      setState('error');
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (!isSupported) {
      setError('voice_not_supported');
      setState('error');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        cleanup();
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        void processBlob(blob);
      };

      recorder.start();
      setState('recording');

      timeoutRef.current = setTimeout(() => recorder.stop(), MAX_RECORDING_MS);
    } catch {
      setError('microphone_denied');
      setState('error');
    }
  }, [isSupported, cleanup, processBlob]);

  const reset = useCallback(() => {
    cleanup();
    setState('idle');
    setTranscript('');
    setError(null);
  }, [cleanup]);

  useEffect(() => () => cleanup(), [cleanup]);

  return { state, transcript, error, isSupported, startRecording, stopRecording, reset };
}
