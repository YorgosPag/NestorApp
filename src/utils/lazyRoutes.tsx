'use client';

import dynamic from 'next/dynamic';
import { ComponentType } from 'react';

// Generic loading components for different types of pages
export const PageLoadingSpinner = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto mb-6"></div>
      <p className="text-muted-foreground">Φόρτωση σελίδας...</p>
    </div>
  </div>
);

export const DashboardLoadingSkeleton = () => (
  <div className="min-h-screen bg-background">
    <div className="border-b bg-card">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="space-y-2">
            <div className="h-8 bg-muted rounded w-48 animate-pulse"></div>
            <div className="h-4 bg-muted rounded w-64 animate-pulse"></div>
          </div>
          <div className="flex space-x-3">
            <div className="h-10 w-32 bg-muted rounded animate-pulse"></div>
            <div className="h-10 w-10 bg-muted rounded animate-pulse"></div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-background border rounded-lg p-4">
              <div className="space-y-2">
                <div className="h-4 bg-muted rounded w-16 animate-pulse"></div>
                <div className="h-8 bg-muted rounded w-20 animate-pulse"></div>
                <div className="h-3 bg-muted rounded w-24 animate-pulse"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
    <div className="p-6">
      <div className="h-64 bg-muted rounded animate-pulse"></div>
    </div>
  </div>
);

export const FormLoadingSkeleton = () => (
  <div className="min-h-screen bg-background p-6">
    <div className="max-w-4xl mx-auto">
      <div className="bg-card border rounded-lg p-6">
        <div className="space-y-6">
          <div className="h-6 bg-muted rounded w-48 animate-pulse"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 bg-muted rounded w-24 animate-pulse"></div>
                <div className="h-10 bg-muted rounded animate-pulse"></div>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <div className="h-4 bg-muted rounded w-32 animate-pulse"></div>
            <div className="h-24 bg-muted rounded animate-pulse"></div>
          </div>
          <div className="flex justify-end space-x-3">
            <div className="h-10 w-20 bg-muted rounded animate-pulse"></div>
            <div className="h-10 w-20 bg-muted rounded animate-pulse"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export const ListLoadingSkeleton = () => (
  <div className="min-h-screen bg-background">
    <div className="border-b bg-card p-6">
      <div className="flex items-center justify-between">
        <div className="h-8 bg-muted rounded w-32 animate-pulse"></div>
        <div className="h-10 w-32 bg-muted rounded animate-pulse"></div>
      </div>
    </div>
    <div className="p-6">
      <div className="space-y-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-card border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="h-5 bg-muted rounded w-32 animate-pulse"></div>
                <div className="h-4 bg-muted rounded w-48 animate-pulse"></div>
              </div>
              <div className="h-6 w-16 bg-muted rounded-full animate-pulse"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// Utility function to create lazy routes with different loading states
export function createLazyRoute<T = {}>(
  importFn: () => Promise<{ default: ComponentType<T> }>,
  options: {
    loadingType?: 'spinner' | 'dashboard' | 'form' | 'list';
    ssr?: boolean;
  } = {}
) {
  const { loadingType = 'spinner', ssr = false } = options;
  
  const LoadingComponent = {
    spinner: PageLoadingSpinner,
    dashboard: DashboardLoadingSkeleton,
    form: FormLoadingSkeleton,
    list: ListLoadingSkeleton,
  }[loadingType];

  return dynamic(importFn, {
    loading: LoadingComponent,
    ssr
  });
}

// Pre-configured lazy routes for common patterns
export const LazyRoutes = {
  // Dashboard routes (heavy with charts and data)
  CRMDashboard: createLazyRoute(
    () => import('@/components/crm/dashboard/CRMDashboardPageContent').then(mod => ({ default: mod.CRMDashboardPageContent })),
    { loadingType: 'dashboard', ssr: false }
  ),
  
  // Management/List routes
  Buildings: createLazyRoute(
    () => import('@/components/building-management/BuildingsPageContent').then(mod => ({ default: mod.BuildingsPageContent })),
    { loadingType: 'list', ssr: false }
  ),
  
  Contacts: createLazyRoute(
    () => import('@/components/contacts/ContactsPageContent').then(mod => ({ default: mod.ContactsPageContent })),
    { loadingType: 'list', ssr: false }
  ),
  
  Units: createLazyRoute(
    () => import('@/components/units/UnitsPageContent').then(mod => ({ default: mod.UnitsPageContent })),
    { loadingType: 'list', ssr: false }
  ),
  
  Properties: createLazyRoute(
    () => import('@/components/properties/PropertiesPageContent').then(mod => ({ default: mod.PropertiesPageContent })),
    { loadingType: 'list', ssr: false }
  ),
  
  // Form routes
  ObligationsNew: createLazyRoute(
    () => import('@/components/obligations/ObligationForm').then(mod => ({ default: mod.ObligationForm })),
    { loadingType: 'form', ssr: false }
  ),
  
  ObligationsEdit: createLazyRoute(
    () => import('@/components/obligations/ObligationEditForm').then(mod => ({ default: mod.ObligationEditForm })),
    { loadingType: 'form', ssr: false }
  ),
  
  // Landing (SEO important, keep SSR)
  Landing: createLazyRoute(
    () => import('@/components/landing/LandingPage').then(mod => ({ default: mod.LandingPage })),
    { loadingType: 'spinner', ssr: true }
  ),
  
  // Heavy DXF Viewer (already optimized, but include for completeness)
  DXFViewer: createLazyRoute(
    () => import('@/subapps/dxf-viewer/DxfViewerApp').then(mod => ({ default: mod.default })),
    { loadingType: 'spinner', ssr: false }
  ),
} as const;

// Export types for TypeScript support
export type LazyRouteComponent = ComponentType<any>;
export type LoadingType = 'spinner' | 'dashboard' | 'form' | 'list';