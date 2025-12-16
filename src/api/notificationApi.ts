// api/notificationApi.ts
export async function fetchNotifications(): Promise<any[]> {
  await new Promise(r => setTimeout(r, 500));
  return [
    { id: '1', title: 'Server Deploy', body: 'Version 2.3 released', kind: 'success', createdAt: new Date().toISOString(), read: false },
    { id: '2', title: 'Job Failed', body: 'ETL pipeline halted', kind: 'error', createdAt: new Date().toISOString(), read: false },
  ];
}

export function connectSampleWS(onEvent: (n: any) => void) {
  const interval = setInterval(() => {
    onEvent({
      id: crypto.randomUUID(),
      title: 'Realtime Event',
      body: 'Telemetry sample',
      kind: 'info',
      createdAt: new Date().toISOString(),
      read: false
    });
  }, 15000);
  return () => clearInterval(interval);
}
