'use client';

/**
 * @fileoverview **«Στοιχεία ακινήτου στο PDF»** — περιγραφή + ΚΑΕΚ, προαιρετικά, ακριβώς πάνω από τη «Λήψη PDF»
 *               (ADR-947 §11 Δ-Φ2β.2).
 * @module components/objective-value/ObjectiveValuePdfIdentification
 * @related lib/objective-value/objective-value-identification.ts (ο κανόνας) · components/ui/hinted-field.tsx (το πεδίο) ·
 *   ObjectiveValuePdfButton.tsx (ο καταναλωτής)
 *
 * 🔑 **Εκεί που χρησιμοποιούνται**: τα πεδία αφορούν **μόνο** το PDF, γι' αυτό ζουν δίπλα στο κουμπί — όχι μέσα στις
 *    ερωτήσεις της μηχανής, που δεν τα χρειάζεται.
 * 🔑 **Επικύρωση ΜΕΤΑ το πεδίο** (Baymard): το σφάλμα ΚΑΕΚ εμφανίζεται στο `blur`, ποτέ ενώ ο άνθρωπος πληκτρολογεί·
 *    μόλις ο κωδικός γίνει έγκυρος, το σφάλμα σβήνει αμέσως.
 */

import React, { useId, useState } from 'react';

import { HintedField } from '@/components/ui/hinted-field';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  IDENTIFICATION_DESCRIPTION_MAX_LENGTH,
  kaekFieldState,
  type ObjectiveValueIdentificationDraft,
} from '@/lib/objective-value/objective-value-identification';

const NS = 'objective-value';
const I = `${NS}:pdf.identification`;

interface Props {
  readonly value: ObjectiveValueIdentificationDraft;
  readonly onChange: (next: ObjectiveValueIdentificationDraft) => void;
}

export function ObjectiveValuePdfIdentification({ value, onChange }: Props) {
  const { t } = useTranslation([NS]);
  const id = useId();
  const [kaekTouched, setKaekTouched] = useState(false);
  const kaekInvalid = kaekTouched && kaekFieldState(value.kaek).kind === 'invalid';
  const optional = t(`${I}.optional`);
  return (
    <details className="rounded-md border border-border p-3">
      <summary className="cursor-pointer text-sm font-semibold text-foreground">{t(`${I}.title`)}</summary>
      <fieldset className="m-0 mt-3 flex flex-col gap-3 border-0 p-0">
        <legend className="sr-only">{t(`${I}.title`)}</legend>
        <p className="m-0 text-xs text-muted-foreground">{t(`${I}.help`)}</p>
        <HintedField
          id={`${id}-description`}
          label={t(`${I}.descriptionLabel`)}
          labelSuffix={optional}
          hint={t(`${I}.descriptionHint`)}
          placeholder={t(`${I}.descriptionPlaceholder`)}
          value={value.description}
          maxLength={IDENTIFICATION_DESCRIPTION_MAX_LENGTH}
          autoComplete="off"
          onChange={(description) => onChange({ ...value, description })}
        />
        <HintedField
          id={`${id}-kaek`}
          label={t(`${I}.kaekLabel`)}
          labelSuffix={optional}
          hint={t(`${I}.kaekHint`)}
          placeholder={t(`${I}.kaekPlaceholder`)}
          value={value.kaek}
          // ⚠️ ΟΧΙ `inputMode="numeric"`: το αριθμητικό πληκτρολόγιο του κινητού δεν έχει «/», που χωρίζει την ιδιοκτησία.
          autoComplete="off"
          error={kaekInvalid ? t(`${I}.kaekInvalid`) : undefined}
          onBlur={() => setKaekTouched(true)}
          onChange={(kaek) => onChange({ ...value, kaek })}
        />
      </fieldset>
    </details>
  );
}
