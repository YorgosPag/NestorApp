/**
 * =============================================================================
 * 🏢 ENTERPRISE: CameraCaptureDialog
 * =============================================================================
 *
 * Desktop camera capture dialog (photo + video) via WebRTC.
 *
 * Why this component exists:
 * - HTML `<input type="file" capture>` is ignored on desktop browsers
 * - Mobile keeps using native `capture` attribute (fallback in AddCaptureMenu)
 * - Desktop users get a full live preview with device switching
 *
 * @module components/shared/files/CameraCaptureDialog
 * @enterprise ADR-311 - Desktop Camera Capture via WebRTC
 * @see ADR-031 - Canonical File Storage System (Extension)
 */

'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Camera, Video as VideoIcon, RefreshCw, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import { useCameraCapture, type CameraCaptureErrorCode } from '@/hooks/useCameraCapture';
import { useVideoRecorder } from '@/hooks/useVideoRecorder';
import {
  type CaptureMetadata,
  createCaptureMetadata,
} from '@/config/upload-entry-points';
import '@/lib/design-system';

// ============================================================================
// TYPES
// ============================================================================

export type CameraCaptureMode = 'photo' | 'video';

export interface CameraCaptureDialogProps {
  open: boolean;
  mode: CameraCaptureMode;
  onClose: () => void;
  onCapture: (file: File, metadata: CaptureMetadata) => Promise<void>;
}

// ============================================================================
// HELPERS
// ============================================================================

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function errorKeyFor(code: CameraCaptureErrorCode | null): string {
  switch (code) {
    case 'PERMISSION_DENIED':
      return 'capture.cameraDialog.errorPermissionDenied';
    case 'NO_DEVICE':
      return 'capture.cameraDialog.errorNoDevice';
    case 'NOT_SUPPORTED':
      return 'capture.cameraDialog.errorNotSupported';
    case 'DEVICE_BUSY':
      return 'capture.cameraDialog.errorDeviceBusy';
    default:
      return 'capture.cameraDialog.errorGeneric';
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

export function CameraCaptureDialog({
  open,
  mode,
  onClose,
  onCapture,
}: CameraCaptureDialogProps) {
  const { t } = useTranslation(['files-media']);
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();

  const photo = useCameraCapture();
  const video = useVideoRecorder();

  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const previewUrlRef = useRef<string | null>(null);

  const activeStatus = mode === 'photo' ? photo.status : video.status;
  const activeErrorCode = mode === 'photo' ? photo.errorCode : video.errorCode;
  const activeVideoRef = mode === 'photo' ? photo.videoRef : video.videoRef;
  const activeDevices = mode === 'photo' ? photo.devices : [];
  const activeDeviceId = mode === 'photo' ? photo.activeDeviceId : null;

  useEffect(() => {
    if (!open) return;
    if (mode === 'photo') {
      void photo.startCamera();
    } else {
      void video.startCamera();
    }
    return () => {
      photo.stopCamera();
      video.stopCamera();
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
      setPreviewFile(null);
      setPreviewUrl(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode]);

  const handleClose = () => {
    if (busy) return;
    photo.stopCamera();
    video.stopCamera();
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewFile(null);
    setPreviewUrl(null);
    onClose();
  };

  const handleCapturePhoto = async () => {
    const file = await photo.capturePhoto();
    if (!file) return;
    const url = URL.createObjectURL(file);
    previewUrlRef.current = url;
    setPreviewFile(file);
    setPreviewUrl(url);
  };

  const handleStartRecording = () => {
    video.startRecording();
  };

  const handleStopRecording = async () => {
    const file = await video.stopRecording();
    if (!file) return;
    const url = URL.createObjectURL(file);
    previewUrlRef.current = url;
    setPreviewFile(file);
    setPreviewUrl(url);
  };

  const handleRetake = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewFile(null);
    setPreviewUrl(null);
  };

  const handleConfirm = async () => {
    if (!previewFile) return;
    try {
      setBusy(true);
      const metadata = createCaptureMetadata(
        mode === 'photo' ? 'camera' : 'video',
        mode === 'photo' ? 'photo' : 'video',
        {
          mimeType: previewFile.type,
          originalFilename: previewFile.name,
          durationMs: mode === 'video' ? video.durationMs : undefined,
        }
      );
      await onCapture(previewFile, metadata);
      handleClose();
    } finally {
      setBusy(false);
    }
  };

  const handleSwitchDevice = async (deviceId: string) => {
    await photo.switchDevice(deviceId);
  };

  const title = mode === 'photo'
    ? t('capture.cameraDialog.titlePhoto')
    : t('capture.cameraDialog.titleVideo');

  const isRecording = video.status === 'recording';
  const showPreview = previewFile !== null && previewUrl !== null;
  const isError = activeStatus === 'error';
  const isRequesting = activeStatus === 'requesting';

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) handleClose(); }}>
      <DialogContent size="xl" className="gap-3">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === 'photo'
              ? <Camera className={iconSizes.md} aria-hidden="true" />
              : <VideoIcon className={iconSizes.md} aria-hidden="true" />
            }
            {title}
          </DialogTitle>
          <DialogDescription>{t('capture.cameraDialog.description')}</DialogDescription>
        </DialogHeader>

        <section
          aria-label={title}
          className={cn('relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-md', colors.bg.secondary)}
        >
          {isError && (
            <output
              role="alert"
              className={cn('flex flex-col items-center gap-2 p-6 text-center', colors.text.primary)}
            >
              <AlertCircle className={cn(iconSizes.lg, 'text-red-500')} aria-hidden="true" />
              <p>{t(errorKeyFor(activeErrorCode))}</p>
            </output>
          )}

          {!isError && isRequesting && (
            <output className={cn('flex flex-col items-center gap-2', colors.text.muted)}>
              <Spinner size="medium" />
              <p>{t('capture.cameraDialog.requestingAccess')}</p>
            </output>
          )}

          {!isError && showPreview && (
            mode === 'photo'
              ? <img src={previewUrl ?? undefined} alt={title} className="h-full w-full object-contain" />
              : <video src={previewUrl ?? undefined} controls className="h-full w-full object-contain" />
          )}

          {!isError && !showPreview && (
            <video
              ref={activeVideoRef}
              autoPlay
              muted
              playsInline
              className={cn('h-full w-full object-contain', isRequesting && 'invisible')}
            />
          )}

          {!isError && !showPreview && isRecording && (
            <span
              aria-live="polite"
              className={cn('absolute right-3 top-3 flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold text-white', 'bg-red-600')} // eslint-disable-line design-system/enforce-semantic-colors
            >
              <span className="h-2 w-2 animate-pulse rounded-full bg-white" aria-hidden="true" />
              {formatDuration(video.durationMs)}
            </span>
          )}
        </section>

        {mode === 'photo' && activeDevices.length > 1 && !showPreview && !isError && (
          <div className="flex items-center gap-2">
            <label htmlFor="camera-device-select" className={cn('text-sm', colors.text.muted)}>
              {t('capture.cameraDialog.selectDevice')}
            </label>
            <Select
              value={activeDeviceId ?? undefined}
              onValueChange={handleSwitchDevice}
            >
              <SelectTrigger id="camera-device-select" className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {activeDevices.map((d) => (
                  <SelectItem key={d.deviceId} value={d.deviceId}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={busy}>
            {t('capture.cameraDialog.cancel')}
          </Button>

          {showPreview ? (
            <>
              <Button variant="outline" onClick={handleRetake} disabled={busy}>
                <RefreshCw className={cn(iconSizes.sm, 'mr-2')} aria-hidden="true" />
                {t('capture.cameraDialog.retake')}
              </Button>
              <Button onClick={handleConfirm} disabled={busy}>
                {busy && <Spinner size="small" color="inherit" className="mr-2" />}
                {t('capture.cameraDialog.use')}
              </Button>
            </>
          ) : mode === 'photo' ? (
            <Button
              onClick={handleCapturePhoto}
              disabled={activeStatus !== 'ready'}
            >
              <Camera className={cn(iconSizes.sm, 'mr-2')} aria-hidden="true" />
              {t('capture.cameraDialog.capture')}
            </Button>
          ) : isRecording ? (
            <Button onClick={handleStopRecording} className="bg-red-600 hover:bg-red-700"> {/* eslint-disable-line design-system/enforce-semantic-colors */}
              {t('capture.cameraDialog.stopRecording')}
            </Button>
          ) : (
            <Button
              onClick={handleStartRecording}
              disabled={activeStatus !== 'ready'}
            >
              <VideoIcon className={cn(iconSizes.sm, 'mr-2')} aria-hidden="true" />
              {t('capture.cameraDialog.startRecording')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CameraCaptureDialog;
