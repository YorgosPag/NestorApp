/**
 * @fileoverview Accounting — Company Ownership Audit Diff (SSoT, pure)
 * @description Computes the audit delta for ownership/dividend changes on the
 *   company profile (partners / members / shareholders) between the previously
 *   persisted profile and the incoming setup payload.
 *
 *   ADR-440: `saveCompanySetup` is the single write path for these material
 *   ownership arrays. Changing who owns the company or how dividends/profits are
 *   split is material data — enterprise systems (SAP CDHDR, NetSuite system_note)
 *   audit it. This pure diff feeds the audited repository wrapper, which emits a
 *   `COMPANY_PROFILE_UPDATED` entry only when ownership actually changed (the
 *   audit log stays signal-rich — pure address/phone edits are not logged here).
 *
 * @author Claude Code (Anthropic AI) + Giorgos Pagonis
 * @created 2026-06-11
 * @see ADR-440 Accounting Entity-Data SSoT
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import type { CompanyProfile, CompanySetupInput } from '../../types/company';
import {
  getProfilePartners,
  getProfileMembers,
  getProfileShareholders,
} from '../repository/profile-entity-accessors';

/** Normalised owner: id + display name + share percent (profit for ΟΕ, dividend for ΕΠΕ/ΑΕ). */
interface OwnerRecord {
  id: string;
  name: string;
  share: number;
}

export interface OwnershipAuditResult {
  /** True when ownership/dividend (or legal form) changed → emit an audit entry. */
  changed: boolean;
  /** Human-readable Greek summary for the audit `details` field. */
  details: string;
  /** Flat metadata (audit entries forbid nested objects → rich delta is a JSON string). */
  metadata: Record<string, string | number | boolean | null>;
}

type ProfileOrInput = CompanyProfile | CompanySetupInput;

/** Normalise the ownership array of a profile/input into id+name+share records. */
function ownersOf(p: ProfileOrInput): OwnerRecord[] {
  switch (p.entityType) {
    case 'oe':
      return getProfilePartners(p).map((x) => ({ id: x.partnerId, name: x.fullName, share: x.profitSharePercent }));
    case 'epe':
      return getProfileMembers(p).map((x) => ({ id: x.memberId, name: x.fullName, share: x.dividendSharePercent }));
    case 'ae':
      return getProfileShareholders(p).map((x) => ({ id: x.shareholderId, name: x.fullName, share: x.dividendSharePercent }));
    default:
      return [];
  }
}

/**
 * Diff the ownership arrays between the previously persisted profile (`before`,
 * `null` on first setup) and the incoming `after` payload.
 */
export function diffCompanyOwnership(
  before: CompanyProfile | null,
  after: CompanySetupInput
): OwnershipAuditResult {
  const formChanged = !!before && before.entityType !== after.entityType;

  const beforeList = before ? ownersOf(before) : [];
  const afterList = ownersOf(after);

  const beforeById = new Map(beforeList.map((e) => [e.id, e]));
  const afterById = new Map(afterList.map((e) => [e.id, e]));

  const added = afterList.filter((e) => !beforeById.has(e.id));
  const removed = beforeList.filter((e) => !afterById.has(e.id));
  const modified = afterList
    .filter((e) => {
      const prev = beforeById.get(e.id);
      return prev !== undefined && prev.share !== e.share;
    })
    .map((e) => ({ id: e.id, name: e.name, from: beforeById.get(e.id)!.share, to: e.share }));

  const changed = formChanged || added.length > 0 || removed.length > 0 || modified.length > 0;
  if (!changed) {
    return { changed: false, details: '', metadata: {} };
  }

  const kindLabel =
    after.entityType === 'oe' ? 'εταίροι' : after.entityType === 'epe' ? 'μέλη' : after.entityType === 'ae' ? 'μέτοχοι' : 'ιδιοκτησία';

  const parts = [`Μεταβολή ιδιοκτησίας (${kindLabel}): +${added.length} νέοι, -${removed.length} αποχωρήσεις, ${modified.length} αλλαγές ποσοστού`];
  if (formChanged && before) {
    parts.push(`αλλαγή νομικής μορφής ${before.entityType}→${after.entityType}`);
  }

  return {
    changed: true,
    details: parts.join(' · '),
    metadata: {
      entityType: after.entityType,
      previousEntityType: before?.entityType ?? null,
      formChanged,
      addedCount: added.length,
      removedCount: removed.length,
      modifiedCount: modified.length,
      changes: JSON.stringify({
        added: added.map((e) => ({ id: e.id, name: e.name, share: e.share })),
        removed: removed.map((e) => ({ id: e.id, name: e.name, share: e.share })),
        modified,
      }),
    },
  };
}
