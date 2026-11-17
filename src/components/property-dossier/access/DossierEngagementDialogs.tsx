'use client';

/**
 * @fileoverview **Αλλαγή εύρους · Ανανέωση** μιας ενεργής συμμετοχής στον φάκελο (ADR-916 Φ-Ε1 Σ4).
 * @module components/property-dossier/access/DossierEngagementDialogs
 * @related `DossierAccessFields.tsx` (τα ΙΔΙΑ πεδία με την πρόσκληση) · `POST …/access/[engagementId]`
 *
 * 🔑 Ο διάλογος ξεκινά από την **τρέχουσα** αλήθεια της συμμετοχής (εύρος · διάρκεια) και στέλνει **μόνο** τη νέα τιμή·
 *    ίδια τιμή ⇒ ο ΕΝΑΣ γραφέας απαντά `noop` (κανένα ίχνος, καμία ειδοποίηση).
 */

import React, { useState } from 'react';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DialogActionFooter } from '@/components/ui/dialog-action-footer';
import type { DossierShareDays } from '@/config/engagement-policy';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { FloorplanTabKind } from '@/lib/property-dossier/property-dossier-view';
import type { DossierEngagementSummary } from '@/types/dossier-access';
import type { DossierShareReach } from '@/types/engagement';
import type { EngagedDossierFile } from '@/types/my-engagements';

import { DossierReachFields, DossierShareDaysField } from './DossierAccessFields';

const K = 'property-market:dossier.access';

/** Το κέλυφος των δύο διαλόγων — ανοιχτό όσο υπάρχει συμμετοχή-στόχος. */
function EngagementDialog({ title, description, onCancel, children }: {
  readonly title: string;
  readonly description: string;
  readonly onCancel: () => void;
  readonly children: React.ReactNode;
}) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

interface ReachDialogProps {
  readonly engagement: DossierEngagementSummary | null;
  readonly floorplanKind: FloorplanTabKind;
  readonly files: readonly EngagedDossierFile[];
  readonly busy: boolean;
  readonly onCancel: () => void;
  readonly onSave: (engagement: DossierEngagementSummary, reach: DossierShareReach) => void;
}

function ReachForm({ engagement, floorplanKind, files, busy, onCancel, onSave }: ReachDialogProps & { readonly engagement: DossierEngagementSummary }) {
  const { t } = useTranslation(['property-market']);
  const [reach, setReach] = useState<DossierShareReach>(engagement.reach);
  return (
    <>
      <DossierReachFields idPrefix="dossier-reach" floorplanKind={floorplanKind} files={files} reach={reach} onChange={setReach} />
      <DialogActionFooter
        cancelLabel={t(`${K}.invite.cancel`)}
        confirmLabel={t(`${K}.reachDialog.save`)}
        busyLabel={t(`${K}.reachDialog.saving`)}
        onCancel={onCancel}
        onConfirm={() => onSave(engagement, reach)}
        isSubmitting={busy}
        canSubmit={!busy && reach.tabs.length > 0}
      />
    </>
  );
}

export function DossierReachDialog(props: ReachDialogProps): React.ReactElement | null {
  const { t } = useTranslation(['property-market']);
  if (props.engagement === null) return null;
  return (
    <EngagementDialog title={t(`${K}.reachDialog.title`)} description={t(`${K}.reachDialog.description`)} onCancel={props.onCancel}>
      <ReachForm {...props} engagement={props.engagement} />
    </EngagementDialog>
  );
}

interface RenewDialogProps {
  readonly engagement: DossierEngagementSummary | null;
  readonly busy: boolean;
  readonly onCancel: () => void;
  readonly onRenew: (engagement: DossierEngagementSummary, shareDays: DossierShareDays) => void;
}

function RenewForm({ engagement, busy, onCancel, onRenew }: RenewDialogProps & { readonly engagement: DossierEngagementSummary }) {
  const { t } = useTranslation(['property-market']);
  const [shareDays, setShareDays] = useState<DossierShareDays>(engagement.shareDays);
  return (
    <>
      <DossierShareDaysField id="dossier-renew-days" value={shareDays} onChange={setShareDays} />
      <DialogActionFooter
        cancelLabel={t(`${K}.invite.cancel`)}
        confirmLabel={t(`${K}.renewDialog.confirm`)}
        busyLabel={t(`${K}.renewDialog.confirming`)}
        onCancel={onCancel}
        onConfirm={() => onRenew(engagement, shareDays)}
        isSubmitting={busy}
      />
    </>
  );
}

export function DossierRenewDialog(props: RenewDialogProps): React.ReactElement | null {
  const { t } = useTranslation(['property-market']);
  if (props.engagement === null) return null;
  return (
    <EngagementDialog title={t(`${K}.renewDialog.title`)} description={t(`${K}.renewDialog.description`)} onCancel={props.onCancel}>
      <RenewForm {...props} engagement={props.engagement} />
    </EngagementDialog>
  );
}
