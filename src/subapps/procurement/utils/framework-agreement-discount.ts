/**
 * Σύμβαση-Πλαίσιο ↔ γραμμή παραγγελίας — ADR-330 Phase 5.5 · ADR-923 §5.11 «3γ»
 *
 * Η επιλογή περνά από τον **ΕΝΑ** επιλογέα `selectMostSpecific` (`lib/pricing/select-condition`)
 * και η έκπτωση από τη **ΜΙΑ** μηχανή (`lib/pricing/discount-rule`). Δεύτερη λογική = απαγορεύεται.
 *
 * 🔑 **Ανά γραμμή, ο ειδικότερος νικά** (SAP access sequence): υλικό (2) → κατηγορία ΑΤΟΕ (1) →
 * όλα (0), και μετά λίστα έργων (1) → όλα τα έργα (0). Πριν ήταν «η πρώτη της λίστας» (Α1).
 * 🔑 **Ισοπαλία ⇒ `ambiguous`**, ποτέ «η πρώτη».
 * 🔑 **Εύρος**: `null` = όλα · `[]` = κανένα · λίστα = μόνο αυτά (Α4 — πριν το `[]` σήμαινε «όλα»).
 *
 * Η μόνη παρενέργεια είναι διαγνωστικό `logger.warn` για μη αναγνώσιμο εύρος ισχύος ή ποσοστό
 * (ADR-218 §Phase 4) — δεν επηρεάζει το αποτέλεσμα πέρα από το ότι η σύμβαση **δεν** ισχύει.
 */

import type { FrameworkAgreementLike } from '../types/framework-agreement';
import { normalizeToMillisOrNull } from '@/lib/date-local';
import { createModuleLogger } from '@/lib/telemetry';
import { minorFromMajor } from '@/lib/money/money';
import { basisPointsFromPercent, type BasisPoints, type DiscountRule, type DiscountTier } from '@/lib/pricing/discount-rule';
import { selectMostSpecific, type Selection, type SelectionCandidate } from '@/lib/pricing/select-condition';
import type { ValidityWindow } from '@/lib/pricing/validity';

const logger = createModuleLogger('FrameworkAgreementDiscount');

/** Γιατί μια σύμβαση **δεν** αφορά μια γραμμή — το ίχνος της επιλογής. */
export type FaMismatch =
  | 'inactive'
  | 'deleted'
  | 'otherVendor'
  | 'unreadableValidity'
  | 'projectOutOfScope'
  | 'itemOutOfScope';

/** Η γραμμή όπως τη βλέπει η επιλογή. */
export interface FaLineContext {
  readonly supplierId: string;
  readonly projectId: string;
  readonly materialId: string | null;
  readonly categoryCode: string;
}

export type FaSelection = Selection<FrameworkAgreementLike, FaMismatch>;

/** Το ΕΝΑ συμβόλαιο εύρους: `null` = όλα · `[]` = κανένα · λίστα = μέλος. */
export function scopeCovers(scope: readonly string[] | null, value: string | null): boolean {
  if (scope === null) return true;
  return value !== null && scope.includes(value);
}

const ITEM_RANK = { all: 0, category: 1, material: 2 } as const;

/**
 * Ειδικότητα του εύρους γραμμής, ή `null` αν δεν την καλύπτει. Μετρούν μόνο οι δηλωμένοι
 * περιορισμοί (μη `null`)· χωρίς κανέναν ⇒ όλα. Αρκεί να ταιριάξει **ένας** (υλικό **ή** ΑΤΟΕ).
 */
function itemScopeRank(fa: FrameworkAgreementLike, line: FaLineContext): number | null {
  const materials = fa.applicableMaterialIds;
  const categories = fa.applicableAtoeCategoryCodes;
  if (materials === null && categories === null) return ITEM_RANK.all;
  if (materials !== null && scopeCovers(materials, line.materialId)) return ITEM_RANK.material;
  if (categories !== null && scopeCovers(categories, line.categoryCode)) return ITEM_RANK.category;
  return null;
}

/**
 * Το εύρος ισχύος στο ημιανοιχτό `[from, until)` της μηχανής. Το `validUntil` της σύμβασης είναι
 * **συμπεριληπτικό** («έως και») ⇒ `+1` ms κρατά ακριβώς τη σημασία του. `null` = μη αναγνώσιμο.
 */
function faValidity(fa: FrameworkAgreementLike): ValidityWindow | null {
  const fromMs = normalizeToMillisOrNull(fa.validFrom);
  const until = normalizeToMillisOrNull(fa.validUntil);
  if (fromMs === null || until === null) {
    logger.warn('Framework agreement has an unreadable validity range — treated as not active', {
      agreementId: fa.id,
      validFrom: String(fa.validFrom),
      validUntil: String(fa.validUntil),
    });
    return null;
  }
  return { fromMs, untilMs: until + 1 };
}

function headerMismatch(fa: FrameworkAgreementLike, line: FaLineContext): FaMismatch | null {
  if (fa.isDeleted) return 'deleted';
  if (fa.status !== 'active') return 'inactive';
  if (fa.vendorContactId !== line.supplierId) return 'otherVendor';
  if (!scopeCovers(fa.applicableProjectIds, line.projectId)) return 'projectOutOfScope';
  return null;
}

const ALWAYS_VALID: ValidityWindow = { fromMs: null, untilMs: null };

/** Η σύμβαση ως υποψήφιος του ΕΝΟΣ επιλογέα, για μία γραμμή. */
export function faSelectionCandidate(
  fa: FrameworkAgreementLike,
  line: FaLineContext,
): SelectionCandidate<FrameworkAgreementLike, FaMismatch> {
  const header = headerMismatch(fa, line);
  const itemRank = header === null ? itemScopeRank(fa, line) : null;
  const validity = header === null && itemRank !== null ? faValidity(fa) : ALWAYS_VALID;
  const mismatch: FaMismatch | null =
    header ?? (itemRank === null ? 'itemOutOfScope' : validity === null ? 'unreadableValidity' : null);
  return {
    id: fa.id,
    item: fa,
    validity: validity ?? ALWAYS_VALID,
    mismatch,
    specificity: [itemRank ?? 0, fa.applicableProjectIds === null ? 0 : 1],
  };
}

/** Η σύμβαση που ισχύει για τη γραμμή τη στιγμή `atMs`: ο ειδικότερος νικά, ισοπαλία ⇒ ασάφεια. */
export function selectLineAgreement(
  agreements: readonly FrameworkAgreementLike[],
  line: FaLineContext,
  atMs: number,
): FaSelection {
  return selectMostSpecific(agreements.map((fa) => faSelectionCandidate(fa, line)), atMs);
}

/** Ποσοστό σύμβασης → αλυσίδα ενός βήματος· μη αναπαραστάσιμο ποσοστό ⇒ καμία έκπτωση, με διάγνωση. */
function stepsOfPercent(fa: FrameworkAgreementLike, percent: number): BasisPoints[] {
  const bp = basisPointsFromPercent(percent);
  if (bp === null) {
    logger.warn('Framework agreement has an unrepresentable discount percent — no discount applied', {
      agreementId: fa.id,
      percent,
    });
    return [];
  }
  return [bp];
}

/**
 * Η σύμβαση ως κανόνας της ΜΙΑΣ μηχανής εκπτώσεων: `flat` = αλυσίδα ενός βήματος ·
 * `volume_breakpoints` = κλίμακες πάνω στο **ποσό** (σε λεπτά) των γραμμών που καλύπτει.
 */
export function faDiscountRule(fa: FrameworkAgreementLike): DiscountRule {
  if (fa.discountType === 'flat') {
    return { kind: 'chain', steps: stepsOfPercent(fa, fa.flatDiscountPercent ?? 0) };
  }
  const tiers: DiscountTier[] = [];
  for (const breakpoint of fa.volumeBreakpoints) {
    const min = minorFromMajor(breakpoint.thresholdEur);
    if (min !== null) tiers.push({ min, steps: stepsOfPercent(fa, breakpoint.discountPercent) });
  }
  return { kind: 'tiers', basis: 'amount', tiers };
}
