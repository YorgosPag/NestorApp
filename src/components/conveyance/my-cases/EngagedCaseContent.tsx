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
 * Φ4: καρτέλες §5.4 — «Δικαιολογητικά» · «Συμμετέχοντες & ίχνος» (η δηλωμένη ιδιότητα των άλλων μερών, Ε-4).
 * Φ4.4: ο κατάλογος (με αποστολή/απόσυρση εγγράφων) ζει στο `EngagedCaseChecklist`· εδώ η σελίδα και οι καρτέλες.
 *
 * @module components/conveyance/my-cases/EngagedCaseContent
 */

import React from 'react';
import { ArrowLeft, ClipboardList, Loader2, Users } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
// 🔴 ADR-744 §18 — ΤΟ SLICE ΤΗΣ ΔΙΑΔΡΟΜΗΣ, ΣΤΑΤΙΚΑ ΚΑΙ ΣΕ ΕΜΒΕΛΕΙΑ MODULE (ποτέ `import()`: κρύβει το ωμό κλειδί από το CHECK 3.51).
import routeSlice from '@/i18n/generated/routes/cases__engagementId.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';
import { PrivatePageHeader } from '@/components/private-space/PrivatePageHeader';
import { StateTabs } from '@/components/ui/navigation/state-tabs';
import { useEngagedCase } from '@/hooks/useEngagedCase';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { MY_CASES_ROUTE } from '@/lib/conveyance/conveyance-routes';
import { formatDate } from '@/lib/intl-utils';
import { cn } from '@/lib/utils';
import { Link } from '@/lib/workspace/navigation';
import type { EngagedCaseView } from '@/types/conveyance-case';
import { EngagedCaseChecklist } from './EngagedCaseChecklist';
import { EngagedCaseActivity } from './EngagedCaseActivity';
import { EngagedCaseParticipants } from './EngagedCaseParticipants';

registerRouteSlice(routeSlice);

function CaseParticipantsTab({ view }: { readonly view: EngagedCaseView }) {
  return (
    <section className="space-y-6">
      <EngagedCaseParticipants participants={view.participants} />
      <EngagedCaseActivity engagementId={view.engagementId} />
    </section>
  );
}

/** Οι καρτέλες της §5.4 — η «Ακίνητο» είναι δηλωμένο όριο της Φ4 (ADR-901 §14.4). */
function CaseView({ view, onChanged }: { readonly view: EngagedCaseView; readonly onChanged: () => void }) {
  const { t } = useTranslation(['conveyance']);
  const facts = [
    t(`engagement.roles.${view.role}`),
    t(`state.${view.state}`),
    t('summary.progress', { complete: view.checklist.summary.complete, applicable: view.checklist.summary.applicable }),
    ...(view.targetSigningDate ? [t('engagement.myCases.signing', { date: formatDate(view.targetSigningDate) })] : []),
  ];
  const tabs = [
    { id: 'checklist', label: t('engagement.case.tabs.checklist'), icon: ClipboardList, content: <EngagedCaseChecklist view={view} onChanged={onChanged} /> },
    { id: 'participants', label: t('engagement.case.tabs.participants'), icon: Users, content: <CaseParticipantsTab view={view} /> },
  ];
  return (
    <>
      <PrivatePageHeader title={view.propertyName ?? t('engagement.myCases.untitled')} lead={facts.join(' · ')} />
      <StateTabs tabs={tabs} defaultTab="checklist" />
    </>
  );
}

function CaseState({ engagementId }: { readonly engagementId: string }) {
  const { t } = useTranslation(['conveyance']);
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();
  const { state, reload } = useEngagedCase(engagementId);
  if (state.kind === 'loading') {
    return (
      <section className="flex justify-center p-8" aria-busy="true">
        <Loader2 className={cn(iconSizes.md, 'animate-spin', colors.text.muted)} aria-hidden="true" />
      </section>
    );
  }
  if (state.kind === 'denied') return <p className="text-sm text-foreground">{t(`engagement.verdicts.${state.verdict}`)}</p>;
  if (state.kind === 'failed') return <p className={cn('text-sm', colors.text.error)}>{t('engagement.case.loadError')}</p>;
  return <CaseView view={state.view} onChanged={reload} />;
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
