/**
 * Η καθαρή λογική της οθόνης κανόνων ορατότητας (ADR-923 §12 · §5.12 Δ1): από το πρόχειρο της φόρμας σε αντικείμενο,
 * και η σειρά της λίστας. Μοιάζει με τον κανόνα του γραφέα επίτηδες: δεύτερος κανόνας στο ίδιο κελί φαίνεται πριν από το κλικ.
 *
 * @module components/catalog/pricing/visibility-rule-draft
 */

import { audienceSpecificity } from '@/subapps/catalog/pricing/price-audience';
import { visibilityRuleKey } from '@/subapps/catalog/pricing/visibility';
import type { PriceAudience } from '@/subapps/catalog/types/price-list';
import type { VisibilityRuleWire } from '@/subapps/catalog/types/pricing-views';
import type { VisibilitySubject } from '@/subapps/catalog/types/visibility-rule';
import { VISIBILITY_SUBJECT_SPECIFICITY, type VisibilitySubjectKind } from '@/subapps/catalog/vocabulary/pricing';
import type { CodeJumpTarget } from '../products/catalog-code-jump';

/** Ποια είδη επιλύονται με κωδικό· ο κατάλογος δεν έχει, η κατηγορία έχει λίστα. */
export function needsCode(kind: VisibilitySubjectKind): kind is 'productModel' | 'variant' {
  return kind === 'productModel' || kind === 'variant';
}

/** Ο κωδικός που επιλύθηκε, ως αντικείμενο του ζητούμενου είδους· λάθος είδος ⇒ `null`, ποτέ σιωπηλή μετατροπή. */
export function subjectOfTarget(kind: 'productModel' | 'variant', target: CodeJumpTarget | null): VisibilitySubject | null {
  if (kind === 'productModel') return target?.kind === 'productModel' ? { kind, modelId: target.id } : null;
  return target?.kind === 'product' ? { kind, variantId: target.id } : null;
}

export function hasRuleFor(rules: readonly VisibilityRuleWire[], subject: VisibilitySubject, audience: PriceAudience): boolean {
  const key = visibilityRuleKey({ subject, audience });
  return rules.some((rule) => visibilityRuleKey(rule) === key);
}

/** Σειρά λίστας: η σειρά της κρίσης, ο ειδικότερος πρώτος. */
export function rulesBySpecificity(rules: readonly VisibilityRuleWire[]): readonly VisibilityRuleWire[] {
  return [...rules].sort(
    (a, b) =>
      audienceSpecificity(b.audience) - audienceSpecificity(a.audience) ||
      VISIBILITY_SUBJECT_SPECIFICITY[b.subject.kind] - VISIBILITY_SUBJECT_SPECIFICITY[a.subject.kind] ||
      a.id.localeCompare(b.id),
  );
}
