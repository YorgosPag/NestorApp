'use client';

/**
 * @fileoverview **Η διατήρηση μιας έκδοσης στην οθόνη** — πότε σβήνεται το PDF, δέσμευση, χειροκίνητη διαγραφή, απόδειξη διάθεσης
 *   (ADR-923 §5.6.1).
 * @related subapps/catalog/publishing/publication-retention.ts (η ίδια κρίση με τον διακομιστή)
 * @module components/catalog/publishing/PublicationRunRetention
 *
 * 🔑 **Η ημερομηνία φαίνεται από πριν**: ο άνθρωπος βλέπει πότε θα σβηστεί κάτι και προλαβαίνει να το δεσμεύσει.
 * 🔑 Τα κουμπιά ακολουθούν την ίδια κρίση με τον διακομιστή· ο διακομιστής ξαναρωτά, γιατί το κουμπί είναι UX, όχι ασφάλεια.
 */

import React, { useCallback, useId, useState } from 'react';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { HOLD_REASON_MAX_LENGTH, holdReasonOf } from '@/lib/files/file-hold';
import { formatDate } from '@/lib/intl-formatting';
import { catalogFailureOf } from '@/services/catalog/catalog-failure';
import { deletePublicationPdf, setPublicationLegalHold } from '@/services/catalog/catalog-publishing-api.client';
import { canDeletePublicationByHand, canHoldPublication } from '@/subapps/catalog/publishing/publication-retention';
import type { PublicationRunWire } from '@/subapps/catalog/types/publication';
import { useCatalogAccess, useCatalogFailureNotice, useCatalogText } from '../shared/catalog-ui-hooks';

const FINGERPRINT_LENGTH = 12;

export interface PublicationRunRetentionProps {
  readonly run: PublicationRunWire;
  readonly revalidate: () => Promise<void>;
}

/** Μία πράξη διατήρησης: ίδια αποτυχία, ίδια ανανέωση της όψης. */
function useRetentionAction(revalidate: () => Promise<void>) {
  const notifyFailure = useCatalogFailureNotice();
  return useCallback(async (act: () => Promise<unknown>) => {
    try {
      await act();
    } catch (cause) {
      notifyFailure(catalogFailureOf(cause));
    }
    await revalidate();
  }, [notifyFailure, revalidate]);
}

function RetentionLine({ run }: { readonly run: PublicationRunWire }) {
  const { t } = useCatalogText();
  const { disposal, legalHold } = run.retention;
  if (disposal !== null) {
    const hash = run.artifacts[0]?.sha256.slice(0, FINGERPRINT_LENGTH) ?? '';
    return <p className="m-0 text-xs text-muted-foreground">{t('publishing.retention.disposed', { date: formatDate(disposal.disposedAt), hash })}</p>;
  }
  if (legalHold !== null) return <p className="m-0 text-xs text-foreground">{t('publishing.retention.legalHold', { reason: legalHold.reason })}</p>;
  if (run.dispositionDueAt === null) return null;
  return <p className="m-0 text-xs text-muted-foreground">{t('publishing.retention.scheduled', { date: formatDate(run.dispositionDueAt) })}</p>;
}

function HoldDialog({ onPlace, onClose }: { readonly onPlace: (reason: string) => void; readonly onClose: () => void }) {
  const { t } = useCatalogText();
  const id = useId();
  const [reason, setReason] = useState('');
  const valid = holdReasonOf(reason);
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t('publishing.retention.hold')}</DialogTitle></DialogHeader>
        <Label htmlFor={id}>{t('publishing.retention.holdReason')}</Label>
        <Textarea id={id} value={reason} maxLength={HOLD_REASON_MAX_LENGTH} onChange={(event) => setReason(event.target.value)} />
        <DialogFooter>
          <Button type="button" disabled={valid === null} onClick={() => { if (valid !== null) onPlace(valid); }}>{t('publishing.retention.hold')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RetentionActions({ run, revalidate }: PublicationRunRetentionProps) {
  const { t } = useCatalogText();
  const canManage = useCatalogAccess('pricing') === 'granted';
  const canHold = useCatalogAccess('legalHolds') === 'granted';
  const act = useRetentionAction(revalidate);
  const [confirming, setConfirming] = useState(false);
  const [holding, setHolding] = useState(false);
  const held = run.retention.legalHold !== null;
  return (
    <span className="flex flex-wrap items-center gap-2">
      {canManage && canDeletePublicationByHand(run) ? (
        <Button type="button" variant="outline" size="sm" onClick={() => setConfirming(true)}>{t('publishing.retention.delete')}</Button>
      ) : null}
      {canHold && canHoldPublication(run) ? (
        <Button type="button" variant="outline" size="sm"
          onClick={() => { if (held) void act(() => setPublicationLegalHold(run.id, { act: 'release' })); else setHolding(true); }}>
          {t(held ? 'publishing.retention.release' : 'publishing.retention.hold')}
        </Button>
      ) : null}
      <ConfirmDialog open={confirming} onOpenChange={setConfirming} variant="destructive" title={t('publishing.retention.delete')}
        description={t('publishing.retention.deleteDescription')} confirmText={t('publishing.retention.delete')}
        onConfirm={() => act(() => deletePublicationPdf(run.id))} />
      {holding ? (
        <HoldDialog onClose={() => setHolding(false)}
          onPlace={(reason) => { setHolding(false); void act(() => setPublicationLegalHold(run.id, { act: 'place', reason })); }} />
      ) : null}
    </span>
  );
}

export function PublicationRunRetention({ run, revalidate }: PublicationRunRetentionProps) {
  if (run.status !== 'ready') return null;
  return (
    <section className="flex flex-col gap-1">
      <RetentionLine run={run} />
      <RetentionActions run={run} revalidate={revalidate} />
    </section>
  );
}
