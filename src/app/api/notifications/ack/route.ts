// app/api/notifications/ack/route.ts
// ✅ MOCK API: Mark notifications as read

import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const body = await request.json();
  console.log('📥 ACK Request:', body);

  // In production, update database here

  return new NextResponse(null, { status: 204 });
}
