'use client';

/**
 * CRM Calendar Page
 * @lazy ADR-294 — Thin wrapper, content loaded via dynamic import
 */

import { CrmRoutes } from '@/components/crm/crm-routes';

const CrmCalendar = CrmRoutes.CrmCalendar;

export default function CrmCalendarPage() {
  return <CrmCalendar />;
}
