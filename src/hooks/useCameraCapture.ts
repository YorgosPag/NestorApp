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
 * @module hooks/useCameraCapture
 * @enterprise ADR-311 - Desktop Camera Capture via WebRTC
 * @see ADR-031 - Canonical File Storage System
 * @see ADR-161 - useVoiceRecorder (parallel pattern for audio)
 * @see ADR-170 - usePhotoCapture (mobile-only predecessor)
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('useCameraCapture');

// =============================================================================
// TYPES
// =============================================================================

export type CameraCaptureStatus =
  | 'idle'
  | 'requesting'
  | 'ready'
  | 'capturing'
  | 'error';

export type CameraCaptureErrorCode =
  | 'PERMISSION_DENIED'
  | 'NO_DEVICE'
  | 'NOT_SUPPORTED'
  | 'DEVICE_BUSY'
  | 'UNKNOWN';

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

function mapErrorToCode(error: unknown): CameraCaptureErrorCode {
  if (!(error instanceof Error)) return 'UNKNOWN';
  const name = error.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'PERMISSION_DENIED';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'NO_DEVICE';
  if (name === 'NotReadableError' || name === 'AbortError') return 'DEVICE_BUSY';
  if (name === 'TypeError') return 'NOT_SUPPORTED';
  return 'UNKNOWN';
}

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
  const [status, setStatus] = useState<CameraCaptureStatus>('idle');
  const [errorCode, setErrorCode] = useState<CameraCaptureErrorCode | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

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
    setActiveDeviceId(null);
    setStatus('idle');
  }, []);

  const startCamera = useCallback(
    async (deviceId?: string) => {
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
          audio: false,
        };

        const next = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = next;
        setStream(next);

        const track = next.getVideoTracks()[0];
        const settings = track?.getSettings();
        const resolvedDeviceId = settings?.deviceId ?? deviceId ?? null;
        setActiveDeviceId(resolvedDeviceId);

        if (videoRef.current) {
          videoRef.current.srcObject = next;
        }

        const list = await enumerateCameraDevices();
        setDevices(list);

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
    },
    []
  );

  const switchDevice = useCallback(
    async (deviceId: string) => {
      await startCamera(deviceId);
    },
    [startCamera]
  );

  const capturePhoto = useCallback(
    async (filename?: string): Promise<File | null> => {
      const video = videoRef.current;
      const currentStream = streamRef.current;
      if (!video || !currentStream) return null;
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
        setErrorCode('UNKNOWN');
        setErrorMessage(message);
        setStatus('error');
        return null;
      }
    },
    []
  );

  useEffect(() => {
    return () => {
      const current = streamRef.current;
      if (current) {
        current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  return {
    status,
    errorCode,
    errorMessage,
    videoRef,
    stream,
    devices,
    activeDeviceId,
    startCamera,
    stopCamera,
    capturePhoto,
    switchDevice,
  };
}
