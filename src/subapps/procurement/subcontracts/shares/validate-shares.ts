/**
 * @fileoverview **«Τα μερίδια αθροίζουν ακριβώς 100%»** — ο ΕΝΑΣ έλεγχος (ADR-928 §5.4 · §5.4.1).
 * @module subapps/procurement/subcontracts/shares/validate-shares
 *
 * Τέσσερις καταναλωτές, ένας κανόνας: στάδια γραμμής (2008: 10/20/45/25) · επιμερισμός κόστους (γερανός 50/50) ·
 * μερίδια πληρωμής (50% τράπεζα / 50% επιταγή) · δόσεις απόδοσης κράτησης. Μονάδες βάσης ⇒ ακέραιο άθροισμα, ακριβής
 * ισότητα με `BP_PER_WHOLE`· καμία ανοχή στρογγύλευσης, γιατί δεν υπάρχει στρογγύλευση.
 */

import { BP_PER_WHOLE, isBasisPoints, type BasisPoints } from '@/lib/pricing/discount-rule';
import { joinPath, type SubcontractIssue } from '../clauses/clause-issues';

export interface ShareCheckOptions {
  /** Επιτρέπεται κενή λίστα (π.χ. γραμμή χωρίς στάδια); */
  readonly allowEmpty: boolean;
  /** Αν τα μερίδια έχουν ταυτότητα (στάδιο → `key`, μέρος → `party`), πρέπει να είναι μοναδική. */
  readonly identityOf?: (index: number) => string;
}

/** Επικυρώνει μια λίστα μεριδίων: καθένα ακέραιο 0..10.000 και > 0, μοναδική ταυτότητα, άθροισμα **ακριβώς** 10.000. */
export function validateShares(shares: readonly BasisPoints[], path: string, options: ShareCheckOptions): SubcontractIssue[] {
  if (shares.length === 0) return options.allowEmpty ? [] : [{ code: 'sharesEmpty', path }];
  const issues: SubcontractIssue[] = [];
  const seen = new Set<string>();
  shares.forEach((share, index) => {
    if (!isBasisPoints(share) || share === 0) issues.push({ code: 'shareInvalid', path: joinPath(path, index) });
    const identity = options.identityOf?.(index);
    if (identity !== undefined && seen.has(identity)) issues.push({ code: 'shareKeyDuplicate', path: joinPath(path, index) });
    if (identity !== undefined) seen.add(identity);
  });
  const total = shares.reduce((sum, share) => sum + share, 0);
  if (issues.length === 0 && total !== BP_PER_WHOLE) issues.push({ code: 'sharesNotWhole', path });
  return issues;
}
