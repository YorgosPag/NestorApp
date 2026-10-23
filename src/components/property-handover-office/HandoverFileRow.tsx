'use client';

/**
 * @fileoverview **Ένα αρχείο της πώλησης στην καρτέλα «Παράδοση»** — γιατί είναι εκεί που είναι, τι αποφάσισε το γραφείο, και
 *   η πράξη «Απόφαση…» (ADR-916 §5.18 Φ-Δ.4).
 * @related PropertyHandoverView.tsx (οι ομάδες) · HandoverFileDecisionDialog.tsx (ο διάλογος)
 * @module components/property-handover-office/HandoverFileRow
 *
 * 🎯 **Το «γιατί» δίπλα στο «τι»** (Purview policy tip): ο άνθρωπος βλέπει **ποιος κανόνας** έβαλε το αρχείο εδώ — δεν
 *    χρειάζεται να μαντέψει αν η «κατηγορία» ή το «εμπιστευτικό» αποφάσισε.
 * 🔒 Ό,τι παραδόθηκε **μένει** (Δ5): το «Απόφαση…» προσφέρει μόνο ό,τι καταλήγει σε παράδοση, και η γραμμή το **λέει**.
 */

import React from 'react';
import { Lock, PackageCheck, Scale } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { HandoverOfficeActions } from '@/hooks/property-handover/useHandoverOfficeActions';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatDate } from '@/lib/intl-formatting';
import type { PropertyHandoverPreviewFile } from '@/types/property-handover';

import { HandoverFileDecisionDialog } from './HandoverFileDecisionDialog';

const K = 'properties-detail:handover';

function FileBadges({ file }: { readonly file: PropertyHandoverPreviewFile }): React.ReactElement | null {
  const { t } = useTranslation(['properties-detail']);
  const iconSizes = useIconSizes();
  if (!file.confidential && !file.delivered && file.decision === null) return null;
  return (
    <span className="flex flex-wrap gap-1.5">
      {file.confidential && <Badge variant="destructive" className="gap-1"><Lock className={iconSizes.xs} aria-hidden="true" />{t(`${K}.files.confidential`)}</Badge>}
      {file.delivered && <Badge variant="success" className="gap-1"><PackageCheck className={iconSizes.xs} aria-hidden="true" />{t(`${K}.files.delivered`)}</Badge>}
      {file.decision !== null && (
        <Badge variant="outline" className="gap-1">
          <Scale className={iconSizes.xs} aria-hidden="true" />
          {t(`${K}.fileDecision.decided.${file.decision.disposition}`, { date: formatDate(file.decision.decidedAt) })}
        </Badge>
      )}
    </span>
  );
}

export function HandoverFileRow({ file, actions }: { readonly file: PropertyHandoverPreviewFile; readonly actions: HandoverOfficeActions }): React.ReactElement {
  const { t } = useTranslation(['properties-detail']);
  const [deciding, setDeciding] = React.useState(false);
  const { offer } = file;
  const busy = actions.busyId === file.fileId;
  return (
    <li data-file={file.fileId} data-basis={file.basis} className="flex flex-col gap-1 py-1.5">
      <span className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-foreground">{file.displayName}</span>
        {offer.kind === 'open' && (
          <Button type="button" size="sm" variant="outline" disabled={actions.busyId !== null} aria-busy={busy} onClick={() => setDeciding(true)}>
            {t(busy ? `${K}.fileDecision.busy` : `${K}.fileDecision.action`)}
          </Button>
        )}
      </span>
      <span className="text-muted-foreground">{t(`${K}.files.basis.${file.basis}`)}</span>
      <FileBadges file={file} />
      {file.decision !== null && <q className="text-muted-foreground">{file.decision.reason}</q>}
      {offer.kind === 'blocked' && offer.reason === 'already-delivered' && (
        <span className="text-muted-foreground">{t(`${K}.fileDecision.blocked.already-delivered`)}</span>
      )}
      {offer.kind === 'open' && deciding && (
        <HandoverFileDecisionDialog file={file} offer={offer} actions={actions} open={deciding} onOpenChange={setDeciding} />
      )}
    </li>
  );
}
