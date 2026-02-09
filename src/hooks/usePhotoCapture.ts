'use client';

/**
 * =============================================================================
 * usePhotoCapture — Camera Capture Hook (Mobile-First)
 * =============================================================================
 *
 * Provides camera access via `<input type="file" capture="user">` for mobile.
 * Compresses captured photos client-side to max 500KB JPEG for upload.
 *
 * Features:
 * - Mobile camera trigger via file input
 * - Client-side compression (canvas resize + JPEG quality)
 * - Object URL management (auto-cleanup on unmount)
 * - Base64 output for API upload
 *
 * @module hooks/usePhotoCapture
 * @enterprise ADR-170 — QR Code + GPS Geofencing + Photo Verification
 */

import { useState, useCallback, useRef, useEffect } from 'react';

// =============================================================================
// TYPES
// =============================================================================

export type PhotoCaptureStatus = 'idle' | 'capturing' | 'ready' | 'error';

export interface UsePhotoCaptureReturn {
  /** Base64 data URL of the captured photo (compressed JPEG) */
  photoBase64: string | null;
  /** Object URL for preview display (auto-cleaned on unmount) */
  photoPreviewUrl: string | null;
  /** Current status */
  status: PhotoCaptureStatus;
  /** Error message */
  error: string | null;
  /** Ref to attach to <input type="file"> */
  inputRef: React.RefObject<HTMLInputElement | null>;
  /** Trigger the file input (opens camera on mobile) */
  capturePhoto: () => void;
  /** Clear the captured photo */
  clearPhoto: () => void;
  /** Handle file input change event (call this from onChange) */
  handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Maximum photo size in bytes after compression */
const MAX_PHOTO_BYTES = 500_000; // 500KB

/** JPEG quality for compression (0-1) */
const JPEG_QUALITY = 0.7;

/** Maximum photo dimension (width or height) in pixels */
const MAX_DIMENSION = 1024;

// =============================================================================
// COMPRESSION HELPER
// =============================================================================

/**
 * Compress an image file to JPEG with maximum size constraints.
 * Uses canvas for resize + quality reduction.
 */
async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = () => {
      img.onload = () => {
        // Calculate target dimensions
        let { width, height } = img;
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        // Draw to canvas
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Try decreasing quality until under size limit
        let quality = JPEG_QUALITY;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);

        while (dataUrl.length > MAX_PHOTO_BYTES * 1.37 && quality > 0.1) {
          // 1.37 = base64 overhead factor
          quality -= 0.1;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        resolve(dataUrl);
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = reader.result as string;
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

// =============================================================================
// HOOK
// =============================================================================

export function usePhotoCapture(): UsePhotoCaptureReturn {
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<PhotoCaptureStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (photoPreviewUrl) {
        URL.revokeObjectURL(photoPreviewUrl);
      }
    };
  }, [photoPreviewUrl]);

  const capturePhoto = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const clearPhoto = useCallback(() => {
    if (photoPreviewUrl) {
      URL.revokeObjectURL(photoPreviewUrl);
    }
    setPhotoBase64(null);
    setPhotoPreviewUrl(null);
    setStatus('idle');
    setError(null);
    // Reset the file input
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }, [photoPreviewUrl]);

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setStatus('error');
      setError('Μόνο αρχεία εικόνας επιτρέπονται');
      return;
    }

    setStatus('capturing');
    setError(null);

    try {
      // Create preview URL
      const previewUrl = URL.createObjectURL(file);
      setPhotoPreviewUrl(previewUrl);

      // Compress for upload
      const compressed = await compressImage(file);
      setPhotoBase64(compressed);
      setStatus('ready');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Σφάλμα κατά τη λήψη φωτογραφίας');
    }
  }, []);

  return {
    photoBase64,
    photoPreviewUrl,
    status,
    error,
    inputRef,
    capturePhoto,
    clearPhoto,
    handleFileChange,
  };
}
