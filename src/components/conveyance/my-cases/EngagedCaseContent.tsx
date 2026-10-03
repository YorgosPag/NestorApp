'use client';

/**
 * =============================================================================
 * Η υπόθεση, όπως τη βλέπει ο επαγγελματίας (ADR-901 Φ2 §5.4 — καρτέλα «Δικαιολογητικά»)
 * =============================================================================
 *
 * **Ίδια** components καταλόγου με τον οικοδεσπότη (`ConveyanceChecklistSection` · `ConveyanceChecklistRow`),
 * με `canEdit=false` — μία παρουσίαση, δύο θεατές. Ο κατάλογος έρχεται φιλτραρισμένος από τον server ανά
 * ρόλο (`visibleTo`) και εμβέλεια (WIP ⛔)· ενότητα χωρίς γραμμές για τον ρόλο μου δεν εμφανίζεται.
 *
 * 🔜 Οι ενέργειες ελέγχου (αποδοχή/απόρριψη εγγράφου), η προβολή/λήψη αρχείων και το ίχνος έρχονται με τη Φ4.
 *
 * @module components/conveyance/my-cases/EngagedCaseContent
 */

import React from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
// 🔴 ADR-744 §18 — ΤΟ SLICE ΤΗΣ ΔΙΑΔΡΟΜΗΣ, ΣΤΑΤΙΚΑ ΚΑΙ ΣΕ ΕΜΒΕΛΕΙΑ MODULE (ποτέ `import()`: κρύβει το ωμό κλειδί από το CHECK 3.51).
import routeSlice from '@/i18n/generated/routes/cases__engagementId.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';
import { ConveyanceChecklistSection } from '@/components/sales/conveyance/ConveyanceChecklistSection';
import { PrivatePageHeader } from '@/components/private-space/PrivatePageHeader';
import { CHECKLIST_SECTIONS } from '@/config/conveyance-checklist/types';
import { useEngagedCase } from '@/hooks/useEngagedCase';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { MY_CASES_ROUTE } from '@/lib/conveyance/conveyance-routes';
import { formatDate } from '@/lib/intl-utils';
import { cn } from '@/lib/utils';
import { Link } from '@/lib/workspace/navigation';
import type { EngagedCaseView } from '@/types/conveyance-case';

registerRouteSlice(routeSlice);

/** Ο κατάλογος είναι μόνο για ανάγνωση — οι χειριστές ενεργειών δεν καλούνται ποτέ (`canEdit=false`). */
const READ_ONLY = (): void => undefined;

function CaseView({ view }: { readonly view: EngagedCaseView }) {
  const { t } = useTranslation(['conveyance']);
  const colors = useSemanticColors();
  const facts = [
    t(`engagement.roles.${view.role}`),
    t(`state.${view.state}`),
    t('summary.progress', { complete: view.checklist.summary.complete, applicable: view.checklist.summary.applicable }),
    ...(view.targetSigningDate ? [t('engagement.myCases.signing', { date: formatDate(view.targetSigningDate) })] : []),
  ];
  return (
    <>
      <PrivatePageHeader title={view.propertyName ?? t('engagement.myCases.untitled')} lead={facts.join(' · ')} />
      <p className={cn('m-0 text-xs', colors.text.muted)}>{t('engagement.case.readOnly')}</p>
      {CHECKLIST_SECTIONS.map((section) => {
        const rows = view.checklist.rows.filter((row) => row.section === section);
        if (rows.length === 0) return null;
        return <ConveyanceChecklistSection key={section} section={section} rows={rows} canEdit={false} onOpenDialog={READ_ONLY} onClear={READ_ONLY} />;
      })}
    </>
  );
}

function CaseState({ engagementId }: { readonly engagementId: string }) {
  const { t } = useTranslation(['conveyance']);
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();
  const state = useEngagedCase(engagementId);
  if (state.kind === 'loading') {
    return (
      <section className="flex justify-center p-8" aria-busy="true">
        <Loader2 className={cn(iconSizes.md, 'animate-spin', colors.text.muted)} aria-hidden="true" />
      </section>
    );
  }
  if (state.kind === 'denied') return <p className="text-sm text-foreground">{t(`engagement.verdicts.${state.verdict}`)}</p>;
  if (state.kind === 'failed') return <p className={cn('text-sm', colors.text.error)}>{t('engagement.case.loadError')}</p>;
  return <CaseView view={state.view} />;
}

export function EngagedCaseContent({ engagementId }: { readonly engagementId: string }) {
  const { t } = useTranslation(['conveyance']);
  const iconSizes = useIconSizes();
  return (
    <main className="flex w-full flex-col gap-4">
      <nav>
        <Link href={MY_CASES_ROUTE} className="inline-flex items-center gap-1 text-sm font-medium text-foreground underline">
          <ArrowLeft className={iconSizes.sm} aria-hidden="true" />
          {t('engagement.case.back')}
        </Link>
      </nav>
      <CaseState engagementId={engagementId} />
    </main>
  );
}
