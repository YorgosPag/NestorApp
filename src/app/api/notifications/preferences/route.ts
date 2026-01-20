/**
 * 🔔 NOTIFICATIONS API - USER PREFERENCES
 *
 * Manages user notification preferences (channels, locale, timezone).
 *
 * @module api/notifications/preferences
 * @version 2.0.0
 * @updated 2026-01-16 - AUTHZ PHASE 2: Added RBAC protection + real DB operations
 *
 * 🔒 SECURITY:
 * - Permission: notifications:notifications:view
 * - Admin SDK for secure server-side operations
 * - User isolation: Each user can only read/update their own preferences
 */

import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { adminDb } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';

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

export async function GET(request: NextRequest) {
  const handler = withAuth<ApiSuccessResponse<PreferencesGetData>>(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      console.log(`🔔 [Notifications/Preferences] Fetching for user ${ctx.uid}...`);

      // Fetch user preferences from Firestore
      const docRef = adminDb.collection(COLLECTIONS.CONTACTS).doc(ctx.uid);
      const docSnapshot = await docRef.get();

      if (!docSnapshot.exists) {
        console.log(`⚠️ [Notifications/Preferences] User document not found, returning defaults`);
        return apiSuccess<PreferencesGetData>(
          { preferences: DEFAULT_PREFERENCES },
          'Returning default preferences'
        );
      }

      const userData = docSnapshot.data();
      const preferences: NotificationPreferences = userData?.notificationPreferences || DEFAULT_PREFERENCES;

      console.log(`✅ [Notifications/Preferences] Loaded successfully`);

      // 🏢 ENTERPRISE: Return standard apiSuccess format
      return apiSuccess<PreferencesGetData>(
        { preferences },
        'Preferences loaded successfully'
      );
    },
    { permissions: 'notifications:notifications:view' }
  );

  return handler(request);
}

export async function PUT(request: NextRequest) {
  const handler = withAuth<ApiSuccessResponse<PreferencesUpdateData>>(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      const body = await req.json();

      console.log(`🔔 [Notifications/Preferences] Updating for user ${ctx.uid}...`);

      // Update user preferences in Firestore
      const docRef = adminDb.collection(COLLECTIONS.CONTACTS).doc(ctx.uid);
      await docRef.set(
        {
          notificationPreferences: body,
          updatedAt: new Date().toISOString()
        },
        { merge: true }
      );

      console.log(`✅ [Notifications/Preferences] Updated successfully`);

      // 🏢 ENTERPRISE: Return standard apiSuccess format
      return apiSuccess<PreferencesUpdateData>(
        { message: 'Notification preferences updated successfully' },
        'Preferences updated'
      );
    },
    { permissions: 'notifications:notifications:view' }
  );

  return handler(request);
}
