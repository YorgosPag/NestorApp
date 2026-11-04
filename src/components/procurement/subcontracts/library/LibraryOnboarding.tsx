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

import { BookOpen, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { seedReportHasChanges } from '@/subapps/procurement/subcontracts/library/default-library-update';
import type { DefaultLibrarySeedReport } from '@/subapps/procurement/subcontracts/types/library-seed';
import type { LibrarySeed } from './useLibrarySeed';

interface LibraryOnboardingProps {
  readonly clauseCount: number | null;
  readonly templateCount: number | null;
  readonly canSeed: boolean;
  readonly seed: Pick<LibrarySeed, 'run' | 'seeding'>;
}

export function LibraryOnboarding({ clauseCount, templateCount, canSeed, seed }: LibraryOnboardingProps) {
  const { t } = useTranslation('procurement');
  const { confirm, dialogProps } = useConfirmDialog();
  const { seeding } = seed;
  const counts = { clauses: clauseCount ?? 0, templates: templateCount ?? 0 };

  const run = async () => {
    const ok = await confirm({
      title: t('subcontracts.library.onboarding.confirmTitle'),
      description: t('subcontracts.library.onboarding.confirmDescription', counts),
      confirmText: t('subcontracts.library.onboarding.seed'),
    });
    if (ok) await seed.run();
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

/**
 * **«Έλεγχος για ενημερώσεις του Nestor App»** (ADR-928 §5.20) — η σταθερή πόρτα της ενημέρωσης σε ήδη σπαρμένο χώρο.
 * Χωρίς αυτήν, η σπορά ξεκινούσε μόνο από πρότυπο **ήδη** έτοιμο — ενώ τα πρότυπα περίμεναν τις ρήτρες που φέρνει η σπορά:
 * αδιέξοδο. Χωρίς δικαίωμα: ανενεργό, με ορατή αιτία (ποτέ κρυφό, ποτέ αδιέξοδο).
 */
export function LibraryUpdateCheck({ canSeed, seed }: { readonly canSeed: boolean; readonly seed: Pick<LibrarySeed, 'run' | 'seeding'> }) {
  const { t } = useTranslation('procurement');
  const { seeding } = seed;
  return (
    <span className="flex flex-col items-end gap-0.5">
      <Button type="button" size="sm" variant="outline" disabled={!canSeed || seeding} aria-busy={seeding} onClick={() => void seed.run()}>
        {seeding ? <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="mr-1 h-4 w-4" aria-hidden />}
        {seeding ? t('subcontracts.library.updates.checking') : t('subcontracts.library.updates.check')}
      </Button>
      {!canSeed && <span className="text-xs text-muted-foreground">{t('subcontracts.library.reasons.notAuthorized')}</span>}
    </span>
  );
}

/**
 * Η αναφορά της σποράς — τι δημιουργήθηκε, τι υπήρχε, τι περιμένει. Κλείνει από τον άνθρωπο. Όταν δεν ήρθε τίποτα νέο,
 * το λέει με μία λέξη («ενημερωμένη») αντί για στήλη από μηδενικά.
 */
export function SeedReportNotice({ report, onDismiss }: { readonly report: DefaultLibrarySeedReport; readonly onDismiss: () => void }) {
  const { t } = useTranslation('procurement');
  const changed = seedReportHasChanges(report);
  const pending = report.templatesPending.length;
  return (
    <section aria-labelledby="seed-report" role="status" className="flex flex-wrap items-start justify-between gap-3 rounded-lg border bg-card p-4 text-sm">
      <span className="flex flex-col gap-1">
        <h2 id="seed-report" className="m-0 text-sm font-semibold">{changed ? t('subcontracts.library.report.title') : t('subcontracts.library.updates.upToDate')}</h2>
        {changed ? <SeedReportLines report={report} /> : pending > 0 && <span>{t('subcontracts.library.updates.templatesPending', { count: pending })}</span>}
      </span>
      <Button type="button" size="sm" variant="ghost" onClick={onDismiss}>{t('subcontracts.library.report.dismiss')}</Button>
    </section>
  );
}

function SeedReportLines({ report }: { readonly report: DefaultLibrarySeedReport }) {
  const { t } = useTranslation('procurement');
  return (
    <>
      <span>{t('subcontracts.library.report.clauses', { created: report.clausesCreated.length, existing: report.clausesExisting.length })}</span>
      {(report.clausesUpdateProposed.length > 0 || report.clausesUpdateDeferred.length > 0) && (
        <span>{t('subcontracts.library.report.updates', { proposed: report.clausesUpdateProposed.length, deferred: report.clausesUpdateDeferred.length })}</span>
      )}
      <span>{t('subcontracts.library.report.templates', { created: report.templatesCreated.length, pending: report.templatesPending.length })}</span>
    </>
  );
}
