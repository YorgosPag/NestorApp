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

/**
 * Detect the best supported audio MIME type for MediaRecorder.
 * Chrome/FF → webm/opus, Safari → mp4, fallback → webm
 */
function getSupportedMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return 'audio/webm';

  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];

  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }

  return 'audio/webm';
}

/**
 * Get file extension from MIME type
 */
function getExtensionFromMime(mime: string): string {
  if (mime.includes('mp4')) return 'mp4';
  if (mime.includes('ogg')) return 'ogg';
  return 'webm';
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
      const message = err instanceof Error ? err.message : String(err);
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

          const response = await fetch('/api/voice/transcribe', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            const errorData: { error?: string } = await response.json().catch(() => ({}));
            const errorMsg = errorData.error || `Server error ${response.status}`;
            setError(errorMsg);
            setStatus('error');
            resolve('');
            return;
          }

          const data: { success: boolean; text: string; error?: string } = await response.json();

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
          const message = err instanceof Error ? err.message : String(err);
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
