'use client';

/**
 * @fileoverview **Πρόσκληση πελάτη από επαφή** (ADR-923 §5.12 Σ2 πόρτα α), με προαιρετική προέγκριση σε ομάδα.
 * @related server/supply-relationships/supply-invitation-issue.server.ts
 * @module components/catalog/supply/InviteCustomerDialog
 *
 * 🔑 Ξεκινά από **επαφή** του προμηθευτή, ποτέ από χώρο (Σ3). Η έκβαση του email λέγεται τίμια: «δεν έφυγε» δεν σημαίνει
 *    ότι η πρόσκληση χάθηκε, και το «ξαναστείλτε» είναι μία νέα έκδοση.
 */

import React, { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useNotifications } from '@/providers/NotificationProvider';
import { inviteSupplyCustomer } from '@/services/catalog/supply-api.client';
import type { PricingPartyRef } from '@/subapps/catalog/types/price-list';
import type { CustomerGroupWire } from '@/subapps/catalog/types/pricing-views';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import { PricingPartyPicker } from '../pricing/PricingPartyPicker';
import { CustomerGroupSelect } from './CustomerGroupSelect';
import { SUPPLY_DELIVERY_KEY } from './supply-labels';
import type { SupplyAction } from './use-supply-action';

const NO_ISSUES: readonly never[] = [];
const ACTION_KEY = 'invite';

interface InviteCustomerDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly groups: readonly CustomerGroupWire[];
  readonly action: SupplyAction;
}

export function InviteCustomerDialog({ open, onOpenChange, groups, action }: InviteCustomerDialogProps) {
  const { t } = useCatalogText();
  const { success, warning } = useNotifications();
  const [party, setParty] = useState<PricingPartyRef | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);
  const busy = action.pending === ACTION_KEY;
  const contactId = party?.kind === 'contact' ? party.contactId : null;

  const close = () => { setParty(null); setGroupId(null); onOpenChange(false); };
  const send = async () => {
    if (contactId === null) return;
    const done = await action.run(ACTION_KEY, async () => {
      const issued = await inviteSupplyCustomer(contactId, groupId);
      (issued.delivery === 'accepted' ? success : warning)(t(SUPPLY_DELIVERY_KEY[issued.delivery]));
    });
    if (done) close();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) close(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('supply.customers.inviteTitle')}</DialogTitle>
          <DialogDescription>{t('supply.customers.inviteBody')}</DialogDescription>
        </DialogHeader>
        <PricingPartyPicker value={party} onChange={setParty} disabled={busy} issues={NO_ISSUES} path="contactId" />
        <CustomerGroupSelect groups={groups} value={groupId} onChange={setGroupId} disabled={busy} />
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={close}>{t('common.cancel')}</Button>
          <Button disabled={busy || contactId === null} aria-busy={busy} onClick={() => void send()}>{t('supply.customers.send')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
