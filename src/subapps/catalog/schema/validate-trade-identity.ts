/**
 * **Η κρίση της ταυτότητας εμπορίου ενός φορέα** — καθαρή, κοινή σε οθόνη και γραφέα (ADR-934 §5.1.2–§5.1.3 · Σ1β).
 *
 * Τρέχει μέσα στην `judgeAggregate` (βήμα 2, μαζί με τις τιμές) ⇒ γνωστό 422 δεν στέλνεται ποτέ από την οθόνη. Ό,τι θέλει
 * ανάγνωση (διπλό GTIN σε **άλλο** σύνολο) το κρίνει η κράτηση `@gtin` στον διακομιστή (`uniqueValueTaken`).
 *
 * | Περίπτωση | Εύρημα |
 * |---|---|
 * | GTIN που δεν περνά τον **έναν** αναλυτή ή δεν είναι στην κανονική μορφή ψηφίων | `gtinInvalid` `{reason}` |
 * | GTIN **και** «χωρίς GTIN» | `noValueConflict` (ίδια σημασία με τις ιδιότητες, Δ5) |
 * | Μάρκα εκτός βάθους 0 (υπο-μοντέλο, παραλλαγή) | `valueWrongLevel` (Δ1) |
 * | Μάρκα / MPN κενά ή πάνω από το όριο | `valueEmpty` · `valueTooLong` |
 *
 * 🔑 **Ποτέ μαντεμένος κωδικός** (κανόνας Google): λάθος ψηφίο ⇒ εύρημα, καμία «διόρθωση».
 *
 * @module subapps/catalog/schema/validate-trade-identity
 */

import { parseGtin } from '@/lib/validation/gtin';
import type { CatalogTradeIdentity, CatalogValueHolder } from '../types/product';
import { BRAND_FIELD, BRAND_OWNER_DEPTH, brandOf, tradeIdentityOf } from '../values/trade-identity';
import { CATALOG_LIMITS } from '../vocabulary/catalog-limits';
import { IssueCollector, type CatalogIssue } from './catalog-issues';

/** Ένα πεδίο κειμένου: όχι κενό, όχι πάνω από το όριο. */
function checkText(collector: IssueCollector, path: string, text: string | null, max: number): void {
  if (text === null) return;
  if (text.trim() === '') collector.add('valueEmpty', path);
  else if (text.length > max) collector.add('valueTooLong', path, { max });
}

function checkBrand(collector: IssueCollector, holder: Partial<Pick<CatalogValueHolder, 'brand'>>, depth: number): void {
  const brand = brandOf(holder);
  if (brand === null) return;
  if (depth !== BRAND_OWNER_DEPTH) {
    collector.add('valueWrongLevel', BRAND_FIELD, { level: BRAND_OWNER_DEPTH });
    return;
  }
  checkText(collector, BRAND_FIELD, brand, CATALOG_LIMITS.maxBrandLength);
}

/** Το GTIN: έγκυρο **και** στην κανονική μορφή (τα ψηφία όπως τα δίνει ο αναλυτής, χωρίς διαχωριστικά). */
function checkGtin(collector: IssueCollector, gtin: string): void {
  const parsed = parseGtin(gtin);
  if (parsed.kind === 'invalid') collector.add('gtinInvalid', 'gtin', { reason: parsed.reason });
  else if (parsed.digits !== gtin) collector.add('gtinInvalid', 'gtin', { reason: 'format' });
}

function checkProductTrade(collector: IssueCollector, product: Partial<CatalogTradeIdentity>): void {
  const { gtin, mpn, noGtinReason } = tradeIdentityOf(product);
  if (gtin !== null) checkGtin(collector, gtin);
  if (gtin !== null && noGtinReason !== null) collector.add('noValueConflict', 'noGtinReason');
  checkText(collector, 'mpn', mpn, CATALOG_LIMITS.maxMpnLength);
}

/** Ο φορέας προς κρίση: μοντέλο (μόνο μάρκα) ή SKU/απλό προϊόν (μάρκα + ταυτότητα εμπορίου). */
export type TradeIdentitySubject =
  | { readonly kind: 'productModel'; readonly holder: Partial<Pick<CatalogValueHolder, 'brand'>> }
  | { readonly kind: 'product'; readonly holder: Partial<Pick<CatalogValueHolder, 'brand'>> & Partial<CatalogTradeIdentity> };

/** Τα ευρήματα ταυτότητας εμπορίου ενός φορέα στο `depth` της αλυσίδας του (διαδρομές σχετικές με τον φορέα). */
export function validateTradeIdentity(subject: TradeIdentitySubject, depth: number): readonly CatalogIssue[] {
  const collector = new IssueCollector();
  checkBrand(collector, subject.holder, depth);
  if (subject.kind === 'product') checkProductTrade(collector, subject.holder);
  return collector.issues;
}
