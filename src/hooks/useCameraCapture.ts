'use client';

/**
 * =============================================================================
 * useCameraCapture — Desktop Camera Capture Hook (WebRTC)
 * =============================================================================
 *
 * Enterprise Pattern: MediaDevices.getUserMedia → Live Preview → Canvas Grab → File
 * Following ChatGPT/Google Meet desktop camera patterns.
 *
 * Why this hook exists:
 * - HTML `<input type="file" capture="environment">` is IGNORED on desktop browsers
 * - Desktop (Chrome/Edge/Firefox/Safari on Windows/Mac/Linux) requires WebRTC
 * - Mobile still uses native `capture` attribute (via existing input)
 *
 * Features:
 * - Device enumeration (front/rear, USB webcams)
 * - Device switching without full re-init
 * - Canvas frame grab → JPEG File (quality 0.9)
 * - Cleanup tracks on stop/unmount/error
 *
 * The stream session (permission, constraints, error mapping, teardown) is
 * shared with `useVideoRecorder` via `useMediaStreamSession` (ADR-584). This
 * hook owns only what is specific to grabbing stills: the device list and the
 * canvas capture.
 *
 * @module hooks/useCameraCapture
 * @enterprise ADR-311 - Desktop Camera Capture via WebRTC
 * @see ADR-031 - Canonical File Storage System
 * @see ADR-161 - useVoiceRecorder (parallel pattern for audio)
 * @see ADR-170 - usePhotoCapture (mobile-only predecessor)
 */

import { useCallback, useState } from 'react';

import { getErrorMessage } from '@/lib/error-utils';
import { createModuleLogger } from '@/lib/telemetry';

import type {
  MediaSessionErrorCode,
  MediaSessionStatus,
} from './media/useMediaStreamSession';
import { useMediaStreamSession } from './media/useMediaStreamSession';

const logger = createModuleLogger('useCameraCapture');

// =============================================================================
// TYPES
// =============================================================================

export type CameraCaptureStatus = MediaSessionStatus | 'capturing';

export type CameraCaptureErrorCode = MediaSessionErrorCode;

export interface CameraDevice {
  deviceId: string;
  label: string;
}

export interface UseCameraCaptureReturn {
  status: CameraCaptureStatus;
  errorCode: CameraCaptureErrorCode | null;
  errorMessage: string | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  stream: MediaStream | null;
  devices: CameraDevice[];
  activeDeviceId: string | null;
  startCamera: (deviceId?: string) => Promise<void>;
  stopCamera: () => void;
  capturePhoto: (filename?: string) => Promise<File | null>;
  switchDevice: (deviceId: string) => Promise<void>;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const JPEG_QUALITY = 0.9;
const JPEG_MIME = 'image/jpeg';

// =============================================================================
// HELPERS
// =============================================================================

async function enumerateCameraDevices(): Promise<CameraDevice[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const all = await navigator.mediaDevices.enumerateDevices();
  return all
    .filter((d) => d.kind === 'videoinput')
    .map((d, idx) => ({
      deviceId: d.deviceId,
      label: d.label || `Camera ${idx + 1}`,
    }));
}

// =============================================================================
// HOOK
// =============================================================================

export function useCameraCapture(): UseCameraCaptureReturn {
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);

  const session = useMediaStreamSession<'capturing'>({
    audio: false,
    logger,

    onStreamReady: async (stream, requestedDeviceId) => {
      // The browser may hand back a different device than requested (or pick
      // one for us when we asked by facingMode) — trust the track, not the ask.
      const track = stream.getVideoTracks()[0];
      const settings = track?.getSettings();
      setActiveDeviceId(settings?.deviceId ?? requestedDeviceId ?? null);

      // Labels are only populated once permission has been granted, so the
      // list is enumerated here rather than on mount.
      setDevices(await enumerateCameraDevices());
    },

    onStopped: () => setActiveDeviceId(null),
  });

  const { videoRef, streamRef, setStatus, fail } = session;

  const switchDevice = useCallback(
    async (deviceId: string) => {
      await session.startCamera(deviceId);
    },
    [session]
  );

  const capturePhoto = useCallback(
    async (filename?: string): Promise<File | null> => {
      const video = videoRef.current;
      if (!video || !streamRef.current) return null;
      // Dimensions are 0 until the first frame decodes; capturing now would
      // yield a blank canvas.
      if (video.videoWidth === 0 || video.videoHeight === 0) return null;

      try {
        setStatus('capturing');

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas 2D context unavailable');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const blob: Blob | null = await new Promise((resolve) => {
          canvas.toBlob((b) => resolve(b), JPEG_MIME, JPEG_QUALITY);
        });

        if (!blob) throw new Error('Canvas toBlob returned null');

        const name = filename ?? `photo-${Date.now()}.jpg`;
        const file = new File([blob], name, { type: JPEG_MIME });

        setStatus('ready');
        return file;
      } catch (err) {
        const message = getErrorMessage(err, 'Capture failed');
        logger.error('capturePhoto failed', { message });
        fail('UNKNOWN', message);
        return null;
      }
    },
    [videoRef, streamRef, setStatus, fail]
  );

  return {
    status: session.status,
    errorCode: session.errorCode,
    errorMessage: session.errorMessage,
    videoRef: session.videoRef,
    stream: session.stream,
    devices,
    activeDeviceId,
    startCamera: session.startCamera,
    stopCamera: session.stopCamera,
    capturePhoto,
    switchDevice,
  };
}
