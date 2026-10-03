'use client';

/**
 * `/admin/ownership-verifications` — η ουρά ελέγχου επαληθεύσεων κατοχής (ADR-900 §3.8).
 * Εργαλείο του παρόχου, πάνω από όλους τους χώρους (`workspace-scope.ts` → `admin`). Μόνο super_admin.
 */

import { LazyRoutes } from '@/utils/lazyRoutes';

export default function OwnershipVerificationsPage() {
  const OwnershipVerifications = LazyRoutes.AdminOwnershipVerifications;
  return <OwnershipVerifications />;
}
