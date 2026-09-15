/**
 * @fileoverview Accounting — Company Legal-Name Audit (SSoT, pure) — ADR-841 §7 Α23
 * @description The audit delta for a change of the company's legal name (επωνυμία).
 *
 *   🔴 WHY IT EXISTS: until 2026-09-15 the legal name changed through
 *   `PUT /api/accounting/setup` left **no trace anywhere** — the audited wrapper
 *   recorded ownership deltas only. A legal name is what contracts, invoices and
 *   the public showcase carry: changing it is material data (SAP CDHDR pattern).
 *
 *   ONE builder, two writers:
 *   - `gemi-adoption` — «Υιοθέτηση επωνυμίας ΓΕΜΗ», inside the adoption transaction;
 *   - `profile`       — typed by a human in the company profile (audited wrapper).
 *
 *   🔑 Exact comparison, never `sameLegalName`: a change of spelling/casing is a change
 *   of the stored legal record, even when the registry judgment treats both as equal.
 *
 *   ⛔ GDPR art. 5(1)(c): only the name before/after and — for an adoption — the registry
 *   evidence (number + check date). Never persons, never the seat.
 *
 * @see ADR-841 §7 Α23 · ADR-440 (audited profile writes)
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

export type LegalNameChangeSource = 'gemi-adoption' | 'profile';

export interface LegalNameChange {
  readonly from: string | null;
  readonly to: string;
  readonly source: LegalNameChangeSource;
  /** Present only for `gemi-adoption`: which registry answer the human adopted. */
  readonly registry?: { readonly registrationNumber: string; readonly checkedAt: string };
}

export interface LegalNameAuditResult {
  /** Human-readable Greek summary for the audit `details` field. */
  readonly details: string;
  /** Flat metadata (audit entries forbid nested objects). */
  readonly metadata: Record<string, string | number | boolean | null>;
}

const SOURCE_LABEL: Readonly<Record<LegalNameChangeSource, string>> = {
  'gemi-adoption': 'υιοθέτηση από ΓΕΜΗ',
  profile: 'προφίλ εταιρείας',
};

/** The audit delta — `null` when the stored name did not change (nothing to record). */
export function legalNameChangeAudit(change: LegalNameChange): LegalNameAuditResult | null {
  if (change.from === change.to) return null;
  return {
    details: `Αλλαγή επωνυμίας (${SOURCE_LABEL[change.source]}): «${change.from ?? '—'}» → «${change.to}»`,
    metadata: {
      previousLegalName: change.from,
      legalName: change.to,
      source: change.source,
      registrationNumber: change.registry?.registrationNumber ?? null,
      registryCheckedAt: change.registry?.checkedAt ?? null,
    },
  };
}
