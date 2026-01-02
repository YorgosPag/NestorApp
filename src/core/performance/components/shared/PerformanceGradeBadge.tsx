'use client';

/**
 * @fileoverview Reusable Performance Grade Badge Component
 * @module core/performance/components/shared/PerformanceGradeBadge
 *
 * Google-style reusable badge for displaying performance grades.
 * Uses enterprise design system for consistent styling.
 *
 * @author Claude (Anthropic AI)
 * @version 1.0.0
 * @since 2026-01-02
 */

import React from 'react';
import { designSystem } from '@/lib/design-system';
import { getGradeStatusColor } from '../utils/performance-utils';

// ============================================================================
// TYPES
// ============================================================================

export interface PerformanceGradeBadgeProps {
  /** Performance grade (e.g., 'good', 'warning', 'poor') */
  grade: string;
  /** Show grade in uppercase */
  uppercase?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * PerformanceGradeBadge - Displays performance grade with color coding.
 *
 * @example
 * <PerformanceGradeBadge grade="good" />
 * <PerformanceGradeBadge grade="warning" uppercase={false} />
 */
export const PerformanceGradeBadge: React.FC<PerformanceGradeBadgeProps> = ({
  grade,
  uppercase = true,
  className
}) => {
  const statusColor = getGradeStatusColor(grade);
  const displayText = uppercase ? grade.toUpperCase() : grade;

  return (
    <span
      className={`${designSystem.getStatusBadgeClass(statusColor)} ${className ?? ''}`}
      role="status"
      aria-label={`Performance grade: ${grade}`}
    >
      {displayText}
    </span>
  );
};

export default PerformanceGradeBadge;
