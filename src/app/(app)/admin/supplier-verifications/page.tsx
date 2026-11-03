'use client';

/**
 * `/admin/supplier-verifications` — η ουρά ελέγχου προμηθευτών (ADR-923 §5.13 Ε1α).
 * Εργαλείο του παρόχου, πάνω από όλους τους χώρους. Μόνο super_admin.
 */

import { LazyRoutes } from '@/utils/lazyRoutes';

export default function SupplierVerificationsPage() {
  const SupplierVerifications = LazyRoutes.AdminSupplierVerifications;
  return <SupplierVerifications />;
}
