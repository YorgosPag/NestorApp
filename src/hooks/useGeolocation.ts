'use client';

/**
 * =============================================================================
 * useGeolocation — Browser GPS Position Hook
 * =============================================================================
 *
 * React state around the ONE geolocation request (`lib/geo/current-position`).
 * Used for attendance QR check-in and the address map «find my position».
 *
 * Features:
 * - State machine: idle → requesting → granted / denied / error
 * - High accuracy mode for outdoor GPS (construction sites)
 * - Timeout protection (15 seconds)
 * - Manual trigger (not auto-request — respects user privacy)
 *
 * 🔴 ADR-882: the error is a **reason code**, never a sentence. It used to be hardcoded Greek
 * (N.11) — callers translate with `common-shared:geolocation.<errorReason>`.
 *
 * @module hooks/useGeolocation
 * @enterprise ADR-170 — QR Code + GPS Geofencing + Photo Verification
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  requestCurrentPosition,
  type CurrentPositionFailure,
} from '@/lib/geo/current-position';

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
  /** Why the request failed (null if no error) — translate via `common-shared:geolocation.*` */
  errorReason: CurrentPositionFailure | null;
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
  const [errorReason, setErrorReason] = useState<CurrentPositionFailure | null>(null);

  // Track mounted state to avoid state updates after unmount
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const requestPosition = useCallback(() => {
    setStatus('requesting');
    setErrorReason(null);

    void requestCurrentPosition({ enableHighAccuracy, maximumAge, timeout }).then((outcome) => {
      if (!mountedRef.current) return;
      if (outcome.kind === 'found') {
        setPosition({
          latitude: outcome.point.lat,
          longitude: outcome.point.lng,
          accuracy: outcome.accuracyMeters,
        });
        setStatus('granted');
        return;
      }
      setStatus(outcome.reason === 'denied' ? 'denied' : 'error');
      setErrorReason(outcome.reason);
    });
  }, [enableHighAccuracy, maximumAge, timeout]);

  const reset = useCallback(() => {
    setPosition(null);
    setStatus('idle');
    setErrorReason(null);
  }, []);

  return { position, status, errorReason, requestPosition, reset };
}
