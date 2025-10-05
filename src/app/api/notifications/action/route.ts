// app/api/notifications/action/route.ts
// ✅ FIRESTORE API: Perform notification action

import { NextResponse } from 'next/server';
import { recordNotificationAction } from '@/services/notificationService';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, actionId } = body;

    if (!id || !actionId) {
      return NextResponse.json(
        { error: 'Invalid request: id and actionId are required' },
        { status: 400 }
      );
    }

    console.log('🎯 ACTION Request:', { id, actionId });

    await recordNotificationAction(id, actionId);

    console.log('✅ Notification action recorded in Firestore');

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Failed to record notification action:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
