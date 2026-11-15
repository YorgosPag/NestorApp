'use client';

/**
 * @fileoverview ADR-915 §41.5 — **οι καρτέλες του μητρώου** (`?tab=`): «Χρειάζονται ενέργεια» · «Όλα τα έγγραφα» · «Προς απόφαση».
 * @related lib/document-validity/document-registry-view.ts (καρτέλες · `rowsOfActionTab`) · RegistryAllTab.tsx ·
 *   RegistryUpkeepPanel.tsx (αμετάβλητο — κοινό με την καρτέλα ακινήτου)
 * @module components/document-registry/RegistryTabs
 *
 * 🏆 Drata: ο πίνακας ελέγχου = **εισερχόμενα**, η βιβλιοθήκη = **πλήρες μητρώο**, ένα λεξιλόγιο. Εδώ επιπλέον τα
 *    εισερχόμενα ταξινομούνται κατά το **πότε μπλοκάρει συναλλαγή**, όχι κατά λήξη (§41.3).
 * 🔑 Οι **αποφάσεις** (προτάσεις μόνιμης υποχρέωσης) φεύγουν από την κορυφή: έκρυβαν το μητρώο (3.940 px, §41.1).
 */

import React, { useMemo } from 'react';

import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatNumber } from '@/lib/intl-formatting';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  isRegistryTab,
  REGISTRY_TABS,
  registryTabTally,
  rowsOfActionTab,
} from '@/lib/document-validity/document-registry-view';
import type { UpkeepDeclarationSubmit } from '@/hooks/document-registry/useUpkeepDeclaration';
import type { RegistryAddress } from '@/hooks/document-registry/useRegistryAddress';
import type { DocumentRegistryResponse } from '@/services/document-registry/document-registry.types';
import { RegistryAllTab } from '@/components/document-registry/RegistryAllTab';
import { RegistryTable } from '@/components/document-registry/RegistryTable';
import { RegistryUpkeepPanel } from '@/components/document-registry/RegistryUpkeepPanel';
import { LAYOUT_KEYS, REGISTRY_TAB_LABEL_KEYS } from '@/components/document-registry/registry-layout-labels';
import { CONVEYANCE_NS, LEGALITY_NS, REGISTRY_NS } from '@/components/document-registry/document-registry-labels';

function ActionTab({ registry, onOpen }: { readonly registry: DocumentRegistryResponse; readonly onOpen: (id: string) => void }) {
  const { t } = useTranslation([REGISTRY_NS, CONVEYANCE_NS, LEGALITY_NS]);
  const rows = useMemo(() => rowsOfActionTab(registry.rows, registry.asOf), [registry]);
  if (rows.length === 0) {
    return (
      <section className="flex flex-col gap-1">
        <p className="m-0 font-medium text-foreground">{t(LAYOUT_KEYS.actionEmpty)}</p>
        <p className="m-0 text-sm text-muted-foreground">{t(LAYOUT_KEYS.actionEmptyHint)}</p>
      </section>
    );
  }
  return <RegistryTable rows={rows} registry={registry} onOpen={onOpen} />;
}

export interface RegistryTabsProps {
  readonly registry: DocumentRegistryResponse;
  readonly address: RegistryAddress;
  readonly upkeep: UpkeepDeclarationSubmit;
  readonly canDecide: boolean;
}

export function RegistryTabs({ registry, address, upkeep, canDecide }: RegistryTabsProps): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS, CONVEYANCE_NS, LEGALITY_NS]);
  const pendingDecisions = useMemo(() => registry.upkeep.filter((item) => item.declaration === null).length, [registry.upkeep]);
  const tally = useMemo(() => registryTabTally(registry.rows, pendingDecisions), [registry.rows, pendingDecisions]);
  return (
    <Tabs value={address.tab} onValueChange={(next) => { if (isRegistryTab(next)) address.selectTab(next); }} className="flex flex-col gap-4">
      <TabsList aria-label={t(LAYOUT_KEYS.tabsLabel)}>
        {REGISTRY_TABS.map((tab) => (
          <TabsTrigger key={tab} value={tab} className="gap-2">
            {t(REGISTRY_TAB_LABEL_KEYS[tab])}
            {/* Ο αριθμός είναι ΣΗΜΑ δίπλα στην ετικέτα (Drata · Linear), όχι μέρος του μηνύματος: κανένα «1 έγγραφα». */}
            <Badge variant={tab === 'action' && tally[tab] > 0 ? 'error' : 'muted'}>{formatNumber(tally[tab])}</Badge>
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="action">
        <ActionTab registry={registry} onOpen={address.openDoc} />
      </TabsContent>
      <TabsContent value="all">
        <RegistryAllTab
          registry={registry} view={address.view} grouping={address.grouping}
          onView={address.selectView} onGrouping={address.selectGrouping} onOpen={address.openDoc}
        />
      </TabsContent>
      <TabsContent value="decisions">
        {registry.upkeep.length === 0
          ? <p className="m-0 text-sm text-muted-foreground">{t(LAYOUT_KEYS.decisionsEmpty)}</p>
          : <RegistryUpkeepPanel registry={registry} declaration={upkeep} canDecide={canDecide} />}
      </TabsContent>
    </Tabs>
  );
}
