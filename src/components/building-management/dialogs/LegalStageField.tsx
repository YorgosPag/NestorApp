'use client';

/**
 * **Στάδιο κατά ΠΟΛ.1149/1994 που κλείνει η φάση** — προαιρετικό πεδίο του διαλόγου φάσης (ADR-898 Φ4 · ADR-034).
 *
 * 🔑 Η ολοκλήρωση μιας φάσης με ετικέτα είναι το **γεγονός** από το οποίο η αντικειμενική αξία ξέρει ότι το κτίριο
 * έφτασε στο στάδιο (`stageReached`) — ο εργολάβος δεν δηλώνει το στάδιο χωριστά από το χρονοδιάγραμμά του.
 *
 * ⚠️ Το «κανένα» είναι φρουρός (`NO_STAGE`), όχι κενή τιμή: το Radix Select δεσμεύει το `''` (CHECK 3.48).
 */

import React from 'react';

import { FormField, FormInput } from '@/components/ui/form/FormComponents';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { isLegalStage, LEGAL_STAGES, type LegalStage } from '@/lib/objective-value/objective-value-stages';

const NO_STAGE = 'noStage';
const S = 'objective-value:stages';

interface LegalStageFieldProps {
  readonly value: LegalStage | null;
  readonly onChange: (value: LegalStage | null) => void;
}

export function LegalStageField({ value, onChange }: LegalStageFieldProps) {
  const { t } = useTranslation(['objective-value']);
  return (
    <FormField label={t(`${S}.fieldLabel`)} htmlFor="construction-legal-stage" helpText={t(`${S}.fieldHelp`)}>
      <FormInput>
        <Select value={value ?? NO_STAGE} onValueChange={(next) => onChange(isLegalStage(next) ? next : null)}>
          <SelectTrigger id="construction-legal-stage">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_STAGE}>{t(`${S}.noStage`)}</SelectItem>
            {LEGAL_STAGES.map((stage) => (
              <SelectItem key={stage} value={stage}>
                {t(`${S}.${stage}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormInput>
    </FormField>
  );
}
