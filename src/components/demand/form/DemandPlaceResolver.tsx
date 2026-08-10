'use client';

/**
 * **Κείμενο → σημείο στον χάρτη** — ο χωρικός άξονας γίνεται γεωμετρία.
 *
 * @related ADR-777 §7 (Α9 · Α3) · lib/geocoding/geocoding-service · components/search/PlaceSearchBox
 * @module components/demand/form/DemandPlaceResolver
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΚΑΜΙΑ ΝΕΑ ΜΗΧΑΝΗ ΓΕΩΚΩΔΙΚΟΠΟΙΗΣΗΣ — ΚΑΙ ΤΟ ΙΔΙΟ ΛΕΞΙΛΟΓΙΟ ΑΠΟΤΥΧΙΑΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Καλείται το **υπάρχον** `geocodeAddressDetailed`, ακριβώς όπως το κάνει ο
 * `PlaceSearchBox` της οθόνης 1: κουβαλά ήδη **cache + in-flight dedup** και
 * επιστρέφει **διακριτή** ετυμηγορία — ώστε το *«δεν υπάρχει τέτοια περιοχή»* να μη
 * συγχέεται με *«μας έκοψε ο ρυθμιστής»*. Η διάκριση δεν είναι λεπτολογία: η πρώτη
 * λέει στον άνθρωπο να **ξαναγράψει**, η δεύτερη να **ξαναδοκιμάσει**.
 *
 * 🔑 **Και η ζήτηση αποθηκεύει ΣΗΜΕΙΟ, ποτέ κείμενο.** Το `DemandPlace.near` κρατά
 * `center` + `radiusKm` — το **ίδιο** σχήμα με το `ListingGeoFilter` της οθόνης 2,
 * ώστε η προβολή προς τα φίλτρα να είναι **ταυτότητα** και όχι μετάφραση. Ένα
 * αποθηκευμένο «Θεσσαλονίκη» θα απαιτούσε να ξαναλυθεί σε **κάθε** ταίριασμα, με
 * αποτέλεσμα που μπορεί να αλλάξει όταν αλλάξει ο πάροχος.
 *
 * ⚠️ Το κείμενο **μένει στην οθόνη** (`placeQuery`) ώστε ο άνθρωπος να βλέπει τι
 * έγραψε — αλλά **δεν ταξιδεύει** στο έγγραφο: το `demandDraftFrom` δεν το διαβάζει.
 */

import React from 'react';
import { useFormContext } from 'react-hook-form';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { geocodeAddressDetailed } from '@/lib/geocoding/geocoding-service';
import { createModuleLogger } from '@/lib/telemetry';
import type { DemandFormValues } from '@/lib/demand/demand-form-values';
import { DemandNumberField } from './demand-field-primitives';

const logger = createModuleLogger('DemandPlaceResolver');
const NS = 'search-results';

/**
 * Οι τέσσερις καταστάσεις — **ρητές**, ποτέ ένα `boolean` + ένα `string`.
 *
 * Ίδιο ιδίωμα με το `SubmitState` του `PlaceSearchBox`: το `not-found` και το `error`
 * έχουν **διαφορετική θεραπεία** για τον χρήστη.
 */
type ResolveState = 'idle' | 'resolving' | 'not-found' | 'error';

export function DemandPlaceResolver(): React.ReactElement {
  const { t } = useTranslation([NS]);
  const form = useFormContext<DemandFormValues>();
  const inputId = React.useId();
  const [state, setState] = React.useState<ResolveState>('idle');

  const query = form.watch('placeQuery');
  const center = form.watch('placeCenter');

  async function handleResolve(): Promise<void> {
    const trimmed = (query ?? '').trim();
    if (trimmed === '') return;

    setState('resolving');
    // ⚠️ Ελεύθερο κείμενο → `city`: η μηχανή δοκιμάζει **free-form πρώτα**, οπότε
    // «Εγνατίας 147, Θεσσαλονίκη» λύνεται το ίδιο καλά με σκέτο «Θεσσαλονίκη».
    const outcome = await geocodeAddressDetailed({ city: trimmed });

    if (outcome.kind === 'found') {
      form.setValue(
        'placeCenter',
        { lat: outcome.result.lat, lng: outcome.result.lng },
        { shouldDirty: true },
      );
      setState('idle');
      return;
    }

    // 🔴 **Η αποτυχία ΣΒΗΝΕΙ το προηγούμενο σημείο.** Αλλιώς ο άνθρωπος που άλλαξε
    // περιοχή και δεν εντοπίστηκε η νέα θα αποθήκευε ζήτηση για την **παλιά** —
    // σιωπηλά, και με το σωστό κείμενο στην οθόνη.
    form.setValue('placeCenter', null, { shouldDirty: true });

    if (outcome.kind === 'not-found') {
      setState('not-found');
      return;
    }
    logger.warn('Ο εντοπισμός περιοχής απέτυχε', { data: { reason: outcome.reason } });
    setState('error');
  }

  const busy = state === 'resolving';
  const K = `${NS}:demand.form.place`;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="text-sm text-foreground">
        {t(`${K}.queryLabel`)}
      </label>

      <div className="flex flex-wrap gap-2">
        <input
          id={inputId}
          type="search"
          {...form.register('placeQuery', {
            // Το σημείο ανήκει στο **προηγούμενο** κείμενο· μόλις αλλάξει το κείμενο,
            // παύει να είναι αλήθεια. Χωρίς αυτό, η φόρμα θα δεχόταν υποβολή με
            // συντεταγμένες που δεν αντιστοιχούν σε ό,τι διαβάζει ο άνθρωπος.
            onChange: () => {
              if (center !== null) form.setValue('placeCenter', null, { shouldDirty: true });
              if (state !== 'idle') setState('idle');
            },
          })}
          placeholder={t(`${K}.queryPlaceholder`)}
          disabled={busy}
          className="min-w-56 flex-1 rounded-md border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground"
        />
        <button
          type="button"
          onClick={handleResolve}
          disabled={busy || (query ?? '').trim() === ''}
          className="rounded-md border border-border bg-card px-4 py-2 font-medium text-foreground disabled:opacity-50"
        >
          {busy ? t(`${K}.resolving`) : t(`${K}.resolve`)}
        </button>
      </div>

      {center !== null && (
        <p className="text-sm text-muted-foreground">
          {t(`${K}.resolved`, { label: `${center.lat.toFixed(4)}, ${center.lng.toFixed(4)}` })}
        </p>
      )}
      {state === 'not-found' && <p className="text-sm text-foreground">{t(`${K}.notFound`)}</p>}
      {state === 'error' && <p className="text-sm text-foreground">{t(`${K}.failed`)}</p>}

      <DemandNumberField name="radiusKm" label={t(`${K}.radiusLabel`)} min={1} />
    </div>
  );
}
