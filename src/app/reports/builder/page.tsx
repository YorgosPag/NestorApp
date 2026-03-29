/**
 * @module app/reports/builder/page
 * @enterprise ADR-268 — Dynamic Report Builder Page
 */

'use client';

import '@/lib/design-system';
import { Suspense } from 'react';
import { ReportBuilder } from '@/components/reports/builder/ReportBuilder';
import { Skeleton } from '@/components/ui/skeleton';

export default function ReportBuilderPage() {
  return (
    <Suspense fallback={<BuilderSkeleton />}>
      <ReportBuilder />
    </Suspense>
  );
}

function BuilderSkeleton() {
  return (
    <section className="space-y-4 p-6" aria-label="Loading report builder">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-12 w-full" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </section>
  );
}
