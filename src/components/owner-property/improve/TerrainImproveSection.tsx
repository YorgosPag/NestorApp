'use client';

/**
 * **Η ενότητα «Τοπογραφικό»** της οθόνης «Βελτίωσε την αγγελία σου» (ADR-920 Β4.9 · ADR-842 Φ4).
 * @related `improve-sections.ts` (ο καταχωρητής — μόνο για γη, Δ1) ·
 *   `components/terrain/survey-import/TerrainSurveyImportPanel.tsx` (όλη η ροή, κοινή με τη φόρμα του γραφείου) ·
 *   `services/realtime/hooks/usePublicListings` (`usePublicListing` — τι βλέπει ήδη ο αγοραστής, ζωντανά)
 *
 * 🔑 Εδώ μόνο η **σύνδεση**: η ενότητα ξέρει τον κάτοχο (πόρτα + ταυτότητα αγγελίας) και διαβάζει την κάρτα που δημοσιεύεται
 *   τώρα· το «πώς» είναι του πάνελ. Η κάρτα έρχεται από την ίδια ζωντανή ανάγνωση με τη δημόσια σελίδα ⇒ μόλις η πόρτα
 *   ξαναπροβάλει την αγγελία, το «Δημοσιευμένο τώρα» αλλάζει μόνο του.
 * ⚡ **Όριο φόρτωσης ΜΕΣΑ στην ενότητα** (όπως ορίζει ο καταχωρητής · ADR-744 §4.1 · CHECK 3.34 Κ2): το πάνελ κουβαλά
 *   ανάγνωση Excel/DXF, Web Worker, χάρτη και τέσσερις χώρους ονομάτων — και αφορά μόνο οικόπεδα. Στατικά θα φούσκωνε το
 *   slice της διαδρομής **74 %** (19,8 → 34,4 KB) για **κάθε** αγγελία. Το πάνελ περιμένει ο ίδιος τους χώρους ονομάτων του.
 */

import dynamic from 'next/dynamic';
import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { TerrainImproveSubject } from '@/lib/terrain/publication/terrain-improve-subject';
import { usePublicListing } from '@/services/realtime/hooks/usePublicListings';

const NS = 'objective-value';

/** Όσο φορτώνει το πάνελ (κώδικας ή χώροι ονομάτων) — μία πρόταση κατάστασης, ποτέ κενό. */
function TerrainPanelPending() {
  const { t } = useTranslation([NS]);
  return <p role="status" className="m-0 text-sm text-muted-foreground">{t(`${NS}:improve.sections.terrain.loading`)}</p>;
}

const TerrainSurveyImportPanel = dynamic(
  () => import('@/components/terrain/survey-import/TerrainSurveyImportPanel').then((m) => m.TerrainSurveyImportPanel),
  { loading: () => <TerrainPanelPending /> },
);

export function TerrainImproveSection({ subject }: { readonly subject: TerrainImproveSubject }) {
  const { t } = useTranslation([NS]);
  const lookup = usePublicListing(subject.listingId);
  const published = lookup.state === 'found' ? lookup.listing.terrain?.value ?? null : null;
  return (
    <>
      <p className="m-0 text-sm text-muted-foreground">{t(`${NS}:improve.sections.terrain.lead`)}</p>
      <TerrainSurveyImportPanel target={subject.target} published={published} pending={<TerrainPanelPending />} />
    </>
  );
}
