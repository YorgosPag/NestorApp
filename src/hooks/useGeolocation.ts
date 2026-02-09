'use client';

/**
 * =============================================================================
 * useGeolocation — Browser GPS Position Hook
 * =============================================================================
 *
 * Wraps `navigator.geolocation.getCurrentPosition` with React state management.
 * Used for attendance QR check-in to capture worker GPS position.
 *
 * Features:
 * - State machine: idle → requesting → granted / denied / error
 * - High accuracy mode for outdoor GPS (construction sites)
 * - Timeout protection (15 seconds)
 * - Manual trigger (not auto-request — respects user privacy)
 *
 * @module hooks/useGeolocation
 * @enterprise ADR-170 — QR Code + GPS Geofencing + Photo Verification
 */

import { useState, useCallback, useRef, useEffect } from 'react';

// =============================================================================
// TYPES
// =============================================================================

export type GeolocationStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'error';

export interface GeolocationPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export interface UseGeolocationOptions {
  /** Enable high accuracy (GPS) — default: true */
  enableHighAccuracy?: boolean;
  /** Maximum age of cached position in ms — default: 0 (no cache) */
  maximumAge?: number;
  /** Timeout in ms — default: 15000 (15 seconds) */
  timeout?: number;
}

export interface UseGeolocationReturn {
  /** Current GPS position (null if not yet acquired) */
  position: GeolocationPosition | null;
  /** Current status of the geolocation request */
  status: GeolocationStatus;
  /** Error message (null if no error) */
  error: string | null;
  /** Request the current position (manual trigger) */
  requestPosition: () => void;
  /** Reset state back to idle */
  reset: () => void;
}

// =============================================================================
// HOOK
// =============================================================================

export function useGeolocation(options: UseGeolocationOptions = {}): UseGeolocationReturn {
  const {
    enableHighAccuracy = true,
    maximumAge = 0,
    timeout = 15_000,
  } = options;

  const [position, setPosition] = useState<GeolocationPosition | null>(null);
  const [status, setStatus] = useState<GeolocationStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  // Track mounted state to avoid state updates after unmount
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const requestPosition = useCallback(() => {
    // Check browser support
    if (!navigator.geolocation) {
      setStatus('error');
      setError('Geolocation is not supported by this browser');
      return;
    }

    setStatus('requesting');
    setError(null);

    navigator.geolocation.getCurrentPosition(
      // Success
      (pos) => {
        if (!mountedRef.current) return;
        setPosition({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setStatus('granted');
        setError(null);
      },
      // Error
      (err) => {
        if (!mountedRef.current) return;

        switch (err.code) {
          case err.PERMISSION_DENIED:
            setStatus('denied');
            setError('Η πρόσβαση στην τοποθεσία απορρίφθηκε');
            break;
          case err.POSITION_UNAVAILABLE:
            setStatus('error');
            setError('Η τοποθεσία δεν είναι διαθέσιμη');
            break;
          case err.TIMEOUT:
            setStatus('error');
            setError('Λήξη χρόνου αναμονής τοποθεσίας');
            break;
          default:
            setStatus('error');
            setError('Σφάλμα κατά τη λήψη τοποθεσίας');
        }
      },
      // Options
      {
        enableHighAccuracy,
        maximumAge,
        timeout,
      }
    );
  }, [enableHighAccuracy, maximumAge, timeout]);

  const reset = useCallback(() => {
    setPosition(null);
    setStatus('idle');
    setError(null);
  }, []);

  return { position, status, error, requestPosition, reset };
}
