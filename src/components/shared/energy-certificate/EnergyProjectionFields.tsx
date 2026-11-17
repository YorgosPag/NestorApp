'use client';

/**
 * **Η εκτίμηση της ΜΕΑ για ακίνητο υπό κατασκευή** (ADR-777 §8.102) — αναμενόμενη κλάση · εμβέλεια · αρχείο της μελέτης.
 *
 * ⚠️ Οι υπενθυμίσεις του κύκλου ζωής **δεν** ζουν εδώ αλλά στη φόρμα του γραφείου (`EnergyConstructionWarning`): αυτό το
 * component φορτώνεται και στη σελίδα του ιδιώτη, και το `PlausibilityAlert` (δυναμική `t(titleKey)`) θα έσπαγε το
 * i18n slice εκείνης της διαδρομής — μετρημένο από τον γεννήτορα, 2026-11-17.
 *
 * @related `lib/energy-certificate/energy-certificate.ts` (`EnergyProjection`) ·
 *   `lib/energy-certificate/energy-construction-notice.ts` (πότε υπενθυμίζεται τι) · `./EnergyCertificateFields.tsx`
 *
 * 🔑 **Ζητείται μόνο όταν η απάντηση είναι «υπό κατασκευή»** — ίδιος κανόνας με τον αναγνώστη (ποτέ ορφανή εκτίμηση).
 * 🔑 **Το αρχείο διαλέγεται, δεν πληκτρολογείται**: η οθόνη προσφέρει μόνο τις ΜΕΑ του έργου· ο server ξαναρωτά τον ίδιο
 * κριτή δοχείου (`projectionSourceAccepted`), γιατί το id έρχεται από τον πελάτη.
 */

import React from 'react';

import { ENERGY_CLASSES, isEnergyClass } from '@/constants/energy-classes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  ENERGY_CERTIFICATE_SCOPES,
  isEnergyCertificateScope,
  type EnergyCertificate,
  type EnergyCertificatePatch,
  type EnergyProjection,
} from '@/lib/energy-certificate/energy-certificate';
import { ENERGY_CERTIFICATE_SCOPE_KEY, ENERGY_CLASS_LABEL_KEY } from '@/lib/energy-certificate/energy-certificate-keys';
import type { EnergyStudyOption } from '@/lib/energy-certificate/energy-construction-notice';

import { BlockSelect } from './BlockSelect';

const NS = 'properties-enums';

interface EnergyProjectionFieldsProps {
  readonly value: EnergyCertificate;
  readonly onChange: (patch: EnergyCertificatePatch) => void;
  readonly disabled: boolean;
  readonly idPrefix: string;
  readonly studies: readonly EnergyStudyOption[] | null;
}

/** Η διόρθωση της εκτίμησης: αλλάζει ένα πεδίο, κρατά τα άλλα· χωρίς κλάση η εκτίμηση σβήνει ολόκληρη. */
function projectionPatch(current: EnergyProjection | null, change: Partial<EnergyProjection>): EnergyCertificatePatch {
  const energyClass = change.class ?? current?.class ?? null;
  if (energyClass === null) return { projection: null };
  return {
    projection: {
      class: energyClass,
      scope: change.scope !== undefined ? change.scope : (current?.scope ?? null),
      sourceFileId: change.sourceFileId !== undefined ? change.sourceFileId : (current?.sourceFileId ?? null),
    },
  };
}

function StudySourceField({ value, onChange, disabled, idPrefix, studies }: EnergyProjectionFieldsProps) {
  const { t } = useTranslation([NS]);
  if (studies === null || studies.length === 0) {
    // Κλειδιά κυριολεκτικά, όχι από μεταβλητή: ο γεννήτορας του slice λύνει μόνο ό,τι διαβάζει.
    const text =
      studies === null
        ? t('properties-enums:energyCertificate.projection.sourceNoProject')
        : t('properties-enums:energyCertificate.projection.sourceEmpty');
    return <p className="m-0 text-xs text-muted-foreground">{text}</p>;
  }
  const labelOf = new Map(studies.map((study) => [study.fileId, study.label]));
  return (
    <BlockSelect
      selectId={`${idPrefix}-energy-projection-source`}
      label={t('properties-enums:energyCertificate.projection.source')}
      placeholder={t('properties-enums:energyCertificate.projection.sourcePlaceholder')}
      hint={t('properties-enums:energyCertificate.projection.sourceHint')}
      value={value.projection?.sourceFileId ?? null}
      options={studies.map((study) => study.fileId)}
      optionLabel={(fileId) => labelOf.get(fileId) ?? fileId}
      onPick={(next) => onChange(projectionPatch(value.projection, { sourceFileId: labelOf.has(next) ? next : null }))}
      disabled={disabled}
    />
  );
}

/** Τα πεδία της εκτίμησης — ζητούνται μόνο δίπλα στο «υπό κατασκευή». */
export function EnergyProjectionFields(props: EnergyProjectionFieldsProps) {
  const { value, onChange, disabled, idPrefix } = props;
  const { t } = useTranslation([NS]);
  const projection = value.projection;

  return (
    <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
      <legend className="p-0 text-xs font-medium text-foreground">{t('properties-enums:energyCertificate.projection.legend')}</legend>
      <BlockSelect
        selectId={`${idPrefix}-energy-projection-class`}
        label={t('properties-enums:energyCertificate.projection.class')}
        placeholder={t('properties-enums:energyCertificate.projection.classPlaceholder')}
        hint={t('properties-enums:energyCertificate.projection.classHint')}
        value={projection?.class ?? null}
        options={ENERGY_CLASSES}
        optionLabel={(energyClass) => t(ENERGY_CLASS_LABEL_KEY[energyClass])}
        onPick={(next) => onChange(isEnergyClass(next) ? projectionPatch(projection, { class: next }) : { projection: null })}
        disabled={disabled}
      />
      {projection !== null && (
        <>
          <BlockSelect
            selectId={`${idPrefix}-energy-projection-scope`}
            label={t('properties-enums:energyCertificate.projection.scope')}
            placeholder={t('properties-enums:energyCertificate.projection.scopePlaceholder')}
            value={projection.scope}
            options={ENERGY_CERTIFICATE_SCOPES}
            optionLabel={(scope) => t(ENERGY_CERTIFICATE_SCOPE_KEY[scope])}
            onPick={(next) => onChange(projectionPatch(projection, { scope: isEnergyCertificateScope(next) ? next : null }))}
            disabled={disabled}
          />
          <StudySourceField {...props} />
        </>
      )}
    </fieldset>
  );
}
