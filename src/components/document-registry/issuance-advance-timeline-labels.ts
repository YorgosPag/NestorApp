/**
 * @fileoverview ADR-943 Φ5δ — **οι λέξεις του χρονολογίου χρημάτων και της εκκρεμούς κίνησης** για γραφείο και μηχανικό,
 *   δεμένες στο κλειστό λεξιλόγιο του τομέα: νέο είδος γραμμής **δεν μεταγλωττίζεται** χωρίς λέξη.
 * @module components/document-registry/issuance-advance-timeline-labels
 *
 * 🔑 **Χωριστά από το `issuance-advance-labels.ts`**: εκείνο το εισάγει η σελίδα του ιδιοκτήτη (`/document-request`), που
 *    έχει τις δικές της λέξεις χρονολογίου — εδώ ζουν μόνο όσα δεν πρέπει να μπουν στην κλειστότητά της (CHECK 3.34).
 * ⚠️ Κυριολεκτικά κλειδιά (CHECK 3.34 τα λύνει στατικά).
 */

import type { useTranslation } from '@/i18n/hooks/useTranslation';
import type { AdvanceReleaseBasis, AdvanceTimelineEntry } from '@/lib/document-validity/issuance-advance';
import { formatMinor } from '@/lib/money/money';

type Translate = ReturnType<typeof useTranslation>['t'];

/** Μία γραμμή του χρονολογίου χρημάτων για γραφείο και μηχανικό (ο ιδιοκτήτης έχει τις δικές του λέξεις). */
export function advanceTimelineText(t: Translate, entry: AdvanceTimelineEntry): string {
  switch (entry.kind) {
    case 'funded': return t('document-registry:issuance.advance.timeline.funded', { amount: formatMinor(entry.amountMinor) });
    case 'work-started': return t('document-registry:issuance.advance.timeline.workStarted');
    case 'start-objected':
      return entry.by === 'owner-link'
        ? t('document-registry:issuance.advance.timeline.objectedByOwner')
        : t('document-registry:issuance.advance.timeline.objectedByOffice');
    case 'released': return t('document-registry:issuance.advance.timeline.released', { amount: formatMinor(entry.amountMinor) });
    case 'refunded': return t('document-registry:issuance.advance.timeline.refunded', { amount: formatMinor(entry.amountMinor) });
    case 'dispute-resolved':
      return t('document-registry:issuance.advance.timeline.disputeResolved', { refund: formatMinor(entry.refundMinor), release: formatMinor(entry.releaseMinor) });
    case 'receipted':
      return t('document-registry:issuance.advance.timeline.receipted', { mark: entry.mark, amount: formatMinor(entry.amountMinor) });
  }
}

/** Γιατί οφείλεται η εκκρεμής κίνηση (`advanceSettlementDueOf`). */
export function settlementBasisText(t: Translate, basis: AdvanceReleaseBasis): string {
  switch (basis) {
    case 'window-elapsed': return t('document-registry:issuance.advance.panel.basis.windowElapsed');
    case 'office-resolution': return t('document-registry:issuance.advance.panel.basis.officeResolution');
    case 'cancellation': return t('document-registry:issuance.advance.panel.basis.cancellation');
  }
}
