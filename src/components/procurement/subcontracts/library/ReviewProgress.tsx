'use client';

/**
 * **Η πρόοδος του ελέγχου της προτεινόμενης βιβλιοθήκης** — «12 από 29 εγκρίθηκαν · 3 για νομικό» (ADR-928 Φ3γ-0).
 * Η απόρριψη είναι **απόφαση** (μετρά στην πρόοδο) αλλά **όχι** «εντάξει» (δική της λέξη). Αριθμοί από το καθαρό
 * `seedProgressOf`· λέξη δίπλα σε κάθε αριθμό (ADR-771).
 */

import { Progress } from '@/components/ui/progress';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { SeedProgress } from '@/subapps/procurement/subcontracts/library/review-queue';

export function ReviewProgress({ progress }: { readonly progress: SeedProgress }) {
  const { t } = useTranslation('procurement');
  const { counts, total } = progress;
  const decided = counts.approved + counts.rejected;
  const percent = total === 0 ? 0 : Math.round((decided / total) * 100);
  return (
    <section aria-labelledby="library-progress" className="flex flex-col gap-2 rounded-lg border bg-card p-3">
      <h2 id="library-progress" className="m-0 text-sm font-semibold">
        {progress.complete ? t('subcontracts.library.progress.complete') : t('subcontracts.library.progress.summary', { decided, total })}
      </h2>
      <Progress value={percent} aria-label={t('subcontracts.library.progress.summary', { decided, total })} />
      <p className="m-0 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>{t('subcontracts.library.progress.approved', { count: counts.approved })}</span>
        <span>{t('subcontracts.library.progress.pending', { count: counts.pending })}</span>
        {counts.rejected > 0 && <span>{t('subcontracts.library.progress.rejected', { count: counts.rejected })}</span>}
        {counts.missing > 0 && <span>{t('subcontracts.library.progress.missing', { count: counts.missing })}</span>}
        {progress.awaitingProfessionalReview > 0 && <span>{t('subcontracts.library.progress.legal', { count: progress.awaitingProfessionalReview })}</span>}
      </p>
    </section>
  );
}
