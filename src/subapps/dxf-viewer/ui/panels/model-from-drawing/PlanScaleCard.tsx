'use client';

/**
 * ADR-929 Φ5.3γ — η **κάρτα κλίμακας** στο πάνελ «Μοντέλο από το σχέδιο»: τι λένε οι διαβασμένες διαστάσεις για την
 * κλίμακα, **ποιες** συμφωνούν (με την απόκλισή τους από τη λύση) και **ποιες** έμειναν έξω (με λόγο).
 *
 * Καθαρή παρουσίαση: δεν διαβάζει store, δεν γράφει τίποτα· οι πράξεις φεύγουν προς τα πάνω ως callbacks.
 * 🔒 Ποτέ σιωπηλή εφαρμογή (Δ4): «Εφαρμογή» μόνο με κλικ· η **αντικατάσταση** υπάρχουσας βαθμονόμησης θέλει και
 * δεύτερη, ρητή επιβεβαίωση. Ό,τι δείχνει η κάρτα (η λύση) είναι ό,τι γράφεται.
 *
 * @see ../../../systems/plan-recognition/plan-scale-card.ts (η παράγωγη)
 */

import * as React from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Ruler } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatNumber, formatPercentage } from '@/lib/intl-formatting';
import { CALIBRATION_LIMITS } from '../../../floorplan-background/geometry/calibration-solve';
import type {
  PlanScaleConfirmed,
  PlanScaleCard as PlanScaleCardModel,
  PlanScaleFailed,
  PlanScaleProposal,
} from '../../../systems/plan-recognition/plan-scale-card';
import type { RejectedScaleDimension } from '../../../bim/plan-recognition/fusion/scale-references';
import { MUTED, SECTION_TITLE, type Translate } from './ModelFromDrawingSections';

const KEY = 'modelFromDrawing.image.scale';

export interface PlanScaleActions {
  readonly onApply: (proposal: PlanScaleProposal) => void;
  readonly onManual: () => void;
  readonly onHover: (textId: string | null) => void;
}

export interface PlanScaleView {
  readonly card: PlanScaleCardModel | null;
  readonly applying: boolean;
  /** Η τελευταία «Εφαρμογή» αρνήθηκε: η βάση της κάρτας είχε αλλάξει. */
  readonly stale: boolean;
}

const mm = (value: number): string => formatNumber(value, { maximumFractionDigits: 3 });
const percent = (rel: number): string => formatPercentage(rel * 100, { maximumFractionDigits: 2 });

function rejectionText(r: RejectedScaleDimension, t: Translate): string {
  if (r.reason === 'conflict' && r.w !== null) return t(`${KEY}.rejection.conflictW`, { w: formatNumber(r.w, { maximumFractionDigits: 1 }) });
  return t(`${KEY}.rejection.${r.reason}`);
}

function RejectedList({ rejected, onHover, t }: {
  readonly rejected: readonly RejectedScaleDimension[];
  readonly onHover: PlanScaleActions['onHover'];
  readonly t: Translate;
}): React.ReactElement | null {
  if (rejected.length === 0) return null;
  return (
    <section className="flex flex-col gap-0.5" data-testid="mfd-scale-rejected">
      <p className={MUTED}>{t(`${KEY}.rejectedTitle`, { count: rejected.length })}</p>
      <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
        {rejected.map((r) => (
          <li key={r.textId} className={MUTED} data-text-id={r.textId} data-reason={r.reason}
            onMouseEnter={() => onHover(r.textId)} onMouseLeave={() => onHover(null)}>
            {t(`${KEY}.rejectedItem`, { value: mm(r.valueMm), reason: rejectionText(r, t) })}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ScaleSummary({ proposal, t }: { readonly proposal: PlanScaleProposal; readonly t: Translate }): React.ReactElement {
  const { solution, references, sigmaRel, replacesMmPerPixel } = proposal;
  const count = references.used.length;
  const proposed = Math.sqrt(solution.mmPerPixelX * solution.mmPerPixelY);
  return (
    <>
      <p className="m-0 text-[11px] text-foreground" data-testid="mfd-scale-value" data-mode={solution.mode}>
        {solution.mode === 'uniform'
          ? t(`${KEY}.uniform`, { mm: mm(solution.mmPerPixelX), count })
          : t(`${KEY}.perAxis`, { x: mm(solution.mmPerPixelX), y: mm(solution.mmPerPixelY), stretch: percent(solution.anisotropyRel), count })}
      </p>
      {sigmaRel !== null ? <p className={MUTED}>{t(`${KEY}.sigma`, { sigma: percent(sigmaRel) })}</p> : null}
      {replacesMmPerPixel !== null ? (
        <p className="m-0 text-[11px] text-foreground" data-testid="mfd-scale-replaces">
          {t(`${KEY}.replaces`, {
            current: mm(replacesMmPerPixel), proposed: mm(proposed), difference: percent(Math.abs(proposed / replacesMmPerPixel - 1)),
          })}
        </p>
      ) : null}
    </>
  );
}

function UsedList({ proposal, onHover, t }: {
  readonly proposal: PlanScaleProposal;
  readonly onHover: PlanScaleActions['onHover'];
  readonly t: Translate;
}): React.ReactElement {
  const { used } = proposal.references;
  return (
    <section className="flex flex-col gap-0.5" data-testid="mfd-scale-used">
      <p className={MUTED}>{t(`${KEY}.usedTitle`, { count: used.length })}</p>
      <ul className="m-0 flex list-none flex-col gap-0.5 p-0" aria-label={t(`${KEY}.listLabel`)}>
        {used.map((r, i) => (
          <li key={r.textId} className="m-0 text-[11px] text-foreground" data-text-id={r.textId}
            onMouseEnter={() => onHover(r.textId)} onMouseLeave={() => onHover(null)}>
            {t(`${KEY}.usedItem`, { value: mm(r.valueMm), residual: percent(Math.abs(proposal.solution.residualsRel[i] ?? 0)) })}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ApplyControls({ proposal, applying, actions, t }: {
  readonly proposal: PlanScaleProposal;
  readonly applying: boolean;
  readonly actions: PlanScaleActions;
  readonly t: Translate;
}): React.ReactElement {
  const [confirming, setConfirming] = React.useState(false);
  // Νέα πρόταση (νέα σύντηξη / θέση) ⇒ η επιβεβαίωση της παλιάς δεν ισχύει: ο άνθρωπος επιβεβαιώνει ό,τι βλέπει τώρα.
  React.useEffect(() => setConfirming(false), [proposal]);
  const replacing = proposal.replacesMmPerPixel !== null;
  const apply = () => { setConfirming(false); actions.onApply(proposal); };
  if (confirming) {
    return (
      <section className="flex flex-col gap-1" role="alertdialog" aria-label={t(`${KEY}.replace`)} data-testid="mfd-scale-confirm">
        <p className="m-0 text-[11px] text-foreground">{t(`${KEY}.replaceConfirm`)}</p>
        <footer className="flex flex-wrap gap-1.5">
          <Button type="button" size="xs" onClick={apply} data-testid="mfd-scale-replace-yes">{t(`${KEY}.replaceYes`)}</Button>
          <Button type="button" size="xs" variant="ghost" onClick={() => setConfirming(false)}>{t(`${KEY}.cancel`)}</Button>
        </footer>
      </section>
    );
  }
  return (
    <Button type="button" size="sm" disabled={applying} onClick={replacing ? () => setConfirming(true) : apply} data-testid="mfd-scale-apply">
      {applying ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Ruler className="size-3.5" aria-hidden="true" />}
      {t(applying ? `${KEY}.applying` : replacing ? `${KEY}.replace` : `${KEY}.apply`)}
    </Button>
  );
}

function ProposalBody({ proposal, view, actions, t }: {
  readonly proposal: PlanScaleProposal;
  readonly view: PlanScaleView;
  readonly actions: PlanScaleActions;
  readonly t: Translate;
}): React.ReactElement {
  return (
    <>
      <p className={MUTED}>{t(`${KEY}.intro`)}</p>
      <ScaleSummary proposal={proposal} t={t} />
      {proposal.needsReview ? (
        <p className="m-0 flex items-start gap-1.5 text-[11px] text-foreground" role="status" data-testid="mfd-scale-review">
          <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          <span>{t(`${KEY}.needsReview`, {
            residual: percent(CALIBRATION_LIMITS.residualWarnRel), stretch: percent(CALIBRATION_LIMITS.anisotropyWarnRel),
          })}</span>
        </p>
      ) : null}
      <UsedList proposal={proposal} onHover={actions.onHover} t={t} />
      <RejectedList rejected={proposal.references.rejected} onHover={actions.onHover} t={t} />
      {view.stale ? <p className="m-0 text-[11px] text-destructive" role="status" data-testid="mfd-scale-stale">{t(`${KEY}.stale`)}</p> : null}
      <ApplyControls proposal={proposal} applying={view.applying} actions={actions} t={t} />
    </>
  );
}

function ConfirmedBody({ card, actions, t }: { readonly card: PlanScaleConfirmed; readonly actions: PlanScaleActions; readonly t: Translate }): React.ReactElement {
  return (
    <>
      <p className="m-0 flex items-center gap-1.5 text-[11px] text-foreground" role="status" data-testid="mfd-scale-confirmed">
        <CheckCircle2 className="size-3.5 shrink-0" aria-hidden="true" />
        <span>{t(`${KEY}.confirmed`, { count: card.agreeing, deviation: percent(card.maxDeviationRel) })}</span>
      </p>
      <RejectedList rejected={card.rejected} onHover={actions.onHover} t={t} />
    </>
  );
}

function FailedBody({ card, actions, t }: { readonly card: PlanScaleFailed; readonly actions: PlanScaleActions; readonly t: Translate }): React.ReactElement {
  return (
    <>
      <p className="m-0 text-[11px] text-destructive" role="status" data-testid="mfd-scale-failed" data-reason={card.reason}>
        {t(`${KEY}.failed.${card.reason}`)}
      </p>
      <RejectedList rejected={card.references.rejected} onHover={actions.onHover} t={t} />
    </>
  );
}

/** Η κάρτα κλίμακας· `null` όταν η αναγνώριση δεν έχει τίποτα να πει για την κλίμακα. */
export function PlanScaleCardSection({ view, actions, t }: {
  readonly view: PlanScaleView;
  readonly actions: PlanScaleActions;
  readonly t: Translate;
}): React.ReactElement | null {
  const { card } = view;
  if (card === null) return null;
  return (
    <section className="flex flex-col gap-1.5 border-t border-border pt-2" data-testid="mfd-scale" data-kind={card.kind}
      onMouseLeave={() => actions.onHover(null)}>
      <h4 className={SECTION_TITLE}>{t(`${KEY}.title`)}</h4>
      {card.kind === 'proposal' ? <ProposalBody proposal={card} view={view} actions={actions} t={t} /> : null}
      {card.kind === 'confirmed' ? <ConfirmedBody card={card} actions={actions} t={t} /> : null}
      {card.kind === 'failed' ? <FailedBody card={card} actions={actions} t={t} /> : null}
      {card.kind === 'confirmed' ? null : (
        <Button type="button" variant="ghost" size="xs" onClick={actions.onManual} data-testid="mfd-scale-manual">
          {t(`${KEY}.manual`)}
        </Button>
      )}
    </section>
  );
}
