/**
 * @fileoverview **Ένα υποψήφιο σε λέξεις** — «1.364 τ.μ. · 4 κορυφές · Στρώση «Orio»» (ADR-920 §14.11 Ζ4).
 * @related ./PlotCandidateList (ο τίτλος της κάρτας · «ίδιο σχήμα με …») · ./PlotCandidateStatusLine (η γραμμή κατάστασης
 *   κάτω από το σχέδιο) — η ΙΔΙΑ φράση και στα δύο, ώστε ο άνθρωπος να αναγνωρίζει την κάρτα από τη γραμμή.
 * @module components/terrain/plot-outline/plot-candidate-text
 */

import type { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatNumber } from '@/lib/intl-formatting';
import type { PlotOutlineCandidate } from '@/lib/terrain/plot-outline/plot-outline-types';

const NS = 'terrain-survey:plotOutline';

export type PlotCandidateTranslate = ReturnType<typeof useTranslation>['t'];

/** Εμβαδόν σε ακέραια τ.μ., με τη μορφή της γλώσσας. */
export const plotCandidateArea = (m2: number) => formatNumber(m2, { maximumFractionDigits: 0 });

/** Από πού ήρθε: στρώση DXF ή σελίδα πίνακα PDF. */
export function plotCandidateOrigin(candidate: PlotOutlineCandidate, t: PlotCandidateTranslate): string {
  const { origin } = candidate;
  return origin.source === 'dxf' ? t(`${NS}.candidates.dxfOrigin`, { layer: origin.layer }) : t(`${NS}.candidates.pdfOrigin`, { page: origin.page });
}

/** Η φράση που ονομάζει ένα υποψήφιο: εμβαδόν · κορυφές · προέλευση. */
export function plotCandidateHeadline(candidate: PlotOutlineCandidate, t: PlotCandidateTranslate): string {
  return [
    t(`${NS}.candidates.area`, { area: plotCandidateArea(candidate.areaM2) }),
    t(`${NS}.candidates.corners`, { count: candidate.corners.length }),
    plotCandidateOrigin(candidate, t),
  ].join(' · ');
}
