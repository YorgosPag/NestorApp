/**
 * @fileoverview Σύνολο ποσοστών μεριδίων — ο ΕΝΑΣ κανόνας «αθροίζουν σε 100%;»
 * @description Εταίροι ΟΕ (κέρδη), μέλη ΕΠΕ και μέτοχοι ΑΕ (μερίσματα): ο κριτής εισόδου, η ανακοίνωση της
 *   ρύθμισης και ο υπολογισμός φόρου διανομής ρωτούν **την ίδια** ερώτηση με **την ίδια** ανοχή.
 *   Ως τις 2026-11-06 η ανοχή ζούσε δύο φορές (validator + `ShareSumStatus`).
 * @see ADR-ACC-009 · ADR-ACC-012 · ADR-ACC-014 · ADR-ACC-016
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, SSoT, pure
 */

/** Ανοχή στρογγυλοποίησης: ποσοστά με δύο δεκαδικά αθροίζουν συχνά σε 99.999… */
const SHARE_SUM_TOLERANCE = 0.01;

/** Το άθροισμα ποσοστών καλύπτει το 100% (εντός ανοχής); */
export function isCompleteShareSum(sum: number): boolean {
  return Math.abs(sum - 100) <= SHARE_SUM_TOLERANCE;
}
