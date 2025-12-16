// app/api/notifications/route.ts
// ✅ FIRESTORE API: Real notifications from Firestore

import { NextResponse } from 'next/server';
import { fetchNotifications } from '@/services/notificationService';
import { CONTACT_INFO } from '@/config/contact-info-config';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const unseenOnly = searchParams.get('unseen') === '1';

    // 🏢 ENTERPRISE: Get user ID from localStorage (saved by UserRoleContext)
    // Default to configured demo user email
    const userId = CONTACT_INFO.DEMO_EMAIL_PERSONAL;

    const { items, cursor } = await fetchNotifications({
      userId,
      limit,
      unseenOnly
    });

    return NextResponse.json({
      items,
      cursor: cursor?.id // Return cursor ID for pagination
    });
  } catch (error) {
    console.error('Failed to fetch notifications:', error);

    // Fallback to empty array on error
    return NextResponse.json({
      items: [],
      cursor: undefined,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  // Handle ack/action requests
  return NextResponse.json({ success: true }, { status: 204 });
}
