'use client';

import dynamic from 'next/dynamic';
import { ComponentProps } from 'react';
import { LandingPage } from './LandingPage';
// 🏢 ENTERPRISE: Import from canonical location
import { Spinner as AnimatedSpinner } from '@/components/ui/spinner';

// Lazy-loaded LandingPage with optimized loading
const LandingPageDynamic = dynamic(
  () => import('./LandingPage').then(mod => ({ default: mod.LandingPage })),
  {
    loading: () => (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-900 dark:via-gray-900 dark:to-blue-950">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <AnimatedSpinner size="large" className="mx-auto mb-6" /> {/* 🏢 ENTERPRISE: Changed x-large to large */}
            <div className="space-y-3">
              <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse w-64" />
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse w-48" />
            </div>
          </div>
        </div>
      </div>
    ),
    ssr: true // Enable SSR for SEO benefits on landing page
  }
);

export type LandingPageProps = ComponentProps<typeof LandingPage>;

export function LandingPageLazy(props: LandingPageProps) {
  // 🏢 ENTERPRISE: Type assertion for dynamic component props spreading
  return <LandingPageDynamic {...(props as Record<string, unknown>)} />;
}