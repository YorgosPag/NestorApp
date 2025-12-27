'use client';

import dynamic from 'next/dynamic';
import { ComponentProps } from 'react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

// Generic Modal Skeleton
function ModalSkeleton() {
  const colors = useSemanticColors();
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className={`${colors.bg.primary} rounded-lg shadow-xl w-full max-w-2xl mx-4`}>
        <div className="p-6 border-b">
          <div className={`h-6 ${colors.bg.skeleton} rounded w-48 animate-pulse`}></div>
        </div>
        <div className="p-6 space-y-4">
          <div className={`h-4 ${colors.bg.skeleton} rounded w-full animate-pulse`}></div>
          <div className={`h-4 ${colors.bg.skeleton} rounded w-3/4 animate-pulse`}></div>
          <div className={`h-32 ${colors.bg.skeleton} rounded animate-pulse`}></div>
        </div>
        <div className="p-6 border-t flex justify-end space-x-3">
          <div className={`h-10 w-20 ${colors.bg.skeleton} rounded animate-pulse`}></div>
          <div className={`h-10 w-20 ${colors.bg.skeleton} rounded animate-pulse`}></div>
        </div>
      </div>
    </div>
  );
}

// Generic Form Skeleton
function FormSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className={`h-4 ${colors.bg.skeleton} rounded w-24 animate-pulse`}></div>
            <div className={`h-10 ${colors.bg.skeleton} rounded animate-pulse`}></div>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <div className={`h-4 ${colors.bg.skeleton} rounded w-32 animate-pulse`}></div>
        <div className={`h-24 ${colors.bg.skeleton} rounded animate-pulse`}></div>
      </div>
    </div>
  );
}

// Lazy Share Modal
export const ShareModalLazy = dynamic(
  () => import('@/components/ui/ShareModal').then(mod => ({ default: mod.ShareModal })),
  {
    loading: () => <ModalSkeleton />,
    ssr: false
  }
);

// Lazy Send Message Modal  
export const SendMessageModalLazy = dynamic(
  () => import('@/components/crm/communications/SendMessageModal').then(mod => ({ default: mod.SendMessageModal })),
  {
    loading: () => <ModalSkeleton />,
    ssr: false
  }
);

// Lazy Create Task Modal
export const CreateTaskModalLazy = dynamic(
  () => import('@/components/crm/tasks/CreateTaskModal').then(mod => ({ default: mod.CreateTaskModal })),
  {
    loading: () => <ModalSkeleton />,
    ssr: false
  }
);

// Lazy PDF Uploader
export const PDFUploaderLazy = dynamic(
  () => import('@/components/pdf/PDFUploader').then(mod => ({ default: mod.PDFUploader })),
  {
    loading: () => <FormSkeleton />,
    ssr: false
  }
);

// Chart Container Lazy (for recharts)
export const ChartContainerLazy = dynamic(
  () => import('@/components/ui/ChartContainer').then(mod => ({ default: mod.ChartContainer })),
  {
    loading: () => (
      <div className={`h-64 ${colors.bg.skeleton} rounded animate-pulse flex items-center justify-center`}>
        <div className={colors.text.muted}>Loading chart...</div>
      </div>
    ),
    ssr: false
  }
);

// Admin Layer Manager Lazy (heavy DXF component)
export const AdminLayerManagerLazy = dynamic(
  () => import('@/subapps/dxf-viewer/ui/components/AdminLayerManager').then(mod => ({ default: mod.AdminLayerManager })),
  {
    loading: () => (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className={`h-6 ${colors.bg.skeleton} rounded w-32 animate-pulse`}></div>
          <div className={`h-8 w-24 ${colors.bg.skeleton} rounded animate-pulse`}></div>
        </div>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={`h-12 ${colors.bg.skeleton} rounded animate-pulse`}></div>
          ))}
        </div>
      </div>
    ),
    ssr: false
  }
);

// Sidebar Lazy
export const SidebarLazy = dynamic(
  () => import('@/components/ui/sidebar').then(mod => ({ default: mod.Sidebar })),
  {
    loading: () => (
      <div className="w-64 bg-card border-r h-full">
        <div className="p-4">
          <div className={`h-8 ${colors.bg.skeleton} rounded w-32 animate-pulse mb-6`}></div>
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-3 p-2">
                <div className={`h-5 w-5 ${colors.bg.skeleton} rounded animate-pulse`}></div>
                <div className={`h-4 ${colors.bg.skeleton} rounded flex-1 animate-pulse`}></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    ssr: true // Keep sidebar SSR for navigation
  }
);

// Export component props for type safety
export type ShareModalProps = ComponentProps<any>;
export type SendMessageModalProps = ComponentProps<any>;
export type CreateTaskModalProps = ComponentProps<any>;
export type PDFUploaderProps = ComponentProps<any>;
export type ChartContainerProps = ComponentProps<any>;
export type AdminLayerManagerProps = ComponentProps<any>;
export type SidebarProps = ComponentProps<any>;