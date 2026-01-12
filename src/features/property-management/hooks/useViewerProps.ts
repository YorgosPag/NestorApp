'use client';

import { buildViewerProps } from '../utils/buildViewerProps';
import type { ViewerProps } from '../types/publicViewer';

/**
 * 🏢 ENTERPRISE: Hook input type
 * Matches the return type of usePublicPropertyViewer hook
 * Uses ReturnType inference for perfect type matching
 */
import type { usePublicPropertyViewer } from '@/hooks/usePublicPropertyViewer';

export type PublicViewerHookInput = ReturnType<typeof usePublicPropertyViewer>;

export function useViewerProps(hook: PublicViewerHookInput): ViewerProps {
  // Type-safe cast through buildViewerProps adapter
  // Cast to unknown first since hook return type differs from PublicViewerHookShape
  return buildViewerProps(hook as unknown as Parameters<typeof buildViewerProps>[0]);
}
