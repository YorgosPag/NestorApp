'use client';

/**
 * @fileoverview **ΤΑ ΚΕΙΜΕΝΑ ΤΗΣ ΦΟΡΜΑΣ ΖΗΤΗΣΗΣ** — ΕΝΑΣ πίνακας, ΜΙΑ γραμμή κώδικα.
 * @related lib/forms/draft-form-labels.ts (όλο το γιατί) · ADR-827 §9.14 · CHECK 3.34
 * @module components/demand/demand-form-labels
 *
 * 🔴 **ΓΙΑΤΙ ΑΡΧΕΙΟ ΑΝΑ ΒΑΣΗ**: η `dynamicKeyPolicy` του τεμαχιστή ζει **ανά ΑΡΧΕΙΟ**.
 * Κοινό αρχείο με όρισμα `base` θα δήλωνε **και τις δύο** ρίζες, και **κάθε** διαδρομή
 * με φόρμα θα κουβαλούσε **και τα δύο** λεξιλόγια *(μετρημένο: 6.072 bytes `demand.*`
 * σε σελίδα προσφοράς)*.
 *
 * 🔑 **ΓΙΑΤΙ ΕΝΑΣ ΚΥΡΙΟΛΕΚΤΙΚΟΣ ΠΙΝΑΚΑΣ ΚΑΙ ΟΧΙ ΤΡΕΙΣ ΜΕ SPREAD**: ο εξαγωγέας
 * διαβάζει **τιμές σταθεράς module**. Ένα `{...A, ...B, ...C}` **δεν διαβάζεται** — και
 * το μέτρησε ο ίδιος ο γεννήτορας (*«1 unresolved dynamic t()»*). Ο ένας πίνακας είναι
 * ταυτόχρονα η **μόνη** μορφή που ο τεμαχιστής επιλύει **και** η μόνη που κρατά τον
 * μεταφραστή σε **μία γραμμή** (CHECK 3.28: τα τρία σώματα ήταν δίδυμα).
 *
 * ⚠️ **Ο τύπος `Record<…>` πάνω στην ΕΝΩΣΗ των τριών λεξιλογίων** ⇒ νέα θέση κελύφους
 * **ή** νέος κωδικός έλλειψης **δεν μεταγλωττίζεται** χωρίς κλειδί. Ότι το κλειδί
 * **έχει λέξεις σε δύο γλώσσες** το φυλά το `form-issue-keys.test.ts`.
 */

import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { DraftFormSlot, DraftFormText } from '@/lib/forms/draft-form-labels';
import type { DemandFormBlocker } from '@/lib/demand/demand-form-values';
import type { DemandInvariant } from '@/types/property-demand';

const NS = 'property-market';

/** Το **ΕΝΩΜΕΝΟ** λεξιλόγιο αυτής της βάσης — θέσεις κελύφους + κωδικοί ελλείψεων. */
export const TEXT_KEYS: Record<DraftFormSlot | DemandFormBlocker | DemandInvariant, string> = {
  title: 'property-market:demand.form.title',
  editTitle: 'property-market:demand.form.editTitle',
  lead: 'property-market:demand.form.lead',
  failed: 'property-market:demand.form.failed',
  saving: 'property-market:demand.form.saving',
  save: 'property-market:demand.form.save',
  submit: 'property-market:demand.form.submit',
  cancel: 'property-market:demand.form.cancel',
  issuesHeading: 'property-market:demand.invariant.heading',

  'place-unresolved': 'property-market:demand.formBlocker.place-unresolved',
  'place-not-identified': 'property-market:demand.formBlocker.place-not-identified',
  'area-not-drawn': 'property-market:demand.formBlocker.area-not-drawn',
  'window-incomplete': 'property-market:demand.formBlocker.window-incomplete',
  'frontage-axis-missing': 'property-market:demand.formBlocker.frontage-axis-missing',

  'seeks-empty': 'property-market:demand.invariant.seeks-empty',
  'seeks-duplicated': 'property-market:demand.invariant.seeks-duplicated',
  'window-inverted': 'property-market:demand.invariant.window-inverted',
  'range-inverted': 'property-market:demand.invariant.range-inverted',
  'radius-not-positive': 'property-market:demand.invariant.radius-not-positive',
  'outline-degenerate': 'property-market:demand.invariant.outline-degenerate',
  'axis-degenerate': 'property-market:demand.invariant.axis-degenerate',
  'depth-not-positive': 'property-market:demand.invariant.depth-not-positive',
  'proximity-not-positive': 'property-market:demand.invariant.proximity-not-positive',
  'proximity-duplicated': 'property-market:demand.invariant.proximity-duplicated',
};

/** Ο **ΕΝΑΣ** μεταφραστής αυτής της βάσης. */
export function useDemandFormText(): DraftFormText<DemandFormBlocker, DemandInvariant> {
  const { t } = useTranslation([NS]);
  return (id) => t(TEXT_KEYS[id]);
}
