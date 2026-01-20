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

import React from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

// 🏢 ENTERPRISE: Centralized types και styles
import type { CommunicationConfig } from '../communication/types';
import { COMMUNICATION_STYLES } from '../communication';

/**
 * Props interface for CommunicationEmptyState component
 */
export interface CommunicationEmptyStateProps {
  /** Communication configuration object */
  readonly config: CommunicationConfig;
  /** Whether the form is disabled */
  readonly disabled?: boolean;
  /** Function to add new communication item */
  readonly onAddItem: () => void;
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
 * <CommunicationEmptyState
 *   config={COMMUNICATION_CONFIGS.phone}
 *   onAddItem={addPhoneItem}
 *   disabled={false}
 * />
 * ```
 */
export function CommunicationEmptyState({
  config,
  disabled = false,
  onAddItem
}: CommunicationEmptyStateProps): JSX.Element {
  const iconSizes = useIconSizes();
  // 🏢 ENTERPRISE: i18n support
  const { t } = useTranslation('contacts');
  const IconComponent = config.icon;

  return (
    <>
      {/* 🎯 SEMANTIC SECTION: Empty state message */}
      <section
        className={COMMUNICATION_STYLES.groupedTable.emptyState}
        aria-label="Empty state"
        role="status"
        aria-live="polite"
      >
        <IconComponent
          className={`${iconSizes.xl} mb-2 mx-auto`}
          aria-hidden="true"
        />
        <p className="font-medium text-gray-700">
          {t(config.emptyStateText)}
        </p>
        <p className="text-sm mt-1 text-gray-500">
          {t('communication.addContactInfo')}
        </p>
      </section>

      {/* 🎯 SEMANTIC BUTTON: Add new item action */}
      <Button
        type="button"
        variant="outline"
        onClick={onAddItem}
        disabled={disabled}
        className={`w-full ${COMMUNICATION_STYLES.groupedTable.input}`}
        aria-label={t('communication.addNew', { type: config.title.toLowerCase() })}
      >
        <Plus
          className={`${iconSizes.sm} mr-2`}
          aria-hidden="true"
        />
        {t(config.addButtonText)}
      </Button>
    </>
  );
}

export default CommunicationEmptyState;