'use client';

/**
 * @module components/projects/tabs/ProcurementProjectTab
 * @enterprise ADR-330 §5.1 S2 — Eject the in-page state-based tab into the
 *   URL-based procurement section (`/projects/[id]/procurement/*`). The actual
 *   surface lives under that route segment with its own RouteTabs strip and
 *   server-side RBAC guard. Mirrors the Procore "Commitments tool" pattern.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';

export function ProcurementProjectTab({ projectId }: { projectId: string }) {
  const router = useRouter();

  useEffect(() => {
    router.replace(`/projects/${projectId}/procurement/overview`);
  }, [projectId, router]);

  return (
    <div className="space-y-3 p-4" aria-busy="true">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
