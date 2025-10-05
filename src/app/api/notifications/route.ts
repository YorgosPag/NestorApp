// app/api/notifications/route.ts
// ✅ MOCK API: Returns mock notifications για development

import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  // Mock notifications data with CTAs
  const mockNotifications = [
    {
      id: crypto.randomUUID(),
      tenantId: 'tenant-1',
      userId: 'user-1',
      createdAt: new Date().toISOString(),
      severity: 'info',
      title: 'Welcome to Enterprise Notifications',
      body: 'This is a mock notification from the server',
      channel: 'inapp',
      source: { service: 'mock-api', env: 'dev' },
      delivery: { state: 'delivered', attempts: 1 },
      meta: {
        correlationId: crypto.randomUUID(),
        traceId: crypto.randomUUID()
      },
      actions: [
        { id: 'view-details', label: 'View Details', url: 'https://example.com/details' },
        { id: 'dismiss', label: 'Dismiss', destructive: false }
      ]
    },
    {
      id: crypto.randomUUID(),
      tenantId: 'tenant-1',
      userId: 'user-1',
      createdAt: new Date(Date.now() - 60000).toISOString(),
      severity: 'success',
      title: 'System Deployed Successfully',
      body: 'Version 2.0 has been deployed to production',
      channel: 'inapp',
      source: { service: 'deployment', env: 'prod' },
      delivery: { state: 'delivered', attempts: 1 },
      actions: [
        { id: 'open-dashboard', label: 'Open Dashboard', url: 'http://localhost:3000/dashboard' }
      ]
    },
    {
      id: crypto.randomUUID(),
      tenantId: 'tenant-1',
      userId: 'user-1',
      createdAt: new Date(Date.now() - 120000).toISOString(),
      severity: 'warning',
      title: 'High Memory Usage',
      body: 'Server memory usage is above 80%',
      channel: 'inapp',
      source: { service: 'monitoring', env: 'prod' },
      delivery: { state: 'delivered', attempts: 1 },
      actions: [
        { id: 'view-metrics', label: 'View Metrics', url: 'http://localhost:3000/monitoring/metrics' },
        { id: 'restart-service', label: 'Restart Service', destructive: true }
      ]
    }
  ];

  return NextResponse.json({
    items: mockNotifications,
    cursor: undefined // No pagination for mock
  });
}

export async function POST(request: Request) {
  // Handle ack/action requests
  return NextResponse.json({ success: true }, { status: 204 });
}
