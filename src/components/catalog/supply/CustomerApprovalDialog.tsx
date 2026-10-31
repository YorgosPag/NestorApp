'use client';

/**
 * @fileoverview **Έγκριση αιτήματος σύνδεσης** (ADR-923 §5.12 Σ2 πόρτα β · Σ6): δέσιμο με επαφή, κατάταξη σε ομάδα, ατομικά.
 * @related server/supply-relationships/supply-relationship-writer.server.ts
 * @module components/catalog/supply/CustomerApprovalDialog
 *
 * 🔑 Ο αριθμός πελάτη είναι **αυτοδήλωση** του αγοραστή και εδώ λέγεται ως τέτοιος: εκείνος που τον κρίνει είναι ο προμηθευτής.
 * 🔑 Η επαφή είναι προαιρετική αλλά σημαντική: χωρίς αυτήν, κάθε έκπτωση σε επαφή δεν φτάνει αυτόν τον πελάτη (Σ6).
 */

import React, { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { approveSupplyRequest } from '@/services/catalog/supply-api.client';
import type { PricingPartyRef } from '@/subapps/catalog/types/price-list';
import type { CustomerGroupWire } from '@/subapps/catalog/types/pricing-views';
import type { SupplierRelationshipRow } from '@/subapps/catalog/types/supply-views';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import { PricingPartyPicker } from '../pricing/PricingPartyPicker';
import { CustomerGroupSelect } from './CustomerGroupSelect';
import type { SupplyAction } from './use-supply-action';

const NO_ISSUES: readonly never[] = [];

interface CustomerApprovalDialogProps {
  readonly row: SupplierRelationshipRow | null;
  readonly onClose: () => void;
  readonly groups: readonly CustomerGroupWire[];
  readonly action: SupplyAction;
}

export function CustomerApprovalDialog({ row, onClose, groups, action }: CustomerApprovalDialogProps) {
  const { t } = useCatalogText();
  const [party, setParty] = useState<PricingPartyRef | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);
  const rowId = row?.id ?? null;
  useEffect(() => { setParty(null); setGroupId(null); }, [rowId]);
  const busy = row !== null && action.pending === row.id;

  const approve = async () => {
    if (row === null) return;
    const supplierContactId = party?.kind === 'contact' ? party.contactId : null;
    const done = await action.run(row.id, () => approveSupplyRequest(row.id, { expectedRevision: row.revision, supplierContactId, customerGroupId: groupId }));
    if (done) onClose();
  };

  return (
    <Dialog open={row !== null} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('supply.customers.approveTitle', { buyer: row?.buyerName ?? t('supply.customers.unnamedBuyer') })}</DialogTitle>
          <DialogDescription>
            {row?.customerRef ? t('supply.customers.approveDeclaredRef', { ref: row.customerRef }) : t('supply.customers.approveNoRef')}
          </DialogDescription>
        </DialogHeader>
        <PricingPartyPicker value={party} onChange={setParty} disabled={busy} issues={NO_ISSUES} path="supplierContactId" />
        <p className="m-0 text-xs text-muted-foreground">{t('supply.customers.approveContactHint')}</p>
        <CustomerGroupSelect groups={groups} value={groupId} onChange={setGroupId} disabled={busy} />
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onClose}>{t('common.cancel')}</Button>
          <Button disabled={busy} aria-busy={busy} onClick={() => void approve()}>{t('supply.customers.approve')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
