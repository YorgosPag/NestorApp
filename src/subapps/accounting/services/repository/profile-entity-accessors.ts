/**
 * @fileoverview Accounting — Profile Entity Accessors (SSoT discriminator)
 * @description Pure, entityType-discriminating accessors that extract the
 *   partners / members / shareholders arrays from the company profile
 *   (`accounting_settings/{companyId}`), which is the SINGLE source of truth
 *   for these entity collections (ADR-440).
 *
 *   The discriminated-union `CompanyProfile` already models that an ΟΕ *has*
 *   partners, an ΕΠΕ *has* members and an ΑΕ *has* shareholders. These
 *   accessors honour that semantics: each returns the correct array for the
 *   matching entityType and an empty array for any non-matching form
 *   (e.g. `getProfileShareholders` on an ΟΕ profile → `[]`).
 *
 * @author Claude Code (Anthropic AI) + Giorgos Pagonis
 * @created 2026-06-11
 * @see ADR-440 Accounting Entity-Data SSoT (partners / members / shareholders)
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import type { CompanyProfile } from '../../types/company';
import type { Partner, Member, Shareholder } from '../../types/entity';

/** Εταίροι ΟΕ από το profile (κενό για κάθε άλλη μορφή). */
export function getProfilePartners(profile: CompanyProfile | null): Partner[] {
  return profile?.entityType === 'oe' ? profile.partners : [];
}

/** Μέλη ΕΠΕ από το profile (κενό για κάθε άλλη μορφή). */
export function getProfileMembers(profile: CompanyProfile | null): Member[] {
  return profile?.entityType === 'epe' ? profile.members : [];
}

/** Μέτοχοι ΑΕ από το profile (κενό για κάθε άλλη μορφή). */
export function getProfileShareholders(profile: CompanyProfile | null): Shareholder[] {
  return profile?.entityType === 'ae' ? profile.shareholders : [];
}
