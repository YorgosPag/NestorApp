'use client';

/**
 * **Η βιβλιοθήκη ρητρών και προτύπων υπεργολαβίας της εταιρείας** (ADR-928 §5.19 · Φ3γ-0): σπορά · ουρά ελέγχου ·
 * ρήτρες · πρότυπα. Χωρίς αυτή την οθόνη κανείς δεν φτιάχνει συμφωνητικό — κανένα πρότυπο δεν γράφεται πριν εγκρίνει
 * άνθρωπος τις ρήτρες του.
 *
 * 🔑 Κέλυφος προμηθειών (`PageContainer` + `ProcurementSubNav` + `PageHeader`), όπως οι αδελφές σελίδες.
 * 🔑 Η κατάσταση ζει στη διεύθυνση: `?tab=review|clauses|templates` · `?clause=<id>` (κοινή σε ουρά και ρήτρες) ·
 *    `?template=<id>`. Σύνδεσμος που μοιράζεται, ανανέωση που κρατά τη θέση.
 * 🔑 Ανάγνωση για κάθε εσωτερικό μέλος (οι κανόνες το επιτρέπουν)· κάθε πράξη με δικαίωμα και ορατή αιτία όταν λείπει.
 * 🔴 ADR-744 §18 — το `procurement` ΔΕΝ είναι στο κέλυφος: το route slice καταχωρείται εδώ (το `page.tsx` είναι Server
 *    Component). Ό,τι κρίνει ή συγκρίνει (έλεγχος, λεπτομέρεια ρήτρας, μεταφράσεις) φτάνει με `import()`.
 */

import { useMemo } from 'react';
import { BookOpen } from 'lucide-react';
import { useCatalogSelection } from '@/components/catalog/shared/use-catalog-selection';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ListContainer, PageContainer } from '@/core/containers';
import { PageHeader } from '@/core/headers';
import { useSubcontractLibraryAuthority, type SubcontractLibraryAuthorityView } from '@/hooks/procurement/subcontracts/useSubcontractAuthority';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import routeSlice from '@/i18n/generated/routes/o__workspace__procurement__subcontracts__library.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';
import { ProcurementSubNav } from '@/subapps/procurement/components/ProcurementSubNav';
import type { LibraryActionContext } from '@/subapps/procurement/subcontracts/library/library-action-blocks';
import { ClausesTab } from './ClausesTab';
import { LibraryOnboarding, LibraryUpdateCheck, SeedReportNotice } from './LibraryOnboarding';
import { ReviewProgress } from './ReviewProgress';
import { ReviewTab } from './ReviewTab';
import { TemplatesTab } from './TemplatesTab';
import { useLibraryActions, type LibraryActions } from './useLibraryActions';
import { useLibrarySeed, type LibrarySeed } from './useLibrarySeed';
import { useLibraryScreen, type LibraryScreen } from './useLibraryScreen';

registerRouteSlice(routeSlice);

const TABS = ['review', 'clauses', 'templates'] as const;
type LibraryTab = (typeof TABS)[number];
const isTab = (value: string | null): value is LibraryTab => (TABS as readonly string[]).includes(value ?? '');

function TabCount({ count, tone }: { readonly count: number; readonly tone: 'warning' | 'outline' }) {
  return count > 0 ? <Badge variant={tone} className="ml-2">{count}</Badge> : null;
}

interface LibraryTabsProps {
  readonly screen: LibraryScreen;
  readonly authority: SubcontractLibraryAuthorityView;
  readonly actions: LibraryActions;
}

function LibraryTabs({ screen, authority, actions }: LibraryTabsProps) {
  const { t } = useTranslation('procurement');
  const tab = useCatalogSelection('tab');
  const clause = useCatalogSelection('clause');
  const template = useCatalogSelection('template');
  const active: LibraryTab = isTab(tab.selected) ? tab.selected : 'review';
  const context = useMemo<LibraryActionContext>(
    () => ({ actorUid: authority.actorUid, canManage: authority.canManageClauses, canPropose: authority.canPropose }),
    [authority.actorUid, authority.canManageClauses, authority.canPropose],
  );
  return (
    <Tabs value={active} onValueChange={(value) => tab.select(value)} className="flex min-h-0 flex-1 flex-col gap-2">
      <TabsList className="self-start">
        <TabsTrigger value="review">{t('subcontracts.library.tabs.review')}<TabCount count={screen.queue.length} tone="warning" /></TabsTrigger>
        <TabsTrigger value="clauses">{t('subcontracts.library.tabs.clauses')}</TabsTrigger>
        <TabsTrigger value="templates">{t('subcontracts.library.tabs.templates')}<TabCount count={screen.pendingTemplates.length} tone="outline" /></TabsTrigger>
      </TabsList>
      <TabsContent value="review" className="mt-0 flex min-h-0 flex-1">
        <ListContainer><ReviewTab screen={screen} context={context} actions={actions} selected={clause.selected} select={clause.select} onOpenInClauses={() => tab.select('clauses')} /></ListContainer>
      </TabsContent>
      <TabsContent value="clauses" className="mt-0 flex min-h-0 flex-1">
        <ListContainer><ClausesTab screen={screen} context={context} actions={actions} selected={clause.selected} select={clause.select} onOpenReview={() => tab.select('review')} /></ListContainer>
      </TabsContent>
      <TabsContent value="templates" className="mt-0 flex min-h-0 flex-1">
        <ListContainer><TemplatesTab screen={screen} authority={authority} actions={actions} selected={template.selected} select={template.select} /></ListContainer>
      </TabsContent>
    </Tabs>
  );
}

interface LibraryBodyProps {
  readonly screen: LibraryScreen;
  readonly authority: SubcontractLibraryAuthorityView;
  readonly actions: LibraryActions;
  readonly seed: LibrarySeed;
}

function LibraryBody({ screen, authority, actions, seed }: LibraryBodyProps) {
  const { t } = useTranslation('procurement');
  if (screen.state === 'loading') return <p className="m-0 px-2 text-muted-foreground" role="status">{t('subcontracts.library.loading')}</p>;
  if (screen.state === 'failed') return <p className="m-0 px-2 text-destructive" role="alert">{t('subcontracts.library.loadFailed')}</p>;
  if (screen.state === 'empty') {
    return <LibraryOnboarding clauseCount={screen.defaultClauseCount} templateCount={screen.defaultTemplateCount} canSeed={authority.canSeed} seed={seed} />;
  }
  return (
    <section className="flex min-h-0 flex-1 flex-col gap-3 px-2" aria-label={t('subcontracts.library.title')}>
      {seed.report && <SeedReportNotice report={seed.report} onDismiss={seed.dismiss} />}
      {screen.progress && screen.progress.counts.missing < screen.progress.total && <ReviewProgress progress={screen.progress} />}
      <LibraryTabs screen={screen} authority={authority} actions={actions} />
    </section>
  );
}

/** Κάθε δρόμος σποράς (κενή οθόνη · «Έλεγχος» · «Γράψε τα έτοιμα πρότυπα») περνά από τη **μία** πόρτα (`useLibrarySeed`). */
function useLibrarySeedActions() {
  const base = useLibraryActions();
  const seed = useLibrarySeed(base.seed);
  const actions = useMemo<LibraryActions>(() => ({ ...base, seed: seed.run }), [base, seed.run]);
  return { actions, seed };
}

export function SubcontractLibraryContent() {
  const { t } = useTranslation('procurement');
  const screen = useLibraryScreen();
  const authority = useSubcontractLibraryAuthority();
  const { actions, seed } = useLibrarySeedActions();
  const title = t('subcontracts.library.title');
  const headerActions = screen.state === 'ready' ? { customActions: [<LibraryUpdateCheck key="library-updates" canSeed={authority.canSeed} seed={seed} />] } : undefined;
  return (
    <PageContainer ariaLabel={title}>
      <div className="mt-2 px-2"><ProcurementSubNav className="mb-0" /></div>
      <PageHeader variant="sticky-rounded" layout="compact" spacing="compact" title={{ icon: BookOpen, title, subtitle: t('subcontracts.library.lead') }} actions={headerActions} />
      <LibraryBody screen={screen} authority={authority} actions={actions} seed={seed} />
    </PageContainer>
  );
}
