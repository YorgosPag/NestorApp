'use client';

/**
 * 🏢 ENTERPRISE SPINNER - CANONICAL IMPLEMENTATION
 *
 * Single source of truth για loading spinners σε όλη την εφαρμογή.
 * Αντικαθιστά το DXF-coupled AnimatedSpinner.
 *
 * @module components/ui/spinner
 * @version 1.0.0
 * @enterprise Centralization - Zero DXF dependencies
 *
 * Usage:
 * ```tsx
 * import { Spinner } from '@/components/ui/spinner';
 * <Spinner size="medium" />
 * ```
 */

import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIconSizes } from '@/hooks/useIconSizes';

// ============================================================================
// TYPES
// ============================================================================

export type SpinnerSize = 'small' | 'medium' | 'large';

export interface SpinnerProps {
  /** Spinner size - maps to centralized icon sizes */
  size?: SpinnerSize;
  /** Additional CSS classes */
  className?: string;
  /** Accessibility label */
  'aria-label'?: string;
}

// ============================================================================
// SIZE MAPPING - Uses centralized useIconSizes
// ============================================================================

const SIZE_MAP: Record<SpinnerSize, keyof ReturnType<typeof useIconSizes>> = {
  small: 'sm',   // h-4 w-4
  medium: 'md',  // h-5 w-5
  large: 'lg',   // h-6 w-6
};

// ============================================================================
// SPINNER COMPONENT
// ============================================================================

/**
 * 🏢 ENTERPRISE: Canonical Spinner Component
 *
 * Uses:
 * - Centralized icon sizes via useIconSizes hook
 * - Standard Tailwind animate-spin
 * - Semantic text-muted-foreground color
 * - Zero DXF Viewer dependencies
 */
export const Spinner: React.FC<SpinnerProps> = ({
  size = 'medium',
  className = '',
  'aria-label': ariaLabel = 'Loading...',
}) => {
  const iconSizes = useIconSizes();
  const sizeClass = iconSizes[SIZE_MAP[size]];

  return (
    <Loader2
      className={cn(sizeClass, 'animate-spin text-muted-foreground', className)}
      aria-label={ariaLabel}
      role="status"
    />
  );
};

// ============================================================================
// ANIMATED SPINNER (Backward Compatibility Alias)
// ============================================================================

/**
 * 🔄 BACKWARD COMPATIBILITY: AnimatedSpinner alias
 *
 * Provides same API as the old DXF Viewer AnimatedSpinner.
 * Use `Spinner` for new code.
 */
export const AnimatedSpinner = Spinner;

// ============================================================================
// EXPORTS
// ============================================================================

export default Spinner;
