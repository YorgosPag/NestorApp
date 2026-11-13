'use client';

/**
 * ADR-941 Δ15 — η **κάρτα κλίμακας** της εισαγωγής διανυσματικού PDF: τι λένε οι γραμμένες τιμές για την κλίμακα του
 * υποβάθρου και πόσο απέχει η καθεμία από τη λύση. Καθαρή παρουσίαση· η πράξη ζει στο `PdfVectorImportSection`.
 *
 * @see ../../../systems/pdf-vector-import/pdf-vector-scale.ts (η παράγωγη)
 */

import * as React from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { formatNumber, formatPercentage } from '@/lib/intl-formatting';
import type { PdfVectorScale, PdfVectorScaleProposal } from '../../../systems/pdf-vector-import/pdf-vector-scale';
import { MUTED, type Translate } from './ModelFromDrawingSections';

const KEY = 'modelFromDrawing.pdfVector.scale';

const mm = (value: number): string => formatNumber(value, { maximumFractionDigits: 3 });
const percent = (rel: number): string => formatPercentage(Math.abs(rel) * 100, { maximumFractionDigits: 2 });

function ProposalSummary({ proposal, t }: { readonly proposal: PdfVectorScaleProposal; readonly t: Translate }): React.ReactElement {
  const { solution, references, needsReview, replacesMmPerPixel } = proposal;
  const maxResidual = Math.max(0, ...solution.residualsRel.map(Math.abs));
  return (
    <section className="flex flex-col gap-0.5" data-testid="mfd-pdf-vector-scale" data-kind="proposal">
      <p className="m-0 text-[11px] text-foreground">
        {t(`${KEY}.proposal`, { count: references.length, mmPerPixel: mm(Math.sqrt(solution.mmPerPixelX * solution.mmPerPixelY)), deviation: percent(maxResidual) })}
      </p>
      <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
        {references.map((r, i) => (
          <li key={`${r.raw}-${i}`} className={MUTED}>
            {t(`${KEY}.reference`, { raw: r.raw, deviation: percent(solution.residualsRel[i] ?? 0) })}
          </li>
        ))}
      </ul>
      {replacesMmPerPixel !== null ? <p className="m-0 text-[11px] text-foreground">{t(`${KEY}.replaces`, { current: mm(replacesMmPerPixel) })}</p> : null}
      {needsReview ? (
        <p className="m-0 flex items-center gap-1 text-[11px] text-destructive" role="status">
          <AlertTriangle className="size-3.5" aria-hidden="true" />{t(`${KEY}.needsReview`)}
        </p>
      ) : null}
    </section>
  );
}

export function PdfVectorScaleSummary({ scale, t }: { readonly scale: PdfVectorScale; readonly t: Translate }): React.ReactElement {
  if (scale.kind === 'proposal') return <ProposalSummary proposal={scale} t={t} />;
  if (scale.kind === 'failed') return <p className={MUTED} data-testid="mfd-pdf-vector-scale" data-kind="failed">{t(`${KEY}.failed`)}</p>;
  return (
    <p className="m-0 flex items-center gap-1 text-[11px] text-foreground" data-testid="mfd-pdf-vector-scale" data-kind="confirmed">
      <CheckCircle2 className="size-3.5" aria-hidden="true" />
      {t(`${KEY}.confirmed`, { count: scale.agreeing, deviation: percent(scale.maxDeviationRel) })}
    </p>
  );
}
