'use client';

/**
 * **Κενή βιβλιοθήκη: τι θα έρθει και τι σημαίνει** (ADR-928 Φ1 απόφαση 5 · Φ3γ-0). Όχι κουμπί κενής κατάστασης —
 * **κατάλογος ελέγχου**: η σπορά φέρνει **προτάσεις**, και τίποτα δεν μπαίνει σε συμφωνητικό πριν το εγκρίνει άνθρωπος.
 *
 * 🔑 Ειλικρίνεια πριν το κλικ: πόσες ρήτρες, από πού, ότι όλες «θέλουν νομικό έλεγχο» (η εφαρμογή δεν κωδικοποιεί νόμο),
 *    και ότι τα πρότυπα γράφονται **μόνο** όταν εγκριθούν οι ρήτρες τους. Ρητή επιβεβαίωση.
 * 🔑 Χωρίς δικαίωμα ⇒ η οθόνη λέει **ποιος** μπορεί (ποτέ αδιέξοδο): «τη φορτώνει διαχειριστής της εταιρείας».
 * 🔑 Ιδεμποτική σπορά (ντετερμινιστικά ids): δεύτερο κλικ, δεύτερη καρτέλα, επανάληψη δικτύου ⇒ τίποτα διπλό.
 */

import { BookOpen, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { DefaultLibrarySeedReport } from '@/subapps/procurement/subcontracts/types/library-seed';

interface LibraryOnboardingProps {
  readonly clauseCount: number | null;
  readonly templateCount: number | null;
  readonly canSeed: boolean;
  readonly seed: () => Promise<DefaultLibrarySeedReport | null>;
  readonly onSeeded: (report: DefaultLibrarySeedReport) => void;
}

export function LibraryOnboarding({ clauseCount, templateCount, canSeed, seed, onSeeded }: LibraryOnboardingProps) {
  const { t } = useTranslation('procurement');
  const { confirm, dialogProps } = useConfirmDialog();
  const [seeding, setSeeding] = useState(false);
  const counts = { clauses: clauseCount ?? 0, templates: templateCount ?? 0 };

  const run = async () => {
    const ok = await confirm({
      title: t('subcontracts.library.onboarding.confirmTitle'),
      description: t('subcontracts.library.onboarding.confirmDescription', counts),
      confirmText: t('subcontracts.library.onboarding.seed'),
    });
    if (!ok) return;
    setSeeding(true);
    const report = await seed();
    setSeeding(false);
    if (report) onSeeded(report);
  };

  return (
    <section aria-labelledby="library-onboarding" className="mx-auto flex max-w-2xl flex-col gap-4 rounded-lg border bg-card p-6">
      <h2 id="library-onboarding" className="m-0 flex items-center gap-2 text-lg font-semibold"><BookOpen className="h-5 w-5" aria-hidden />{t('subcontracts.library.onboarding.title')}</h2>
      <p className="m-0 text-sm text-muted-foreground">{t('subcontracts.library.onboarding.lead')}</p>
      <ul className="m-0 list-disc space-y-1 pl-5 text-sm">
        <li>{clauseCount === null ? t('subcontracts.library.loading') : t('subcontracts.library.onboarding.clauses', { count: counts.clauses })}</li>
        <li>{t('subcontracts.library.onboarding.legal')}</li>
        <li>{t('subcontracts.library.onboarding.approval')}</li>
        <li>{templateCount === null ? t('subcontracts.library.loading') : t('subcontracts.library.onboarding.templates', { count: counts.templates })}</li>
      </ul>
      {canSeed ? (
        <Button type="button" className="self-start" disabled={seeding || clauseCount === null} onClick={() => void run()}>
          {seeding && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
          {seeding ? t('subcontracts.library.onboarding.seeding') : t('subcontracts.library.onboarding.seed')}
        </Button>
      ) : (
        <p className="m-0 text-sm" role="note">{t('subcontracts.library.onboarding.noPermission')}</p>
      )}
      <ConfirmDialog {...dialogProps} />
    </section>
  );
}

/** Η αναφορά της σποράς — τι δημιουργήθηκε, τι υπήρχε, τι περιμένει. Κλείνει από τον άνθρωπο. */
export function SeedReportNotice({ report, onDismiss }: { readonly report: DefaultLibrarySeedReport; readonly onDismiss: () => void }) {
  const { t } = useTranslation('procurement');
  return (
    <section aria-labelledby="seed-report" role="status" className="flex flex-wrap items-start justify-between gap-3 rounded-lg border bg-card p-4 text-sm">
      <span className="flex flex-col gap-1">
        <h2 id="seed-report" className="m-0 text-sm font-semibold">{t('subcontracts.library.report.title')}</h2>
        <span>{t('subcontracts.library.report.clauses', { created: report.clausesCreated.length, existing: report.clausesExisting.length })}</span>
        {(report.clausesUpdateProposed.length > 0 || report.clausesUpdateDeferred.length > 0) && (
          <span>{t('subcontracts.library.report.updates', { proposed: report.clausesUpdateProposed.length, deferred: report.clausesUpdateDeferred.length })}</span>
        )}
        <span>{t('subcontracts.library.report.templates', { created: report.templatesCreated.length, pending: report.templatesPending.length })}</span>
      </span>
      <Button type="button" size="sm" variant="ghost" onClick={onDismiss}>{t('subcontracts.library.report.dismiss')}</Button>
    </section>
  );
}
