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

/**
 * 🎯 BACKWARD COMPATIBLE HeaderSearchBar
 * Delegates στο unified HeaderSearch με την ίδια ακριβώς εμφάνιση
 */
export function HeaderSearchBar() {
  return (
    <HeaderSearch
      placeholder="Αναζήτηση επαφών... (⌘K)"
      showShortcut={true}
      shortcutKey="k"
    />
  );
}
