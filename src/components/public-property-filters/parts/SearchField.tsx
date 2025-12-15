/**
 * 🏢 ENTERPRISE MIGRATION: Unified SearchField Implementation
 * Αντικατέστησε το διπλότυπο implementation με centralized system
 *
 * @version 2.0.0 - Enterprise Unified
 * @migration_date 2025-12-15
 * @backward_compatible 100% - Zero visual changes
 */

"use client";
import { PropertySearchField } from "@/components/ui/search";
import type { SearchFieldProps } from "../types";

/**
 * 🎯 BACKWARD COMPATIBLE SearchField
 * Delegates στο unified PropertySearchField με την ίδια ακριβώς εμφάνιση
 */
export function SearchField({ value, onChange }: SearchFieldProps) {
  return (
    <PropertySearchField
      value={value}
      onChange={onChange}
    />
  );
}
