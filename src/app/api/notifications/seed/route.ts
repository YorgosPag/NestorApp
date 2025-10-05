// app/api/notifications/seed/route.ts
// ✅ Development endpoint to create sample notifications in Firestore

import { NextResponse } from 'next/server';
import { createSampleNotifications } from '@/services/notificationService';

export async function POST(request: Request) {
  try {
    // Get user ID (same as main API)
    const userId = 'user@example.com';

    console.log('🌱 Creating sample notifications for user:', userId);

    await createSampleNotifications(userId);

    console.log('✅ Sample notifications created successfully in Firestore');

    return NextResponse.json({
      success: true,
      message: `Sample notifications created for ${userId}`,
      userId
    });
  } catch (error) {
    console.error('Failed to create sample notifications:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
