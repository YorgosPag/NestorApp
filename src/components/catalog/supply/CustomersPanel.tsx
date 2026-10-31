'use client';

/**
 * @fileoverview **«Οι πελάτες μου»**, η πλευρά του προμηθευτή (ADR-923 §5.12 Σ2 · Σ7): αιτήματα · ενεργές σχέσεις · εκκρεμείς
 *   προσκλήσεις · ο σύνδεσμος/QR.
 * @related CustomerApprovalDialog.tsx · InviteCustomerDialog.tsx · SupplyLinkCard.tsx
 * @module components/catalog/supply/CustomersPanel
 *
 * ⛔ Κανένα πεδίο «χώρος» πουθενά (Σ3): ο προμηθευτής ξεκινά από **επαφή του** ή περιμένει αίτημα.
 */

import React, { useState } from 'react';
import { Send } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useDiscountsView } from '@/hooks/catalog/usePriceListViews';
import { pricingLoadState } from '@/hooks/catalog/usePricingView';
import { useSupplierSupplyView } from '@/hooks/catalog/useSupplyViews';
import {
  declineSupplyRequest,
  endRelationshipAsSupplier,
  revokeSupplyInvitation,
} from '@/services/catalog/supply-api.client';
import type { SupplierRelationshipRow, SupplierSupplyView } from '@/subapps/catalog/types/supply-views';
import { useCatalogAccess, useCatalogText } from '../shared/catalog-ui-hooks';
import { CustomerApprovalDialog } from './CustomerApprovalDialog';
import { InviteCustomerDialog } from './InviteCustomerDialog';
import { SUPPLIER_STATE_KEY } from './supply-labels';
import { SupplyLinkCard } from './SupplyLinkCard';
import { useSupplyAction, type SupplyAction } from './use-supply-action';

const NO_GROUPS: readonly never[] = [];

interface RowProps {
  readonly row: SupplierRelationshipRow;
  readonly action: SupplyAction;
  readonly canManage: boolean;
  readonly onApprove: (row: SupplierRelationshipRow) => void;
  readonly onEnd: (row: SupplierRelationshipRow) => void;
}

function RelationshipRow({ row, action, canManage, onApprove, onEnd }: RowProps) {
  const { t } = useCatalogText();
  const busy = action.pending === row.id;
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
      <section className="min-w-0">
        <h4 className="m-0 truncate text-sm font-medium">{row.buyerName ?? t('supply.customers.unnamedBuyer')}</h4>
        <p className="m-0 text-xs text-muted-foreground">
          {t(SUPPLIER_STATE_KEY[row.state])}
          {row.contactName ? ` · ${row.contactName}` : ''}
          {row.customerRef ? ` · ${t('supply.customers.customerRef', { ref: row.customerRef })}` : ''}
        </p>
      </section>
      {canManage ? (
        <nav className="flex gap-2" aria-label={t('common.actions')}>
          {row.state === 'requested' ? (
            <>
              <Button size="sm" disabled={busy} onClick={() => onApprove(row)}>{t('supply.customers.approve')}</Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => void action.run(row.id, () => declineSupplyRequest(row.id, row.revision))}>
                {t('supply.customers.decline')}
              </Button>
            </>
          ) : null}
          {row.state === 'active' ? <Button size="sm" variant="outline" disabled={busy} onClick={() => onEnd(row)}>{t('supply.customers.disconnect')}</Button> : null}
        </nav>
      ) : null}
    </li>
  );
}

function RelationshipSection({ title, rows, ...rest }: Omit<RowProps, 'row'> & { readonly title: string; readonly rows: readonly SupplierRelationshipRow[] }) {
  if (rows.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h3 className="m-0 text-sm font-semibold">{title}</h3>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {rows.map((row) => <RelationshipRow key={row.id} row={row} {...rest} />)}
      </ul>
    </section>
  );
}

function PendingInvitations({ view, action, canManage }: { readonly view: SupplierSupplyView; readonly action: SupplyAction; readonly canManage: boolean }) {
  const { t } = useCatalogText();
  if (view.invitations.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h3 className="m-0 text-sm font-semibold">{t('supply.customers.invitations')}</h3>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {view.invitations.map((invitation) => (
          <li key={invitation.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
            <section className="min-w-0">
              <h4 className="m-0 truncate text-sm font-medium">{invitation.contactName ?? invitation.inviteeEmail}</h4>
              <p className="m-0 text-xs text-muted-foreground">
                {invitation.inviteeEmail} · {t(invitation.state === 'expired' ? 'supply.customers.invitationExpired' : 'supply.customers.invitationPending')}
              </p>
            </section>
            {canManage ? (
              <Button size="sm" variant="outline" disabled={action.pending === invitation.id} onClick={() => void action.run(invitation.id, () => revokeSupplyInvitation(invitation.id))}>
                {t('supply.customers.cancelInvitation')}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function CustomersPanel() {
  const { t } = useCatalogText();
  const api = useSupplierSupplyView();
  const groupsApi = useDiscountsView();
  const canManage = useCatalogAccess('pricing') === 'granted';
  const action = useSupplyAction(api.revalidate);
  const [inviting, setInviting] = useState(false);
  const [approving, setApproving] = useState<SupplierRelationshipRow | null>(null);
  const [ending, setEnding] = useState<SupplierRelationshipRow | null>(null);
  const load = pricingLoadState(api.current);
  if (api.current.state !== 'ready') return <p className="m-0 text-muted-foreground" role="status">{t(load === 'failed' ? 'pricing.noView' : 'common.loading')}</p>;

  const { view } = api.current;
  const groups = groupsApi.current.state === 'ready' ? groupsApi.current.view.customerGroups : NO_GROUPS;
  const rowsIn = (...states: readonly SupplierRelationshipRow['state'][]) => view.relationships.filter((row) => states.includes(row.state));
  const shared = { action, canManage, onApprove: setApproving, onEnd: setEnding };
  const nothing = view.relationships.length === 0 && view.invitations.length === 0;
  return (
    <section className="flex flex-col gap-4">
      {canManage ? <Button className="self-start" onClick={() => setInviting(true)}><Send aria-hidden="true" />{t('supply.customers.invite')}</Button> : null}
      {nothing ? <p className="m-0 text-muted-foreground">{t('supply.customers.empty')}</p> : null}
      <RelationshipSection title={t('supply.customers.requests')} rows={rowsIn('requested')} {...shared} />
      <RelationshipSection title={t('supply.customers.active')} rows={rowsIn('active')} {...shared} />
      <PendingInvitations view={view} action={action} canManage={canManage} />
      <RelationshipSection title={t('supply.customers.ended')} rows={rowsIn('declined', 'revoked')} {...shared} />
      <SupplyLinkCard link={view.link} action={action} canManage={canManage} />
      <InviteCustomerDialog open={inviting} onOpenChange={setInviting} groups={groups} action={action} />
      <CustomerApprovalDialog row={approving} onClose={() => setApproving(null)} groups={groups} action={action} />
      <ConfirmDialog open={ending !== null} onOpenChange={(open) => { if (!open) setEnding(null); }} variant="warning"
        title={t('supply.customers.disconnectTitle')} description={t('supply.customers.disconnectBody')}
        confirmText={t('supply.customers.disconnect')} cancelText={t('common.cancel')}
        onConfirm={async () => {
          if (ending) await action.run(ending.id, () => endRelationshipAsSupplier(ending.id, ending.revision));
          setEnding(null);
        }} />
    </section>
  );
}
