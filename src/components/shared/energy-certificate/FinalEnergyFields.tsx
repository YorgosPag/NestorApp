'use client';

/**
 * **Η ωφέλιμη επιφάνεια και η τελική ενέργεια ανά πηγή του ΠΕΑ** (ADR-777 §8.95) — τα δύο πεδία από τα οποία η
 * δημόσια αγγελία βγάζει την εκτίμηση ετήσιου κόστους.
 *
 * @related `lib/energy-certificate/certificate-final-energy.ts` (κανόνες) · `./EnergyCertificateFields.tsx` (το κρεμά,
 *   μόνο δίπλα σε κλάση) · `lib/energy-cost/listing-energy-cost.ts` (τι γίνεται με αυτά)
 *
 * 🔑 **Γραμμές που προστίθενται, όχι οκτώ άδεια κουτιά**: ένα πιστοποιητικό κατοικίας γράφει συνήθως μία έως τρεις
 * πηγές. Ο άνθρωπος διαλέγει πηγή και γράφει τον αριθμό της στήλης «Συνολική».
 *
 * 🔑 **Ο πίνακας εκπέμπεται ΟΛΟΚΛΗΡΟΣ** σε κάθε αλλαγή (ίδιος κανόνας με τον αναγνώστη: ολόκληρος ή καθόλου). Μια
 * γραμμή που περιμένει ακόμη αριθμό ζει **μόνο** στην οθόνη — πηγή χωρίς αριθμό δεν είναι δήλωση.
 */

import React, { useState } from 'react';

import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  CERTIFICATE_ENERGY_SOURCES,
  certificateEnergySourceRank,
  isCertificateEnergySource,
  type CertificateEnergySource,
} from '@/constants/certificate-energy-sources';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  MAX_FINAL_ENERGY_PER_SQM,
  MAX_USEFUL_AREA,
  isFinalEnergyPerSqm,
  isUsefulArea,
  type FinalEnergyLine,
} from '@/lib/energy-certificate/certificate-final-energy';
import type { EnergyCertificate, EnergyCertificatePatch } from '@/lib/energy-certificate/energy-certificate';
import { CERTIFICATE_ENERGY_SOURCE_KEY } from '@/lib/energy-certificate/energy-certificate-keys';

import { CertificateFigureField, figureReaderOf } from './CertificateFigureField';

const NS = 'properties-enums';

const readUsefulArea = figureReaderOf(isUsefulArea);
const readPerSqm = figureReaderOf(isFinalEnergyPerSqm);

export interface FinalEnergyFieldsProps {
  readonly value: Pick<EnergyCertificate, 'usefulArea' | 'finalEnergy'>;
  readonly onChange: (patch: EnergyCertificatePatch) => void;
  readonly disabled: boolean;
  readonly idPrefix: string;
}

/** Ο πίνακας με τη γραμμή της πηγής αλλαγμένη ή βγαλμένη· κενός πίνακας ⇒ `null` («δεν δηλώθηκε»). */
function withLine(
  lines: readonly FinalEnergyLine[],
  source: CertificateEnergySource,
  perSqm: number | null,
): readonly FinalEnergyLine[] | null {
  const others = lines.filter((line) => line.source !== source);
  const next = perSqm === null ? others : [...others, { source, perSqm }];
  return next.length === 0 ? null : next;
}

/** Οι πηγές που φαίνονται ως γραμμές: οι δηλωμένες και όσες περιμένουν αριθμό, σε σειρά εντύπου. */
function shownSources(lines: readonly FinalEnergyLine[], pending: readonly CertificateEnergySource[]): CertificateEnergySource[] {
  const declared = lines.map((line) => line.source);
  return [...new Set([...declared, ...pending])].sort((a, b) => certificateEnergySourceRank(a) - certificateEnergySourceRank(b));
}

interface AddSourceProps {
  readonly selectId: string;
  readonly remaining: readonly CertificateEnergySource[];
  readonly onAdd: (source: CertificateEnergySource) => void;
  readonly disabled: boolean;
}

function AddSource({ selectId, remaining, onAdd, disabled }: AddSourceProps) {
  const { t } = useTranslation([NS]);
  if (remaining.length === 0) return null;

  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={selectId} className="text-xs text-muted-foreground">{t('properties-enums:energyCertificate.form.addSource')}</Label>
      <Select value="" disabled={disabled} onValueChange={(next) => isCertificateEnergySource(next) && onAdd(next)}>
        <SelectTrigger id={selectId} className="max-w-64 text-xs">
          <SelectValue placeholder={t('properties-enums:energyCertificate.form.addSourcePlaceholder')} />
        </SelectTrigger>
        <SelectContent>
          {remaining.map((source) => (
            <SelectItem key={source} value={source} className="text-xs">{t(CERTIFICATE_ENERGY_SOURCE_KEY[source])}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Οι γραμμές του πίνακα — μία ανά πηγή που δηλώθηκε ή περιμένει αριθμό — και η προσθήκη νέας. */
function FinalEnergyLines({ value, onChange, disabled, idPrefix }: FinalEnergyFieldsProps) {
  const { t } = useTranslation([NS]);
  const [pending, setPending] = useState<readonly CertificateEnergySource[]>([]);
  const lines = value.finalEnergy ?? [];
  const shown = shownSources(lines, pending);

  const commitLine = (source: CertificateEnergySource, perSqm: number | null) => {
    setPending((current) => current.filter((entry) => entry !== source));
    onChange({ finalEnergy: withLine(lines, source, perSqm) });
  };

  return (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
      <legend className="p-0 text-xs text-muted-foreground">{t('properties-enums:energyCertificate.form.finalEnergyLegend')}</legend>
      <p className="m-0 text-xs text-muted-foreground">{t('properties-enums:energyCertificate.form.finalEnergyHint')}</p>
      {shown.map((source) => (
        <CertificateFigureField
          key={source}
          inputId={`${idPrefix}-energy-final-${source}`}
          label={t(CERTIFICATE_ENERGY_SOURCE_KEY[source])}
          hint={t('properties-enums:energyCertificate.form.finalEnergyUnit')}
          invalidText={t('properties-enums:energyCertificate.form.positiveInvalid', { max: MAX_FINAL_ENERGY_PER_SQM })}
          figure={lines.find((line) => line.source === source)?.perSqm ?? null}
          read={readPerSqm}
          onCommit={(perSqm) => commitLine(source, perSqm)}
          disabled={disabled}
        />
      ))}
      <AddSource
        selectId={`${idPrefix}-energy-final-add`}
        remaining={CERTIFICATE_ENERGY_SOURCES.filter((source) => !shown.includes(source))}
        onAdd={(source) => setPending((current) => [...current, source])}
        disabled={disabled}
      />
    </fieldset>
  );
}

export function FinalEnergyFields(props: FinalEnergyFieldsProps) {
  const { t } = useTranslation([NS]);
  const { value, onChange, disabled, idPrefix } = props;

  return (
    <>
      <CertificateFigureField
        inputId={`${idPrefix}-energy-useful-area`}
        label={t('properties-enums:energyCertificate.form.usefulArea')}
        hint={t('properties-enums:energyCertificate.form.usefulAreaHint')}
        invalidText={t('properties-enums:energyCertificate.form.positiveInvalid', { max: MAX_USEFUL_AREA })}
        figure={value.usefulArea}
        read={readUsefulArea}
        onCommit={(usefulArea) => onChange({ usefulArea })}
        disabled={disabled}
      />
      <FinalEnergyLines {...props} />
    </>
  );
}
