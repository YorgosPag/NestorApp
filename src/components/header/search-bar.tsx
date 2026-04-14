/**
 * 🏢 ENTERPRISE MIGRATION: Unified Header Search Bar
 * Αντικατέστησε με centralized HeaderSearch component
 *
 * @version 2.0.0 - Enterprise Unified
 * @migration_date 2025-12-15
 * @backward_compatible 100% - Zero visual changes
 */

"use client";

import { HeaderSearch } from "@/components/ui/search/HeaderSearch";
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

/**
 * 🎯 BACKWARD COMPATIBLE HeaderSearchBar
 * Delegates στο unified HeaderSearch με την ίδια ακριβώς εμφάνιση
 */
export function HeaderSearchBar() {
  // 🏢 ENTERPRISE: i18n support
  const { t } = useTranslation(['common', 'common-account', 'common-actions', 'common-empty-states', 'common-navigation', 'common-photos', 'common-sales', 'common-shared', 'common-status', 'common-validation']);

  return (
    <HeaderSearch
      placeholder={t('header.searchBar.placeholder')}
      showShortcut
      shortcutKey="k"
    />
  );
}
