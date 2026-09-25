'use client';

/**
 * **Το όνομα της ζήτησης κατά την αποθήκευση** — προαιρετικό, με το **ζωντανό** αυτόματο όνομα ως υπόδειξη.
 *
 * @related ADR-886 · lib/demand/demand-display-name.ts · lib/demand/demand-title.ts
 * @module components/demand/form/DemandTitleField
 *
 * 🏆 **ΓΙΑΤΙ PLACEHOLDER ΚΑΙ ΟΧΙ ΠΡΟΣΥΜΠΛΗΡΩΣΗ** (εκεί ξεπερνάμε το Redfin): το προτεινόμενο όνομα
 * γραμμένο **μέσα** στο πεδίο θα αποθηκευόταν ως δικό του — και θα έλεγε «έως 200.000 €» για πάντα, ακόμη
 * κι όταν ο άνθρωπος ανέβαζε το ταβάνι. Ως **placeholder** ο άνθρωπος βλέπει **ακριβώς** το όνομα που θα
 * πάρει η ζήτηση, να αλλάζει καθώς διαλέγει κριτήρια· αν το αφήσει κενό, το όνομα **μένει ζωντανό**.
 *
 * ⚠️ Η προεπισκόπηση περνά από τον **ίδιο** δρόμο με την αποθήκευση (`demandFormSchema` → `demandDraftFrom`),
 * όχι από δεύτερη ανάγνωση των πεδίων — αλλιώς το placeholder θα μπορούσε να υπόσχεται άλλο όνομα από
 * αυτό που θα δει μετά στον κατάλογο.
 */

import React from 'react';
import { useFormContext } from 'react-hook-form';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useDemandName } from '@/hooks/demand/useDemandName';
import {
  demandDraftFrom,
  demandFormSchema,
  type DemandFormValues,
} from '@/lib/demand/demand-form-values';
import { DEMAND_TITLE_MAX_LENGTH } from '@/lib/demand/demand-title';
import { DemandFieldset } from './demand-field-primitives';

const K = 'property-market:demand.form.name';

/** Το αυτόματο όνομα των τρεχουσών τιμών — `''` όσο η φόρμα δεν διαβάζεται ακόμη ως σχήμα. */
function useAutoNamePreview(values: DemandFormValues): string {
  const { autoName } = useDemandName();
  return React.useMemo(() => {
    const parsed = demandFormSchema.safeParse(values);
    return parsed.success ? autoName(demandDraftFrom(parsed.data)) : '';
  }, [values, autoName]);
}

export function DemandTitleField(): React.ReactElement {
  const { t } = useTranslation(['property-market']);
  const form = useFormContext<DemandFormValues>();
  const inputId = React.useId();
  const values = form.watch();
  const preview = useAutoNamePreview(values);
  const length = (values.title ?? '').length;

  return (
    <DemandFieldset legend={t(`${K}.label`)} help={t(`${K}.hint`)}>
      <label htmlFor={inputId} className="sr-only">
        {t(`${K}.label`)}
      </label>
      <input
        id={inputId}
        type="text"
        {...form.register('title')}
        maxLength={DEMAND_TITLE_MAX_LENGTH}
        placeholder={preview}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground"
      />
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {t(`${K}.counter`, { count: length, max: DEMAND_TITLE_MAX_LENGTH })}
      </p>
    </DemandFieldset>
  );
}
