/**
 * Οι **κανόνες ορατότητας** του προμηθευτή (ADR-923 §12 · §5.12 Δ1): ποιος βλέπει τι από τον κατάλογό του.
 * Ένας κανόνας ανά (αντικείμενο, κοινό), δομικά: η ταυτότητα του εγγράφου **είναι** αυτό το ζεύγος.
 *
 * @module subapps/catalog/types/visibility-rule
 */

import type { SelectionTraceEntry } from '@/lib/pricing/select-condition';
import type { CatalogVisibility, VisibilitySubjectKind } from '../vocabulary/pricing';
import type { PriceAudience } from './price-list';

/** Χάρτης είδος αντικειμένου → στοιχεία. Δεμένος στη ρίζα `VisibilitySubjectKind` (CHECK 3.73). */
export interface VisibilitySubjectByKind {
  readonly catalog: Record<never, never>;
  readonly category: { readonly categoryId: string };
  readonly productModel: { readonly modelId: string };
  readonly variant: { readonly variantId: string };
}

export type VisibilitySubject = {
  [K in VisibilitySubjectKind]: { readonly kind: K } & VisibilitySubjectByKind[K];
}[VisibilitySubjectKind];

export interface VisibilityRuleDefinition {
  readonly subject: VisibilitySubject;
  readonly audience: PriceAudience;
  readonly visibility: CatalogVisibility;
}

/** Η θέση ενός SKU στον κατάλογο: από εδώ βγαίνει ποιοι κανόνες το αφορούν. */
export interface VisibilityAncestry {
  readonly variantId: string;
  /** Μοντέλα από τη ρίζα προς το SKU· κενό για απλό προϊόν. */
  readonly modelIds: readonly string[];
  /** Κάθε κατηγορία που το καλύπτει, με το βάθος της: 0 = ρίζα δέντρου. */
  readonly categoryDepths: Readonly<Record<string, number>>;
}

export type VisibilityMismatch = 'audienceMismatch' | 'otherSubject';

/** Η απάντηση της κρίσης, με το «γιατί» της (SAP pricing analysis). */
export interface VisibilityVerdict {
  readonly visibility: CatalogVisibility;
  /** Ο κανόνας που νίκησε· `null` ⇒ κανένας δεν ισχύει και μιλά η προεπιλογή. */
  readonly ruleId: string | null;
  /** Ισοβάθμησαν κανόνες και αποφάσισε το περιοριστικότερο (§5.12 Σ8). */
  readonly tied: boolean;
  readonly trace: readonly SelectionTraceEntry<VisibilityMismatch>[];
}
