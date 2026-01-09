'use client';

/**
 * 🏢 ENTERPRISE ENTITY LIST COLUMN - Centralized List Container
 *
 * Single Source of Truth for entity list column styling.
 * Replaces 6 scattered hardcoded patterns across the application.
 *
 * @fileoverview Centralized container for entity lists (Buildings, Contacts, Units, etc.)
 * @enterprise Fortune 500 compliant - ZERO hardcoded values
 * @see useBorderTokens for centralized border styling
 * @see ENTITY_LIST_TOKENS for centralized width/layout tokens
 * @author Enterprise Architecture Team
 * @since 2026-01-09
 */

import React from 'react';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { ENTITY_LIST_TOKENS } from '@/styles/design-tokens';

// =============================================================================
// 🏢 TYPE DEFINITIONS
// =============================================================================

/**
 * Height variant for the list column
 * - 'full': Uses max-h-full (default, for scrollable lists)
 * - 'fit': Uses h-fit (for content that determines height)
 */
type HeightVariant = 'full' | 'fit';

/**
 * Props for EntityListColumn component
 */
export interface EntityListColumnProps {
  /** Content to render inside the column */
  children: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show explicit border (Units, Parking, Storage use this) */
  hasBorder?: boolean;
  /** Height behavior: 'full' for scrollable, 'fit' for content-based */
  heightVariant?: HeightVariant;
  /** Accessible label for the container */
  'aria-label'?: string;
  /** Test ID for testing purposes */
  'data-testid'?: string;
}

// =============================================================================
// 🏢 COMPONENT
// =============================================================================

/**
 * 🏢 EntityListColumn Component
 *
 * Centralized container for entity list columns.
 * Produces EXACT same output as original scattered patterns.
 *
 * @example
 * ```tsx
 * // Standard list (Buildings, Contacts) - uses quick.card for border
 * <EntityListColumn aria-label="Λίστα Κτιρίων">
 *   {children}
 * </EntityListColumn>
 *
 * // List with explicit border (Units, Parking, Storage)
 * <EntityListColumn hasBorder aria-label="Λίστα Μονάδων">
 *   {children}
 * </EntityListColumn>
 *
 * // Fit-height variant (Projects)
 * <EntityListColumn heightVariant="fit" aria-label="Λίστα Έργων">
 *   {children}
 * </EntityListColumn>
 * ```
 */
export function EntityListColumn({
  children,
  className = '',
  hasBorder = false,
  heightVariant = 'full',
  'aria-label': ariaLabel,
  'data-testid': testId,
}: EntityListColumnProps) {
  // 🏢 CENTRALIZED HOOK - Same as original
  const { quick } = useBorderTokens();

  // 🏢 HEIGHT CLASS - Based on variant (using visual tokens)
  const heightClass = heightVariant === 'fit' ? 'h-fit' : ENTITY_LIST_TOKENS.visual.maxHeight;

  // 🏢 BORDER CLASS - Matches original patterns exactly
  // - hasBorder=true: "border" before quick.card (Units, Parking, Storage)
  // - hasBorder=false: no extra border (Buildings, Contacts, Projects)
  const borderClass = hasBorder ? 'border ' : '';

  // 🏢 BUILD FINAL CLASS STRING - Using centralized tokens from ENTITY_LIST_TOKENS
  // Pattern: width + bg + border + rounded + layout + shadow + height + overflow
  const finalClassName = `${ENTITY_LIST_TOKENS.width.combined} w-full ${ENTITY_LIST_TOKENS.visual.background} ${borderClass}${quick.card} ${ENTITY_LIST_TOKENS.layout.combined} ${ENTITY_LIST_TOKENS.visual.shadow} ${heightClass} ${ENTITY_LIST_TOKENS.visual.overflow}${className ? ' ' + className : ''}`;

  return (
    <div
      className={finalClassName}
      aria-label={ariaLabel}
      data-testid={testId}
    >
      {children}
    </div>
  );
}

EntityListColumn.displayName = 'EntityListColumn';

export default EntityListColumn;
