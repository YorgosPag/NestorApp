'use client';

/**
 * @fileoverview **Η καρτέλα «Παράδοση», ως όψη** — καθαρή απόδοση της απάντησης της πόρτας (ADR-916 §5.15 Φ-Δ).
 * @related PropertyHandoverPanel.tsx (φέρνει τα δεδομένα) · testing/PropertyHandoverOfficeHarness.tsx (η γκαλερί — η
 *          **ίδια** όψη πάνω σε συνθετικά δεδομένα) · handover-office-presentation.ts
 * @module components/property-handover-office/PropertyHandoverView
 *
 * 🎯 **«Ποιος κινείται» πρώτα** (DocuSign «Action Required» · ACC Transmittals): σύνοψη ανά κάτοχο κίνησης στην κορυφή,
 *    οι παραδόσεις με ό,τι περιμένει το γραφείο ψηλότερα, και μετά τα αρχεία — με τα «θέλουν απόφαση» ορατά, ποτέ κρυμμένα.
 */

import React from 'react';

import { Badge } from '@/components/ui/badge';
import type { HandoverOfficeActions } from '@/hooks/property-handover/useHandoverOfficeActions';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { PropertyHandoverPreview, PropertyHandoverPreviewFile } from '@/types/property-handover';

import { HandoverEntryCard } from './HandoverEntryCard';
import { HandoverFileRow } from './HandoverFileRow';
import { HANDOVER_MOVE_PRESENTATION, handoverMoveCounts, sortHandoverEntries } from './handover-office-presentation';

const K = 'properties-detail:handover';
const FILE_GROUPS = ['review', 'deliver', 'internal'] as const;

function MoveSummary({ preview }: { readonly preview: PropertyHandoverPreview }): React.ReactElement {
  const { t } = useTranslation(['properties-detail']);
  const iconSizes = useIconSizes();
  return (
    <ul aria-label={t(`${K}.buyersLabel`)} className="m-0 flex list-none flex-wrap gap-2 p-0">
      {handoverMoveCounts(preview.handovers).map(({ move, count }) => {
        const { variant, Icon } = HANDOVER_MOVE_PRESENTATION[move];
        return (
          <li key={move}>
            <Badge variant={variant} className="gap-1">
              <Icon className={iconSizes.xs} aria-hidden="true" />
              {t(`${K}.summary.${move}`, { count })}
            </Badge>
          </li>
        );
      })}
    </ul>
  );
}

interface FileGroupProps {
  readonly group: (typeof FILE_GROUPS)[number];
  readonly files: readonly PropertyHandoverPreviewFile[];
  readonly actions: HandoverOfficeActions;
}

function FileGroup({ group, files, actions }: FileGroupProps) {
  const { t } = useTranslation(['properties-detail']);
  return (
    <details open={group === 'review' && files.length > 0} data-group={group} className="text-sm">
      <summary className="cursor-pointer text-foreground">{t(`${K}.files.${group}`, { count: files.length })}</summary>
      {group === 'review' && files.length > 0 && <p className="m-0 mt-1 text-muted-foreground">{t(`${K}.files.reviewHint`)}</p>}
      {files.length === 0
        ? <p className="m-0 mt-1 text-muted-foreground">{t(`${K}.files.none`)}</p>
        : <ul className="m-0 mt-1 flex list-none flex-col divide-y divide-border p-0">{files.map((file) => <HandoverFileRow key={file.fileId} file={file} actions={actions} />)}</ul>}
    </details>
  );
}

function HandoverFiles({ files, actions }: { readonly files: PropertyHandoverPreview['files']; readonly actions: HandoverOfficeActions }): React.ReactElement {
  const { t } = useTranslation(['properties-detail']);
  const titleId = React.useId();
  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-2">
      <h3 id={titleId} className="m-0 text-base font-semibold text-foreground">{t(`${K}.files.title`)}</h3>
      {FILE_GROUPS.map((group) => <FileGroup key={group} group={group} files={files[group]} actions={actions} />)}
    </section>
  );
}

interface PropertyHandoverViewProps {
  readonly preview: PropertyHandoverPreview;
  /** Φ-Δ.3 · Φ-Δ.4 — οι πράξεις του γραφείου: πραγματικές στην καρτέλα, προσομοιωμένες στη γκαλερί (η ΙΔΙΑ όψη). */
  readonly actions: HandoverOfficeActions;
}

export function PropertyHandoverView({ preview, actions }: PropertyHandoverViewProps): React.ReactElement {
  const { t } = useTranslation(['properties-detail']);
  const live = preview.handovers.some(({ handover }) => handover.lifecycle !== 'cancelled');
  return (
    <div className="flex flex-col gap-4">
      {preview.handovers.length === 0
        ? <p className="m-0 text-sm text-muted-foreground">{t(`${K}.empty`)}</p>
        : <MoveSummary preview={preview} />}
      {live && !preview.seal.configured && <p role="note" className="m-0 text-sm text-muted-foreground">{t(`${K}.sealNotConfigured`)}</p>}
      {preview.handovers.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {sortHandoverEntries(preview.handovers).map((entry) => <li key={entry.handover.id}><HandoverEntryCard entry={entry} actions={actions} /></li>)}
        </ul>
      )}
      <HandoverFiles files={preview.files} actions={actions} />
    </div>
  );
}
