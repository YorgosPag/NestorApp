// app/api/notifications/ack/route.ts
// ✅ FIRESTORE API: Mark notifications as read

import { NextResponse } from 'next/server';
import { markNotificationsAsRead } from '@/services/notificationService';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { ids } = body;

    if (!ids || !Array.isArray(ids)) {
      return NextResponse.json({ error: 'Invalid request: ids must be an array' }, { status: 400 });
    }

    console.log('📥 ACK Request - Marking as read:', ids);

    await markNotificationsAsRead(ids);

    console.log('✅ Notifications marked as read in Firestore');

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Failed to mark notifications as read:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
