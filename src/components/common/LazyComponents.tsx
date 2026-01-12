'use client';

/**
 * 🏢 ENTERPRISE LAZY COMPONENTS
 *
 * Centralized lazy-loading components for code-splitting optimization.
 * Follows Next.js dynamic import patterns with consistent skeleton states.
 *
 * @module components/common/LazyComponents
 * @version 2.0.0
 *
 * Architecture:
 * - Uses COLOR_BRIDGE for consistent, theme-aware skeleton colors
 * - All skeletons follow the same visual pattern for brand consistency
 * - Type-safe component props exported for consumer type checking
 *
 * @see https://nextjs.org/docs/advanced-features/dynamic-import
 * @see src/design-system/color-bridge.ts
 */

import dynamic from 'next/dynamic';
import { ComponentProps } from 'react';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';

// ============================================================================
// SKELETON COMPONENTS
// ============================================================================

/**
 * Generic skeleton for modal dialogs
 * Uses static COLOR_BRIDGE (safe for use in Next.js dynamic loading functions)
 */
function ModalSkeleton() {
  return (
    <div
      className={`fixed inset-0 flex items-center justify-center z-50 ${COLOR_BRIDGE.bg.modalBackdrop}`}
      role="dialog"
      aria-busy="true"
      aria-label="Loading modal..."
    >
      <div className={`${COLOR_BRIDGE.bg.card} rounded-lg shadow-xl w-full max-w-2xl mx-4`}>
        <header className="p-6 border-b border-border">
          <div className={`h-6 ${COLOR_BRIDGE.bg.skeleton} rounded w-48 animate-pulse`} />
        </header>
        <main className="p-6 space-y-4">
          <div className={`h-4 ${COLOR_BRIDGE.bg.skeleton} rounded w-full animate-pulse`} />
          <div className={`h-4 ${COLOR_BRIDGE.bg.skeleton} rounded w-3/4 animate-pulse`} />
          <div className={`h-32 ${COLOR_BRIDGE.bg.skeleton} rounded animate-pulse`} />
        </main>
        <footer className="p-6 border-t border-border flex justify-end gap-3">
          <div className={`h-10 w-20 ${COLOR_BRIDGE.bg.skeleton} rounded animate-pulse`} />
          <div className={`h-10 w-20 ${COLOR_BRIDGE.bg.skeleton} rounded animate-pulse`} />
        </footer>
      </div>
    </div>
  );
}

/**
 * Skeleton for chart/visualization components
 */
function ChartSkeleton() {
  return (
    <div
      className={`h-64 ${COLOR_BRIDGE.bg.skeleton} rounded animate-pulse flex items-center justify-center`}
      role="img"
      aria-busy="true"
      aria-label="Loading chart..."
    >
      <span className={COLOR_BRIDGE.text.muted}>Loading chart...</span>
    </div>
  );
}

/**
 * Skeleton for layer manager panel
 */
function LayerManagerSkeleton() {
  return (
    <div className="space-y-4" role="region" aria-busy="true" aria-label="Loading layer manager...">
      <div className="flex items-center justify-between">
        <div className={`h-6 ${COLOR_BRIDGE.bg.skeleton} rounded w-32 animate-pulse`} />
        <div className={`h-8 w-24 ${COLOR_BRIDGE.bg.skeleton} rounded animate-pulse`} />
      </div>
      <ul className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <li key={i} className={`h-12 ${COLOR_BRIDGE.bg.skeleton} rounded animate-pulse`} />
        ))}
      </ul>
    </div>
  );
}

/**
 * Skeleton for sidebar navigation
 */
function SidebarSkeleton() {
  return (
    <nav
      className={`w-64 ${COLOR_BRIDGE.bg.card} border-r border-border h-full`}
      role="navigation"
      aria-busy="true"
      aria-label="Loading sidebar..."
    >
      <div className="p-4">
        <div className={`h-8 ${COLOR_BRIDGE.bg.skeleton} rounded w-32 animate-pulse mb-6`} />
        <ul className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <li key={i} className="flex items-center gap-3 p-2">
              <div className={`h-5 w-5 ${COLOR_BRIDGE.bg.skeleton} rounded animate-pulse`} />
              <div className={`h-4 ${COLOR_BRIDGE.bg.skeleton} rounded flex-1 animate-pulse`} />
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

// ============================================================================
// LAZY-LOADED COMPONENTS
// ============================================================================

/**
 * Lazy-loaded Share Modal
 * @see src/components/ui/ShareModal
 */
export const ShareModalLazy = dynamic(
  () => import('@/components/ui/ShareModal').then(mod => ({ default: mod.ShareModal })),
  {
    loading: () => <ModalSkeleton />,
    ssr: false
  }
);

/**
 * Lazy-loaded Send Message Modal (CRM)
 * @see src/components/crm/SendMessageModal
 */
export const SendMessageModalLazy = dynamic(
  () => import('@/components/crm/SendMessageModal'),
  {
    loading: () => <ModalSkeleton />,
    ssr: false
  }
);

/**
 * Lazy-loaded Create Task Modal (CRM Dashboard)
 * @see src/components/crm/dashboard/dialogs/CreateTaskModal
 */
export const CreateTaskModalLazy = dynamic(
  () => import('@/components/crm/dashboard/dialogs/CreateTaskModal'),
  {
    loading: () => <ModalSkeleton />,
    ssr: false
  }
);

/**
 * Lazy-loaded Chart Container (Recharts wrapper)
 * @see src/components/ui/chart/ChartContainer
 */
export const ChartContainerLazy = dynamic(
  () => import('@/components/ui/chart/ChartContainer').then(mod => ({ default: mod.ChartContainer })),
  {
    loading: () => <ChartSkeleton />,
    ssr: false
  }
);

/**
 * Lazy-loaded Admin Layer Manager (DXF Viewer)
 * Heavy component - always lazy-load
 * @see src/subapps/dxf-viewer/ui/components/AdminLayerManager
 */
export const AdminLayerManagerLazy = dynamic(
  () => import('@/subapps/dxf-viewer/ui/components/AdminLayerManager').then(mod => ({ default: mod.AdminLayerManager })),
  {
    loading: () => <LayerManagerSkeleton />,
    ssr: false
  }
);

/**
 * Lazy-loaded Sidebar
 * Keep SSR enabled for navigation SEO
 * @see src/components/ui/sidebar
 */
export const SidebarLazy = dynamic(
  () => import('@/components/ui/sidebar').then(mod => ({ default: mod.Sidebar })),
  {
    loading: () => <SidebarSkeleton />,
    ssr: true
  }
);

// ============================================================================
// TYPE EXPORTS
// ============================================================================

/** Props type for ShareModalLazy component */
export type ShareModalProps = ComponentProps<typeof ShareModalLazy>;

/** Props type for SendMessageModalLazy component */
export type SendMessageModalProps = ComponentProps<typeof SendMessageModalLazy>;

/** Props type for CreateTaskModalLazy component */
export type CreateTaskModalProps = ComponentProps<typeof CreateTaskModalLazy>;

/** Props type for ChartContainerLazy component */
export type ChartContainerProps = ComponentProps<typeof ChartContainerLazy>;

/** Props type for AdminLayerManagerLazy component */
export type AdminLayerManagerProps = ComponentProps<typeof AdminLayerManagerLazy>;

/** Props type for SidebarLazy component */
export type SidebarProps = ComponentProps<typeof SidebarLazy>;
