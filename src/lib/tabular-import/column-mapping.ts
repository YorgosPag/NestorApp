/**
 * Η **γενική** αντιστοίχιση στηλών (ADR-923 §5.5 · ADR-650 M2) — ό,τι δεν εξαρτάται από το τι σημαίνει ο ρόλος.
 * Το νόημα των ρόλων το κρατά ο καταναλωτής (`terrain/survey-import/topo-column-mapping` · `subapps/catalog/import`).
 * @module lib/tabular-import/column-mapping
 */

import type { HeaderHints, TabularMapping } from './tabular-types';

/** Το διεκδικεί καθένας από αυτούς τους ρόλους ακριβώς μία στήλη; */
export function claimsExactlyOnce<TRole>(mapping: TabularMapping<TRole>, roles: readonly TRole[]): boolean {
  return roles.every((role) => mapping.filter((claimed) => claimed === role).length === 1);
}

/** Το πρώτο κελί του ρόλου, ή `undefined` όταν ο ρόλος δεν αντιστοιχίστηκε ή η γραμμή είναι κοντή. */
export function cellForRole<TRole>(row: readonly string[], mapping: TabularMapping<TRole>, role: TRole): string | undefined {
  const index = mapping.indexOf(role);
  return index === -1 ? undefined : row[index];
}

/**
 * Οι σύντομες υποδείξεις (`x`, `ψ`, `id`, `αα`) πρέπει να ταιριάζουν **ολόκληρη** την ετικέτα: ως υποσυμβολοσειρές
 * αστοχούν καταστροφικά («Υψόμετρο» περιέχει «ψ»). Οι μακριές μένουν υποσυμβολοσειρές («Northing (m)»).
 */
export function matchesHeaderHint(label: string, hint: string): boolean {
  return hint.length <= 2 ? label === hint : label.includes(hint);
}

/**
 * Πρόταση ρόλου από τις ετικέτες. Ετικέτα που δεν ταιριάζει — ή ρόλος ήδη πιασμένος — μένει `ignore`: ο άνθρωπος
 * βλέπει κενή στήλη, ποτέ σιωπηλά λάθος αντιστοίχιση.
 */
export function suggestRolesFromHeaders<TRole>(
  headers: readonly string[],
  hints: HeaderHints<TRole>,
  ignore: TRole,
): TabularMapping<TRole> {
  const taken = new Set<TRole>();
  return headers.map((header): TRole => {
    const label = header.trim().toLowerCase();
    for (const [role, keywords] of hints) {
      if (taken.has(role)) continue;
      if (keywords.some((keyword) => matchesHeaderHint(label, keyword))) {
        taken.add(role);
        return role;
      }
    }
    return ignore;
  });
}
