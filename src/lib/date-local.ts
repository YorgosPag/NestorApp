

export function toLocalDateInputValue(d: Date): string { // 'YYYY-MM-DD'
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function combineLocalDateTime(dateStr: string, timeStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(n => parseInt(n, 10));
  const [hh, mm] = (timeStr || '00:00').split(':').map(n => parseInt(n, 10));
  const dt = new Date(y, (m - 1), d, isNaN(hh) ? 0 : hh, isNaN(mm) ? 0 : mm, 0, 0);
  return dt;
}

export function normalizeToDate(val: any): Date | null {
  if (!val) return null;
  // Firestore Timestamp
  if (val && typeof val.toDate === 'function') return val.toDate();
  // JS Date
  if (val instanceof Date) return val;
  // ISO string / epoch
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}
