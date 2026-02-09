/**
 * =============================================================================
 * Attendance Server Service — Orchestrator for QR Check-In
 * =============================================================================
 *
 * Server-side orchestrator that coordinates:
 * 1. Token validation (qr-token-service)
 * 2. Worker resolution (AMKA → contactId via contact_links)
 * 3. Geofence verification (geofence-service)
 * 4. Photo upload (Firebase Storage)
 * 5. Immutable event creation (Firestore attendance_events)
 *
 * @module services/attendance/attendance-server-service
 * @enterprise ADR-170 — QR Code + GPS Geofencing + Photo Verification
 */

import 'server-only';

import { getAdminFirestore, getAdminStorage, FieldValue } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { validateQrToken } from './qr-token-service';
import { isWithinGeofence } from './geofence-service';
import type {
  QrCheckInPayload,
  QrCheckInResponse,
  AttendancePhotoMetadata,
  GeofenceConfig,
  GeofenceVerificationResult,
} from '@/components/projects/ika/contracts';

// =============================================================================
// LOGGER
// =============================================================================

const logger = createModuleLogger('ATTENDANCE_SERVER');

// =============================================================================
// WORKER RESOLUTION
// =============================================================================

/**
 * Resolve a worker by AMKA within a project's linked contacts.
 *
 * Searches the contact_links collection for a worker linked to the project
 * whose contact document has a matching AMKA.
 *
 * @param projectId - The project to search within
 * @param amka - The worker's AMKA number
 * @returns Worker info or null if not found
 */
export async function resolveWorkerForProject(
  projectId: string,
  amka: string
): Promise<{ contactId: string; name: string } | null> {
  const db = getAdminFirestore();

  // Get all contact links for this project with role 'worker' or type 'contact'
  const linksSnapshot = await db
    .collection(COLLECTIONS.CONTACT_LINKS)
    .where('entityId', '==', projectId)
    .where('entityType', '==', 'project')
    .get();

  if (linksSnapshot.empty) {
    logger.warn('No contact links found for project', { projectId });
    return null;
  }

  // Extract contact IDs from links
  const contactIds = linksSnapshot.docs.map((doc) => doc.data().contactId as string);

  // Search contacts for matching AMKA (batch in groups of 10 for Firestore 'in' limit)
  for (let i = 0; i < contactIds.length; i += 10) {
    const batch = contactIds.slice(i, i + 10);
    const contactsSnapshot = await db
      .collection(COLLECTIONS.CONTACTS)
      .where('__name__', 'in', batch)
      .get();

    for (const doc of contactsSnapshot.docs) {
      const data = doc.data();
      // Check AMKA in employment/identification fields
      const contactAmka =
        data.amka ??
        data.socialSecurityNumber ??
        data.identificationNumbers?.amka ??
        null;

      if (contactAmka === amka) {
        const firstName = (data.firstName ?? '') as string;
        const lastName = (data.lastName ?? '') as string;
        const name = `${firstName} ${lastName}`.trim() || 'Άγνωστος';
        return { contactId: doc.id, name };
      }
    }
  }

  logger.warn('Worker with AMKA not found in project contacts', { projectId, amkaLast4: amka.slice(-4) });
  return null;
}

// =============================================================================
// GEOFENCE LOOKUP
// =============================================================================

/**
 * Get geofence configuration for a project.
 * Reads from the project document's geofenceConfig field.
 *
 * @param projectId - The project ID
 * @returns GeofenceConfig or null if not configured
 */
export async function getProjectGeofence(projectId: string): Promise<GeofenceConfig | null> {
  const db = getAdminFirestore();
  const projectDoc = await db.collection(COLLECTIONS.PROJECTS).doc(projectId).get();

  if (!projectDoc.exists) return null;

  const data = projectDoc.data();
  const geofence = data?.geofenceConfig as GeofenceConfig | undefined;

  if (!geofence || !geofence.enabled) return null;

  return geofence;
}

// =============================================================================
// PHOTO UPLOAD
// =============================================================================

/**
 * Upload an attendance photo to Firebase Storage.
 *
 * @param projectId - Project ID for storage path organization
 * @param eventId - Event ID for unique naming
 * @param photoBase64 - Base64 data URL (e.g., "data:image/jpeg;base64,...")
 * @param date - Date string for path organization (YYYY-MM-DD)
 * @returns Photo metadata or null on failure
 */
export async function uploadAttendancePhoto(
  projectId: string,
  eventId: string,
  photoBase64: string,
  date: string
): Promise<AttendancePhotoMetadata | null> {
  try {
    const storage = getAdminStorage();
    const bucket = storage.bucket();

    // Parse the data URL
    const matches = photoBase64.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!matches) {
      logger.warn('Invalid photo data URL format');
      return null;
    }

    const mimeType = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');

    // Storage path: attendance/{projectId}/{date}/{eventId}.jpg
    const storagePath = `attendance/${projectId}/${date}/${eventId}.jpg`;
    const file = bucket.file(storagePath);

    await file.save(buffer, {
      metadata: {
        contentType: mimeType,
        metadata: {
          projectId,
          eventId,
          capturedAt: new Date().toISOString(),
        },
      },
    });

    // Make the file publicly accessible for download URL
    await file.makePublic();
    const downloadUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

    return {
      storagePath,
      downloadUrl,
      sizeBytes: buffer.length,
      mimeType,
      capturedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('Photo upload failed', {
      projectId,
      eventId,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return null;
  }
}

// =============================================================================
// MAIN ORCHESTRATOR
// =============================================================================

/**
 * Process a QR check-in request.
 *
 * Orchestration flow:
 * 1. Validate QR token (HMAC + Firestore lookup)
 * 2. Resolve worker by AMKA within the project
 * 3. Verify geofence (if configured)
 * 4. Upload photo (if provided)
 * 5. Create immutable attendance event in Firestore
 *
 * @param payload - The check-in payload from the worker's browser
 * @returns Check-in result
 */
export async function processQrCheckIn(payload: QrCheckInPayload): Promise<QrCheckInResponse> {
  const failResponse = (error: string): QrCheckInResponse => ({
    success: false,
    error,
    eventId: null,
    workerName: null,
    geofence: null,
    timestamp: null,
    photoUploaded: false,
  });

  // Step 1: Validate token
  const tokenResult = await validateQrToken(payload.token);
  if (!tokenResult.valid || !tokenResult.projectId) {
    logger.warn('QR check-in rejected: invalid token', { reason: tokenResult.reason });
    return failResponse(`invalid_token: ${tokenResult.reason ?? 'unknown'}`);
  }

  const projectId = tokenResult.projectId;
  const validDate = tokenResult.validDate ?? new Date().toISOString().slice(0, 10);

  // Step 2: Resolve worker
  const worker = await resolveWorkerForProject(projectId, payload.workerIdentifier);
  if (!worker) {
    logger.warn('QR check-in rejected: worker not found', { projectId });
    return failResponse('worker_not_found');
  }

  // Step 3: Geofence verification
  let geofenceResult: GeofenceVerificationResult | null = null;
  const geofence = await getProjectGeofence(projectId);

  if (geofence && payload.coordinates) {
    geofenceResult = isWithinGeofence(
      payload.coordinates.lat,
      payload.coordinates.lng,
      geofence,
      payload.coordinates.accuracy
    );

    logger.info('Geofence check', {
      projectId,
      contactId: worker.contactId,
      inside: geofenceResult.inside,
      distance: geofenceResult.distanceMeters,
      radius: geofenceResult.radiusMeters,
    });
  }

  // Step 4: Create attendance event (immutable — server timestamp)
  const db = getAdminFirestore();
  const now = new Date().toISOString();

  const eventData = {
    projectId,
    contactId: worker.contactId,
    eventType: payload.eventType,
    method: 'qr' as const,
    timestamp: now,
    coordinates: payload.coordinates
      ? { lat: payload.coordinates.lat, lng: payload.coordinates.lng }
      : null,
    deviceId: payload.deviceInfo.userAgent.slice(0, 100),
    recordedBy: `qr:${worker.contactId}`,
    notes: geofenceResult
      ? `GPS: ${geofenceResult.distanceMeters}m from center (${geofenceResult.inside ? 'inside' : 'outside'})`
      : null,
    approvedBy: null,
    createdAt: now,
    // Extended fields for ADR-170
    geofenceResult: geofenceResult ?? null,
    qrTokenId: tokenResult.tokenId,
    deviceInfo: {
      userAgent: payload.deviceInfo.userAgent.slice(0, 200),
      platform: payload.deviceInfo.platform,
      language: payload.deviceInfo.language,
    },
    gpsAccuracy: payload.coordinates?.accuracy ?? null,
    _serverTimestamp: FieldValue.serverTimestamp(),
  };

  const eventRef = await db.collection(COLLECTIONS.ATTENDANCE_EVENTS).add(eventData);
  const eventId = eventRef.id;

  // Step 5: Upload photo (async, non-blocking for the response)
  let photoUploaded = false;
  if (payload.photoBase64) {
    const photoMeta = await uploadAttendancePhoto(
      projectId,
      eventId,
      payload.photoBase64,
      validDate
    );

    if (photoMeta) {
      // Update the event with photo metadata
      await eventRef.update({ photo: photoMeta });
      photoUploaded = true;
    }
  }

  logger.info('QR check-in successful', {
    projectId,
    contactId: worker.contactId,
    eventId,
    eventType: payload.eventType,
    geofenceInside: geofenceResult?.inside ?? null,
    photoUploaded,
  });

  return {
    success: true,
    error: null,
    eventId,
    workerName: worker.name,
    geofence: geofenceResult,
    timestamp: now,
    photoUploaded,
  };
}
