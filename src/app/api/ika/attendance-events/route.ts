/**
 * =============================================================================
 * POST /api/ika/attendance-events — Create immutable attendance event
 * =============================================================================
 *
 * Migrated from client-side write (useAttendanceEvents.ts) to server-side
 * for: validation, tenant isolation, audit trail, enterprise ID generation.
 *
 * Events are IMMUTABLE — once created, they cannot be modified or deleted.
 * This is a legal requirement for construction site compliance (ΣΕΠΕ).
 *
 * @module api/ika/attendance-events
 * @enterprise ADR-090 — IKA/EFKA Labor Compliance System
 * @security SPEC-255C — Client-Side Writes Migration (CRITICAL)
 */

import 'server-only';

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth, logAuditEvent } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { generateEventId } from '@/services/enterprise-id.service';
import { getErrorMessage } from '@/lib/error-utils';
import { safeParseBody } from '@/lib/validation/shared-schemas';

// =============================================================================
// TYPES
// =============================================================================

const CreateAttendanceEventSchema = z.object({
  projectId: z.string().min(1).max(128),
  contactId: z.string().min(1).max(128),
  eventType: z.enum(['check_in', 'check_out', 'break_start', 'break_end']),
  method: z.enum(['manual', 'qr_code', 'gps', 'nfc']),
  notes: z.string().max(2000).optional(),
  coordinates: z.object({ lat: z.number(), lng: z.number() }).optional(),
  deviceId: z.string().max(200).optional(),
  approvedBy: z.string().max(128).optional(),
});

// =============================================================================
// POST — Create Attendance Event (Immutable)
// =============================================================================

async function handlePost(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const parsed = safeParseBody(CreateAttendanceEventSchema, await req.json());
        if (parsed.error) return parsed.error;
        const body = parsed.data;

        const now = new Date().toISOString();
        const eventId = generateEventId();

        const eventData = {
          projectId: body.projectId,
          contactId: body.contactId,
          eventType: body.eventType,
          method: body.method,
          timestamp: now,
          coordinates: body.coordinates ?? null,
          deviceId: body.deviceId ?? null,
          recordedBy: ctx.uid,
          notes: body.notes ?? null,
          approvedBy: body.approvedBy ?? null,
          companyId: ctx.companyId,
          createdAt: now,
        };

        const db = getAdminFirestore();
        await db.collection(COLLECTIONS.ATTENDANCE_EVENTS).doc(eventId).set(eventData);

        await logAuditEvent(ctx, 'data_created', eventId, 'project', {
          metadata: { reason: `Attendance event created — ΣΕΠΕ compliance (project: ${body.projectId})` },
        }).catch(() => {/* non-blocking */});

        return NextResponse.json({ success: true, data: { id: eventId } }, { status: 201 });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to create attendance event');
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    }
  );

  return handler(request);
}

export const POST = withStandardRateLimit(handlePost);
