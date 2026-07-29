/**
 * Quick-filter predicates — Procurement (Vendors / Materials / Agreements)
 *
 * Pure functions that return a per-item predicate for the active quick-filter
 * value. Thresholds match SAP MM Vendor/Material Master + Procore Directory
 * conventions documented in TypeQuickFilters.tsx.
 *
 * @see ADR-267 §Phase J — SSoT alignment for procurement
 * @see TypeQuickFilters.tsx VENDOR/MATERIAL/AGREEMENT_STATUS_OPTIONS
 */

import type { Material } from '@/subapps/procurement/types/material';
import type { FrameworkAgreement } from '@/subapps/procurement/types/framework-agreement';
import { daysSinceOrNull, daysUntilOrNull, normalizeToMillisOrNull } from '@/lib/date-local';
import type { VendorCardData } from '@/domain/cards/vendor';

const VENDOR_ACTIVE_DAYS = 365;
const VENDOR_NEW_DAYS = 30;
const MATERIAL_RECENT_DAYS = 90;
const MATERIAL_INACTIVE_DAYS = 180;
const AGREEMENT_EXPIRING_DAYS = 30;
const VENDOR_PREFERRED_PERCENTILE = 0.2;

export type VendorFilter = '' | 'all' | 'active' | 'preferred' | 'inactive' | 'new';

export function makeVendorPredicate(
  filter: VendorFilter,
  allVendors: VendorCardData[],
): (v: VendorCardData) => boolean {
  if (!filter || filter === 'all') return () => true;

  if (filter === 'preferred') {
    const sorted = [...allVendors].sort(
      (a, b) => (b.metrics?.totalSpend ?? 0) - (a.metrics?.totalSpend ?? 0),
    );
    const cutoff = Math.max(1, Math.ceil(sorted.length * VENDOR_PREFERRED_PERCENTILE));
    const preferredIds = new Set(
      sorted
        .slice(0, cutoff)
        .filter((v) => (v.metrics?.totalSpend ?? 0) > 0)
        .map((v) => v.contact.id ?? ''),
    );
    return (v) => preferredIds.has(v.contact.id ?? '');
  }

  if (filter === 'active') {
    return (v) => {
      const days = daysSinceOrNull(v.metrics?.lastOrderDate);
      return days !== null && days <= VENDOR_ACTIVE_DAYS;
    };
  }

  if (filter === 'inactive') {
    return (v) => {
      const days = daysSinceOrNull(v.metrics?.lastOrderDate);
      return days === null || days > VENDOR_ACTIVE_DAYS;
    };
  }

  if (filter === 'new') {
    return (v) => {
      const createdAt = (v.contact as { createdAt?: unknown }).createdAt;
      const days = daysSinceOrNull(createdAt);
      return days !== null && days <= VENDOR_NEW_DAYS;
    };
  }

  return () => true;
}

export type MaterialFilter = '' | 'all' | 'recently_used' | 'inactive' | 'no_supplier';

export function makeMaterialPredicate(
  filter: MaterialFilter,
): (m: Material) => boolean {
  if (!filter || filter === 'all') return () => true;

  if (filter === 'recently_used') {
    return (m) => {
      const days = daysSinceOrNull(m.lastPurchaseDate);
      return days !== null && days <= MATERIAL_RECENT_DAYS;
    };
  }

  if (filter === 'inactive') {
    return (m) => {
      const days = daysSinceOrNull(m.lastPurchaseDate);
      return days === null || days > MATERIAL_INACTIVE_DAYS;
    };
  }

  if (filter === 'no_supplier') {
    return (m) => m.preferredSupplierContactIds.length === 0;
  }

  return () => true;
}

export type AgreementFilter = '' | 'all' | 'active' | 'expiring' | 'expired' | 'draft';

export function makeAgreementPredicate(
  filter: AgreementFilter,
): (a: FrameworkAgreement) => boolean {
  if (!filter || filter === 'all') return () => true;

  if (filter === 'draft') return (a) => a.status === 'draft';

  if (filter === 'active') {
    return (a) => {
      const ms = normalizeToMillisOrNull(a.validUntil);
      return a.status === 'active' && ms !== null && ms > Date.now();
    };
  }

  if (filter === 'expiring') {
    return (a) => {
      if (a.status !== 'active') return false;
      const daysLeft = daysUntilOrNull(a.validUntil);
      if (daysLeft === null) return false;
      return daysLeft >= 0 && daysLeft <= AGREEMENT_EXPIRING_DAYS;
    };
  }

  if (filter === 'expired') {
    return (a) => {
      if (a.status === 'expired') return true;
      const ms = normalizeToMillisOrNull(a.validUntil);
      return ms !== null && ms < Date.now();
    };
  }

  return () => true;
}
