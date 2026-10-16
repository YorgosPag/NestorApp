'use client';

/**
 * @fileoverview **Οι άδειες της βιτρίνας** — «έχω άδεια» + αριθμός μητρώου (ADR-915 §21).
 * @related config/professional-licences.ts · lib/agency/showcase-licence.ts (ο γραφέας) · AgencyShowcaseContent.tsx
 * @module components/mandate/ShowcaseLicenceField
 *
 * 🔑 **Άδεια ≠ επάγγελμα**: ο ενεργειακός επιθεωρητής δηλώνει ΗΔΗ την ειδικότητά του (μηχανικός, πιο πάνω) και ΕΔΩ την
 *    επιπλέον άδεια. Μία γραμμή ανά άδεια του λεξιλογίου — νέα άδεια = νέα γραμμή, καμία αλλαγή εδώ.
 * 🔑 **Η αρχή ονομάζεται, δεν επιλέγεται** — ίδια πρόταση με το credential (`registryLabel`), ώστε ο άνθρωπος να ξέρει
 *    **ποιανού** αριθμό δηλώνει. Ο αριθμός είναι υποχρεωτικός· χωρίς αυτόν ο γραφέας αρνείται ονομαστικά.
 * 🔑 Η κατάσταση της φόρμας ζει **εδώ** (τύπος + μετατροπές)· η φόρμα κρατά μόνο την τιμή.
 */

import React from 'react';

import { Checkbox } from '@/components/ui/checkbox';
import { HintedField } from '@/components/ui/hinted-field';
import { SHOWCASE_KEYS, SHOWCASE_NS } from '@/components/mandate/agency-showcase-labels';
import {
  PROFESSIONAL_LICENCES,
  PROFESSIONAL_LICENCE_SPECS,
  type ProfessionalLicence,
} from '@/config/professional-licences';
import { REGISTRY_AUTHORITY_PRESENTATION } from '@/constants/professional-registries';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { ShowcaseLicenceWire } from '@/lib/agency/showcase-wire';
import type { ShowcaseLicence } from '@/types/agency-profile';

/** Ανά άδεια: `null` = δεν την έχω · κείμενο = την έχω, με αυτόν τον αριθμό (ίσως ακόμη κενό). */
export type ShowcaseLicenceDrafts = Readonly<Record<ProfessionalLicence, string | null>>;

/** `Record` ολικός ⇒ νέα άδεια χωρίς γραμμή εδώ = σφάλμα μεταγλώττισης, όχι σιωπηλή απουσία από τη φόρμα. */
export const NO_LICENCE_DRAFTS: ShowcaseLicenceDrafts = { 'energy-inspector': null };
const NONE = NO_LICENCE_DRAFTS;

/** Από τη δημοσιευμένη βιτρίνα στη φόρμα. */
export function licenceDraftsOf(licences: readonly ShowcaseLicence[]): ShowcaseLicenceDrafts {
  const drafts: Record<ProfessionalLicence, string | null> = { ...NONE };
  for (const { licence, attestation } of licences) drafts[licence] = attestation.registration.number;
  return drafts;
}

/** Από τη φόρμα στο σύρμα — μόνο όσες δηλώνει· ο κενός αριθμός φτάνει στον γραφέα, που αρνείται **ονομαστικά**. */
export function licenceWireOf(drafts: ShowcaseLicenceDrafts): ShowcaseLicenceWire[] {
  return PROFESSIONAL_LICENCES.flatMap((licence) => {
    const number = drafts[licence];
    return number === null ? [] : [{ licence, registrationNumber: number }];
  });
}

export interface ShowcaseLicenceFieldProps {
  readonly value: ShowcaseLicenceDrafts;
  readonly onChange: (next: ShowcaseLicenceDrafts) => void;
}

export function ShowcaseLicenceField({ value, onChange }: ShowcaseLicenceFieldProps): React.ReactElement {
  const { t } = useTranslation([SHOWCASE_NS]);
  return (
    <fieldset className="flex flex-col gap-3 border-0 p-0">
      <legend className="text-sm font-medium text-foreground">{t(SHOWCASE_KEYS.licencesLabel)}</legend>
      <p className="m-0 text-sm text-muted-foreground">{t(SHOWCASE_KEYS.licencesHint)}</p>
      {PROFESSIONAL_LICENCES.map((licence) => (
        <LicenceRow
          key={licence}
          licence={licence}
          number={value[licence]}
          onChange={(number) => onChange({ ...value, [licence]: number })}
        />
      ))}
    </fieldset>
  );
}

function LicenceRow({
  licence,
  number,
  onChange,
}: {
  readonly licence: ProfessionalLicence;
  readonly number: string | null;
  readonly onChange: (number: string | null) => void;
}): React.ReactElement {
  const { t } = useTranslation([SHOWCASE_NS]);
  const spec = PROFESSIONAL_LICENCE_SPECS[licence];
  return (
    <>
      <label className="flex items-center gap-2 text-sm text-foreground">
        <Checkbox checked={number !== null} onCheckedChange={(checked) => onChange(checked === true ? '' : null)} />
        {t(SHOWCASE_KEYS.licenceHold, { licence: t(spec.nameKey) })}
      </label>
      {number !== null && (
        <HintedField
          id={`showcase-licence-${licence}`}
          label={t(SHOWCASE_KEYS.registryLabel, { authority: t(REGISTRY_AUTHORITY_PRESENTATION[spec.authority].nameKey) })}
          hint={t(SHOWCASE_KEYS.registryHint)}
          placeholder={t(SHOWCASE_KEYS.registryPlaceholder)}
          value={number}
          onChange={onChange}
        />
      )}
    </>
  );
}
