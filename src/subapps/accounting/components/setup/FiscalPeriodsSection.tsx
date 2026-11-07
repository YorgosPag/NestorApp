'use client';

/**
 * @fileoverview Ρύθμιση Επιχείρησης — Λογιστικές χρήσεις (ADR-ACC-010 §2.1.1 Φ9-Β)
 * @description Οι 13 περίοδοι μιας χρήσης με την κατάστασή τους, και οι διοικητικές πράξεις του SAP OB52 / Xero
 *   «Lock dates»: άνοιγμα χρήσης (για έτη ΕΚΤΟΣ του αυτόματου παραθύρου — μέσα σε αυτό η χρήση ανοίγει μόνη της, Φ9-Α),
 *   κλείσιμο · κλείδωμα · επαναφορά περιόδου. Οι ενέργειες προσφέρονται μόνο σε διαχειριστή (`admin_access`, ο ΕΝΑΣ
 *   κριτής — ADR-801)· τις κρίνει ΠΑΝΤΑ ο διακομιστής (`ADMINISTRATIVE_ROLES` + κατάσταση μέσα στη συναλλαγή).
 *   Οι διαθέσιμες ενέργειες ανά κατάσταση βγαίνουν από τον ΙΔΙΟ πίνακα μεταβάσεων του γραφέα (`fiscalPeriodActionsFrom`).
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles, semantic HTML
 */

import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarRange } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useCapability } from '@/auth/hooks/useCapability';
import { isGranted } from '@/types/capability-authority';
import type { TranslatorFn } from '@/lib/policy/policy-error-translator';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { FiscalYearPicker } from '../shared/FiscalYearPicker';
import { useFiscalPeriods, type FiscalPeriodFailureCode } from '../../hooks/useFiscalPeriods';
import { fiscalPeriodActionsFrom } from '../../services/fiscal-period-transitions';
import { fiscalPeriodLabel } from '../../utils/posting-period-denial';
import { formatAccountingDate } from '../../utils/format';
import type { FiscalPeriod, FiscalPeriodStatus } from '../../types/fiscal-period';
import { FiscalPeriodActionDialog, type FiscalPeriodActionTarget } from './FiscalPeriodActionDialog';

/** Οι αρνήσεις του διακομιστή που έχουν δικό τους κείμενο· οτιδήποτε άλλο ⇒ γενικό μήνυμα. */
const KNOWN_FAILURES = [
  'FISCAL_YEAR_EXISTS',
  'FISCAL_YEAR_INCOMPLETE',
  'FISCAL_PERIOD_NOT_FOUND',
  'FISCAL_PERIOD_INVALID_TRANSITION',
] as const;

const STATUS_BADGE: Readonly<Record<FiscalPeriodStatus, 'outline' | 'secondary' | 'destructive'>> = {
  OPEN: 'outline',
  CLOSED: 'secondary',
  LOCKED: 'destructive',
};

function failureText(code: FiscalPeriodFailureCode, t: TranslatorFn): string {
  const known = (KNOWN_FAILURES as readonly string[]).includes(code) ? code : 'UNKNOWN';
  return t(`accounting:fiscalPeriods.manage.errors.${known}`);
}

interface PeriodRowProps {
  readonly period: FiscalPeriod;
  readonly label: string;
  readonly canManage: boolean;
  readonly running: boolean;
  readonly onAction: (target: FiscalPeriodActionTarget) => void;
}

function PeriodRow({ period, label, canManage, running, onAction }: PeriodRowProps) {
  const { t } = useTranslation('accounting');
  return (
    <tr className="border-b border-border last:border-0">
      <th scope="row" className="py-2 pr-4 text-left font-medium">{label}</th>
      <td className="py-2 pr-4">{formatAccountingDate(period.startDate)} – {formatAccountingDate(period.endDate)}</td>
      <td className="py-2 pr-4"><Badge variant={STATUS_BADGE[period.status]}>{t(`fiscalPeriods.manage.statuses.${period.status}`)}</Badge></td>
      {canManage && (
        <td className="py-2 text-right space-x-2">
          {fiscalPeriodActionsFrom(period.status).map((action) => (
            <Button key={action} size="sm" variant={action === 'lock' ? 'destructive' : 'outline'} disabled={running}
              onClick={() => onAction({ periodId: period.periodId, periodLabel: label, action })}>
              {t(`fiscalPeriods.manage.actions.${action}`)}
            </Button>
          ))}
        </td>
      )}
    </tr>
  );
}

interface YearNotOpenProps {
  readonly year: number;
  readonly canManage: boolean;
  readonly running: boolean;
  readonly onOpen: () => void;
}

function YearNotOpen({ year, canManage, running, onOpen }: YearNotOpenProps) {
  const { t } = useTranslation('accounting');
  const colors = useSemanticColors();
  return (
    <section className="space-y-3 py-4">
      <p className={`text-sm ${colors.text.muted}`}>{t('fiscalPeriods.manage.notOpen', { year: String(year) })}</p>
      {canManage && (
        <Button onClick={onOpen} disabled={running}>
          {running && <Spinner size="small" className="mr-2" />}
          {t('fiscalPeriods.manage.openYear', { year: String(year) })}
        </Button>
      )}
    </section>
  );
}

export function FiscalPeriodsSection() {
  const { t } = useTranslation('accounting');
  const colors = useSemanticColors();
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [target, setTarget] = useState<FiscalPeriodActionTarget | null>(null);
  const { periods, loading, loadFailure, running, actionFailure, openYear, transition, clearActionFailure } = useFiscalPeriods(year);
  const canManage = isGranted(useCapability('admin_access').verdict);

  const rows = useMemo(
    () => [...periods].sort((a, b) => a.periodNumber - b.periodNumber)
      .map((period) => ({ period, label: fiscalPeriodLabel(period.fiscalYear, period.periodNumber, t) })),
    [periods, t]
  );

  const startAction = useCallback((next: FiscalPeriodActionTarget) => { clearActionFailure(); setTarget(next); }, [clearActionFailure]);
  const confirm = useCallback(async (pending: FiscalPeriodActionTarget, reason: string | null) => {
    if (await transition(pending.periodId, pending.action, reason)) setTarget(null);
  }, [transition]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><CalendarRange className="h-5 w-5" aria-hidden="true" />{t('fiscalPeriods.manage.title')}</CardTitle>
        <CardDescription>{t('fiscalPeriods.manage.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <section className="max-w-[12rem]" aria-label={t('fiscalPeriods.manage.yearLabel')}>
          <FiscalYearPicker value={year} onValueChange={setYear} disabled={running} />
        </section>
        {loading && <Spinner size="medium" />}
        {!loading && loadFailure !== null && <p role="alert" className={`text-sm ${colors.text.error}`}>{failureText(loadFailure, t)}</p>}
        {!loading && loadFailure === null && rows.length === 0 && (
          <YearNotOpen year={year} canManage={canManage} running={running} onOpen={() => void openYear()} />
        )}
        {target === null && actionFailure !== null && <p role="alert" className={`text-sm ${colors.text.error}`}>{failureText(actionFailure, t)}</p>}
        {!loading && rows.length > 0 && (
          <table className="w-full text-sm">
            <thead className={colors.text.muted}>
              <tr className="border-b border-border text-left">
                <th scope="col" className="py-2 pr-4 font-normal">{t('fiscalPeriods.manage.columns.period')}</th>
                <th scope="col" className="py-2 pr-4 font-normal">{t('fiscalPeriods.manage.columns.range')}</th>
                <th scope="col" className="py-2 pr-4 font-normal">{t('fiscalPeriods.manage.columns.status')}</th>
                {canManage && <th scope="col" className="py-2 text-right font-normal">{t('fiscalPeriods.manage.columns.actions')}</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ period, label }) => (
                <PeriodRow key={period.periodId} period={period} label={label} canManage={canManage} running={running} onAction={startAction} />
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
      <FiscalPeriodActionDialog target={target} running={running}
        failureMessage={target !== null && actionFailure !== null ? failureText(actionFailure, t) : null}
        onConfirm={(pending, reason) => void confirm(pending, reason)} onClose={() => setTarget(null)} />
    </Card>
  );
}
