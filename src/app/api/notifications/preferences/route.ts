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

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { adminDb } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';

// Notification Preferences Interface
interface NotificationPreferences {
  locale: string;
  timezone: string;
  channels: {
    inapp: { enabled: boolean };
    email: { enabled: boolean; address?: string };
  };
}

// Response types for type-safe withAuth
type PreferencesGetSuccess = {
  success: true;
  preferences: NotificationPreferences;
};

type PreferencesGetError = {
  success: false;
  error: string;
  details?: string;
};

type PreferencesGetResponse = PreferencesGetSuccess | PreferencesGetError;

type PreferencesUpdateSuccess = {
  success: true;
  message: string;
};

type PreferencesUpdateError = {
  success: false;
  error: string;
  details?: string;
};

type PreferencesUpdateResponse = PreferencesUpdateSuccess | PreferencesUpdateError;

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
  const handler = withAuth<PreferencesGetResponse>(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse<PreferencesGetResponse>> => {
      try {
        console.log(`🔔 [Notifications/Preferences] Fetching preferences for user ${ctx.uid}...`);

        // Fetch user preferences from Firestore
        const docRef = adminDb.collection(COLLECTIONS.CONTACTS).doc(ctx.uid);
        const docSnapshot = await docRef.get();

        if (!docSnapshot.exists) {
          console.log(`⚠️ User document not found, returning defaults`);
          return NextResponse.json({
            success: true,
            preferences: DEFAULT_PREFERENCES
          });
        }

        const userData = docSnapshot.data();
        const preferences: NotificationPreferences = userData?.notificationPreferences || DEFAULT_PREFERENCES;

        console.log(`✅ [Notifications/Preferences] Complete`);

        return NextResponse.json({
          success: true,
          preferences
        });
      } catch (error) {
        console.error('❌ [Notifications/Preferences] GET Error:', {
          error: error instanceof Error ? error.message : 'Unknown error',
          userId: ctx.uid
        });

        return NextResponse.json({
          success: false,
          error: 'Failed to fetch notification preferences',
          details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
      }
    },
    { permissions: 'notifications:notifications:view' }
  );

  return handler(request);
}

export async function PUT(request: NextRequest) {
  const handler = withAuth<PreferencesUpdateResponse>(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse<PreferencesUpdateResponse>> => {
      try {
        const body = await req.json();

        console.log(`🔔 [Notifications/Preferences] Updating preferences for user ${ctx.uid}...`);
        console.log('⚙️ New preferences:', body);

        // Update user preferences in Firestore
        const docRef = adminDb.collection(COLLECTIONS.CONTACTS).doc(ctx.uid);
        await docRef.set(
          {
            notificationPreferences: body,
            updatedAt: new Date().toISOString()
          },
          { merge: true }
        );

        console.log(`✅ [Notifications/Preferences] Update complete`);

        return NextResponse.json({
          success: true,
          message: 'Notification preferences updated successfully'
        });
      } catch (error) {
        console.error('❌ [Notifications/Preferences] PUT Error:', {
          error: error instanceof Error ? error.message : 'Unknown error',
          userId: ctx.uid
        });

        return NextResponse.json({
          success: false,
          error: 'Failed to update notification preferences',
          details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
      }
    },
    { permissions: 'notifications:notifications:view' }
  );

  return handler(request);
}
