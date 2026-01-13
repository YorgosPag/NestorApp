// app/api/notifications/seed/route.ts
// ✅ Development endpoint to create sample notifications in Firestore

import { NextResponse } from 'next/server';
import { createSampleNotifications } from '@/services/notificationService';

interface SeedRequestBody {
  userId?: string;
}

export async function POST(request: Request) {
  try {
    // Get user ID from request body (Firebase Auth UID)
    const body = await request.json() as SeedRequestBody;
    const userId = body.userId;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required in request body' },
        { status: 400 }
      );
    }

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
