'use client';

/**
 * =============================================================================
 * CheckInClient — Worker Check-In UI (Mobile-First)
 * =============================================================================
 *
 * Client component for the worker QR check-in page.
 * Runs on the worker's phone browser after scanning the QR code.
 *
 * Flow:
 * 1. Validate token via GET /api/attendance/qr/validate
 * 2. Request GPS via useGeolocation
 * 3. Worker enters AMKA
 * 4. Optional photo capture
 * 5. POST /api/attendance/check-in
 * 6. Display result
 *
 * @module app/attendance/check-in/[token]/CheckInClient
 * @enterprise ADR-170 — QR Code + GPS Geofencing + Photo Verification
 */

import React, { useState, useEffect, useCallback } from 'react';
import { API_ROUTES } from '@/config/domain-constants';
import {
  MapPin,
  Camera,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Navigation,
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { getStatusColor } from '@/lib/design-system';
import { useGeolocation } from '@/hooks/useGeolocation';
import { usePhotoCapture } from '@/hooks/usePhotoCapture';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { QrCheckInResponse } from '@/components/projects/ika/contracts';
import { STATUS_CLASSES, formatCheckInDateGreek } from './check-in-styles';

// =============================================================================
// TYPES
// =============================================================================

type PageStatus =
  | 'validating'
  | 'token_invalid'
  | 'ready'
  | 'submitting'
  | 'success'
  | 'error';

interface TokenValidationResult {
  valid: boolean;
  projectName: string;
  validDate: string;
  reason?: string;
}

interface CheckInClientProps {
  token: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function CheckInClient({ token }: CheckInClientProps) {
  const { t } = useTranslation('attendance');

  // Token validation state
  const [pageStatus, setPageStatus] = useState<PageStatus>('validating');
  const [projectName, setProjectName] = useState<string>('');
  const [validDate, setValidDate] = useState<string>('');
  const [tokenError, setTokenError] = useState<string>('');

  // Form state
  const [amka, setAmka] = useState('');
  const [eventType, setEventType] = useState<'check_in' | 'check_out'>('check_in');

  // Result state
  const [result, setResult] = useState<QrCheckInResponse | null>(null);
  const [submitError, setSubmitError] = useState<string>('');

  // GPS
  const { position, status: gpsStatus, error: gpsError, requestPosition } = useGeolocation();

  // Photo
  const {
    photoBase64,
    photoPreviewUrl,
    status: photoStatus,
    inputRef,
    capturePhoto,
    clearPhoto,
    handleFileChange,
  } = usePhotoCapture();

  // =========================================================================
  // HELPERS (using t())
  // =========================================================================

  const getTokenErrorMessage = useCallback((reason?: string): string => {
    switch (reason) {
      case 'token_expired':
        return t('tokenExpired');
      case 'token_not_found_or_inactive':
        return t('tokenNotFound');
      case 'invalid_signature':
        return t('tokenInvalidSignature');
      case 'malformed_token':
        return t('tokenMalformed');
      default:
        return t('tokenDefaultError');
    }
  }, [t]);

  const getCheckInErrorMessage = useCallback((error?: string | null): string => {
    if (!error) return t('unknownError');

    if (error.includes('worker_not_found')) {
      return t('workerNotFound');
    }
    if (error.includes('invalid_token')) {
      return t('invalidTokenError');
    }
    return t('checkInGenericError');
  }, [t]);

  // =========================================================================
  // TOKEN VALIDATION (on mount)
  // =========================================================================

  useEffect(() => {
    async function validateToken() {
      try {
        const res = await fetch(
          `${API_ROUTES.ATTENDANCE.QR_VALIDATE}?token=${encodeURIComponent(token)}`
        );
        const data = (await res.json()) as TokenValidationResult;

        if (data.valid) {
          setProjectName(data.projectName);
          setValidDate(data.validDate);
          setPageStatus('ready');
          requestPosition();
        } else {
          setTokenError(getTokenErrorMessage(data.reason));
          setPageStatus('token_invalid');
        }
      } catch {
        setTokenError(t('connectionError'));
        setPageStatus('token_invalid');
      }
    }

    validateToken();
  // Token is the only external dependency that should trigger re-validation
  // getTokenErrorMessage/requestPosition/t are stable refs
  }, [token]); // eslint-disable-line

  // =========================================================================
  // SUBMIT CHECK-IN
  // =========================================================================

  const handleSubmit = useCallback(async () => {
    if (!amka || amka.length !== 11) return;

    setPageStatus('submitting');
    setSubmitError('');

    try {
      const res = await fetch(API_ROUTES.ATTENDANCE.CHECK_IN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          workerIdentifier: amka,
          eventType,
          coordinates: position
            ? { lat: position.latitude, lng: position.longitude, accuracy: position.accuracy }
            : null,
          photoBase64: photoBase64 ?? null,
          deviceInfo: {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
          },
        }),
      });

      const data = (await res.json()) as QrCheckInResponse;
      setResult(data);
      setPageStatus(data.success ? 'success' : 'error');

      if (!data.success) {
        setSubmitError(getCheckInErrorMessage(data.error));
      }
    } catch {
      setPageStatus('error');
      setSubmitError(t('connectionErrorRetry'));
    }
  }, [amka, token, eventType, position, photoBase64, getCheckInErrorMessage, t]);

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <main className="min-h-screen bg-background flex flex-col items-center px-4 py-8">
      {/* Header */}
      <header className="w-full max-w-md text-center mb-6">
        <h1 className="text-xl font-bold text-foreground">
          {t('pageTitle')}
        </h1>
        {projectName && (
          <p className="text-sm text-muted-foreground mt-1">{projectName}</p>
        )}
        {validDate && (
          <p className="text-xs text-muted-foreground/70 mt-0.5">
            {formatCheckInDateGreek(validDate)}
          </p>
        )}
      </header>

      <section className="w-full max-w-md space-y-4">
        {/* VALIDATING */}
        {pageStatus === 'validating' && (
          <div className="flex flex-col items-center py-12">
            <Spinner size="large" color="inherit" className={STATUS_CLASSES.info.spinnerText} />
            <p className="mt-3 text-sm text-muted-foreground">{t('validatingQr')}</p>
          </div>
        )}

        {/* TOKEN INVALID */}
        {pageStatus === 'token_invalid' && (
          <div className={cn(STATUS_CLASSES.error.containerBg, STATUS_CLASSES.error.containerBorder, 'rounded-lg p-6 text-center')}>
            <XCircle className={cn('h-10 w-10 mx-auto', STATUS_CLASSES.error.icon)} />
            <h2 className={cn('mt-3 text-lg font-semibold', STATUS_CLASSES.error.title)}>
              {t('invalidQrTitle')}
            </h2>
            <p className={cn('mt-2 text-sm', STATUS_CLASSES.error.body)}>{tokenError}</p>
          </div>
        )}

        {/* READY — Check-in form */}
        {(pageStatus === 'ready' || pageStatus === 'submitting') && (
          <>
            {/* GPS Status */}
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'flex items-center justify-center w-10 h-10 rounded-full',
                  gpsStatus === 'granted' ? STATUS_CLASSES.gpsGranted.bg : 'bg-muted'
                )}>
                  {gpsStatus === 'requesting' ? (
                    <Spinner color="inherit" className={STATUS_CLASSES.info.spinnerText} />
                  ) : gpsStatus === 'granted' ? (
                    <MapPin className={cn('h-5 w-5', STATUS_CLASSES.gpsGranted.text)} />
                  ) : (
                    <Navigation className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{t('gpsLocation')}</p>
                  {gpsStatus === 'idle' && (
                    <button
                      onClick={requestPosition}
                      className={cn('text-xs hover:underline', STATUS_CLASSES.info.link)}
                    >
                      {t('enableGps')}
                    </button>
                  )}
                  {gpsStatus === 'requesting' && (
                    <p className="text-xs text-muted-foreground">{t('searchingLocation')}</p>
                  )}
                  {gpsStatus === 'granted' && position && (
                    <p className={cn('text-xs', STATUS_CLASSES.gpsGranted.text)}>
                      {t('accuracy', { meters: Math.round(position.accuracy) })}
                    </p>
                  )}
                  {(gpsStatus === 'denied' || gpsStatus === 'error') && (
                    <p className={cn('text-xs', STATUS_CLASSES.warning.body)}>{gpsError}</p>
                  )}
                </div>
              </div>
            </div>

            {/* AMKA Input */}
            <div className="bg-card border border-border rounded-lg p-4">
              <label htmlFor="amka-input" className="block text-sm font-medium text-foreground mb-2">
                {t('amkaLabel')}
              </label>
              <input
                id="amka-input"
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={11}
                value={amka}
                onChange={(e) => setAmka(e.target.value.replace(/\D/g, '').slice(0, 11))}
                placeholder={t('amkaPlaceholder')}
                className="w-full px-3 py-3 border border-border rounded-md text-lg font-mono tracking-wider text-center focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
              />
              {amka.length > 0 && amka.length < 11 && (
                <p className={cn('text-xs mt-1', STATUS_CLASSES.warning.icon)}>
                  {t('digitsRemaining', { count: 11 - amka.length })}
                </p>
              )}
            </div>

            {/* Event Type Toggle */}
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-sm font-medium text-foreground mb-2">{t('eventTypeLabel')}</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEventType('check_in')}
                  className={cn(
                    'py-3 rounded-md text-sm font-medium border transition-colors',
                    eventType === 'check_in'
                      ? cn(STATUS_CLASSES.info.buttonBg, 'text-white', getStatusColor('pending', 'border'))
                      : 'bg-card text-foreground border-border hover:bg-accent'
                  )}
                >
                  {t('checkIn')}
                </button>
                <button
                  type="button"
                  onClick={() => setEventType('check_out')}
                  className={cn(
                    'py-3 rounded-md text-sm font-medium border transition-colors',
                    eventType === 'check_out'
                      ? cn(getStatusColor('reserved', 'bg'), 'text-white', getStatusColor('reserved', 'border'))
                      : 'bg-card text-foreground border-border hover:bg-accent'
                  )}
                >
                  {t('checkOut')}
                </button>
              </div>
            </div>

            {/* Photo Capture (Optional) */}
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-foreground">
                  {t('photoLabel')} <span className="text-muted-foreground">{t('photoOptional')}</span>
                </p>
                {photoPreviewUrl && (
                  <button
                    onClick={clearPhoto}
                    className={cn('text-xs hover:underline', STATUS_CLASSES.error.icon)}
                  >
                    {t('removePhoto')}
                  </button>
                )}
              </div>

              {photoPreviewUrl ? (
                <img
                  src={photoPreviewUrl}
                  alt={t('capturedPhotoAlt')}
                  className="w-full h-40 object-cover rounded-md"
                />
              ) : (
                <button
                  type="button"
                  onClick={capturePhoto}
                  disabled={photoStatus === 'capturing'}
                  className="w-full py-8 border-2 border-dashed border-border rounded-md flex flex-col items-center gap-2 text-muted-foreground hover:bg-accent transition-colors"
                >
                  <Camera className="h-6 w-6" />
                  <span className="text-sm">{t('capturePhoto')}</span>
                </button>
              )}

              {/* Hidden file input for camera capture */}
              <input
                ref={inputRef as React.RefObject<HTMLInputElement>}
                type="file"
                accept="image/*"
                capture="user"
                onChange={handleFileChange}
                className="hidden"
                aria-hidden="true"
              />
            </div>

            {/* Privacy Notice */}
            <div className={cn(STATUS_CLASSES.info.containerBg, STATUS_CLASSES.info.containerBorder, 'rounded-lg p-3')}>
              <p className={cn('text-xs leading-relaxed', STATUS_CLASSES.info.body)}>
                <AlertTriangle className="h-3 w-3 inline mr-1" />
                {t('privacyNotice')}
              </p>
            </div>

            {/* Submit Button */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={amka.length !== 11 || pageStatus === 'submitting'}
              className={cn(
                'w-full py-4 rounded-lg text-white font-semibold text-lg transition-colors',
                amka.length !== 11
                  ? 'bg-muted cursor-not-allowed'
                  : pageStatus === 'submitting'
                  ? cn(STATUS_CLASSES.info.buttonBgHover, 'cursor-wait')
                  : eventType === 'check_in'
                  ? cn(STATUS_CLASSES.info.buttonBg, 'hover:opacity-90 active:opacity-80')
                  : cn(getStatusColor('reserved', 'bg'), 'hover:opacity-90 active:opacity-80')
              )}
            >
              {pageStatus === 'submitting' ? (
                <span className="flex items-center justify-center gap-2">
                  <Spinner color="inherit" />
                  {t('submitting')}
                </span>
              ) : eventType === 'check_in' ? (
                t('submitCheckIn')
              ) : (
                t('submitCheckOut')
              )}
            </button>
          </>
        )}

        {/* SUCCESS */}
        {pageStatus === 'success' && result && (
          <div className={cn(STATUS_CLASSES.success.containerBg, STATUS_CLASSES.success.containerBorder, 'rounded-lg p-6 text-center')}>
            <CheckCircle2 className={cn('h-12 w-12 mx-auto', STATUS_CLASSES.success.icon)} />
            <h2 className={cn('mt-3 text-lg font-semibold', STATUS_CLASSES.success.title)}>
              {t('successTitle')}
            </h2>
            {result.workerName && (
              <p className={cn('mt-1 text-sm', STATUS_CLASSES.success.body)}>{result.workerName}</p>
            )}
            {result.geofence && (
              <p className={cn('mt-2 text-sm', STATUS_CLASSES.success.body)}>
                {t('distanceFromCenter', { distance: result.geofence.distanceMeters })}
                {result.geofence.inside ? ` ${t('insideRadius')}` : ` ${t('outsideRadius')}`}
              </p>
            )}
            {result.timestamp && (
              <p className={cn('mt-1 text-xs', STATUS_CLASSES.success.body)}>
                {new Date(result.timestamp).toLocaleTimeString('el-GR')}
              </p>
            )}
            {result.geofence && !result.geofence.inside && (
              <div className={cn(STATUS_CLASSES.warning.containerBg, STATUS_CLASSES.warning.containerBorder, 'mt-3 rounded-md p-3')}>
                <AlertTriangle className={cn('h-4 w-4 inline mr-1', STATUS_CLASSES.warning.icon)} />
                <span className={cn('text-xs', STATUS_CLASSES.warning.body)}>
                  {t('outsideZoneWarning', {
                    distance: result.geofence.distanceMeters,
                    radius: result.geofence.radiusMeters,
                  })}
                </span>
              </div>
            )}
          </div>
        )}

        {/* ERROR */}
        {pageStatus === 'error' && (
          <div className={cn(STATUS_CLASSES.error.containerBg, STATUS_CLASSES.error.containerBorder, 'rounded-lg p-6 text-center')}>
            <XCircle className={cn('h-10 w-10 mx-auto', STATUS_CLASSES.error.icon)} />
            <h2 className={cn('mt-3 text-lg font-semibold', STATUS_CLASSES.error.title)}>
              {t('errorTitle')}
            </h2>
            <p className={cn('mt-2 text-sm', STATUS_CLASSES.error.body)}>{submitError || result?.error}</p>
            <button
              onClick={() => setPageStatus('ready')}
              className={cn('mt-4 px-6 py-2 text-white rounded-md text-sm hover:opacity-90', STATUS_CLASSES.error.buttonBg)}
            >
              {t('tryAgain')}
            </button>
          </div>
        )}
      </section>
    </main>
  );
}

