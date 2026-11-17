'use client';

/**
 * @fileoverview **«Πρόσβαση» — ποιος βλέπει τον φάκελό μου** (ADR-916 Φ-Ε1 Σ4). Η κάρτα του κατόχου στη σελίδα του φακέλου.
 * @module components/property-dossier/access/DossierAccessCard
 * @related `useDossierAccessDialogs.ts` (κατάσταση + πράξεις) · `DossierAccessSlotRow.tsx` · `DossierInviteDialog.tsx` ·
 *          `DossierEngagementDialogs.tsx` · `dossier-surfaces.tsx` (φορτώνεται τεμπέλικα — Drive/Figma: ο διάλογος
 *          κοινοποίησης δεν βαραίνει τη σελίδα πριν χρειαστεί)
 *
 * 🔑 **Κάρτα, όχι καρτέλα**: η πρόσβαση αφορά **όλο** τον φάκελο, όχι ένα είδος αρχείων.
 * 🔑 Η ανάκληση ρωτά πρώτα και λέει την αλήθεια: «ό,τι κατέβηκε δεν σβήνεται».
 */

import React from 'react';
import { ShieldCheck } from 'lucide-react';

import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { floorplanTabKind, type FloorplanTabKind } from '@/lib/property-dossier/property-dossier-view';
import { cn } from '@/lib/utils';
import type { PropertyDossier } from '@/types/property-dossier';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

import { DossierAccessSlotRow } from './DossierAccessSlotRow';
import { DossierReachDialog, DossierRenewDialog } from './DossierEngagementDialogs';
import { DossierInviteDialog } from './DossierInviteDialog';
import { useDossierAccessDialogs, type DossierAccessDialogs } from './useDossierAccessDialogs';

const K = 'property-market:dossier.access';

/** Οι τρεις διάλογοι με πεδία — ανοίγει **ένας** κάθε φορά. */
function AccessDialogs({ ctl, floorplanKind }: { readonly ctl: DossierAccessDialogs; readonly floorplanKind: FloorplanTabKind }) {
  const files = ctl.access.files;
  return (
    <>
      <DossierInviteDialog
        seed={ctl.inviteSeed}
        floorplanKind={floorplanKind}
        files={files}
        busy={ctl.busyFor(ctl.inviteSeed?.role)}
        onCancel={ctl.close}
        onSend={ctl.sendInvite}
      />
      <DossierReachDialog
        engagement={ctl.target('reach')}
        floorplanKind={floorplanKind}
        files={files}
        busy={ctl.busyFor(ctl.target('reach')?.role)}
        onCancel={ctl.close}
        onSave={ctl.saveReach}
      />
      <DossierRenewDialog engagement={ctl.target('renew')} busy={ctl.busyFor(ctl.target('renew')?.role)} onCancel={ctl.close} onRenew={ctl.renew} />
    </>
  );
}

/** Οι δύο επιβεβαιώσεις — ανάκληση συμμετοχής · ακύρωση πρόσκλησης. */
function AccessConfirms({ ctl }: { readonly ctl: DossierAccessDialogs }) {
  const { t } = useTranslation(['property-market', 'conveyance']);
  const onOpenChange = (isOpen: boolean) => { if (!isOpen) ctl.close(); };
  return (
    <>
      <ConfirmDialog
        open={ctl.target('revoke') !== null}
        onOpenChange={onOpenChange}
        title={t(`${K}.revokeConfirm.title`)}
        description={t(`${K}.revokeConfirm.description`)}
        confirmText={t(`${K}.revokeConfirm.confirm`)}
        cancelText={t(`${K}.revokeConfirm.cancel`)}
        variant="destructive"
        onConfirm={ctl.confirmRevoke}
      />
      <ConfirmDialog
        open={ctl.cancellingSlot !== null}
        onOpenChange={onOpenChange}
        title={t('conveyance:engagement.invitation.cancelConfirm.title')}
        description={t('conveyance:engagement.invitation.cancelConfirm.description')}
        confirmText={t('conveyance:engagement.endConfirm.confirm')}
        cancelText={t('conveyance:engagement.endConfirm.cancel')}
        variant="destructive"
        onConfirm={ctl.confirmCancelInvitation}
      />
    </>
  );
}

export function DossierAccessCard({ dossier }: { readonly dossier: PropertyDossier }): React.ReactElement {
  const { t } = useTranslation(['property-market']);
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();
  const ctl = useDossierAccessDialogs(dossier.id);
  const floorplanKind = floorplanTabKind(dossier.type);
  const archived = dossier.lifecycle !== 'active';
  const muted = cn('m-0 text-sm', colors.text.muted);
  return (
    <section aria-labelledby="dossier-access-title" className="space-y-2 rounded-lg border border-border bg-card p-4">
      <header className="flex items-center gap-2">
        <ShieldCheck className={cn(iconSizes.sm, colors.text.muted)} aria-hidden="true" />
        <h2 id="dossier-access-title" className="m-0 text-base font-semibold">{t(`${K}.title`)}</h2>
      </header>
      <p className={muted}>{t(`${K}.lead`)}</p>
      {archived && <p className={muted}>{t(`${K}.archivedHint`)}</p>}
      {ctl.access.loading && <p className={muted}>{t(`${K}.loading`)}</p>}
      {ctl.access.failed && <p className={cn('m-0 text-sm', colors.text.error)}>{t(`${K}.error`)}</p>}
      <ul className="m-0 list-none p-0">
        {ctl.access.slots.map((slot) => (
          <DossierAccessSlotRow key={slot.role} slot={slot} floorplanKind={floorplanKind} archived={archived} {...ctl.rowActions(slot)} />
        ))}
      </ul>
      <AccessDialogs ctl={ctl} floorplanKind={floorplanKind} />
      <AccessConfirms ctl={ctl} />
    </section>
  );
}
