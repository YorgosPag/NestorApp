'use client';

/**
 * ADR-929 §6.23 — η **επιβεβαιωμένη** κάρτα κλίμακας: όχι πια αδιέξοδο «συμφωνεί, μέγιστη απόκλιση x%».
 *
 * - **Ετυμηγορία** του ολικού τεστ χ² (`calibrationAgreement`): εξηγούνται οι διαφορές από την ακρίβεια των γραμμένων
 *   τιμών, ή όχι; Bluebeam / STACK / PlanSwift δείχνουν μόνο την απόκλιση και αφήνουν την κρίση στον άνθρωπο.
 * - **Ανά διάσταση**: «σχέδιο − γραμμένο» δίπλα στο εύρος στρογγυλοποίησης της τιμής (±μισό τελευταίο ψηφίο).
 * - **Προέλευση** της βαθμονόμησης: το διανυσματικό PDF μετρά ακριβέστερα από την εικόνα.
 * - «Ευθυγράμμιση με τις διαστάσεις…» — **πάντα** διαθέσιμη (Bluebeam: η επαναβαθμονόμηση δεν κρύβεται ποτέ).
 *
 * Καθαρή παρουσίαση: δεν διαβάζει store, δεν γράφει τίποτα.
 *
 * @see ../../../bim/plan-recognition/fusion/calibration-agreement.ts
 */

import * as React from 'react';
import { CheckCircle2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatNumber, formatPercentage } from '@/lib/intl-formatting';
import type { PlanScaleConfirmed } from '../../../systems/plan-recognition/plan-scale-card';
import type { CalibrationAgreementRow } from '../../../bim/plan-recognition/fusion/calibration-agreement';
import { MUTED, type Translate } from './ModelFromDrawingSections';

const KEY = 'modelFromDrawing.image.scale';

const mm = (value: number): string => formatNumber(value, { maximumFractionDigits: 0 });
const signedMm = (value: number): string => formatNumber(value, { maximumFractionDigits: 0, signDisplay: 'exceptZero' });
const percent = (rel: number): string => formatPercentage(rel * 100, { maximumFractionDigits: 2 });

function AgreementRows({ rows, onHover, t }: {
  readonly rows: readonly CalibrationAgreementRow[];
  readonly onHover: (textId: string | null) => void;
  readonly t: Translate;
}): React.ReactElement {
  return (
    <ul className="m-0 flex list-none flex-col gap-0.5 p-0" aria-label={t(`${KEY}.agreementLabel`)} data-testid="mfd-scale-agreement-rows">
      {rows.map((r) => (
        <li key={r.textId} className="m-0 text-[11px] text-foreground" data-text-id={r.textId}
          onMouseEnter={() => onHover(r.textId)} onMouseLeave={() => onHover(null)}>
          {t(`${KEY}.agreementItem`, { value: mm(r.valueMm), misfit: signedMm(r.misfitMm), half: formatNumber(r.precisionMm / 2, { maximumFractionDigits: 1 }) })}
        </li>
      ))}
    </ul>
  );
}

/** Η επιβεβαιωμένη κατάσταση· το κουμπί ευθυγράμμισης κρύβεται όσο η ευθυγράμμιση είναι ανοιχτή. */
export function PlanScaleConfirmedBody({ card, refining, onRefine, onHover, t }: {
  readonly card: PlanScaleConfirmed;
  readonly refining: boolean;
  readonly onRefine: () => void;
  readonly onHover: (textId: string | null) => void;
  readonly t: Translate;
}): React.ReactElement {
  const { agreement, origin } = card;
  return (
    <>
      <p className="m-0 flex items-center gap-1.5 text-[11px] text-foreground" role="status" data-testid="mfd-scale-confirmed">
        <CheckCircle2 className="size-3.5 shrink-0" aria-hidden="true" />
        <span>{t(`${KEY}.confirmed`, { count: agreement.rows.length, deviation: percent(agreement.maxDeviationRel) })}</span>
      </p>
      <p className="m-0 flex items-start gap-1.5 text-[11px] text-foreground" data-testid="mfd-scale-verdict"
        data-within={agreement.withinPrecision ? 'true' : 'false'}>
        <Info className="mt-px size-3.5 shrink-0" aria-hidden="true" />
        <span>{t(agreement.withinPrecision ? `${KEY}.agreementWithin` : `${KEY}.agreementBeyond`)}</span>
      </p>
      <AgreementRows rows={agreement.rows} onHover={onHover} t={t} />
      {origin !== null ? <p className={MUTED} data-testid="mfd-scale-origin" data-origin={origin}>{t(`${KEY}.origin.${origin}`)}</p> : null}
      {refining ? null : (
        <Button type="button" variant="outline" size="xs" onClick={onRefine} data-testid="mfd-scale-refine">
          {t(`${KEY}.refine`)}
        </Button>
      )}
    </>
  );
}
