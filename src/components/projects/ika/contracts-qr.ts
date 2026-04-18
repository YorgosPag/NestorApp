/**
 * =============================================================================
 * IKA/EFKA Labor Compliance — QR Code Attendance Types
 * =============================================================================
 *
 * Extracted from contracts.ts (C.5.23 SRP split) — ADR-314.
 * QR token + GPS geofencing + photo verification types.
 *
 * @module components/projects/ika/contracts-qr
 * @enterprise ADR-170 — QR + GPS Geofencing + Photo Verification
 */

// ============================================================================
// QR CODE ATTENDANCE (ADR-170 — QR + GPS Geofencing + Photo Verification)
// ============================================================================

/** QR token status lifecycle */
export type QrTokenStatus = 'active' | 'expired' | 'revoked';

/**
 * QR token stored in Firestore `attendance_qr_tokens` collection.
 * Tokens rotate daily to prevent fraud (anti-sharing).
 * HMAC-SHA256 signed with ATTENDANCE_QR_SECRET env var.
 */
export interface AttendanceQrToken {
  /** Firestore document ID */
  id: string;
  /** Associated project */
  projectId: string;
  /** Date this token is valid for (YYYY-MM-DD) */
  validDate: string;
  /** HMAC-signed token string (base64url encoded) */
  token: string;
  /** Token status */
  status: QrTokenStatus;
  /** Expiration timestamp (ISO — end of validDate 23:59:59) */
  expiresAt: string;
  /** Who generated the token */
  generatedBy: string;
  /** When the token was generated (ISO) */
  generatedAt: string;
  /** When the token was revoked (ISO), null if not revoked */
  revokedAt: string | null;
  /** Who revoked it, null if not revoked */
  revokedBy: string | null;
}

/**
 * Geofence configuration for a project site.
 * Stored within the project's primary address or as separate config.
 */
export interface GeofenceConfig {
  /** Center point latitude */
  latitude: number;
  /** Center point longitude */
  longitude: number;
  /** Geofence radius in meters (50-500m typical for construction sites) */
  radiusMeters: number;
  /** Whether geofence verification is enabled */
  enabled: boolean;
  /** Last updated (ISO) */
  updatedAt: string;
  /** Updated by user ID */
  updatedBy: string;
}

/**
 * Photo metadata for attendance verification.
 * Photo stored in Firebase Storage, metadata stored alongside event.
 */
export interface AttendancePhotoMetadata {
  /** Firebase Storage path */
  storagePath: string;
  /** Public download URL */
  downloadUrl: string;
  /** File size in bytes */
  sizeBytes: number;
  /** MIME type (image/jpeg) */
  mimeType: string;
  /** Capture timestamp (ISO) */
  capturedAt: string;
}

/** Geofence verification result */
export interface GeofenceVerificationResult {
  /** Whether the worker is inside the geofence */
  inside: boolean;
  /** Distance from geofence center in meters */
  distanceMeters: number;
  /** Geofence radius that was checked against */
  radiusMeters: number;
  /** GPS accuracy reported by device (meters) */
  gpsAccuracyMeters: number | null;
}

/**
 * Payload sent by the worker's browser when scanning QR and checking in.
 * Public endpoint — no Firebase auth required (worker identified by token + AMKA).
 */
export interface QrCheckInPayload {
  /** The scanned QR token string */
  token: string;
  /** Worker identifier — AMKA (Social Security Number) */
  workerIdentifier: string;
  /** Event type: check_in or check_out */
  eventType: 'check_in' | 'check_out';
  /** GPS coordinates from browser */
  coordinates: {
    lat: number;
    lng: number;
    accuracy: number;
  } | null;
  /** Photo as base64 data URL (optional) */
  photoBase64: string | null;
  /** Device info for audit trail */
  deviceInfo: {
    userAgent: string;
    platform: string;
    language: string;
  };
}

/**
 * Response from the check-in API endpoint.
 */
export interface QrCheckInResponse {
  /** Whether the check-in was successful */
  success: boolean;
  /** Error message if not successful */
  error: string | null;
  /** Created event ID (if successful) */
  eventId: string | null;
  /** Worker name resolved from AMKA */
  workerName: string | null;
  /** Geofence verification result */
  geofence: GeofenceVerificationResult | null;
  /** Server timestamp of the event (ISO) */
  timestamp: string | null;
  /** Photo uploaded successfully */
  photoUploaded: boolean;
}
