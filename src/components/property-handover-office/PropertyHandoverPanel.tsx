'use client';

/**
 * @fileoverview **Η καρτέλα «Παράδοση» του γραφείου** — φέρνει την απάντηση της πόρτας και τη δείχνει (ADR-916 §5.15 Φ-Δ).
 * @related hooks/property-handover/usePropertyHandover · PropertyHandoverView.tsx (η όψη)
 * @module components/property-handover-office/PropertyHandoverPanel
 *
 * ⚠️ **Η αποτυχία ΔΕΝ είναι «καμία παράδοση»**: «δεν φορτώθηκαν» με «Δοκιμάστε ξανά» ≠ «δεν υπάρχει παράδοση ακόμη».
 *    Μια οθόνη που λέει «τίποτα» επειδή έπεσε μια κλήση λέει ψέματα με σιγουριά.
 */

import React from 'react';

import { COLOR_BRIDGE } from '@/design-system/color-bridge';
import { useHandoverOfficeActions } from '@/hooks/property-handover/useHandoverOfficeActions';
import { usePropertyHandover } from '@/hooks/property-handover/usePropertyHandover';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';

import { PropertyHandoverView } from './PropertyHandoverView';

const K = 'properties-detail:handover';

function PanelBody({ propertyId }: { readonly propertyId: string }): React.ReactElement {
  const { t } = useTranslation(['properties-detail']);
  const { view, reload } = usePropertyHandover(propertyId);
  const actions = useHandoverOfficeActions(propertyId, reload);
  if (view.kind === 'loading') return <p role="status" className="m-0 text-sm text-muted-foreground">{t(`${K}.loading`)}</p>;
  if (view.kind === 'unavailable') return <p className="m-0 text-sm text-muted-foreground">{t(`${K}.unavailable`)}</p>;
  if (view.kind === 'failed') {
    return (
      <p role="alert" className="m-0 flex flex-wrap items-center gap-2 text-sm text-foreground">
        {t(`${K}.failed`)}
        <button type="button" onClick={reload} className={cn('rounded-md px-3 py-1.5 text-sm font-medium', COLOR_BRIDGE.action.secondary)}>
          {t(`${K}.retry`)}
        </button>
      </p>
    );
  }
  return <PropertyHandoverView preview={view.preview} actions={actions} />;
}

export function PropertyHandoverPanel({ propertyId }: { readonly propertyId: string }): React.ReactElement {
  const { t } = useTranslation(['properties-detail']);
  const titleId = React.useId();
  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h2 id={titleId} className="m-0 text-lg font-semibold text-foreground">{t(`${K}.title`)}</h2>
        <p className="m-0 text-sm text-muted-foreground">{t(`${K}.intro`)}</p>
      </header>
      <PanelBody propertyId={propertyId} />
    </section>
  );
}
