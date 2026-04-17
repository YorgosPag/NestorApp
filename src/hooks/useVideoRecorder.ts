'use client';

/**
 * =============================================================================
 * useVideoRecorder — Desktop Video Recording Hook (WebRTC + MediaRecorder)
 * =============================================================================
 *
 * Enterprise Pattern: MediaDevices.getUserMedia (video+audio) → MediaRecorder → File
 * Mirror of useVoiceRecorder (ADR-161) for video capture.
 *
 * Cross-browser MIME detection:
 * - Chrome/Edge/Firefox: video/webm;codecs=vp9,opus
 * - Safari: video/mp4
 *
 * @module hooks/useVideoRecorder
 * @enterprise ADR-311 - Desktop Camera Capture via WebRTC
 * @see ADR-161 - useVoiceRecorder (parallel pattern for audio)
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('useVideoRecorder');

// =============================================================================
// TYPES
// =============================================================================

export type VideoRecorderStatus =
  | 'idle'
  | 'requesting'
  | 'ready'
  | 'recording'
  | 'finalizing'
  | 'error';

export type VideoRecorderErrorCode =
  | 'PERMISSION_DENIED'
  | 'NO_DEVICE'
  | 'NOT_SUPPORTED'
  | 'DEVICE_BUSY'
  | 'UNKNOWN';

export interface UseVideoRecorderReturn {
  status: VideoRecorderStatus;
  errorCode: VideoRecorderErrorCode | null;
  errorMessage: string | null;
  durationMs: number;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  stream: MediaStream | null;
  startCamera: (deviceId?: string) => Promise<void>;
  stopCamera: () => void;
  startRecording: () => void;
  stopRecording: () => Promise<File | null>;
}

// =============================================================================
// MIME TYPE DETECTION
// =============================================================================

function getSupportedVideoMime(): string {
  if (typeof MediaRecorder === 'undefined') return 'video/webm';
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4',
  ];
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return 'video/webm';
}

function getExtensionFromMime(mime: string): string {
  if (mime.includes('mp4')) return 'mp4';
  return 'webm';
}

function mapErrorToCode(error: unknown): VideoRecorderErrorCode {
  if (!(error instanceof Error)) return 'UNKNOWN';
  const name = error.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'PERMISSION_DENIED';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'NO_DEVICE';
  if (name === 'NotReadableError' || name === 'AbortError') return 'DEVICE_BUSY';
  if (name === 'TypeError') return 'NOT_SUPPORTED';
  return 'UNKNOWN';
}

// =============================================================================
// HOOK
// =============================================================================

export function useVideoRecorder(): UseVideoRecorderReturn {
  const [status, setStatus] = useState<VideoRecorderStatus>('idle');
  const [errorCode, setErrorCode] = useState<VideoRecorderErrorCode | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTick = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const stopCamera = useCallback(() => {
    const current = streamRef.current;
    if (current) {
      current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStream(null);
    setStatus('idle');
  }, []);

  const startCamera = useCallback(async (deviceId?: string) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('error');
      setErrorCode('NOT_SUPPORTED');
      setErrorMessage('MediaDevices API not available');
      return;
    }

    try {
      setStatus('requesting');
      setErrorCode(null);
      setErrorMessage(null);

      const previous = streamRef.current;
      if (previous) {
        previous.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      const constraints: MediaStreamConstraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId } }
          : { facingMode: 'environment' },
        audio: true,
      };

      const next = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = next;
      setStream(next);

      if (videoRef.current) {
        videoRef.current.srcObject = next;
      }

      setStatus('ready');
    } catch (err) {
      const code = mapErrorToCode(err);
      const message = getErrorMessage(err, 'Camera access failed');
      if (code === 'PERMISSION_DENIED') {
        logger.warn('startCamera blocked by user', { code });
      } else {
        logger.error('startCamera failed', { code, message });
      }
      setErrorCode(code);
      setErrorMessage(message);
      setStatus('error');
    }
  }, []);

  const startRecording = useCallback(() => {
    const currentStream = streamRef.current;
    if (!currentStream) return;

    try {
      const mimeType = getSupportedVideoMime();
      const recorder = new MediaRecorder(currentStream, { mimeType });
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.start(500);
      startedAtRef.current = Date.now();
      setDurationMs(0);
      setStatus('recording');

      tickRef.current = setInterval(() => {
        setDurationMs(Date.now() - startedAtRef.current);
      }, 250);
    } catch (err) {
      const message = getErrorMessage(err, 'Recording failed to start');
      logger.error('startRecording failed', { message });
      setErrorCode('UNKNOWN');
      setErrorMessage(message);
      setStatus('error');
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<File | null> => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') return null;

    return new Promise((resolve) => {
      recorder.onstop = () => {
        clearTick();
        const mimeType = recorder.mimeType || getSupportedVideoMime();
        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];

        if (blob.size === 0) {
          setErrorCode('UNKNOWN');
          setErrorMessage('Empty recording');
          setStatus('error');
          resolve(null);
          return;
        }

        const ext = getExtensionFromMime(mimeType);
        const file = new File([blob], `video-${Date.now()}.${ext}`, { type: mimeType });
        setStatus('ready');
        resolve(file);
      };

      setStatus('finalizing');
      recorder.stop();
    });
  }, [clearTick]);

  useEffect(() => {
    return () => {
      clearTick();
      const current = streamRef.current;
      if (current) {
        current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (recorderRef.current?.state === 'recording') {
        recorderRef.current.stop();
      }
    };
  }, [clearTick]);

  return {
    status,
    errorCode,
    errorMessage,
    durationMs,
    videoRef,
    stream,
    startCamera,
    stopCamera,
    startRecording,
    stopRecording,
  };
}
