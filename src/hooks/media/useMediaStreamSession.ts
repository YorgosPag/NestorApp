'use client';

/**
 * =============================================================================
 * useMediaStreamSession — the getUserMedia video session, owned once
 * =============================================================================
 *
 * `useCameraCapture` (canvas frame grab → JPEG) and `useVideoRecorder`
 * (MediaRecorder → webm/mp4) do two genuinely different things with one
 * genuinely identical prerequisite: a live camera stream bound to a
 * `<video>` element, with permission errors mapped to a stable code and every
 * track stopped on teardown. That prerequisite was copy-pasted between them —
 * including `mapErrorToCode` byte-for-byte, so a fix to one could never reach
 * the other.
 *
 * This module owns the session exactly once. The two hooks stay separate and
 * keep their own public signatures; they supply only what actually differs:
 *
 *   - `audio`         — the constraint (false for photos, true for video)
 *   - `logger`        — so telemetry keeps each hook's own module name
 *   - `onStreamReady` — per-hook work once the stream is live (device
 *                       enumeration for the camera; nothing for the recorder)
 *   - `onStopped`     — per-hook teardown of state the session does not own
 *
 * Extended statuses ('capturing' / 'recording' | 'finalizing') are threaded
 * through the `TExtra` type parameter, so each hook keeps its exact status
 * union instead of collapsing onto a lowest common denominator.
 *
 * NOT a public camera hook: it has no capture and no recording. Consumers use
 * `useCameraCapture` or `useVideoRecorder`.
 *
 * @module hooks/media/useMediaStreamSession
 * @ssot ADR-584 — de-duplication of the two desktop camera hooks
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import { getErrorMessage } from '@/lib/error-utils';
import type { Logger } from '@/lib/telemetry';

// =============================================================================
// TYPES
// =============================================================================

/** Statuses every media session goes through, regardless of what it captures. */
export type MediaSessionStatus = 'idle' | 'requesting' | 'ready' | 'error';

/** Stable codes the UI can branch on, mapped from the browser's error names. */
export type MediaSessionErrorCode =
  | 'PERMISSION_DENIED'
  | 'NO_DEVICE'
  | 'NOT_SUPPORTED'
  | 'DEVICE_BUSY'
  | 'UNKNOWN';

export interface UseMediaStreamSessionOptions {
  /** Request a microphone track alongside the camera. */
  audio: boolean;
  /** Per-hook logger, so telemetry keeps the calling hook's module name. */
  logger: Logger;
  /**
   * Runs once the stream is live and bound to the video element, before the
   * status flips to 'ready'. Throwing here surfaces as a session error.
   */
  onStreamReady?: (
    stream: MediaStream,
    requestedDeviceId?: string
  ) => Promise<void> | void;
  /** Runs after every track is stopped, before the status flips to 'idle'. */
  onStopped?: () => void;
}

export interface UseMediaStreamSessionReturn<TExtra extends string> {
  status: MediaSessionStatus | TExtra;
  errorCode: MediaSessionErrorCode | null;
  errorMessage: string | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** Live handle for callbacks that must not re-render on stream change. */
  streamRef: React.MutableRefObject<MediaStream | null>;
  stream: MediaStream | null;
  startCamera: (deviceId?: string) => Promise<void>;
  stopCamera: () => void;
  /** Lets the owning hook drive its own extended statuses. */
  setStatus: Dispatch<SetStateAction<MediaSessionStatus | TExtra>>;
  /** Records a failure: sets code + message and flips the status to 'error'. */
  fail: (code: MediaSessionErrorCode, message: string) => void;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Map a `getUserMedia` rejection to a stable code.
 *
 * The browser's `DOMException.name` is the only reliable signal here — the
 * message is locale-dependent and vendor-specific.
 */
export function mapMediaErrorToCode(error: unknown): MediaSessionErrorCode {
  if (!(error instanceof Error)) return 'UNKNOWN';
  const name = error.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'PERMISSION_DENIED';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'NO_DEVICE';
  if (name === 'NotReadableError' || name === 'AbortError') return 'DEVICE_BUSY';
  if (name === 'TypeError') return 'NOT_SUPPORTED';
  return 'UNKNOWN';
}

/** Stop every track on a stream. Safe to call with null. */
function stopAllTracks(stream: MediaStream | null): void {
  stream?.getTracks().forEach((t) => t.stop());
}

// =============================================================================
// HOOK
// =============================================================================

export function useMediaStreamSession<TExtra extends string = never>({
  audio,
  logger,
  onStreamReady,
  onStopped,
}: UseMediaStreamSessionOptions): UseMediaStreamSessionReturn<TExtra> {
  type Status = MediaSessionStatus | TExtra;

  const [status, setStatus] = useState<Status>('idle');
  const [errorCode, setErrorCode] = useState<MediaSessionErrorCode | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Held in refs so `startCamera` / `stopCamera` keep stable identities even
  // when the owning hook passes inline closures.
  const onStreamReadyRef = useRef(onStreamReady);
  onStreamReadyRef.current = onStreamReady;
  const onStoppedRef = useRef(onStopped);
  onStoppedRef.current = onStopped;
  const audioRef = useRef(audio);
  audioRef.current = audio;
  const loggerRef = useRef(logger);
  loggerRef.current = logger;

  const fail = useCallback((code: MediaSessionErrorCode, message: string) => {
    setErrorCode(code);
    setErrorMessage(message);
    setStatus('error');
  }, []);

  const stopCamera = useCallback(() => {
    stopAllTracks(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStream(null);
    onStoppedRef.current?.();
    setStatus('idle');
  }, []);

  const startCamera = useCallback(async (deviceId?: string) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      fail('NOT_SUPPORTED', 'MediaDevices API not available');
      return;
    }

    try {
      setStatus('requesting');
      setErrorCode(null);
      setErrorMessage(null);

      // Release the previous device before asking for the next one — some
      // drivers report NotReadableError while the old track is still open.
      stopAllTracks(streamRef.current);
      streamRef.current = null;

      const constraints: MediaStreamConstraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId } }
          : { facingMode: 'environment' },
        audio: audioRef.current,
      };

      const next = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = next;
      setStream(next);

      if (videoRef.current) {
        videoRef.current.srcObject = next;
      }

      await onStreamReadyRef.current?.(next, deviceId);

      setStatus('ready');
    } catch (err) {
      const code = mapMediaErrorToCode(err);
      const message = getErrorMessage(err, 'Camera access failed');
      // A user declining the prompt is an expected outcome, not a fault.
      if (code === 'PERMISSION_DENIED') {
        loggerRef.current.warn('startCamera blocked by user', { code });
      } else {
        loggerRef.current.error('startCamera failed', { code, message });
      }
      fail(code, message);
    }
  }, [fail]);

  // Never leave a camera light on after unmount.
  useEffect(() => {
    return () => {
      stopAllTracks(streamRef.current);
      streamRef.current = null;
    };
  }, []);

  return {
    status,
    errorCode,
    errorMessage,
    videoRef,
    streamRef,
    stream,
    startCamera,
    stopCamera,
    setStatus,
    fail,
  };
}
