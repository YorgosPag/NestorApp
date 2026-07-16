'use client';

/**
 * =============================================================================
 * USE VOICE RECORDER — Cross-Browser Voice Recording + Whisper Transcription
 * =============================================================================
 *
 * Enterprise Pattern: MediaRecorder API → Audio Blob → Server Whisper API
 * Following ChatGPT/Google/Microsoft voice input patterns.
 *
 * Cross-browser support:
 * - Chrome/Edge/FF: audio/webm;codecs=opus
 * - Safari/iOS: audio/mp4
 *
 * @module hooks/useVoiceRecorder
 * @enterprise ADR-161 - Global Voice Assistant
 */

import { useState, useRef, useCallback } from 'react';
import { getErrorMessage } from '@/lib/error-utils';
import { getExtensionFromMime, pickSupportedMime } from '@/lib/media/media-mime';
import { transcribeVoiceWithPolicy } from '@/services/voice/voice-mutation-gateway';

// =============================================================================
// TYPES
// =============================================================================

/** Voice recorder status states */
export type VoiceRecorderStatus =
  | 'idle'
  | 'recording'
  | 'transcribing'
  | 'done'
  | 'error';

/** Return type of the useVoiceRecorder hook */
export interface UseVoiceRecorderReturn {
  status: VoiceRecorderStatus;
  transcribedText: string;
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<string>;
  reset: () => void;
}

// =============================================================================
// MIME TYPE DETECTION (Cross-Browser)
// =============================================================================

/** Preferred audio containers, best first. Chrome/FF → webm/opus, Safari → mp4. */
const AUDIO_MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
] as const;

const AUDIO_MIME_FALLBACK = 'audio/webm';

/**
 * Detect the best supported audio MIME type for MediaRecorder.
 * The probe + extension mechanics are shared with `useVideoRecorder`
 * (ADR-584); only the candidate list is audio-specific.
 */
function getSupportedMimeType(): string {
  return pickSupportedMime(AUDIO_MIME_CANDIDATES, AUDIO_MIME_FALLBACK);
}

// =============================================================================
// HOOK
// =============================================================================

/**
 * Custom hook for voice recording with Whisper transcription.
 *
 * @example
 * ```tsx
 * const { status, transcribedText, startRecording, stopRecording, reset } = useVoiceRecorder();
 *
 * <button onClick={status === 'recording' ? stopRecording : startRecording}>
 *   {status === 'recording' ? 'Stop' : 'Record'}
 * </button>
 * ```
 */
export function useVoiceRecorder(): UseVoiceRecorderReturn {
  const [status, setStatus] = useState<VoiceRecorderStatus>('idle');
  const [transcribedText, setTranscribedText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  /**
   * Start recording audio from the microphone
   */
  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setTranscribedText('');

      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = getSupportedMimeType();
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.start(250); // Collect data every 250ms
      setStatus('recording');
    } catch (err) {
      const message = getErrorMessage(err);
      const isPermissionDenied =
        message.includes('Permission') ||
        message.includes('NotAllowed') ||
        message.includes('denied');

      setError(isPermissionDenied ? 'PERMISSION_DENIED' : message);
      setStatus('error');
    }
  }, []);

  /**
   * Stop recording and transcribe the audio via server API
   */
  const stopRecording = useCallback(async (): Promise<string> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        resolve('');
        return;
      }

      recorder.onstop = async () => {
        // Stop all audio tracks
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;

        const mimeType = recorder.mimeType || getSupportedMimeType();
        const audioBlob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];

        if (audioBlob.size === 0) {
          setError('EMPTY_RECORDING');
          setStatus('error');
          resolve('');
          return;
        }

        // Send to server for transcription
        setStatus('transcribing');
        try {
          const ext = getExtensionFromMime(mimeType);
          const formData = new FormData();
          formData.append('file', audioBlob, `voice.${ext}`);

          const data = await transcribeVoiceWithPolicy(formData);

          if (data.success && data.text) {
            setTranscribedText(data.text);
            setStatus('done');
            resolve(data.text);
          } else {
            setError(data.error || 'TRANSCRIPTION_FAILED');
            setStatus('error');
            resolve('');
          }
        } catch (err) {
          const message = getErrorMessage(err);
          setError(message);
          setStatus('error');
          resolve('');
        }
      };

      recorder.stop();
    });
  }, []);

  /**
   * Reset to idle state
   */
  const reset = useCallback(() => {
    // Clean up any active recording
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
    chunksRef.current = [];

    setStatus('idle');
    setTranscribedText('');
    setError(null);
  }, []);

  return {
    status,
    transcribedText,
    error,
    startRecording,
    stopRecording,
    reset,
  };
}
