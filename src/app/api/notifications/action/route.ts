// app/api/notifications/action/route.ts
// ✅ MOCK API: Perform notification action

import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const body = await request.json();
  console.log('🎯 ACTION Request:', body);

  // In production, execute action here

  return new NextResponse(null, { status: 204 });
}
