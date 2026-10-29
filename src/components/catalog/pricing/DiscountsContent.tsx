'use client';

/**
 * @fileoverview **Η σελίδα «Εκπτώσεις»** — πίνακας συνθηκών (SAP condition table) + ομάδες έκπτωσης και ομάδες πελατών
 *   (ADR-923 §5.11 «3δ» Τμήμα 2).
 * @related ConditionsPanel.tsx · PricingGroupsPanel.tsx · use-discounts-workspace.ts · PriceListsContent.tsx (η αδελφή σελίδα)
 * @module components/catalog/pricing/DiscountsContent
 *
 * 🔑 **Οι εκπτώσεις ΜΟΝΟ από τον διακομιστή** (απόφαση Ζ): μία όψη `discounts`, ζωντανή με το σήμα της.
 * 🔑 **Καρτέλα, συνθήκη και ομάδα ζουν στη διεύθυνση** (`?tab=groups&group=customerGroup:wholesale` · `?condition=<id>`): ο
 *    σύνδεσμος «δες αυτή την έκπτωση» ανοίγει ακριβώς εκεί. Η αλλαγή καρτέλας περνά από τον φύλακα μη αποθηκευμένων — η
 *    καρτέλα που φεύγει αποσυνδέεται, και μαζί το πρόχειρό της.
 * 🔑 **Χωρίς δικαίωμα προβολής** ⇒ το **δικό** μας μήνυμα (`pricing.noView`), όχι γενικό «δεν φορτώθηκε».
 */

import React from 'react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { pricingLoadState } from '@/hooks/catalog/usePricingView';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import { CatalogPageFrame } from '../shared/CatalogPageFrame';
import { useCatalogSelection } from '../shared/use-catalog-selection';
import { useUnsavedGuard } from '../shared/use-unsaved-guard';
import { ConditionsPanel } from './ConditionsPanel';
import { PricingGroupsPanel } from './PricingGroupsPanel';
import { useDiscountsWorkspace } from './use-discounts-workspace';

// 🔴 ADR-744 §18 — το `catalog` ΔΕΝ είναι στο κέλυφος: χωρίς το slice, ωμά κλειδιά στο πρώτο καρέ.
import routeSlice from '@/i18n/generated/routes/o__workspace__catalog__discounts.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

registerRouteSlice(routeSlice);

const TABS = ['conditions', 'groups'] as const;
type Tab = (typeof TABS)[number];

const TAB_KEYS: Readonly<Record<Tab, string>> = {
  conditions: 'pricing.discounts.tabs.conditions',
  groups: 'pricing.discounts.tabs.groups',
};

/** Η προεπιλεγμένη καρτέλα δεν γράφεται στη διεύθυνση (καθαρός σύνδεσμος). */
const DEFAULT_TAB: Tab = 'conditions';

const tabOf = (value: string | null): Tab => TABS.find((tab) => tab === value) ?? DEFAULT_TAB;

export function DiscountsContent() {
  const { t } = useCatalogText();
  const workspace = useDiscountsWorkspace();
  const unsaved = useUnsavedGuard();
  const tabSelection = useCatalogSelection('tab');
  const conditionSelection = useCatalogSelection('condition');
  const groupSelection = useCatalogSelection('group');
  const tab = tabOf(tabSelection.selected);
  const chooseTab = (next: string) => unsaved.guard(() => tabSelection.select(next === DEFAULT_TAB ? null : tabOf(next)));
  return (
    <CatalogPageFrame
      title={t('pages.discounts.title')}
      lead={t('pages.discounts.lead')}
      state={workspace.forbidden ? 'ready' : pricingLoadState(workspace.api.current)}
    >
      {workspace.forbidden || workspace.view === null ? (
        <p className="m-0 text-muted-foreground" role="status">{t('pricing.noView')}</p>
      ) : (
        <Tabs value={tab} onValueChange={chooseTab} className="flex min-h-0 flex-1 flex-col gap-3">
          <TabsList className="self-start">
            {TABS.map((item) => <TabsTrigger key={item} value={item}>{t(TAB_KEYS[item])}</TabsTrigger>)}
          </TabsList>
          <TabsContent value="conditions" className="mt-0 flex min-h-0 flex-1 flex-col">
            <ConditionsPanel workspace={workspace} selection={conditionSelection} unsaved={unsaved} />
          </TabsContent>
          <TabsContent value="groups" className="mt-0 flex min-h-0 flex-1 flex-col">
            <PricingGroupsPanel workspace={workspace} selection={groupSelection} unsaved={unsaved} />
          </TabsContent>
        </Tabs>
      )}
      {unsaved.dialog}
    </CatalogPageFrame>
  );
}
