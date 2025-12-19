'use client';

// ⚡ ENTERPRISE: Use LazyRoutes instead of direct import για massive bundle reduction
import { LazyRoutes } from '@/utils/lazyRoutes';

export default function ContactsPage() {
  const Contacts = LazyRoutes.Contacts;
  return <Contacts />;
}
