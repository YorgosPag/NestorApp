/**
 * =============================================================================
 * Ο ΤΟΜΕΑΣ ΕΝΟΣ ΔΙΚΑΙΩΜΑΤΟΣ — **ΕΝΑΣ** ΚΑΝΟΝΑΣ (N.0.2 · ADR-583/CHECK 3.28)
 * =============================================================================
 *
 * 🔴 **Το εύρημα (2026-09-22)**: δύο οθόνες (`RolePermissionMatrix` ·
 * `UserDetailPanel`) έκοβαν **μόνες τους** το `domain:action` στο `:` και έβαζαν
 * `'other'` όταν δεν υπήρχε `:` — ίδιος βρόχος, ίδια μαντεψιά, δύο φορές. Το
 * CHECK 3.28 τις βρήκε στο ίδιο commit.
 *
 * ⚠️ **Δεν ζει στο `lib/auth/permissions.ts`**: εκείνο είναι `server-only` και οι
 * δύο καταναλωτές είναι **οθόνες**. Δεν ζει ούτε μέσα στο `types.ts`: εκείνο είναι
 * leaf που το εισάγει μισή εφαρμογή, και η ομαδοποίηση δεν είναι τύπος.
 *
 * 🔑 **Γιατί ο τομέας δεν είναι τύπος**: το `PermissionId` είναι κλειστό σύνολο,
 * αλλά το πρόθεμά του είναι **σύμβαση ονοματοδοσίας** — όχι δηλωμένο λεξιλόγιο.
 * Όσο δεν υπάρχει πίνακας τομέων, η τίμια απάντηση είναι `string` και μία
 * δηλωμένη εφεδρεία. *(Αν αποκτήσει πίνακα, εδώ είναι η μία θέση που αλλάζει.)*
 *
 * @module lib/auth/permission-domains
 */

import type { PermissionId } from './types';

/** Η εφεδρεία για δικαίωμα **χωρίς** πρόθεμα — δηλωμένη, ποτέ σιωπηλή. */
export const UNGROUPED_DOMAIN = 'other' as const;

/**
 * **Ο τομέας ενός δικαιώματος** — το κομμάτι πριν από το `:` του `domain:action`.
 */
export function permissionDomain(permission: PermissionId): string {
  const separator = permission.indexOf(':');
  return separator > 0 ? permission.slice(0, separator) : UNGROUPED_DOMAIN;
}

/**
 * **Τα δικαιώματα, ομαδοποιημένα ανά τομέα.** Διατηρεί τη σειρά εισόδου μέσα σε
 * κάθε ομάδα· η σειρά **των ομάδων** είναι δουλειά του καλούντος, που ξέρει με τι
 * κριτήριο τις δείχνει (π.χ. αλφαβητικά κατά τοπική διάταξη).
 */
export function groupPermissionsByDomain(
  permissions: readonly PermissionId[],
): Record<string, PermissionId[]> {
  const groups: Record<string, PermissionId[]> = {};

  for (const permission of permissions) {
    const domain = permissionDomain(permission);
    if (!groups[domain]) {
      groups[domain] = [];
    }
    groups[domain].push(permission);
  }

  return groups;
}
