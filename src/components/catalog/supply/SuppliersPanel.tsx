'use client';

/**
 * @fileoverview **«Οι προμηθευτές μου»**, η πλευρά του αγοραστή (ADR-923 §5.12 Σ7): σε ποιους είναι συνδεδεμένος ο χώρος, με
 *   αποσύνδεση με ένα κλικ. Ο δρόμος προς αυτή τη λίστα είναι πρόσκληση ή σύνδεσμος του προμηθευτή: εδώ δεν υπάρχει
 *   αναζήτηση προμηθευτών, αυτή ανήκει στη βιτρίνα (§16 · Φάση 8).
 * @module components/catalog/supply/SuppliersPanel
 *
 * 🔒 `ended` χωρίς λόγο: ούτε ποιος έκλεισε, ούτε γιατί (Σ7).
 */

import React, { useState } from 'react';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { pricingLoadState } from '@/hooks/catalog/usePricingView';
import { useBuyerSupplyView } from '@/hooks/catalog/useSupplyViews';
import { endRelationshipAsBuyer } from '@/services/catalog/supply-api.client';
import type { BuyerRelationshipRow } from '@/subapps/catalog/types/supply-views';
import { useCatalogAccess, useCatalogText } from '../shared/catalog-ui-hooks';
import { BUYER_STATE_KEY } from './supply-labels';
import { useSupplyAction } from './use-supply-action';

export function SuppliersPanel() {
  const { t } = useCatalogText();
  const api = useBuyerSupplyView();
  const canManage = useCatalogAccess('pricing') === 'granted';
  const action = useSupplyAction(api.revalidate);
  const [ending, setEnding] = useState<BuyerRelationshipRow | null>(null);
  if (api.current.state !== 'ready') {
    return <p className="m-0 text-muted-foreground" role="status">{t(pricingLoadState(api.current) === 'failed' ? 'pricing.noView' : 'common.loading')}</p>;
  }
  const { relationships } = api.current.view;
  return (
    <section className="flex flex-col gap-2">
      {relationships.length === 0 ? <p className="m-0 text-muted-foreground">{t('supply.suppliers.empty')}</p> : null}
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {relationships.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
            <section className="min-w-0">
              <h3 className="m-0 truncate text-sm font-medium">{row.supplierName ?? t('supply.access.unnamedSupplier')}</h3>
              <p className="m-0 text-xs text-muted-foreground">
                {t(BUYER_STATE_KEY[row.state])}
                {row.customerRef ? ` · ${t('supply.customers.customerRef', { ref: row.customerRef })}` : ''}
              </p>
            </section>
            {canManage && row.state !== 'ended' ? (
              <Button size="sm" variant="outline" disabled={action.pending === row.id} onClick={() => setEnding(row)}>
                {t(row.state === 'active' ? 'supply.suppliers.disconnect' : 'supply.suppliers.cancelRequest')}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      <ConfirmDialog open={ending !== null} onOpenChange={(open) => { if (!open) setEnding(null); }} variant="warning"
        title={t('supply.suppliers.disconnectTitle')} description={t('supply.suppliers.disconnectBody')}
        confirmText={t('supply.suppliers.disconnect')} cancelText={t('common.cancel')}
        onConfirm={async () => {
          if (ending) await action.run(ending.id, () => endRelationshipAsBuyer(ending.id, ending.revision));
          setEnding(null);
        }} />
    </section>
  );
}
