/**
 * 🏢 ENTERPRISE COMMUNICATION EMPTY STATE
 *
 * @fileoverview Production-grade empty state component for communications
 * @version 1.0.0
 * @since 2025-12-28
 *
 * Extracted from UniversalCommunicationManager.tsx (Lines 388-407)
 * Upgraded to enterprise standards with semantic HTML and centralized design tokens.
 *
 * @enterprise Following FAANG/Microsoft enterprise patterns:
 * - ✅ Semantic HTML (section, button - NO div soup)
 * - ✅ Zero hardcoded values (all from design system)
 * - ✅ Accessibility-first (ARIA labels, status roles)
 * - ✅ Type-safe props with comprehensive interfaces
 * - ✅ Reusable across communication types
 * - ✅ Single Responsibility Principle (SRP)
 */

'use client';

import '@/lib/design-system';
import React from 'react';
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

// 🏢 ENTERPRISE: Centralized types και styles
import type { CommunicationConfig, CommunicationType } from '../communication/types';
import { COMMUNICATION_STYLES } from '../communication';
import { COMMUNICATION_ICON_COLORS } from '../communication/config/CommunicationIcons';

/**
 * Props interface for CommunicationEmptyState component
 */
export interface CommunicationEmptyStateProps {
  /** Communication configuration object */
  readonly config: CommunicationConfig;
}

/**
 * 🏢 ENTERPRISE: Communication empty state component with semantic HTML
 *
 * Provides user-friendly empty state with add functionality when no
 * communication items exist. Uses centralized design tokens and
 * accessibility best practices.
 *
 * @param props - Component configuration and callbacks
 * @returns JSX.Element - Complete empty state layout
 *
 * @example
 * ```tsx
 * <CommunicationEmptyState config={COMMUNICATION_CONFIGS.phone} />
 * ```
 */
export function CommunicationEmptyState({
  config,
}: CommunicationEmptyStateProps): JSX.Element {
  const iconSizes = useIconSizes();
  const { t, isNamespaceReady } = useTranslation(['contacts', 'contacts-banking', 'contacts-core', 'contacts-form', 'contacts-lifecycle', 'contacts-relationships']);
  const IconComponent = config.icon;
  // Dark-mode-aware color from SSoT — replaces ad-hoc text-gray classes that
  // washed out against dark backgrounds.
  const iconColor = COMMUNICATION_ICON_COLORS[config.type as CommunicationType]
    ?? 'text-muted-foreground';

  return (
    <section
      className={COMMUNICATION_STYLES.groupedTable.emptyState}
      aria-label="Empty state"
      role="status"
      aria-live="polite"
    >
      <IconComponent
        className={`${iconSizes.xl} mb-2 mx-auto ${iconColor}`}
        aria-hidden="true"
      />
      <p className="font-medium text-foreground">
        {t(config.emptyStateText)}
      </p>
      {isNamespaceReady && (
        <p className="text-sm mt-1 text-muted-foreground">
          {t('communication.addContactInfo')}
        </p>
      )}
    </section>
  );
}

export default CommunicationEmptyState;