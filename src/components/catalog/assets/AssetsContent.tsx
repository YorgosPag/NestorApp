'use client';

/**
 * @fileoverview **Η σελίδα «Βιβλιοθήκη μέσων» του καταλόγου** (ADR-923 §5.10 Δ9 · §5.10.4).
 * @module components/catalog/assets/AssetsContent
 *
 * 🔑 **Το μέσο είναι οντότητα, όχι αρχείο** (Akeneo Asset Manager · Salsify DAM): κωδικός, ρόλος, δικαιώματα και ένας
 *    δείκτης στο τρέχον αρχείο. Τα προϊόντα δείχνουν το μέσο· νέα έκδοση αρχείου δεν τα αγγίζει.
 * 🔑 Η εισαγωγή ζει **εδώ** (`useAssetIntake`), όχι στο φύλλο: το φύλλο κλείνει, τα ανεβάσματα συνεχίζουν, και ο
 *    επεξεργαστής ξέρει ότι τρέχει νέα έκδοση για το μέσο του (κλειδωμένο κουμπί, όχι δεύτερη αποστολή).
 * 🔑 Η επιλογή ζει στη διεύθυνση (`?asset=<id>`).
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Images, Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useCatalogAssetFiles } from '@/hooks/catalog/useCatalogAssetFiles';
import { useCatalogCollection } from '@/hooks/catalog/useCatalogCollection';
import { useCatalogOptimistic } from '@/hooks/catalog/useCatalogOptimistic';
import { compareByLocale } from '@/lib/intl-formatting';
import { useCatalogCanManageProducts, useCatalogFailureNotice, useCatalogText } from '../shared/catalog-ui-hooks';
import { CatalogPageFrame } from '../shared/CatalogPageFrame';
import { CatalogSplit } from '../shared/CatalogSplit';
import { useCatalogSelection } from '../shared/use-catalog-selection';
import { useUnsavedGuard } from '../shared/use-unsaved-guard';
import { AssetEditor } from './AssetEditor';
import { AssetIntakeSheet } from './AssetIntakeSheet';
import { AssetLibraryList } from './AssetLibraryList';
import { useAssetIntake } from './use-asset-intake';

function useAssets() {
  const notice = useCatalogFailureNotice();
  const collection = useCatalogCollection('CATALOG_ASSETS');
  const ops = useCatalogOptimistic(collection.items, notice);
  const files = useCatalogAssetFiles();
  const { text, language } = useCatalogText();
  const sorted = useMemo(() => [...ops.view].sort((a, b) => compareByLocale(text(a.labels, a.code), text(b.labels, b.code))), [ops.view, text]);
  const intake = useAssetIntake(ops, language);
  return { ops, files, sorted, intake, state: collection.state };
}

export function AssetsContent() {
  const { t, text } = useCatalogText();
  const { ops, files, sorted, intake, state } = useAssets();
  const canManage = useCatalogCanManageProducts();
  const unsaved = useUnsavedGuard();
  const [intakeOpen, setIntakeOpen] = useState(false);
  const replaceSequence = useRef(0);
  const { selected, select, key: session } = useCatalogSelection('asset');
  const choose = useCallback((id: string | null) => unsaved.guard(() => select(id)), [unsaved, select]);
  const record = selected ? ops.settled.find((asset) => asset.id === selected) ?? null : null;
  const takenCodes = useMemo(() => new Set(ops.view.map((asset) => asset.code)), [ops.view]);
  // Η τελευταία πράξη αρχείου για αυτό το μέσο (εισαγωγή ή νέα έκδοση) — η κατάστασή της φαίνεται και στον επεξεργαστή.
  const fileRow = record ? [...intake.rows].reverse().find((row) => row.asset?.id === record.id) ?? null : null;
  return (
    <CatalogPageFrame
      title={t('pages.assets.title')}
      lead={t('pages.assets.lead')}
      state={state}
      actions={canManage ? <Button type="button" onClick={() => setIntakeOpen(true)}><Upload className="mr-1 h-4 w-4" aria-hidden />{t('assets.intake.open')}</Button> : null}
    >
      <CatalogSplit
        listLabel={t('pages.assets.title')}
        list={<AssetLibraryList assets={sorted} files={files} selectedId={selected} pendingKeys={ops.pendingKeys} onSelect={choose} />}
        open={record !== null}
        title={record ? text(record.labels, record.code) : ''}
        onClose={() => choose(null)}
        empty={{ icon: Images, title: t('assets.emptyTitle'), description: t('assets.emptyDescription') }}
        details={record ? (
          <AssetEditor
            key={session}
            record={record}
            current={record.fileId ? files.byId.get(record.fileId) ?? null : null}
            versions={files.byAsset.get(record.id) ?? []}
            ops={ops}
            canManage={canManage}
            fileRow={fileRow}
            onReplaceFile={(file) => void intake.replaceFile(record, file, `replace-${(replaceSequence.current += 1)}`)}
            onRetryFile={(row) => void intake.start([row], null)}
            onRefreshRenditions={() => void intake.refreshRenditions(record, `refresh-${(replaceSequence.current += 1)}`)}
            onDeleted={() => select(null)}
            reportDirty={unsaved.reportDirty}
          />
        ) : null}
      />
      {canManage ? <AssetIntakeSheet open={intakeOpen} onOpenChange={setIntakeOpen} intake={intake} takenCodes={takenCodes} /> : null}
      {unsaved.dialog}
    </CatalogPageFrame>
  );
}
