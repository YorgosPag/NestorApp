/**
 * =============================================================================
 * QR Token Service — HMAC-SHA256 Token Generation, Validation & Revocation
 * =============================================================================
 *
 * Generates daily QR tokens for construction site attendance check-in.
 * Tokens are cryptographically signed to prevent forgery and rotate daily.
 *
 * Security:
 * - HMAC-SHA256 signing with ATTENDANCE_QR_SECRET env var
 * - Token format: base64url({projectId}:{date}:{nonce}:{hmac})
 * - Daily expiration (23:59:59 of the valid date)
 * - Server-validated only (no client-side verification)
 * - Revocable by admin
 *
 * @module services/attendance/qr-token-service
 * @enterprise ADR-170 — QR Code + GPS Geofencing + Photo Verification
 */

import 'server-only';

import type { SignedTokenRejection } from '@/lib/tokens/signed-token';
import {
  decodeSignedToken,
  encodeSignedToken,
  newTokenNonce,
  requireTokenSecret,
} from '@/lib/tokens/signed-token';
import { getAdminFirestore, FieldValue } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { generateAttendanceQrTokenId } from '@/services/enterprise-id.service';
import { createModuleLogger } from '@/lib/telemetry';
import type { AttendanceQrToken, QrTokenStatus } from '@/components/projects/ika/contracts';
import { nowISO } from '@/lib/date-local';

// =============================================================================
// LOGGER
// =============================================================================

const logger = createModuleLogger('QR_TOKEN_SERVICE');

// =============================================================================
// TOKEN GENERATION
// =============================================================================

/**
 * 🔑 **§8.33 — Η ΓΡΑΜΜΑΤΙΚΗ ΤΟΥ ΣΥΝΔΕΣΜΟΥ ΕΦΥΓΕ ΣΕ SSoT** (`lib/tokens/signed-token`).
 *
 * Οι τέσσερις βοηθητικές που ζούσαν εδώ ήταν **πανομοιότυπες** με του
 * `vendor-portal-token-service.ts`, μαζί με το εικοσάγραμμο σκέλος επαλήθευσης
 * υπογραφής. Η **πολιτική** (ημερήσια λήξη · ανάκληση από διαχειριστή) μένει εδώ.
 */
const SECRET_ENV = 'ATTENDANCE_QR_SECRET';

/** Οι λόγοι του SSoT → το **υπάρχον** λεξιλόγιο αυτής της πύλης. */
const REJECTION_REASON: Record<SignedTokenRejection, string> = {
  malformed: 'malformed_token',
  'invalid-format': 'invalid_format',
  'invalid-signature': 'invalid_signature',
  'server-config': 'server_config_error',
};

function getEndOfDay(dateStr: string): string {
  return `${dateStr}T23:59:59.999Z`;
}

/**
 * Generate a new daily QR token for a project.
 *
 * If a valid token already exists for this project+date, it returns the existing one.
 * Otherwise creates a new one.
 *
 * @param projectId - The project to generate token for
 * @param date - Date string (YYYY-MM-DD), defaults to today
 * @param generatedBy - User ID of the admin generating the token
 * @returns The generated or existing QR token document
 */
export async function generateDailyQrToken(
  projectId: string,
  date: string,
  generatedBy: string
): Promise<AttendanceQrToken> {
  const db = getAdminFirestore();
  const collection = db.collection(COLLECTIONS.ATTENDANCE_QR_TOKENS);

  // Check for existing active token for this project+date
  const existing = await collection
    .where(FIELDS.PROJECT_ID, '==', projectId)
    .where('validDate', '==', date)
    .where(FIELDS.STATUS, '==', 'active' satisfies QrTokenStatus)
    .limit(1)
    .get();

  if (!existing.empty) {
    const doc = existing.docs[0];
    logger.info('Reusing existing QR token', { projectId, date, tokenId: doc.id });
    return { id: doc.id, ...doc.data() } as AttendanceQrToken;
  }

  // Generate new token
  const nonce = newTokenNonce();
  const token = encodeSignedToken(requireTokenSecret(SECRET_ENV), [projectId, date, nonce]);
  const now = nowISO();
  const expiresAt = getEndOfDay(date);

  const tokenData: Omit<AttendanceQrToken, 'id'> = {
    projectId,
    validDate: date,
    token,
    status: 'active',
    expiresAt,
    generatedBy,
    generatedAt: now,
    revokedAt: null,
    revokedBy: null,
  };

  const tokenId = generateAttendanceQrTokenId();
  await collection.doc(tokenId).set({
    ...tokenData,
    _createdAt: FieldValue.serverTimestamp(),
  });

  logger.info('Generated new QR token', { projectId, date, tokenId });

  return { id: tokenId, ...tokenData };
}

// =============================================================================
// TOKEN VALIDATION
// =============================================================================

/** Validation result for a QR token */
export interface QrTokenValidationResult {
  valid: boolean;
  projectId: string | null;
  validDate: string | null;
  tokenId: string | null;
  reason: string | null;
}

/**
 * Validate a QR token string.
 *
 * Verification steps:
 * 1. Decode base64url
 * 2. Parse token format (projectId:date:nonce:hmac)
 * 3. Recompute HMAC and verify signature
 * 4. Check Firestore for token document (active, not expired, not revoked)
 *
 * @param tokenString - The base64url-encoded token from QR scan
 * @returns Validation result
 */
export async function validateQrToken(tokenString: string): Promise<QrTokenValidationResult> {
  const invalid = (reason: string): QrTokenValidationResult => ({
    valid: false,
    projectId: null,
    validDate: null,
    tokenId: null,
    reason,
  });

  // Steps 1-3: decode + verify signature — μία κλήση στο SSoT, καμία επαφή με βάση.
  let secret: string;
  try {
    secret = requireTokenSecret(SECRET_ENV);
  } catch {
    return invalid('server_config_error');
  }

  const verdict = decodeSignedToken(secret, tokenString, 3);
  if (!verdict.ok) return invalid(REJECTION_REASON[verdict.reason]);

  const [projectId, date] = verdict.fields as [string, string, ...string[]];

  // Step 4: Check Firestore
  const db = getAdminFirestore();
  const snapshot = await db
    .collection(COLLECTIONS.ATTENDANCE_QR_TOKENS)
    .where('token', '==', tokenString)
    .where(FIELDS.STATUS, '==', 'active' satisfies QrTokenStatus)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return invalid('token_not_found_or_inactive');
  }

  const doc = snapshot.docs[0];
  const data = doc.data() as Omit<AttendanceQrToken, 'id'>;

  // Check expiration
  const now = new Date();
  const expiresAt = new Date(data.expiresAt);
  if (now > expiresAt) {
    // Auto-expire the token
    await doc.ref.update({ status: 'expired' satisfies QrTokenStatus });
    return invalid('token_expired');
  }

  return {
    valid: true,
    projectId: data.projectId,
    validDate: data.validDate,
    tokenId: doc.id,
    reason: null,
  };
}

// =============================================================================
// TOKEN REVOCATION
// =============================================================================

