'use client';

/**
 * **`/interest-check` — «Δες αν κάποιος ενδιαφέρεται για το ακίνητό σου»** (ADR-900).
 *
 * @related ADR-900 · ADR-777 §7 (Α9 · Α12 · Α14) · app/api/demand/prospect-interest
 * @module components/demand/interest-check/InterestCheckContent
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΟ ΔΙΔΥΜΟ ΜΟΝΤΕΛΟ ΤΩΝ ΜΕΓΑΛΩΝ — ΚΑΙ ΤΙ ΚΑΝΟΥΜΕ ΠΑΡΑΠΑΝΩ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | Πριν την απόδειξη κατοχής | Μετά |
 * |---|---|
 * | **εδώ**: άθροισμα «σαν το δικό σας», κατώφλι 5, βήμα 5 (Zoopla MyHome · Spekulantkollen) | το πάνελ του κατόχου, κατώφλι 1 (Zillow Owner Dashboard) |
 *
 * Κανείς τους δεν έχει **ρητή** ζήτηση για συγκεκριμένο κτίριο («όποτε κι αν βγει», Ζ3) — εμείς έχουμε,
 * και γι' αυτό η δεύτερη βαθμίδα λέει «ζητούν **αυτό ακριβώς**». Η πρώτη **δεν** το λέει ποτέ.
 *
 * ⚠️ **Η απάντηση ζητιέται με ΚΟΥΜΠΙ, όχι σε κάθε πληκτρολόγηση.** Το όριο ρυθμού της διαδρομής είναι
 * 10/λεπτό (HEAVY) — ζωντανό ερώτημα ανά πλήκτρο θα το εξαντλούσε στο τρίτο ψηφίο του εμβαδού. Και η
 * υποβληθείσα ερώτηση **παγώνει**: αλλαγή στη φόρμα δεν αλλάζει σιωπηλά την απάντηση που διαβάζεις.
 */

import React from 'react';
import { useForm } from 'react-hook-form';

// 🧩 ADR-744 §15 — per-route slice: τα είδη ακινήτου (`properties-enums`) και οι λέξεις της σελίδας
//    βάφονται στο ΠΡΩΤΟ καρέ, όχι ως ωμά κλειδιά (CHECK 3.51). Στατικά, εμβέλεια module.
import routeSlice from '@/i18n/generated/routes/interest-check.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { PrivatePageHeader } from '@/components/private-space/PrivatePageHeader';
import {
  EMPTY_PROSPECT_FORM,
  prospectQueryFrom,
  type ProspectFormValues,
  type ProspectQuery,
} from '@/lib/demand/prospect-interest';
import type { PlaceRef } from '@/types/geo/public-place';

import { InterestCheckDescriptionStep, InterestCheckPlaceStep } from './InterestCheckForm';
import { InterestCheckResult } from './InterestCheckResult';

registerRouteSlice(routeSlice);

const NS = 'property-market';
const K = `${NS}:interestCheck`;

export function InterestCheckContent({
  initialAddress = null,
}: {
  /** ADR-900 §3.7 — η διεύθυνση που έγραψε ο άνθρωπος σε δημόσια πόρτα (αρχική), αν ήρθε από εκεί. */
  readonly initialAddress?: string | null;
}): React.ReactElement {
  const { t } = useTranslation([NS]);
  const [place, setPlace] = React.useState<PlaceRef | null>(null);
  const [asked, setAsked] = React.useState<ProspectQuery | null>(null);
  const form = useForm<ProspectFormValues>({ defaultValues: EMPTY_PROSPECT_FORM });
  const values = form.watch();
  const draft = prospectQueryFrom(place, values);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (draft !== null) setAsked(draft);
  }

  return (
    <main className="flex w-full flex-col gap-6">
      <PrivatePageHeader title={t(`${K}.title`)} lead={t(`${K}.lead`)} />

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <InterestCheckPlaceStep place={place} onPlace={setPlace} initialAddress={initialAddress} />
        <InterestCheckDescriptionStep control={form.control} type={values.type} />
        <Button type="submit" disabled={draft === null} className="self-start">
          {t(`${K}.submit`)}
        </Button>
      </form>

      {asked !== null && <InterestCheckResult query={asked} />}
    </main>
  );
}
