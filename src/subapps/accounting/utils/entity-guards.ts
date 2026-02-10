/**
 * @fileoverview Accounting Subapp — Entity Type Guards
 * @description Type guards για discriminated union CompanyProfile
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-10
 * @version 1.0.0
 * @see ADR-ACC-012 OE Partnership Support
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import type { CompanyProfile, SoleProprietorProfile, OECompanyProfile } from '../types/company';

/**
 * Type guard: Ατομική Επιχείρηση
 */
export function isSoleProprietor(profile: CompanyProfile): profile is SoleProprietorProfile {
  return profile.entityType === 'sole_proprietor';
}

/**
 * Type guard: Ομόρρυθμη Εταιρεία (ΟΕ)
 */
export function isPartnership(profile: CompanyProfile): profile is OECompanyProfile {
  return profile.entityType === 'oe';
}
