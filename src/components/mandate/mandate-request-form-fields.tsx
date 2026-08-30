'use client';

/**
 * @fileoverview **ΤΑ ΔΟΜΙΚΑ ΠΕΔΙΑ ΤΗΣ ΦΟΡΜΑΣ ΤΟΥ Σ1** — ετικέτα, υπόδειξη, αμοιβή.
 * @related components/mandate/MandateRequestFormContent.tsx · ADR-827 §9.17
 * @module components/mandate/mandate-request-form-fields
 *
 * 🔑 **ΕΞΗΧΘΗΣΑΝ ΓΙΑΤΙ ΤΟ ΑΡΧΕΙΟ ΧΤΥΠΗΣΕ ΤΟ ΟΡΙΟ, ΚΑΙ ΤΟ ΟΡΙΟ ΕΧΕΙ ΔΙΚΙΟ** (N.7.1):
 * η προσθήκη των δύο πεδίων της κατάληψης (ADR-832 §5) έφερε το
 * `MandateRequestFormContent` στις **575** γραμμές. Το κόψιμο **δεν είναι αυθαίρετο**:
 * εδώ μένει ό,τι είναι **παρουσίαση πεδίου** και δεν ξέρει τίποτα για τη ροή —
 * καμία υποβολή, καμία έκβαση, κανένα `fetch`. Ό,τι έμεινε πίσω **ξέρει τη ροή**.
 *
 * ⛔ **ΜΗΝ φέρεις εδώ την επικύρωση.** Ο κριτής είναι το `mandate-request-form-values`
 * και ο διακομιστής· ένα τρίτο σημείο θα ήταν τρίτη απάντηση (ADR-749).
 */

import React from 'react';
import type { useForm } from 'react-hook-form';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { MandateRequestFormValues } from '@/lib/mandate/mandate-request-form-values';

import { MANDATE_REQUEST_NS, SCREEN_KEYS } from './mandate-request-form-labels';

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
      {hint !== undefined && <p className="m-0 text-xs text-muted-foreground">{hint}</p>}
    </section>
  );
}

/** Η αμοιβή — διακριτή ένωση στην οθόνη, όπως και στον τύπο. */
export function CompensationField({
  form,
  values,
}: {
  form: ReturnType<typeof useForm<MandateRequestFormValues>>;
  values: MandateRequestFormValues;
}): React.JSX.Element {
  const { t } = useTranslation([MANDATE_REQUEST_NS]);
  const { compensation } = values;

  return (
    <Field label={t(SCREEN_KEYS.compensationLabel)} hint={t(SCREEN_KEYS.compensationHint)}>
      <Select
        value={compensation.type}
        onValueChange={(next) =>
          form.setValue(
            'compensation',
            // 🔑 Η αλλαγή σκέλους **ξαναχτίζει** το αντικείμενο, δεν το μπαλώνει: ένα
            //    `{...compensation, type: next}` θα κουβαλούσε `percentage` μέσα σε
            //    `fixed` — δηλαδή κατάσταση που ο τύπος δηλώνει **αδύνατη**.
            next === 'percentage'
              ? { type: 'percentage', percentage: 2, vatIncluded: compensation.vatIncluded }
              : { type: 'fixed', amountEUR: 0, vatIncluded: compensation.vatIncluded },
          )
        }
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="percentage">{t(SCREEN_KEYS.compensationPercentage)}</SelectItem>
          <SelectItem value="fixed">{t(SCREEN_KEYS.compensationFixed)}</SelectItem>
        </SelectContent>
      </Select>

      <Label className="text-xs text-muted-foreground">
        {compensation.type === 'percentage'
          ? t(SCREEN_KEYS.percentageLabel)
          : t(SCREEN_KEYS.amountLabel)}
      </Label>
      <Input
        type="number"
        min={0}
        step={compensation.type === 'percentage' ? 0.1 : 1}
        value={compensation.type === 'percentage' ? compensation.percentage : compensation.amountEUR}
        onChange={(event) => {
          const amount = Number(event.target.value);
          form.setValue(
            'compensation',
            compensation.type === 'percentage'
              ? { ...compensation, percentage: amount }
              : { ...compensation, amountEUR: amount },
          );
        }}
      />

      <Label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={compensation.vatIncluded}
          onChange={(event) =>
            form.setValue('compensation', { ...compensation, vatIncluded: event.target.checked })
          }
        />
        {t(SCREEN_KEYS.vatLabel)}
      </Label>
    </Field>
  );
}
