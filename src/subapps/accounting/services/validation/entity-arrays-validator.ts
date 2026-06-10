/**
 * @fileoverview Accounting — Entity Arrays Validator (SSoT, server-side)
 * @description Single source of truth for server-side validation of the
 *   partners / members / shareholders arrays before they are persisted into the
 *   company profile (`accounting_settings/{companyId}`).
 *
 *   ADR-440 background: these arrays used to be saved via dedicated
 *   `/api/accounting/{partners,members,shareholders}` routes that carried their
 *   own validation. Those routes were retired (dead path) and the live write
 *   path is now `PUT /api/accounting/setup` → `saveCompanySetup`. This module
 *   re-homes that validation so the live path keeps the money-affecting
 *   guarantees (share/dividend sums = 100%, valid ΑΦΜ, board-role coherence).
 *
 *   Intentional deviation from the old routes: an EMPTY array is allowed (the
 *   profile may be saved before the user has entered all partners/shareholders —
 *   incremental setup). The 100%-sum invariant is enforced ONLY when the array
 *   is non-empty, which is exactly the case that would otherwise silently
 *   miscalculate tax/dividends.
 *
 * @author Claude Code (Anthropic AI) + Giorgos Pagonis
 * @created 2026-06-11
 * @see ADR-440 Accounting Entity-Data SSoT
 * @see ADR-ACC-012 OE, ADR-ACC-014 EPE, ADR-ACC-015 AE
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import type { CompanySetupInput } from '../../types/company';
import type { Partner, Member, Shareholder, ShareholderEFKAMode } from '../../types/entity';

/** ±0.01 ανοχή στρογγυλοποίησης για το άθροισμα ποσοστών. */
const SHARE_SUM_TOLERANCE = 0.01;
const VAT_PATTERN = /^\d{9}$/;

function validatePartners(partners: Partner[]): string | null {
  for (const p of partners) {
    if (!p.fullName?.trim()) return `partner ${p.partnerId}: fullName is required`;
    if (!p.vatNumber?.trim()) return `partner ${p.partnerId}: vatNumber is required`;
    if (!VAT_PATTERN.test(p.vatNumber.trim())) return `partner ${p.partnerId}: vatNumber must be 9 digits`;
    if (typeof p.profitSharePercent !== 'number' || p.profitSharePercent < 0 || p.profitSharePercent > 100) {
      return `partner ${p.partnerId}: profitSharePercent must be 0-100`;
    }
  }
  if (partners.length === 0) return null;

  const shareSum = partners.filter((p) => p.isActive).reduce((sum, p) => sum + p.profitSharePercent, 0);
  if (Math.abs(shareSum - 100) > SHARE_SUM_TOLERANCE) {
    return `active partners profitSharePercent sum must equal 100% (currently ${shareSum}%)`;
  }
  return null;
}

function validateMembers(members: Member[]): string | null {
  for (const m of members) {
    if (!m.fullName?.trim()) return `member ${m.memberId}: fullName is required`;
    if (!m.vatNumber?.trim()) return `member ${m.memberId}: vatNumber is required`;
    if (!VAT_PATTERN.test(m.vatNumber.trim())) return `member ${m.memberId}: vatNumber must be 9 digits`;
    if (typeof m.sharesCount !== 'number' || m.sharesCount < 0) {
      return `member ${m.memberId}: sharesCount must be a non-negative number`;
    }
    if (typeof m.dividendSharePercent !== 'number' || m.dividendSharePercent < 0 || m.dividendSharePercent > 100) {
      return `member ${m.memberId}: dividendSharePercent must be 0-100`;
    }
  }
  if (members.length === 0) return null;

  const shareSum = members.filter((m) => m.isActive).reduce((sum, m) => sum + m.dividendSharePercent, 0);
  if (Math.abs(shareSum - 100) > SHARE_SUM_TOLERANCE) {
    return `active members dividendSharePercent sum must equal 100% (currently ${shareSum}%)`;
  }
  return null;
}

function validateShareholders(shareholders: Shareholder[]): string | null {
  for (const s of shareholders) {
    if (!s.fullName?.trim()) return `shareholder ${s.shareholderId}: fullName is required`;
    if (!s.vatNumber?.trim()) return `shareholder ${s.shareholderId}: vatNumber is required`;
    if (!VAT_PATTERN.test(s.vatNumber.trim())) return `shareholder ${s.shareholderId}: vatNumber must be 9 digits`;
    if (typeof s.sharesCount !== 'number' || s.sharesCount < 0) {
      return `shareholder ${s.shareholderId}: sharesCount must be a non-negative number`;
    }
    if (typeof s.dividendSharePercent !== 'number' || s.dividendSharePercent < 0 || s.dividendSharePercent > 100) {
      return `shareholder ${s.shareholderId}: dividendSharePercent must be 0-100`;
    }
    if (s.isBoardMember && !s.boardRole) {
      return `shareholder ${s.shareholderId}: boardRole is required when isBoardMember is true`;
    }
  }
  if (shareholders.length === 0) return null;

  const shareSum = shareholders.filter((s) => s.isActive).reduce((sum, s) => sum + s.dividendSharePercent, 0);
  if (Math.abs(shareSum - 100) > SHARE_SUM_TOLERANCE) {
    return `active shareholders dividendSharePercent sum must equal 100% (currently ${shareSum}%)`;
  }
  return null;
}

/**
 * Validate the entity arrays carried by a company setup payload, dispatching by
 * `entityType`. Returns an error message (HTTP 400) or `null` when valid.
 * Sole proprietors carry no entity arrays → always valid.
 */
export function validateCompanyEntityArrays(data: CompanySetupInput): string | null {
  switch (data.entityType) {
    case 'oe':
      return validatePartners(data.partners ?? []);
    case 'epe':
      return validateMembers(data.members ?? []);
    case 'ae':
      return validateShareholders(data.shareholders ?? []);
    default:
      return null;
  }
}

/**
 * Server-authoritative EFKA-mode derivation for ΑΕ shareholders
 * (Εγκύκλιοι ΕΦΚΑ 4/2017, 17/2017): the mode is a DERIVED field — never trust
 * the client value. Returns a new array with `efkaMode` recomputed from board
 * membership, compensation and share percentage of the total.
 *
 * - `none`         : !isBoardMember || compensation ≤ 0
 * - `employee`     : board member with compensation, shares < 3% του συνόλου
 * - `self_employed`: board member with compensation, shares ≥ 3%
 */
export function deriveShareholderEfkaModes(shareholders: Shareholder[]): Shareholder[] {
  const totalShares = shareholders.reduce((sum, s) => sum + (s.sharesCount > 0 ? s.sharesCount : 0), 0);

  return shareholders.map((s) => {
    let efkaMode: ShareholderEFKAMode;
    if (!s.isBoardMember || !s.monthlyCompensation || s.monthlyCompensation <= 0) {
      efkaMode = 'none';
    } else {
      const sharePercent = totalShares > 0 ? (s.sharesCount / totalShares) * 100 : 0;
      efkaMode = sharePercent < 3 ? 'employee' : 'self_employed';
    }
    return s.efkaMode === efkaMode ? s : { ...s, efkaMode };
  });
}
