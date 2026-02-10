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
import {
  MapPin,
  Camera,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  Navigation,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGeolocation } from '@/hooks/useGeolocation';
import { usePhotoCapture } from '@/hooks/usePhotoCapture';
import { formatDate } from '@/lib/intl-utils'; // 🏢 ENTERPRISE: Centralized date formatting
import type { QrCheckInResponse } from '@/components/projects/ika/contracts';

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
  // TOKEN VALIDATION (on mount)
  // =========================================================================

  useEffect(() => {
    async function validateToken() {
      try {
        const res = await fetch(`/api/attendance/qr/validate?token=${encodeURIComponent(token)}`);
        const data = (await res.json()) as TokenValidationResult;

        if (data.valid) {
          setProjectName(data.projectName);
          setValidDate(data.validDate);
          setPageStatus('ready');
          // Auto-request GPS
          requestPosition();
        } else {
          setTokenError(getTokenErrorMessage(data.reason));
          setPageStatus('token_invalid');
        }
      } catch {
        setTokenError('Σφάλμα σύνδεσης. Ελέγξτε τη σύνδεσή σας στο internet.');
        setPageStatus('token_invalid');
      }
    }

    validateToken();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // =========================================================================
  // SUBMIT CHECK-IN
  // =========================================================================

  const handleSubmit = useCallback(async () => {
    if (!amka || amka.length !== 11) return;

    setPageStatus('submitting');
    setSubmitError('');

    try {
      const res = await fetch('/api/attendance/check-in', {
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
      setSubmitError('Σφάλμα σύνδεσης. Δοκιμάστε ξανά.');
    }
  }, [amka, token, eventType, position, photoBase64]);

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center px-4 py-8">
      {/* Header */}
      <header className="w-full max-w-md text-center mb-6">
        <h1 className="text-xl font-bold text-slate-900">
          Παρουσιολόγιο Εργοταξίου
        </h1>
        {projectName && (
          <p className="text-sm text-slate-500 mt-1">{projectName}</p>
        )}
        {validDate && (
          <p className="text-xs text-slate-400 mt-0.5">
            {formatDateGreek(validDate)}
          </p>
        )}
      </header>

      <section className="w-full max-w-md space-y-4">
        {/* VALIDATING */}
        {pageStatus === 'validating' && (
          <div className="flex flex-col items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <p className="mt-3 text-sm text-slate-500">Επαλήθευση QR code...</p>
          </div>
        )}

        {/* TOKEN INVALID */}
        {pageStatus === 'token_invalid' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <XCircle className="h-10 w-10 text-red-500 mx-auto" />
            <h2 className="mt-3 text-lg font-semibold text-red-800">
              Μη έγκυρο QR Code
            </h2>
            <p className="mt-2 text-sm text-red-600">{tokenError}</p>
          </div>
        )}

        {/* READY — Check-in form */}
        {(pageStatus === 'ready' || pageStatus === 'submitting') && (
          <>
            {/* GPS Status */}
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'flex items-center justify-center w-10 h-10 rounded-full',
                  gpsStatus === 'granted' ? 'bg-green-100' : 'bg-slate-100'
                )}>
                  {gpsStatus === 'requesting' ? (
                    <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                  ) : gpsStatus === 'granted' ? (
                    <MapPin className="h-5 w-5 text-green-600" />
                  ) : (
                    <Navigation className="h-5 w-5 text-slate-400" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-700">Τοποθεσία GPS</p>
                  {gpsStatus === 'idle' && (
                    <button
                      onClick={requestPosition}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Ενεργοποίηση GPS
                    </button>
                  )}
                  {gpsStatus === 'requesting' && (
                    <p className="text-xs text-slate-400">Αναζήτηση τοποθεσίας...</p>
                  )}
                  {gpsStatus === 'granted' && position && (
                    <p className="text-xs text-green-600">
                      Ακρίβεια: ±{Math.round(position.accuracy)}m
                    </p>
                  )}
                  {(gpsStatus === 'denied' || gpsStatus === 'error') && (
                    <p className="text-xs text-amber-600">{gpsError}</p>
                  )}
                </div>
              </div>
            </div>

            {/* AMKA Input */}
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <label htmlFor="amka-input" className="block text-sm font-medium text-slate-700 mb-2">
                ΑΜΚΑ (Αριθμός Μητρώου Κοινωνικής Ασφάλισης)
              </label>
              <input
                id="amka-input"
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={11}
                value={amka}
                onChange={(e) => setAmka(e.target.value.replace(/\D/g, '').slice(0, 11))}
                placeholder="Εισάγετε 11ψήφιο ΑΜΚΑ"
                className="w-full px-3 py-3 border border-slate-300 rounded-md text-lg font-mono tracking-wider text-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {amka.length > 0 && amka.length < 11 && (
                <p className="text-xs text-amber-500 mt-1">
                  {11 - amka.length} ψηφία ακόμα
                </p>
              )}
            </div>

            {/* Event Type Toggle */}
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <p className="text-sm font-medium text-slate-700 mb-2">Τύπος Ενέργειας</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEventType('check_in')}
                  className={cn(
                    'py-3 rounded-md text-sm font-medium border transition-colors',
                    eventType === 'check_in'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  )}
                >
                  Προσέλευση
                </button>
                <button
                  type="button"
                  onClick={() => setEventType('check_out')}
                  className={cn(
                    'py-3 rounded-md text-sm font-medium border transition-colors',
                    eventType === 'check_out'
                      ? 'bg-orange-600 text-white border-orange-600'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  )}
                >
                  Αποχώρηση
                </button>
              </div>
            </div>

            {/* Photo Capture (Optional) */}
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-slate-700">
                  Φωτογραφία <span className="text-slate-400">(προαιρετικά)</span>
                </p>
                {photoPreviewUrl && (
                  <button
                    onClick={clearPhoto}
                    className="text-xs text-red-500 hover:underline"
                  >
                    Αφαίρεση
                  </button>
                )}
              </div>

              {photoPreviewUrl ? (
                <img
                  src={photoPreviewUrl}
                  alt="Captured photo"
                  className="w-full h-40 object-cover rounded-md"
                />
              ) : (
                <button
                  type="button"
                  onClick={capturePhoto}
                  disabled={photoStatus === 'capturing'}
                  className="w-full py-8 border-2 border-dashed border-slate-300 rounded-md flex flex-col items-center gap-2 text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  <Camera className="h-6 w-6" />
                  <span className="text-sm">Λήψη Φωτογραφίας</span>
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
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
              <p className="text-xs text-blue-700 leading-relaxed">
                <AlertTriangle className="h-3 w-3 inline mr-1" />
                Η τοποθεσία σας καταγράφεται μόνο κατά την προσέλευση/αποχώρηση
                για λόγους ασφάλειας εργοταξίου. Δεν γίνεται συνεχής παρακολούθηση.
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
                  ? 'bg-slate-300 cursor-not-allowed'
                  : pageStatus === 'submitting'
                  ? 'bg-blue-400 cursor-wait'
                  : eventType === 'check_in'
                  ? 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
                  : 'bg-orange-600 hover:bg-orange-700 active:bg-orange-800'
              )}
            >
              {pageStatus === 'submitting' ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Καταχώρηση...
                </span>
              ) : eventType === 'check_in' ? (
                'Καταχώρηση Προσέλευσης'
              ) : (
                'Καταχώρηση Αποχώρησης'
              )}
            </button>
          </>
        )}

        {/* SUCCESS */}
        {pageStatus === 'success' && result && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
            <h2 className="mt-3 text-lg font-semibold text-green-800">
              Καταχωρήθηκε!
            </h2>
            {result.workerName && (
              <p className="mt-1 text-sm text-green-700">{result.workerName}</p>
            )}
            {result.geofence && (
              <p className="mt-2 text-sm text-green-600">
                {result.geofence.distanceMeters}m από το κέντρο εργοταξίου
                {result.geofence.inside ? ' (εντός ακτίνας)' : ' (εκτός ακτίνας)'}
              </p>
            )}
            {result.timestamp && (
              <p className="mt-1 text-xs text-green-500">
                {new Date(result.timestamp).toLocaleTimeString('el-GR')}
              </p>
            )}
            {result.geofence && !result.geofence.inside && (
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-md p-3">
                <AlertTriangle className="h-4 w-4 text-amber-500 inline mr-1" />
                <span className="text-xs text-amber-700">
                  Βρίσκεστε εκτός της ζώνης εργοταξίου ({result.geofence.distanceMeters}m / {result.geofence.radiusMeters}m)
                </span>
              </div>
            )}
          </div>
        )}

        {/* ERROR */}
        {pageStatus === 'error' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <XCircle className="h-10 w-10 text-red-500 mx-auto" />
            <h2 className="mt-3 text-lg font-semibold text-red-800">
              Αποτυχία Καταχώρησης
            </h2>
            <p className="mt-2 text-sm text-red-600">{submitError || result?.error}</p>
            <button
              onClick={() => setPageStatus('ready')}
              className="mt-4 px-6 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700"
            >
              Δοκιμάστε ξανά
            </button>
          </div>
        )}
      </section>
    </main>
  );
}

// =============================================================================
// HELPERS
// =============================================================================

function formatDateGreek(dateStr: string): string {
  try {
    const date = new Date(dateStr + 'T00:00:00');
    return formatDate(date, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function getTokenErrorMessage(reason?: string): string {
  switch (reason) {
    case 'token_expired':
      return 'Το QR code έχει λήξει. Ζητήστε νέο από τον υπεύθυνο.';
    case 'token_not_found_or_inactive':
      return 'Το QR code δεν βρέθηκε ή έχει ακυρωθεί.';
    case 'invalid_signature':
      return 'Μη έγκυρο QR code. Ελέγξτε ότι σκανάρετε το σωστό.';
    case 'malformed_token':
      return 'Το QR code είναι κατεστραμμένο.';
    default:
      return 'Μη έγκυρο QR code. Δοκιμάστε ξανά ή ζητήστε βοήθεια.';
  }
}

function getCheckInErrorMessage(error?: string | null): string {
  if (!error) return 'Άγνωστο σφάλμα';

  if (error.includes('worker_not_found')) {
    return 'Ο ΑΜΚΑ δεν βρέθηκε στους εργαζόμενους αυτού του εργοταξίου.';
  }
  if (error.includes('invalid_token')) {
    return 'Το QR code δεν είναι πλέον έγκυρο.';
  }
  return 'Σφάλμα κατά την καταχώρηση. Δοκιμάστε ξανά.';
}
