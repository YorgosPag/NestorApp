'use client';

/**
 * @fileoverview AccountingPageHeader — Shared header for all accounting pages
 * @description Thin wrapper around centralized PageHeader (same pattern as BuildingsHeader).
 *   Provides dashboard toggle (eye icon) + custom action buttons.
 * @author Claude Code (Anthropic AI) + Georgios Pagonis
 * @created 2026-02-10
 * @see BuildingsHeader for reference pattern
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles, semantic HTML
 */

import React from 'react';
import { PageHeader } from '@/core/headers';
import { useTranslation } from 'react-i18next';
import type { LucideIcon } from 'lucide-react';

interface AccountingPageHeaderProps {
  /** Lucide icon component for the title */
  icon: LucideIcon;
  /** i18n key for the page title (e.g., 'invoices.title') */
  titleKey: string;
  /** i18n key for the page description (e.g., 'invoices.description') */
  descriptionKey: string;
  /** Whether the dashboard stats section is visible */
  showDashboard: boolean;
  /** Callback to toggle dashboard visibility */
  onDashboardToggle: () => void;
  /** Optional action buttons rendered in the header (New Invoice, FiscalYearPicker, etc.) */
  actions?: React.ReactNode[];
}

export function AccountingPageHeader({
  icon,
  titleKey,
  descriptionKey,
  showDashboard,
  onDashboardToggle,
  actions,
}: AccountingPageHeaderProps) {
  const { t } = useTranslation('accounting');

  return (
    <PageHeader
      variant="sticky-rounded"
      layout="compact"
      spacing="compact"
      title={{
        icon,
        title: t(titleKey),
        subtitle: t(descriptionKey),
      }}
      actions={{
        showDashboard,
        onDashboardToggle,
        customActions: actions,
      }}
    />
  );
}
