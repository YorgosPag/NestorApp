/**
 * LAZY PANEL WRAPPER COMPONENT
 * Reusable Suspense wrapper με loading state για lazy loaded panels
 * ΒΗΜΑ 14 του FloatingPanelContainer refactoring
 */

import React from 'react';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { AnimatedSpinner } from '../../../components/modal/ModalLoadingStates';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { PANEL_LAYOUT } from '../../../config/panel-tokens';

/**
 * Props for the LazyPanelWrapper component
 */
interface LazyPanelWrapperProps {
  /** The lazy-loaded component(s) to wrap */
  children: React.ReactNode;
  /** Custom loading text to display */
  loadingText?: string;
  /** Additional CSS classes for the loading container */
  className?: string;
}

/**
 * Lazy Panel Wrapper Component
 *
 * Reusable Suspense boundary wrapper that provides consistent loading states
 * for all lazy-loaded panels in the DXF viewer. Displays a spinner and
 * customizable loading message while components are being loaded.
 *
 * @component
 * @example
 * ```tsx
 * <LazyPanelWrapper loadingText="Loading settings...">
 *   <LazyLoadedComponent />
 * </LazyPanelWrapper>
 * ```
 *
 * Features:
 * - Consistent loading UI across all panels
 * - Customizable loading messages
 * - Animated spinner with smooth transitions
 * - Optimized with React.memo and useMemo
 *
 * @since ΒΗΜΑ 14 του FloatingPanelContainer refactoring
 */
export const LazyPanelWrapper = React.memo<LazyPanelWrapperProps>(function LazyPanelWrapper({
  children,
  loadingText = 'Φόρτωση...',
  className = ''
}) {
  const colors = useSemanticColors();
  const loadingSpinner = React.useMemo(() => (
    <div className={`flex items-center justify-center ${PANEL_LAYOUT.SPACING.XXXL} ${className}`}>
      <div className={`flex flex-col items-center ${PANEL_LAYOUT.SPACING.GAP_MD}`}>
        <AnimatedSpinner size="medium" />
        <span className={`text-sm ${colors.text.muted}`}>{loadingText}</span>
      </div>
    </div>
  ), [loadingText, className, colors.text.muted]);

  return (
    <React.Suspense fallback={loadingSpinner}>
      {children}
    </React.Suspense>
  );
});