'use client';

import dynamic from 'next/dynamic';
import { ComponentProps } from 'react';

// Lazy-loaded CRM Dashboard components
const CRMDashboardPageContentDynamic = dynamic(
  () => import('./CRMDashboardPageContent').then(mod => ({ default: mod.CRMDashboardPageContent })),
  {
    loading: () => (
      <div className="min-h-screen bg-gray-50 dark:bg-background">
        {/* Header Skeleton */}
        <div className="bg-white dark:bg-card shadow-sm border-b">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48 animate-pulse"></div>
              <div className="flex items-center space-x-3">
                <div className="h-10 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                <div className="h-10 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Tab Navigation Skeleton */}
        <div className="bg-white dark:bg-card border-b">
          <div className="px-6">
            <div className="flex space-x-8">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-12 w-24 bg-gray-200 dark:bg-gray-700 rounded-t animate-pulse"></div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Content Skeleton */}
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-card p-6 rounded-lg shadow-sm border">
                <div className="flex items-center justify-between mb-4">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20 animate-pulse"></div>
                  <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                </div>
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-16 animate-pulse mb-2"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-24 animate-pulse"></div>
              </div>
            ))}
          </div>
          
          {/* Chart Skeleton */}
          <div className="bg-white dark:bg-card p-6 rounded-lg shadow-sm border">
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32 animate-pulse mb-6"></div>
            <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
          </div>
        </div>
      </div>
    ),
    ssr: false // Disable SSR for heavy dashboard components
  }
);

export type CRMDashboardPageContentProps = ComponentProps<any>;

export function CRMDashboardLazy(props: CRMDashboardPageContentProps) {
  return <CRMDashboardPageContentDynamic {...props} />;
}