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
 * §15 Γ2 — **μία σελίδα-περιεχόμενο, δύο κελύφη** (γραφείο · προσωπικός): το κέλυφος δηλώνει το `home` του και
 * κατέχει το ορόσημο `<main>` (στο `(app)` το δίνει ήδη ο `MainContentBridge` — δεύτερο θα ήταν εμφωλευμένο).
 * Υπόθεση ανοιγμένη σε λάθος χώρο ⇒ η σελίδα **πηγαίνει** στο σπίτι της (ο server δίνει τη διεύθυνση).
 *
 * @module components/conveyance/my-cases/EngagedCaseContent
 */

import React, { useEffect } from 'react';
import { ArrowLeft, ClipboardList, Loader2, Users } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
// ⚠️ ΚΑΝΕΝΑ route slice εδώ (ADR-744 §15): η σελίδα υπηρετεί ΔΥΟ διαδρομές — το καταχωρεί το `page.tsx` κάθε κελύφους.
import { PrivatePageHeader } from '@/components/private-space/PrivatePageHeader';
import { StateTabs } from '@/components/ui/navigation/state-tabs';
import { useEngagedCase, type EngagedCaseState } from '@/hooks/useEngagedCase';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { myCasesRoute, type CaseHome } from '@/lib/conveyance/conveyance-routes';
import { formatDate } from '@/lib/intl-utils';
import { cn } from '@/lib/utils';
import { Link, usePathname, useRouter, useWorkspaceHref } from '@/lib/workspace/navigation';
import { declaredHref } from '@/lib/workspace/route-worlds';
import type { EngagedCaseView } from '@/types/conveyance-case';
import { EngagedCaseChecklist } from './EngagedCaseChecklist';
import { EngagedCaseActivity } from './EngagedCaseActivity';
import { EngagedCaseParticipants } from './EngagedCaseParticipants';

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

/**
 * §15 Γ2 — η υπόθεση ζει σε **άλλο** χώρο ⇒ πήγαινε εκεί (`replace`: το «πίσω» δεν ξαναπέφτει στη λάθος διεύθυνση).
 * Επιστρέφει `true` όσο η μετάβαση εκκρεμεί.
 *
 * ⚠️ **Ζώνη-και-τιράντες**: προορισμός ίδιος με την τρέχουσα διεύθυνση **δεν** ακολουθείται (θα ήταν βρόχος) — η
 *    σελίδα δείχνει «δεν φορτώθηκε». Δεν το γεννά καμία γνωστή διαδρομή· αν συμβεί, φαίνεται αντί να γυρίζει.
 */
function useCaseRelocation(state: EngagedCaseState): boolean {
  const router = useRouter();
  const here = useWorkspaceHref()(usePathname());
  const to = state.kind === 'moved' && state.to !== here ? state.to : null;
  useEffect(() => {
    if (to !== null) router.replace(declaredHref('ADR-901 §15 Γ2 — το σπίτι της υπόθεσης, χτισμένο από τον server (`addressInWorkspace`)', to));
  }, [router, to]);
  return to !== null;
}

function CaseState({ engagementId, home }: { readonly engagementId: string; readonly home: CaseHome }) {
  const { t } = useTranslation(['conveyance']);
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();
  const { state, reload } = useEngagedCase(engagementId, home);
  const relocating = useCaseRelocation(state);
  if (state.kind === 'loading' || relocating) {
    return (
      <section className="flex justify-center p-8" aria-busy="true">
        <Loader2 className={cn(iconSizes.md, 'animate-spin', colors.text.muted)} aria-hidden="true" />
      </section>
    );
  }
  if (state.kind === 'denied') return <p className="text-sm text-foreground">{t(`engagement.verdicts.${state.verdict}`)}</p>;
  if (state.kind === 'failed' || state.kind === 'moved') return <p className={cn('text-sm', colors.text.error)}>{t('engagement.case.loadError')}</p>;
  return <CaseView view={state.view} onChanged={reload} />;
}

interface EngagedCaseContentProps {
  readonly engagementId: string;
  /** Το είδος χώρου του κελύφους που την αποδίδει (§15 Γ2). */
  readonly home: CaseHome;
}

export function EngagedCaseContent({ engagementId, home }: EngagedCaseContentProps) {
  const { t } = useTranslation(['conveyance']);
  const iconSizes = useIconSizes();
  return (
    <section className="flex w-full flex-col gap-4">
      <nav>
        <Link href={myCasesRoute(home)} className="inline-flex items-center gap-1 text-sm font-medium text-foreground underline">
          <ArrowLeft className={iconSizes.sm} aria-hidden="true" />
          {t('engagement.case.back')}
        </Link>
      </nav>
      <CaseState engagementId={engagementId} home={home} />
    </section>
  );
}
