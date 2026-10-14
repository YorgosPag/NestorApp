'use client';

/**
 * **«Τι θα αλλάξει»** — ο πίνακας «τρέχον → από ΠΕΑ» της προεπισκόπησης εισαγωγής (ADR-777 §8.96).
 *
 * @related `./EnergyCertificateImportReview.tsx` (ο διάλογος) · `lib/energy-certificate/pea-proposal.ts` (η πρόταση)
 *
 * 🔑 **Κάθε γραμμή, και αυτές που μένουν ίδιες**: ο άνθρωπος βλέπει ολόκληρο το μπλοκ που θα ισχύει, όχι μόνο τη
 * διαφορά — ένα ΠΕΑ αντικαθιστά ολόκληρο το μπλοκ, άρα και το «αυτό σβήνεται» είναι αλλαγή που πρέπει να φαίνεται.
 * 🔑 Η αλλαγή λέγεται **με λέξη**, όχι μόνο με χρώμα (WCAG 1.4.1).
 */

import React from 'react';

import type { EnergyClass } from '@/constants/energy-classes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { FinalEnergyLine } from '@/lib/energy-certificate/certificate-final-energy';
import type { EnergyCertificate, EnergyCertificateScope } from '@/lib/energy-certificate/energy-certificate';
import {
  CERTIFICATE_ENERGY_SOURCE_KEY,
  ENERGY_CERTIFICATE_SCOPE_KEY,
  ENERGY_CLASS_LABEL_KEY,
} from '@/lib/energy-certificate/energy-certificate-keys';
import type { PeaFigures } from '@/lib/energy-certificate/pea-proposal';
import { formatDate, formatNumber } from '@/lib/intl-formatting';

const NS = 'properties-enums';

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** Το μπλοκ που θα ισχύσει — κλάση και εμβέλεια `null` όσο δεν τις έχει κλείσει ο άνθρωπος. */
export interface ProposedCertificate extends PeaFigures {
  readonly class: EnergyClass | null;
  readonly scope: EnergyCertificateScope | null;
}

interface Row {
  readonly key: string;
  readonly label: string;
  readonly current: string;
  readonly next: string;
}

const figure = (value: number | null, empty: string): string =>
  value === null ? empty : formatNumber(value, { maximumFractionDigits: 1 });

function linesText(t: Translate, lines: readonly FinalEnergyLine[] | null, empty: string): string {
  if (lines === null) return empty;
  return lines.map((line) => `${t(CERTIFICATE_ENERGY_SOURCE_KEY[line.source])} ${figure(line.perSqm, empty)}`).join(' · ');
}

function rowsOf(t: Translate, current: EnergyCertificate, next: ProposedCertificate): readonly Row[] {
  const empty = t(`${NS}:energyCertificate.import.review.empty`);
  const cls = (value: EnergyClass | null) => (value === null ? empty : t(ENERGY_CLASS_LABEL_KEY[value]));
  const scope = (value: EnergyCertificateScope | null) => (value === null ? empty : t(ENERGY_CERTIFICATE_SCOPE_KEY[value]));
  const day = (value: string | null) => (value === null ? empty : formatDate(value, { timeZone: 'UTC' }));
  return [
    { key: 'class', label: t(`${NS}:energyCertificate.form.class`), current: cls(current.class), next: cls(next.class) },
    { key: 'scope', label: t(`${NS}:energyCertificate.form.scope`), current: scope(current.scope), next: scope(next.scope) },
    { key: 'primary', label: t(`${NS}:energyCertificate.form.primaryEnergy`), current: figure(current.primaryEnergy, empty), next: figure(next.primaryEnergy, empty) },
    { key: 'co2', label: t(`${NS}:energyCertificate.form.co2Emissions`), current: figure(current.co2Emissions, empty), next: figure(next.co2Emissions, empty) },
    { key: 'issued', label: t(`${NS}:energyCertificate.form.issuedOn`), current: day(current.issuedOn), next: day(next.issuedOn) },
    { key: 'area', label: t(`${NS}:energyCertificate.form.usefulArea`), current: figure(current.usefulArea, empty), next: figure(next.usefulArea, empty) },
    { key: 'final', label: t(`${NS}:energyCertificate.form.finalEnergyLegend`), current: linesText(t, current.finalEnergy, empty), next: linesText(t, next.finalEnergy, empty) },
  ];
}

export function EnergyCertificateImportChanges({
  current,
  next,
}: {
  readonly current: EnergyCertificate;
  readonly next: ProposedCertificate;
}) {
  const { t } = useTranslation([NS]);

  return (
    <table className="w-full border-collapse text-xs">
      <caption className="pb-2 text-left text-sm font-semibold text-foreground">
        {t(`${NS}:energyCertificate.import.review.changesHeading`)}
      </caption>
      <thead>
        <tr className="text-left text-muted-foreground">
          <th scope="col" className="py-1 pr-2 font-medium">{t(`${NS}:energyCertificate.import.review.columnField`)}</th>
          <th scope="col" className="py-1 pr-2 font-medium">{t(`${NS}:energyCertificate.import.review.columnCurrent`)}</th>
          <th scope="col" className="py-1 font-medium">{t(`${NS}:energyCertificate.import.review.columnNext`)}</th>
        </tr>
      </thead>
      <tbody>
        {rowsOf(t, current, next).map((row) => (
          <tr key={row.key} className="border-t border-border align-top">
            <th scope="row" className="py-1 pr-2 text-left font-normal text-muted-foreground">{row.label}</th>
            <td className="py-1 pr-2 text-foreground">{row.current}</td>
            <td className="py-1 text-foreground">
              <span className={row.current === row.next ? undefined : 'font-semibold'}>{row.next}</span>
              {row.current !== row.next && (
                <span className="ml-2 text-muted-foreground">{t(`${NS}:energyCertificate.import.review.changed`)}</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
