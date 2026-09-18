'use client';

/**
 * **ΟΙ ΟΡΟΙ ΔΙΑΜΟΝΗΣ** — πόσες νύχτες και ποια παρέα, μόνο όταν ζητείται Διαμονή (ADR-777 §8.60.19).
 *
 * @related ADR-777 §8.60.19 · lib/demand/demand-form-stay.ts · lib/demand/demand-match-stay.ts
 * @module components/demand/form/DemandStayTermsRow
 *
 * 🌐 **Η παρέα με ηλικίες, όπως το Airbnb** (ενήλικες 13+ · παιδιά 2–12 · βρέφη κάτω των 2) — ο
 * άνθρωπος ξέρει την ηλικία του παιδιού του, όχι το αν «μετρά» στη χωρητικότητα. Αυτό το λέει η
 * μηχανή, με όνομα, όταν έχει σημασία.
 *
 * ⚠️ Το **πότε** δεν ρωτιέται εδώ — είναι ο άξονας χρόνου της ίδιας φόρμας (ένα πεδίο χρόνου, όχι δύο).
 */

import React from 'react';
import { useWatch } from 'react-hook-form';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { DemandFormValues } from '@/lib/demand/demand-form-values';
import { DemandNumberField, DemandRangeRow } from './demand-field-primitives';

const NS = 'property-market';
const K = `${NS}:demand.form.stayTerms`;

/**
 * Τα τέσσερα πεδία της παρέας, με τη **σειρά** του «Who» του Airbnb (ενήλικες → παιδιά → βρέφη →
 * κατοικίδια). Τα κατοικίδια (ADR-777 §8.60.21) **δεν** είναι άτομα — δεν μετρούν στη χωρητικότητα.
 */
const PARTY_FIELDS = [
  { name: 'stayParty.adults', key: 'adults', min: 1 },
  { name: 'stayParty.children', key: 'children', min: 0 },
  { name: 'stayParty.infants', key: 'infants', min: 0 },
  { name: 'stayParty.pets', key: 'pets', min: 0 },
] as const;

export function DemandStayTermsRow(): React.ReactElement | null {
  const { t } = useTranslation([NS]);
  const selected = useWatch<DemandFormValues, 'seeks'>({ name: 'seeks' });

  if (!selected.includes('leaseShort')) return null;

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-sm font-medium text-foreground">{t(`${K}.legend`)}</legend>
      <DemandRangeRow
        legend={t(`${K}.nights`)}
        help={t(`${K}.nightsHelp`)}
        minName="stayNights.min"
        maxName="stayNights.max"
        minLabel={t(`${K}.from`)}
        maxLabel={t(`${K}.to`)}
        floor={1}
      />
      <p className="text-sm font-medium text-foreground">{t(`${K}.party`)}</p>
      <ul className="flex flex-wrap gap-3">
        {PARTY_FIELDS.map((field) => (
          <li key={field.key}>
            <DemandNumberField name={field.name} label={t(`${K}.${field.key}`)} min={field.min} />
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted-foreground">{t(`${K}.partyHelp`)}</p>
      <p className="text-sm text-muted-foreground">{t(`${K}.petsHelp`)}</p>
    </fieldset>
  );
}
