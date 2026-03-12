'use client';

// ⚡ ENTERPRISE: Use LazyRoutes instead of direct import για massive bundle reduction
import { LazyRoutes } from '@/utils/lazyRoutes';

export default function ContactsPage() {
  const Contacts = LazyRoutes.Contacts;
  // Breadcrumb is rendered inside ContactsHeader → PageHeader
  return <Contacts />;
}
