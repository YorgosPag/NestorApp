'use client';

/**
 * **Τα πεδία του ενεργειακού πιστοποιητικού** (ADR-777 §8.94) — κλάση · κατανάλωση · εκπομπές · έκδοση · «δεν έχω ΠΕΑ».
 *
 * @related `lib/energy-certificate/energy-certificate.ts` (τύπος · κανόνες) ·
 *   `components/owner-property/improve/EnergyCertificateImproveSection.tsx` («Βελτίωσε την αγγελία σου») ·
 *   `features/property-details/components/PropertyFieldsDetailCards.tsx` (φόρμα γραφείου)
 *
 * 🔑 **ΕΝΑ component για ιδιώτη ΚΑΙ γραφείο**: δεν ξέρει ποιο έγγραφο είναι ούτε πότε αποθηκεύεται — εκπέμπει
 * **μερική διόρθωση**, και ο καλών αποφασίζει (ουρά ανά απάντηση, ή κατάσταση φόρμας).
 *
 * 🔑 **Η κλάση ανοίγει τα υπόλοιπα**: αριθμοί και ημερομηνία ζητούνται **μόνο** δίπλα σε κλάση, και το «γιατί δεν
 * έχω ΠΕΑ» **μόνο** χωρίς κλάση — ίδιος κανόνας με τον αναγνώστη (ποτέ ορφανός προσδιοριστής).
 *
 * 🔑 **Οι αριθμοί αντιγράφονται από το πιστοποιητικό**, γι' αυτό δέχονται και κόμμα («125,4») και εκπέμπονται στο
 * blur: το ΠΕΑ τυπώνει ένα δεκαδικό, και το πεδίο δεν «διορθώνει» ό,τι δεν αναγνωρίζει — το σημαίνει άκυρο.
 */

import React from 'react';

import { CheckLine } from '@/components/shared/form/CheckLine';
import { ClearableSelect } from '@/components/ui/clearable-select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SelectItem } from '@/components/ui/select';
import { ENERGY_CLASSES, isEnergyClass } from '@/constants/energy-classes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { normalizeCalendarDay, todayLocalDate } from '@/lib/date-local';
import {
  ENERGY_CERTIFICATE_ABSENCES,
  MAX_CO2_EMISSIONS,
  MAX_PRIMARY_ENERGY,
  isCo2Emissions,
  isPrimaryEnergy,
  type EnergyCertificate,
  type EnergyCertificatePatch,
} from '@/lib/energy-certificate/energy-certificate';
import {
  ENERGY_CERTIFICATE_ABSENCE_KEY,
  ENERGY_CLASS_LABEL_KEY,
} from '@/lib/energy-certificate/energy-certificate-keys';

import { CertificateFigureField, figureReaderOf } from './CertificateFigureField';
import { FinalEnergyFields } from './FinalEnergyFields';

/** Τα κείμενα της ερώτησης ζουν δίπλα στο λεξιλόγιό της (`properties-enums`) — δες `energy-certificate-keys.ts`. */
const NS = 'properties-enums';

export interface EnergyCertificateFieldsProps {
  readonly value: EnergyCertificate;
  readonly onChange: (patch: EnergyCertificatePatch) => void;
  readonly disabled: boolean;
  /** Πρόθεμα για τα `id` — δύο στιγμιότυπα στην ίδια σελίδα δεν συγκρούονται. */
  readonly idPrefix: string;
}

const readPrimaryEnergy = figureReaderOf(isPrimaryEnergy);
const readCo2Emissions = figureReaderOf(isCo2Emissions);

function ClassField({ value, onChange, disabled, idPrefix }: EnergyCertificateFieldsProps) {
  const { t } = useTranslation([NS]);
  const selectId = `${idPrefix}-energy-class`;

  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={selectId} className="text-xs text-muted-foreground">{t('properties-enums:energyCertificate.form.class')}</Label>
      <ClearableSelect
        id={selectId}
        value={value.class ?? ''}
        disabled={disabled}
        onValueChange={(next) => onChange({ class: isEnergyClass(next) ? next : null })}
        placeholder={t('properties-enums:energyCertificate.form.classPlaceholder')}
        clearLabel={t('properties-enums:energyCertificate.form.classPlaceholder')}
      >
        {ENERGY_CLASSES.map((energyClass) => (
          <SelectItem key={energyClass} value={energyClass} className="text-xs">
            {t(ENERGY_CLASS_LABEL_KEY[energyClass])}
          </SelectItem>
        ))}
      </ClearableSelect>
    </div>
  );
}

/** Ό,τι γράφει το πιστοποιητικό πέρα από την κλάση — ζητείται μόνο όταν υπάρχει κλάση. */
function CertificateDetails({ value, onChange, disabled, idPrefix }: EnergyCertificateFieldsProps) {
  const { t } = useTranslation([NS]);
  const issuedId = `${idPrefix}-energy-issued-on`;

  return (
    <>
      <CertificateFigureField
        inputId={`${idPrefix}-energy-primary`}
        label={t('properties-enums:energyCertificate.form.primaryEnergy')}
        hint={t('properties-enums:energyCertificate.form.primaryEnergyHint')}
        invalidText={t('properties-enums:energyCertificate.form.figureInvalid', { max: MAX_PRIMARY_ENERGY })}
        figure={value.primaryEnergy}
        read={readPrimaryEnergy}
        onCommit={(primaryEnergy) => onChange({ primaryEnergy })}
        disabled={disabled}
      />
      <CertificateFigureField
        inputId={`${idPrefix}-energy-co2`}
        label={t('properties-enums:energyCertificate.form.co2Emissions')}
        hint={t('properties-enums:energyCertificate.form.co2EmissionsHint')}
        invalidText={t('properties-enums:energyCertificate.form.figureInvalid', { max: MAX_CO2_EMISSIONS })}
        figure={value.co2Emissions}
        read={readCo2Emissions}
        onCommit={(co2Emissions) => onChange({ co2Emissions })}
        disabled={disabled}
      />
      <div className="flex flex-col gap-1">
        <Label htmlFor={issuedId} className="text-xs text-muted-foreground">{t('properties-enums:energyCertificate.form.issuedOn')}</Label>
        <Input
          id={issuedId}
          type="date"
          value={value.issuedOn ?? ''}
          max={todayLocalDate()}
          onChange={(event) => onChange({ issuedOn: normalizeCalendarDay(event.target.value) })}
          size="sm"
          className="max-w-40 text-xs"
          aria-describedby={`${issuedId}-hint`}
          disabled={disabled}
        />
        <p id={`${issuedId}-hint`} className="m-0 text-xs text-muted-foreground">{t('properties-enums:energyCertificate.form.issuedOnHint')}</p>
      </div>
    </>
  );
}

/** «Γιατί δεν έχω κλάση να δηλώσω» — μία απάντηση ή καμία· ζητείται μόνο όταν δεν υπάρχει κλάση. */
function AbsenceField({ value, onChange, disabled }: EnergyCertificateFieldsProps) {
  const { t } = useTranslation([NS]);

  return (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
      <legend className="p-0 text-xs text-muted-foreground">{t('properties-enums:energyCertificate.form.absenceLegend')}</legend>
      {ENERGY_CERTIFICATE_ABSENCES.map((absence) => (
        <CheckLine
          key={absence}
          label={t(ENERGY_CERTIFICATE_ABSENCE_KEY[absence])}
          checked={value.absence === absence}
          disabled={disabled}
          onToggle={(checked) => onChange({ absence: checked ? absence : null })}
        />
      ))}
    </fieldset>
  );
}

export function EnergyCertificateFields(props: EnergyCertificateFieldsProps) {
  return (
    <div className="flex flex-col gap-3">
      <ClassField {...props} />
      {props.value.class === null ? (
        <AbsenceField {...props} />
      ) : (
        <>
          <CertificateDetails {...props} />
          <FinalEnergyFields {...props} />
        </>
      )}
    </div>
  );
}
