/**
 * Framework Agreement discount computation — ADR-330 Phase 5.5
 *
 * Pure, side-effect-free functions. No state, no hooks.
 * Used by usePOFrameworkAgreement to resolve and compute discounts.
 */

import type { FrameworkAgreement } from '../types/framework-agreement';

export interface FADiscountResult {
  discountPercent: number;
  discountAmount: number;
  netTotal: number;
}

type TimestampLike = { seconds: number } | { toDate(): Date } | string | number;

function toMs(ts: TimestampLike): number {
  if (typeof ts === 'number') return ts;
  if (typeof ts === 'string') return new Date(ts).getTime();
  if ('toDate' in ts) return ts.toDate().getTime();
  return ts.seconds * 1000;
}

/**
 * Find the first active Framework Agreement matching vendor + project scope.
 * Validates: status=active, date range, project scope, not deleted.
 */
export function resolveActiveFa(
  agreements: FrameworkAgreement[],
  supplierId: string,
  projectId: string,
): FrameworkAgreement | null {
  if (!supplierId || !projectId) return null;

  const now = Date.now();

  return (
    agreements.find((fa) => {
      if (fa.status !== 'active') return false;
      if (fa.isDeleted) return false;
      if (fa.vendorContactId !== supplierId) return false;

      const from = toMs(fa.validFrom as unknown as TimestampLike);
      const until = toMs(fa.validUntil as unknown as TimestampLike);
      if (now < from || now > until) return false;

      // null = all projects; [] = no projects; list = specific projects
      if (
        fa.applicableProjectIds !== null &&
        fa.applicableProjectIds.length > 0 &&
        !fa.applicableProjectIds.includes(projectId)
      ) {
        return false;
      }

      return true;
    }) ?? null
  );
}

/**
 * Compute discount amount and net total for a given FA and gross total.
 * Volume breakpoints: finds the highest applicable threshold.
 */
export function computeFaDiscount(
  fa: FrameworkAgreement,
  grossTotal: number,
): FADiscountResult {
  let discountPercent = 0;

  if (fa.discountType === 'flat') {
    discountPercent = fa.flatDiscountPercent ?? 0;
  } else {
    const sorted = [...fa.volumeBreakpoints].sort(
      (a, b) => a.thresholdEur - b.thresholdEur,
    );
    for (const bp of sorted) {
      if (grossTotal >= bp.thresholdEur) {
        discountPercent = bp.discountPercent;
      }
    }
  }

  const discountAmount = Math.round(grossTotal * (discountPercent / 100) * 100) / 100;
  const netTotal = Math.round((grossTotal - discountAmount) * 100) / 100;

  return { discountPercent, discountAmount, netTotal };
}
