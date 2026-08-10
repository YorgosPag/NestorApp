'use client';

/**
 * @module /reports/contacts
 * @enterprise ADR-265 Phase 9 — Contacts Report Dashboard
 * @lazy ADR-294 Batch 2 — Thin wrapper, content loaded via dynamic import
 */

import { LazyRoutes } from '@/utils/lazyRoutes';

const ReportsContacts = LazyRoutes.ReportsContacts;

export default function ContactsReportsPage() {
  return <ReportsContacts />;
}
