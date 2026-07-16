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
 * The stream session (permission, constraints, error mapping, teardown) is
 * shared with `useCameraCapture` via `useMediaStreamSession` (ADR-584). This
 * hook owns only the recording: the MediaRecorder, the chunk buffer and the
 * duration tick.
 *
 * @module hooks/useVideoRecorder
 * @enterprise ADR-311 - Desktop Camera Capture via WebRTC
 * @see ADR-161 - useVoiceRecorder (parallel pattern for audio)
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { getErrorMessage } from '@/lib/error-utils';
import { getExtensionFromMime, pickSupportedMime } from '@/lib/media/media-mime';
import { createModuleLogger } from '@/lib/telemetry';

import type {
  MediaSessionErrorCode,
  MediaSessionStatus,
} from './media/useMediaStreamSession';
import { useMediaStreamSession } from './media/useMediaStreamSession';

const logger = createModuleLogger('useVideoRecorder');

// =============================================================================
// TYPES
// =============================================================================

export type VideoRecorderStatus =
  | MediaSessionStatus
  | 'recording'
  | 'finalizing';

export type VideoRecorderErrorCode = MediaSessionErrorCode;

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
// CONSTANTS
// =============================================================================

/** Preferred containers, best first. Probed against the running browser. */
const VIDEO_MIME_CANDIDATES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
  'video/mp4',
] as const;

const VIDEO_MIME_FALLBACK = 'video/webm';

/** How often MediaRecorder flushes a chunk. */
const CHUNK_INTERVAL_MS = 500;

/** How often the elapsed-time readout updates. */
const TICK_INTERVAL_MS = 250;

function getSupportedVideoMime(): string {
  return pickSupportedMime(VIDEO_MIME_CANDIDATES, VIDEO_MIME_FALLBACK);
}

// =============================================================================
// HOOK
// =============================================================================

export function useVideoRecorder(): UseVideoRecorderReturn {
  const [durationMs, setDurationMs] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const session = useMediaStreamSession<'recording' | 'finalizing'>({
    audio: true,
    logger,
  });

  const { streamRef, setStatus, fail } = session;

  const clearTick = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
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

      recorder.start(CHUNK_INTERVAL_MS);
      startedAtRef.current = Date.now();
      setDurationMs(0);
      setStatus('recording');

      tickRef.current = setInterval(() => {
        setDurationMs(Date.now() - startedAtRef.current);
      }, TICK_INTERVAL_MS);
    } catch (err) {
      const message = getErrorMessage(err, 'Recording failed to start');
      logger.error('startRecording failed', { message });
      fail('UNKNOWN', message);
    }
  }, [streamRef, setStatus, fail]);

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
          fail('UNKNOWN', 'Empty recording');
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
  }, [clearTick, setStatus, fail]);

  // The session stops the camera tracks on unmount; the recorder is ours.
  useEffect(() => {
    return () => {
      clearTick();
      if (recorderRef.current?.state === 'recording') {
        recorderRef.current.stop();
      }
    };
  }, [clearTick]);

  return {
    status: session.status,
    errorCode: session.errorCode,
    errorMessage: session.errorMessage,
    durationMs,
    videoRef: session.videoRef,
    stream: session.stream,
    startCamera: session.startCamera,
    stopCamera: session.stopCamera,
    startRecording,
    stopRecording,
  };
}
