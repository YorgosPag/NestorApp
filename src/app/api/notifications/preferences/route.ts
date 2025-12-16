// app/api/notifications/preferences/route.ts
// ✅ SAMPLE API: User notification preferences

import { NextResponse } from 'next/server';

const samplePreferences = {
  locale: 'el-GR',
  timezone: 'Europe/Athens',
  channels: {
    inapp: { enabled: true },
    email: { enabled: true, address: 'user@example.com' }
  }
};

export async function GET(request: Request) {
  return NextResponse.json(samplePreferences);
}

export async function PUT(request: Request) {
  const body = await request.json();
  console.log('⚙️ UPDATE Preferences:', body);

  // In production, update database here

  return new NextResponse(null, { status: 204 });
}
