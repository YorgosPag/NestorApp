'use client';

/**
 * @fileoverview **Ένας τιμοκατάλογος, ολόκληρος** — καρτέλες Γενικά · Εκδόσεις · Γραμμές + δημοσίευση (ADR-923 §5.11 «3δ» Τμήμα 1).
 * @related PriceListEditor.tsx (Γενικά) · VersionTimeline.tsx (Εκδόσεις) · PriceListLinesTab.tsx (Γραμμές) · PublishVersionDialog.tsx
 * @module components/catalog/pricing/PriceListWorkspace
 *
 * 🔑 **Κανένα πρόχειρο δεν χάνεται με αλλαγή καρτέλας**: οι καρτέλες μένουν προσαρτημένες (`forceMount`) και απλώς κρύβονται
 *    — το Radix θα αποσύνδεε την ανενεργή και μαζί το μισογραμμένο πλέγμα. Ο φύλακας μη αποθηκευμένων βλέπει **και τα δύο**
 *    πρόχειρα (φόρμα + πλέγμα).
 * 🔑 Νέος τιμοκατάλογος ⇒ μόνο «Γενικά»: εκδόσεις και γραμμές δεν υπάρχουν πριν υπάρξει η λίστα.
 * 🔑 Η δημοσίευση ζει **εδώ**, όχι σε μια καρτέλα: ανοίγει από τη χρονογραμμή **και** από το πλέγμα, με τον ίδιο διάλογο.
 */

import React, { useCallback, useEffect, useState } from 'react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { DiscountGroupWire, PriceListVersionWire } from '@/subapps/catalog/types/pricing-views';
import { useCatalogAccess, useCatalogText } from '../shared/catalog-ui-hooks';
import { summarizePriceList } from './price-list-summary';
import { PriceListEditor, type PriceListEditorProps } from './PriceListEditor';
import { defaultVersionId, PriceListLinesTab } from './PriceListLinesTab';
import { PublishVersionDialog } from './PublishVersionDialog';
import { usePriceVersionActions } from './use-price-version-actions';
import { VersionTimeline } from './VersionTimeline';

const TABS = ['general', 'versions', 'lines'] as const;
type Tab = (typeof TABS)[number];

const TAB_KEYS: Readonly<Record<Tab, string>> = {
  general: 'pricing.general.tab',
  versions: 'pricing.versions.tab',
  lines: 'pricing.lines.tab',
};

/** Καρτέλα κρυμμένη αλλά προσαρτημένη — το πρόχειρό της επιβιώνει της αλλαγής καρτέλας. */
const KEPT_TAB = 'data-[state=inactive]:hidden';

export interface PriceListWorkspaceProps extends Omit<PriceListEditorProps, 'reportDirty'> {
  readonly versions: readonly PriceListVersionWire[];
  readonly nowMs: number;
  readonly discountGroups: readonly DiscountGroupWire[];
  /** Ανανέωση της όψης λιστών στο παρασκήνιο μετά από πράξη έκδοσης. */
  readonly revalidate: () => Promise<void>;
  readonly reportDirty: (dirty: boolean) => void;
}

/** Δύο πρόχειρα (φόρμα · πλέγμα), ένας φύλακας. */
function useCombinedDirty(reportDirty: (dirty: boolean) => void) {
  const [form, setForm] = useState(false);
  const [lines, setLines] = useState(false);
  useEffect(() => reportDirty(form || lines), [form, lines, reportDirty]);
  return { reportForm: setForm, reportLines: setLines };
}

export function PriceListWorkspace(props: PriceListWorkspaceProps) {
  const { t } = useCatalogText();
  const { record, versions, nowMs, revalidate } = props;
  const dirty = useCombinedDirty(props.reportDirty);
  const [tab, setTab] = useState<Tab>('general');
  const [chosenVersion, setChosenVersion] = useState<string | null>(null);
  // Το id, όχι το στιγμιότυπο: ο διάλογος παίρνει πάντα τη ΖΩΝΤΑΝΗ έκδοση (νέα αναθεώρηση μετά το «ισχύει από»).
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const actions = usePriceVersionActions(record?.id ?? '', revalidate);
  const canManage = useCatalogAccess('pricing') === 'granted';
  const canPublish = useCatalogAccess('pricingPublish') === 'granted';
  const onChanged = useCallback(() => { void revalidate(); }, [revalidate]);
  const editor = <PriceListEditor {...props} reportDirty={dirty.reportForm} />;
  if (record === null) return editor;
  const summary = summarizePriceList(record.id, versions, nowMs);
  const versionId = chosenVersion ?? defaultVersionId(summary);
  const openLines = (id: string) => { setChosenVersion(id); setTab('lines'); };
  const own = versions.filter((version) => version.priceListId === record.id);
  const publishing = own.find((version) => version.id === publishingId) ?? null;
  const publish = (version: PriceListVersionWire) => setPublishingId(version.id);
  return (
    <Tabs value={tab} onValueChange={(next) => { const match = TABS.find((item) => item === next); if (match) setTab(match); }} className="flex flex-col gap-0">
      <TabsList className="mx-4 mt-4 flex-wrap justify-start">
        {TABS.map((item) => <TabsTrigger key={item} value={item}>{t(TAB_KEYS[item])}</TabsTrigger>)}
      </TabsList>
      <TabsContent value="general" forceMount className={KEPT_TAB}>{editor}</TabsContent>
      <TabsContent value="versions" forceMount className={KEPT_TAB}>
        <VersionTimeline priceListId={record.id} versions={versions} nowMs={nowMs} canManage={canManage} canPublish={canPublish}
          actions={actions} onOpenLines={openLines} onPublish={publish} />
      </TabsContent>
      <TabsContent value="lines" forceMount className={KEPT_TAB}>
        <PriceListLinesTab list={record} summary={summary} versionId={versionId} onVersion={setChosenVersion} discountGroups={props.discountGroups}
          canManage={canManage} canPublish={canPublish} reportDirty={dirty.reportLines} onPublish={publish} />
      </TabsContent>
      {publishing ? <PublishVersionDialog version={publishing} versions={own} onChanged={onChanged} onClose={() => setPublishingId(null)} /> : null}
    </Tabs>
  );
}
