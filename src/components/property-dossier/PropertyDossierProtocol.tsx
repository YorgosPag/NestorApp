'use client';

/**
 * @fileoverview **Το Πρωτόκολλο Παράδοσης στον φάκελο του αγοραστή** (ADR-916 Φ-Γ2 Σ5) — βλέπει, κατεβάζει, καταλαβαίνει.
 * @related lib/property-handover/handover-protocol-presentation.ts (τι λέει η οθόνη) · PropertyDossierOrigin.tsx (ο οικοδεσπότης)
 * @module components/property-dossier/PropertyDossierProtocol
 *
 * 🏆 DocuSign: το Certificate of Completion κατεβαίνει **δίπλα** στα ολοκληρωμένα έγγραφα και υπάρχει **μόνο** για
 *    ολοκληρωμένα. Εδώ: η κάρτα υπάρχει **μόνο** όταν ο γραφέας έχει προβάλει σφραγισμένο Πρωτόκολλο (`origin.protocol`)
 *    — κανένα «σε αναμονή», κανένα ασφράγιστο. Και πέρα από αυτούς: η αναθεώρηση λέει **ρητά** τι αντικαθιστά, και ο
 *    σύνδεσμος οδηγεί στο κείμενο **της έκδοσης που τυπώθηκε**, όχι στο «τρέχον».
 * 🔒 Διαβάζει **μόνο** τον φάκελο (Δ10) — ποτέ `property_handovers`. Κανένα στοιχείο αγοραστή (η προβολή δεν έχει).
 * 🔑 Λήψη **κατά id** με διαμέρισμα `personal`: ο διακομιστής βρίσκει τα bytes και περνά από τον φρουρό του δοχείου.
 */

import React from 'react';
import { Download, ExternalLink, Stamp } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { useFileDownload } from '@/components/shared/files/hooks/useFileDownload';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatDateTime } from '@/lib/intl-formatting';
import { handoverProtocolPresentationOf } from '@/lib/property-handover/handover-protocol-presentation';
import { cn } from '@/lib/utils';
import { Link } from '@/lib/workspace/navigation';
import type { PropertyHandoverProtocolSummary } from '@/types/property-handover-protocol';

const K = 'property-market:dossier.origin.protocol';
const ACTION_CLASS = cn('inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium', COLOR_BRIDGE.action.secondary);

/** Στη λίστα φακέλων: μόνο «υπάρχει, αναθ. N». `null` ⇒ τίποτα. */
export function PropertyDossierProtocolBadge({ protocol }: { readonly protocol: PropertyHandoverProtocolSummary | null }) {
  const { t } = useTranslation(['property-market']);
  const iconSizes = useIconSizes();
  if (protocol === null) return null;
  return (
    <Badge variant="success" className="gap-1">
      <Stamp className={iconSizes.xs} aria-hidden="true" />
      {t(`${K}.short`, { revision: protocol.revision })}
    </Badge>
  );
}

/** «Λήψη» — κατά id, στο προσωπικό διαμέρισμα· κλειδώνει όσο κατεβαίνει (ποτέ δύο λήψεις από διπλό κλικ). */
function DownloadAction({ protocol }: { readonly protocol: PropertyHandoverProtocolSummary }) {
  const { t } = useTranslation(['property-market']);
  const iconSizes = useIconSizes();
  const { handleDownload } = useFileDownload();
  const [busy, setBusy] = React.useState(false);
  const download = React.useCallback(async () => {
    setBusy(true);
    try {
      await handleDownload({
        id: protocol.fileId,
        custody: 'personal',
        displayName: t(`${K}.fileName`, { revision: protocol.revision }),
        ext: 'pdf',
      });
    } finally {
      setBusy(false);
    }
  }, [handleDownload, protocol.fileId, protocol.revision, t]);
  return (
    <button type="button" disabled={busy} aria-busy={busy} onClick={() => void download()} className={cn(ACTION_CLASS, 'disabled:opacity-50')}>
      <Download className={iconSizes.sm} aria-hidden="true" />
      {t(busy ? `${K}.downloading` : `${K}.download`)}
    </button>
  );
}

/** Στη σελίδα του φακέλου: τι είναι, πότε, τι αντικαθιστά, λήψη, κείμενο της έκδοσης. `null` ⇒ τίποτα. */
export function PropertyDossierProtocolCard({ protocol }: { readonly protocol: PropertyHandoverProtocolSummary | null }) {
  const { t } = useTranslation(['property-market']);
  const iconSizes = useIconSizes();
  const titleId = React.useId();
  if (protocol === null) return null;
  const view = handoverProtocolPresentationOf(protocol);
  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-2 border-t border-border pt-3">
      <header className="flex flex-wrap items-center gap-2">
        <h3 id={titleId} className="m-0 text-sm font-semibold text-foreground">{t(`${K}.title`)}</h3>
        <Badge variant="success" className="gap-1">
          <Stamp className={iconSizes.xs} aria-hidden="true" />
          {t(`${K}.sealed`, { revision: view.revision })}
        </Badge>
      </header>
      <dl className="m-0 grid gap-1 text-sm">
        <dt className="text-muted-foreground">{t(`${K}.issuedAt`)}</dt>
        <dd className="m-0 text-foreground">{formatDateTime(view.issuedAt)}</dd>
        {view.supersedesRevision !== null && (
          <>
            <dt className="text-muted-foreground">{t(`${K}.supersedes`)}</dt>
            <dd className="m-0 text-foreground">{t(`${K}.supersedesValue`, { revision: view.supersedesRevision })}</dd>
          </>
        )}
      </dl>
      <p className="m-0 text-sm text-foreground">{t(`${K}.meaning`)}</p>
      <nav aria-label={t(`${K}.title`)} className="flex flex-wrap gap-2">
        <DownloadAction protocol={protocol} />
        {view.legalText !== null && (
          <Link href={view.legalText.href} target="_blank" rel="noopener noreferrer" className={ACTION_CLASS}>
            <ExternalLink className={iconSizes.sm} aria-hidden="true" />
            {t(`${K}.legalText`, { version: view.legalText.version })}
          </Link>
        )}
      </nav>
    </section>
  );
}
