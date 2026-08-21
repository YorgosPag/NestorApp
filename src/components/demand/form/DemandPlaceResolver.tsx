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
import { usePlaceResolver } from '@/hooks/geo/usePlaceResolver';
import type { DemandFormValues } from '@/lib/demand/demand-form-values';
import { DemandNumberField } from './demand-field-primitives';

const NS = 'property-market';

export function DemandPlaceResolver(): React.ReactElement {
  const { t } = useTranslation([NS]);
  const form = useFormContext<DemandFormValues>();
  const inputId = React.useId();

  const query = form.watch('placeQuery');
  const center = form.watch('placeCenter');

  // 🔑 **Η ζήτηση κρατά ΜΟΝΟ το σημείο** — η ακρίβεια δεν την αφορά: το ερώτημα είναι
  // «γύρω από πού ψάχνεις;», και η ακτίνα το απαντά ούτως ή άλλως κατά προσέγγιση.
  // ⚠️ Και το **κείμενο δεν αποθηκεύεται**: ένα «Θεσσαλονίκη» θα έπρεπε να ξαναλυθεί
  // σε κάθε ταίριασμα, με αποτέλεσμα που αλλάζει όταν αλλάξει ο πάροχος.
  const { state, resolve, reset } = usePlaceResolver({
    onFound: React.useCallback(
      (place) =>
        form.setValue(
          'placeCenter',
          { lat: place.lat, lng: place.lng },
          { shouldDirty: true },
        ),
      [form],
    ),
    onCleared: React.useCallback(
      () => form.setValue('placeCenter', null, { shouldDirty: true }),
      [form],
    ),
  });

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
              if (state !== 'idle') reset();
            },
          })}
          placeholder={t(`${K}.queryPlaceholder`)}
          disabled={busy}
          className="min-w-56 flex-1 rounded-md border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground"
        />
        <button
          type="button"
          onClick={() => void resolve(query ?? '')}
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
