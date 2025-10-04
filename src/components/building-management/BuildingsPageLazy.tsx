'use client';

import dynamic from 'next/dynamic';
import { ComponentProps } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';

// Lazy-loaded Buildings Page Content
const BuildingsPageContentDynamic = dynamic(
  () => import('./BuildingsPageContent').then(mod => ({ default: mod.BuildingsPageContent })),
  {
    loading: () => (
      <TooltipProvider>
        <div className="h-full bg-background">
          {/* Header Skeleton */}
          <div className="border-b bg-card">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48 animate-pulse mb-2"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-64 animate-pulse"></div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                </div>
              </div>
              
              {/* Stats Cards Skeleton */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="bg-background border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16 animate-pulse"></div>
                      <div className="h-5 w-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    </div>
                    <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-20 animate-pulse mb-1"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-24 animate-pulse"></div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Toolbar Skeleton */}
            <div className="px-6 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="h-10 w-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  <div className="h-10 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  <div className="h-10 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Content Skeleton */}
          <div className="flex h-full">
            {/* Building List Skeleton */}
            <div className="w-1/2 border-r p-6">
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="bg-card border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-32 animate-pulse mb-2"></div>
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-48 animate-pulse"></div>
                      </div>
                      <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"></div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-12 animate-pulse mb-1"></div>
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-8 animate-pulse"></div>
                      </div>
                      <div>
                        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16 animate-pulse mb-1"></div>
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-12 animate-pulse"></div>
                      </div>
                      <div>
                        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-14 animate-pulse mb-1"></div>
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-10 animate-pulse"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Details Panel Skeleton */}
            <div className="w-1/2 p-6">
              <div className="text-center text-gray-500 dark:text-gray-400">
                <div className="h-16 w-16 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-4 animate-pulse"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-48 mx-auto animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>
      </TooltipProvider>
    ),
    ssr: false // Disable SSR for building management
  }
);

export type BuildingsPageContentProps = ComponentProps<any>;

export function BuildingsPageLazy(props: BuildingsPageContentProps) {
  return <BuildingsPageContentDynamic {...props} />;
}