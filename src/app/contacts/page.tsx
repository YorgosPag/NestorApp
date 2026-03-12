'use client';

// ⚡ ENTERPRISE: Use LazyRoutes instead of direct import για massive bundle reduction
import { LazyRoutes } from '@/utils/lazyRoutes';
import { ModuleBreadcrumb } from '@/components/shared/ModuleBreadcrumb';

export default function ContactsPage() {
  const Contacts = LazyRoutes.Contacts;
  return (
    <>
      <ModuleBreadcrumb className="px-6 pt-4" />
      <Contacts />
    </>
  );
}
