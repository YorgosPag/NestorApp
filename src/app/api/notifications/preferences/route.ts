/**
 * 🔔 NOTIFICATIONS API - USER PREFERENCES
 *
 * Manages user notification preferences (channels, locale, timezone).
 *
 * @module api/notifications/preferences
 * @version 2.0.0
 * @updated 2026-01-16 - AUTHZ PHASE 2: Added RBAC protection + real DB operations
 * @rateLimit STANDARD (60 req/min) - User preferences management
 *
 * 🔒 SECURITY:
 * - Permission: notifications:notifications:view
 * - Admin SDK for secure server-side operations
 * - User isolation: Each user can only read/update their own preferences
 */

import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { createModuleLogger } from '@/lib/telemetry';
import { EntityAuditService } from '@/services/entity-audit.service';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { nowISO } from '@/lib/date-local';

const logger = createModuleLogger('NotificationsPreferencesRoute');

// 🏢 ENTERPRISE: Notification Preferences Interface
interface NotificationPreferences {
  locale: string;
  timezone: string;
  channels: {
    inapp: { enabled: boolean };
    email: { enabled: boolean; address?: string };
  };
}

// 🏢 ENTERPRISE: Response data types (for apiSuccess wrapper)
interface PreferencesGetData {
  preferences: NotificationPreferences;
}

interface PreferencesUpdateData {
  message: string;
}

// Default preferences for new users
const DEFAULT_PREFERENCES: NotificationPreferences = {
  locale: 'el-GR',
  timezone: 'Europe/Athens',
  channels: {
    inapp: { enabled: true },
    email: { enabled: true }
  }
};

const baseGET = async (request: NextRequest) => {
  const handler = withAuth<ApiSuccessResponse<PreferencesGetData>>(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      logger.info('[Notifications/Preferences] Fetching preferences', { userId: ctx.uid });

      // Το προφίλ χρήστη ζει στο USERS — εκεί το γράφει το `syncUserProfileToFirestore`
      // (ADR-100). Το CONTACTS είναι το CRM ευρετήριο επαφών, με δικά του ids· ένα
      // `contacts/{authUid}` δεν υπάρχει ποτέ, οπότε αυτό το GET γύριζε defaults για ΚΑΘΕ
      // χρήστη και το PUT έγραφε σε ξένο χώρο ονομάτων. Ένα uid, ένα collection.
      const docRef = getAdminFirestore().collection(COLLECTIONS.USERS).doc(ctx.uid);
      const docSnapshot = await docRef.get();

      if (!docSnapshot.exists) {
        logger.warn('[Notifications/Preferences] User document not found, returning defaults');
        return apiSuccess<PreferencesGetData>(
          { preferences: DEFAULT_PREFERENCES },
          'Returning default preferences'
        );
      }

      const userData = docSnapshot.data();
      const preferences: NotificationPreferences = userData?.notificationPreferences || DEFAULT_PREFERENCES;

      logger.info('[Notifications/Preferences] Loaded successfully');

      // 🏢 ENTERPRISE: Return standard apiSuccess format
      return apiSuccess<PreferencesGetData>(
        { preferences },
        'Preferences loaded successfully'
      );
    },
    { permissions: 'notifications:notifications:view' }
  );

  return handler(request);
};

const basePUT = async (request: NextRequest) => {
  const handler = withAuth<ApiSuccessResponse<PreferencesUpdateData>>(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      const body = await req.json();

      logger.info('[Notifications/Preferences] Updating preferences', { userId: ctx.uid });

      // Ίδιο collection με το GET — βλ. σχόλιο εκεί. Γράφε όπου διαβάζεις.
      const docRef = getAdminFirestore().collection(COLLECTIONS.USERS).doc(ctx.uid);
      await docRef.set(
        {
          notificationPreferences: body,
          updatedAt: nowISO()
        },
        { merge: true }
      );

      // Per-entity audit trail (feeds the contact "Ιστορικό" tab via ADR-195).
      // Single change entry — the full preferences payload is stored on the
      // contact document itself, so the audit row just needs to mark WHEN
      // the user touched their notification settings. Fire-and-forget.
      await EntityAuditService.recordChange({
        entityType: ENTITY_TYPES.CONTACT,
        entityId: ctx.uid,
        entityName: ctx.email ?? null,
        action: 'updated',
        changes: [
          {
            field: 'notificationPreferences',
            oldValue: null,
            newValue: 'updated',
            label: 'Προτιμήσεις Ειδοποιήσεων',
          },
        ],
        performedBy: ctx.uid,
        performedByName: ctx.email ?? null,
        companyId: ctx.companyId,
      });

      logger.info('[Notifications/Preferences] Updated successfully');

      // 🏢 ENTERPRISE: Return standard apiSuccess format
      return apiSuccess<PreferencesUpdateData>(
        { message: 'Notification preferences updated successfully' },
        'Preferences updated'
      );
    },
    { permissions: 'notifications:notifications:view' }
  );

  return handler(request);
};

export const GET = withStandardRateLimit(baseGET);
export const PUT = withStandardRateLimit(basePUT);
