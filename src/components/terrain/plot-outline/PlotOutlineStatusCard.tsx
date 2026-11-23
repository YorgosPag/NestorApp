'use client';

/**
 * @fileoverview **Το περίγραμμα που ισχύει** — εμβαδόν, προέλευση, Π9, αφαίρεση, επαναφορά σχεδίου (ADR-920 §14.11 Ζ4 · Ζ3c).
 * @related hooks/listings/usePlotOutlineStatus (`GET` · `PATCH` · επαναφορά) · lib/terrain/plot-outline/plot-outline-status
 * @module components/terrain/plot-outline/PlotOutlineStatusCard
 *
 * 🔑 **Προέλευση πάντα ορατή** — εκεί που οι μεγάλοι αποτυγχάνουν (Revit: το property line ξεχνά από ποια γραμμή CAD ήρθε·
 *    Figma: τα ορφανά instances δεν βρίσκονται): αρχείο · στρώση/οντότητα ή σελίδα · μονάδα · αποτύπωμα — και όταν το σχέδιο
 *    είναι στον **κάδο**, το λέμε και δίνουμε «Επαναφορά» (το «Restore component» του Figma).
 * 🔑 **Copy semantics, ρητή αφαίρεση** (Revit · Civil 3D «Remove From Definition»): ο κάδος του σχεδίου δεν σβήνει το
 *    περίγραμμα· η αφαίρεση είναι δική της πράξη, με επιβεβαίωση.
 * 🔑 Π9: ο διακόπτης κοινού αλλάζει **χωρίς** νέο σχέδιο (`PATCH`), και μόνο όταν υπάρχει ανάγλυφο να ξαναδημοσιευτεί.
 */

import React, { useId, useState } from 'react';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import type { PlotOutlineStatusApi } from '@/hooks/listings/usePlotOutlineStatus';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatNumber } from '@/lib/intl-formatting';
import type { PlotDrawingSummary, PlotOutlineStatus } from '@/lib/terrain/plot-outline/plot-outline-status';
import { TERRAIN_REFUSAL_MESSAGE_LIMITS } from '@/lib/terrain/publication/terrain-publication-contract';

import { PlotOutlineVisibilityCheckbox } from './PlotOutlineVisibilityCheckbox';

const NS = 'terrain-survey:plotOutline';
/** Τα πρώτα ψηφία του sha256 — αρκετά για να ξεχωρίσουν δύο εκδόσεις στο μάτι (όπως ένα σύντομο git hash). */
const FINGERPRINT_DIGITS = 12;

type Translate = ReturnType<typeof useTranslation>['t'];

function originText(drawing: PlotDrawingSummary, t: Translate): string {
  const { origin } = drawing;
  if (origin.source === 'pdf-table') return t(`${NS}.status.origin.pdf`, { page: origin.page });
  return origin.handle === null
    ? t(`${NS}.status.origin.dxf`, { layer: origin.layer })
    : t(`${NS}.status.origin.dxfHandle`, { layer: origin.layer, handle: origin.handle });
}

/** «Από πού ήρθε» — το σχέδιο (ενεργό ή στον κάδο) ή ειλικρινές «από σχέδιο που δεν υπάρχει πια». */
function Provenance({ status, onRestore, busy }: {
  readonly status: PlotOutlineStatus;
  readonly onRestore: (fileId: string) => void;
  readonly busy: boolean;
}) {
  const { t } = useTranslation(['terrain-survey']);
  const drawing = status.drawing;
  if (drawing === null || !drawing.isOutlineSource) return <p className="m-0 text-sm text-muted-foreground">{t(`${NS}.status.source.orphan`)}</p>;
  const unit = drawing.drawingUnit === null
    ? t(`${NS}.status.unit.declared`)
    : t(`${NS}.status.unit.human`, { unit: t(`terrain-survey:unit.${drawing.drawingUnit}`) });
  return (
    <section className="flex flex-col gap-1">
      <p className="m-0 text-sm text-foreground">
        {t(`${NS}.status.source.${drawing.place === 'trash' ? 'trash' : 'drawing'}`, { name: drawing.fileName })}
      </p>
      <p className="m-0 text-xs text-muted-foreground">
        {originText(drawing, t)}{' · '}{unit}{' · '}
        <span className="font-mono">{t(`${NS}.status.fingerprint`, { sha: drawing.drawingSha256.slice(0, FINGERPRINT_DIGITS) })}</span>
      </p>
      {drawing.place === 'trash' && (
        <Button type="button" variant="outline" size="sm" className="self-start" disabled={busy} onClick={() => onRestore(drawing.fileId)}>
          {t(`${NS}.status.restore`)}
        </Button>
      )}
    </section>
  );
}

function ActionMessage({ api }: { readonly api: PlotOutlineStatusApi }) {
  const { t } = useTranslation(['terrain-survey']);
  const { action } = api;
  const text = action.kind === 'done' ? t(`${NS}.status.done.${action.changed ? 'changed' : 'unchanged'}`)
    : action.kind === 'refused' ? t(`terrain-survey:publish.refusals.${action.refusal}`, TERRAIN_REFUSAL_MESSAGE_LIMITS)
    : action.kind === 'restore-failed' ? t(`${NS}.status.restoreFailed`) : '';
  return <p role="status" className="m-0 text-sm text-foreground">{text}</p>;
}

function OutlineInForce({ api, status }: { readonly api: PlotOutlineStatusApi; readonly status: PlotOutlineStatus }) {
  const { t } = useTranslation(['terrain-survey']);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const busy = api.action.kind === 'acting';
  const outline = status.outline;
  if (outline === null) return <p className="m-0 text-sm text-muted-foreground">{t(`${NS}.status.none`)}</p>;
  return (
    <>
      <p className="m-0 text-sm text-foreground">{t(`${NS}.status.area`, { area: formatNumber(outline.areaM2, { maximumFractionDigits: 0 }) })}</p>
      {!status.hasRelief && <p className="m-0 text-sm text-muted-foreground">{t(`${NS}.status.waiting`)}</p>}
      <Provenance status={status} onRestore={(id) => void api.restoreDrawing(id)} busy={busy} />
      <PlotOutlineVisibilityCheckbox checked={outline.showInListing} disabled={busy || !status.hasRelief}
        onChange={(showInListing) => void api.amend({ kind: 'visibility', showInListing })} />
      <Button type="button" variant="outline" size="sm" className="self-start" disabled={busy || !status.hasRelief}
        onClick={() => setConfirmRemove(true)}>
        {t(`${NS}.status.remove`)}
      </Button>
      <ConfirmDialog open={confirmRemove} onOpenChange={setConfirmRemove} variant="destructive"
        title={t(`${NS}.status.removeTitle`)} description={t(`${NS}.status.removeBody`)} confirmText={t(`${NS}.status.remove`)}
        onConfirm={() => api.amend({ kind: 'remove' })} />
    </>
  );
}

export function PlotOutlineStatusCard({ api }: { readonly api: PlotOutlineStatusApi }) {
  const { t } = useTranslation(['terrain-survey']);
  const headingId = useId();
  const { view } = api;
  return (
    <section aria-labelledby={headingId} aria-busy={view.kind === 'loading'}
      className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <h4 id={headingId} className="m-0 text-sm font-semibold text-foreground">{t(`${NS}.status.heading`)}</h4>
      {view.kind === 'loading' && <p role="status" className="m-0 text-sm text-muted-foreground">{t(`${NS}.status.loading`)}</p>}
      {view.kind === 'failed' && (
        <p role="alert" className="m-0 text-sm text-foreground">
          {t(`terrain-survey:publish.refusals.${view.refusal}`, TERRAIN_REFUSAL_MESSAGE_LIMITS)}
        </p>
      )}
      {view.kind === 'ready' && <OutlineInForce api={api} status={view.status} />}
      <ActionMessage api={api} />
    </section>
  );
}
