'use client';

/**
 * @fileoverview **Η λίστα ενοτήτων της «Βελτίωσε την αγγελία σου», σε λέξεις** (ADR-946 · ADR-842 Φ4) — η κατάσταση
 * κάθε ενότητας (`IMPROVE_SECTIONS[id].status`) → ετικέτα · σύνοψη μίας γραμμής · μετρητής.
 * @related `improve-sections.ts` (η κατάσταση, καθαρή) · `core/layouts/SectionNavList.tsx` (ο ζωγράφος)
 * @module components/owner-property/improve/improve-section-entries
 *
 * 🔑 **Οι ΙΔΙΟΙ δρόμοι με τον αγοραστή**: το ποσό κοινοχρήστων από το `resolvedPriceLabel` (η μονάδα «/μήνα») · η
 *   κλάση και η απουσία ΠΕΑ από τους πίνακες του `energy-certificate-keys` · το ποσό ή το εύρος της αντικειμενικής από
 *   το `useObjectiveValueAmountText`. Δικά μας κλειδιά ΜΟΝΟ για το «δεν δηλώθηκε»: τα αντίστοιχα της αγγελίας ζουν στο
 *   `listing-detail`, που θα έβαζε όλο εκείνο το namespace στην αναμονή της πρώτης απόδοσης (ADR-744 §27, μετρημένο).
 * 🔑 **Μετρητής μόνο όπου ΜΕΤΡΑ κάτι**: οι ερωτήσεις που μένουν στην αντικειμενική. Ένα «1» δίπλα σε «Δεν έχει δηλωθεί»
 *   δεν λέει τίποτα που η σύνοψη δεν λέει ήδη.
 */

import { useObjectiveValueAmountText } from '@/components/objective-value/ObjectiveValueEvaluated';
import type { SectionEntry } from '@/core/layouts/SectionNavList';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  ENERGY_CERTIFICATE_ABSENCE_KEY,
  ENERGY_CLASS_LABEL_KEY,
} from '@/lib/energy-certificate/energy-certificate-keys';
import { resolvedPriceLabel, type PriceLabelT } from '@/lib/listings/listing-price-label';

import {
  IMPROVE_SECTIONS,
  type ImproveContext,
  type ImproveSectionId,
  type ImproveSectionStatus,
} from './improve-sections';

const NS = 'objective-value';
const I = `${NS}:improve`;

type AmountText = ReturnType<typeof useObjectiveValueAmountText>;

/** Το ποσό με τη μονάδα του μήνα, από τον ΕΝΑΝ δρόμο τιμών (`resolvedPriceLabel`) — ίδιο με την αγγελία. */
function commonChargesSummary(t: PriceLabelT, amount: number | null): string {
  if (amount === null) return t(`${I}.summary.commonChargesUndeclared`);
  if (amount === 0) return t(`${I}.summary.commonChargesNone`);
  return resolvedPriceLabel(t, { role: 'rent', amount });
}

/** Η μία γραμμή σύνοψης κάθε κατάστασης. */
function summaryOf(t: PriceLabelT, amountText: AmountText, status: ImproveSectionStatus): string {
  switch (status.kind) {
    case 'loading':
      return t(`${I}.summary.loading`);
    case 'unavailable':
      return t(`${I}.summary.unavailable`);
    case 'commonCharges':
      return commonChargesSummary(t, status.monthlyAmount);
    case 'energyCertificate':
      if (status.energyClass !== null) {
        return t(`${I}.summary.energyClass`, { energyClass: t(ENERGY_CLASS_LABEL_KEY[status.energyClass]) });
      }
      if (status.absence !== null) return t(ENERGY_CERTIFICATE_ABSENCE_KEY[status.absence]);
      return t(`${I}.summary.energyUndeclared`);
    case 'terrain':
      return status.published ? t(`${I}.summary.terrainPublished`) : t(`${I}.summary.terrainMissing`);
    case 'objectiveValue':
      return amountText(status.bounds) ?? t(`${I}.summary.unavailable`);
  }
}

function entryOf(t: PriceLabelT, amountText: AmountText, id: ImproveSectionId, status: ImproveSectionStatus): SectionEntry {
  const open = status.kind === 'objectiveValue' ? status.openQuestions : 0;
  return {
    id,
    label: t(`${I}.sections.${id}.title`),
    summary: summaryOf(t, amountText, status),
    count: open,
    attention: open > 0,
  };
}

/** Οι γραμμές της λίστας, με τη σειρά του καταχωρητή — μόνο για τις ενότητες που ισχύουν. */
export function useImproveSectionEntries(
  ids: readonly ImproveSectionId[],
  context: ImproveContext,
): readonly SectionEntry[] {
  // Μόνο ο δικός μας χώρος ονομάτων: τα ξένα κλειδιά (κοινόχρηστα · κλάση ΠΕΑ) είναι γραμμένα στατικά, άρα μπαίνουν στο
  // slice της διαδρομής — ένα `useTranslation([..., 'listing-detail'])` θα περίμενε ΟΛΟ το namespace (ADR-744 §27).
  const { t } = useTranslation([NS]);
  const amountText = useObjectiveValueAmountText();
  // Χωρίς `useMemo`: τέσσερις καθαρές κλήσεις ανά απόδοση, και το `SectionListDetail` δεν συγκρίνει ταυτότητα γραμμών.
  return ids.map((id) => entryOf(t, amountText, id, IMPROVE_SECTIONS[id].status(context)));
}
