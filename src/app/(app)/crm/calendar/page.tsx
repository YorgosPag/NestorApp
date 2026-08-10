'use client';

/**
 * CRM Calendar Page
 * @lazy ADR-294 — Thin wrapper, content loaded via dynamic import
 */

import { LazyRoutes } from '@/utils/lazyRoutes';

const CrmCalendar = LazyRoutes.CrmCalendar;

export default function CrmCalendarPage() {
  return <CrmCalendar />;
}
