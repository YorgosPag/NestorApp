'use client';

/**
 * @fileoverview **ΔΙΕΥΘΥΝΣΗ → ΣΗΜΕΙΟ ΣΤΟΝ ΧΑΡΤΗ** — με την ακρίβειά της, ή μια ειλικρινής άρνηση.
 * @related ADR-777 §7 (Α5 · Α14) · lib/geocoding/geocoding-service · components/search/PlaceSearchBox
 * @module components/owner-property/form/OwnerPropertyPlaceField
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΚΑΜΙΑ ΝΕΑ ΜΗΧΑΝΗ ΓΕΩΚΩΔΙΚΟΠΟΙΗΣΗΣ — ΚΑΙ ΤΟ ΙΔΙΟ ΛΕΞΙΛΟΓΙΟ ΑΠΟΤΥΧΙΑΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Καλείται το **υπάρχον** `geocodeAddressDetailed`, ακριβώς όπως το κάνουν ο
 * `PlaceSearchBox` της οθόνης 1 και ο `DemandPlaceResolver` της Α9: κουβαλά ήδη
 * **cache + in-flight dedup** και επιστρέφει **διακριτή** ετυμηγορία — ώστε το *«δεν
 * υπάρχει τέτοια διεύθυνση»* να μη συγχέεται με *«μας έκοψε ο ρυθμιστής»*. Η πρώτη
 * λέει στον άνθρωπο να **ξαναγράψει**, η δεύτερη να **ξαναδοκιμάσει**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΚΡΑΤΑΜΕ ΠΑΡΑΠΑΝΩ ΑΠΟ ΤΗ ΖΗΤΗΣΗ — ΚΑΙ ΓΙΑΤΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο `DemandPlaceResolver` κρατά **σημείο + ακτίνα** και **πετά το κείμενο**. Εδώ
 * κρατάμε **δύο ακόμη** πράγματα, και καθένα έχει λόγο:
 *
 * | Τι | Γιατί |
 * |---|---|
 * | το **κείμενο** (`label`) | Η ζήτηση λέει *«ψάχνω γύρω από εκεί»* — το κείμενο είναι **αναζήτηση**. Η προσφορά λέει *«το ακίνητό μου **είναι** εκεί»* — είναι **η δήλωση του ανθρώπου για το δικό του πράγμα**, και οφείλει να τη βλέπει αυτούσια. ⛔ **Δεν ταξιδεύει στη δημόσια αγγελία** (κλειστό σχήμα) |
 * | η **ακρίβεια** (`accuracy`) | **Είναι ολόκληρη η Α5**: το σχήμα στον χάρτη *είναι* η ακρίβεια. Χωρίς αυτήν, μια διεύθυνση που ο γεωκωδικοποιητής έλυσε σε **κέντρο πόλης** θα ζωγραφιζόταν ως **ακριβής πινέζα** — ψέμα που μοιάζει με γνώση |
 *
 * ⚠️ **Η ακρίβεια ΔΕΝ μαντεύεται όταν λείπει.** Το `null` σημαίνει «κάποιος **έβαλε**
 * το σημείο» ⇒ προέλευση `manual` (δες `addressToPositionCandidate`). Ένα
 * `accuracy: 'center'` ως προεπιλογή θα ήταν ψέμα **προς την ασφαλή κατεύθυνση**: θα
 * έκρυβε γνώση που έχουμε.
 */

import React from 'react';
import { useFormContext } from 'react-hook-form';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { usePlaceResolver } from '@/hooks/geo/usePlaceResolver';
import { FormFieldset } from '@/components/shared/forms/form-field-primitives';
import type { OwnerPropertyFormValues } from '@/lib/owner-property/owner-property-form-values';

import { OwnerPlaceAnswerField } from './OwnerPropertyFields';

const NS = 'search-results';
const K = `${NS}:offer`;

export function OwnerPropertyPlaceField(): React.ReactElement {
  const { t } = useTranslation([NS]);
  const form = useFormContext<OwnerPropertyFormValues>();
  const inputId = React.useId();

  const answer = form.watch('placeAnswer');
  const query = form.watch('placeQuery');
  const point = form.watch('placePoint');

  // 🔑 **Η προσφορά κρατά ΚΑΙ την ακρίβεια** — σε αντίθεση με τη ζήτηση, όπου δεν
  // χρειάζεται. Είναι **ολόκληρη η Α5**: το σχήμα στον χάρτη *είναι* η ακρίβεια, και
  // χωρίς αυτήν μια διεύθυνση λυμένη σε **κέντρο πόλης** θα ζωγραφιζόταν ως ακριβής
  // πινέζα — ψέμα που μοιάζει με γνώση.
  // ⚠️ Οι δύο τιμές γράφονται στην **ίδια** επανάκληση: ξεχωριστές πράξεις θα άφηναν
  // παράθυρο όπου το σημείο είναι νέο και η ακρίβεια παλιά.
  const { state, resolve, reset } = usePlaceResolver({
    onFound: React.useCallback(
      (place) => {
        form.setValue('placePoint', { lat: place.lat, lng: place.lng }, { shouldDirty: true });
        form.setValue('placeAccuracy', place.accuracy, { shouldDirty: true });
      },
      [form],
    ),
    onCleared: React.useCallback(() => {
      form.setValue('placePoint', null, { shouldDirty: true });
      form.setValue('placeAccuracy', null, { shouldDirty: true });
    }, [form]),
  });

  const busy = state === 'resolving';

  return (
    <FormFieldset legend={t(`${K}.placeAnswer.label`)} help={t(`${K}.placeAnswer.help`)}>
      <OwnerPlaceAnswerField />

      {/*
        🔑 Τα πεδία διεύθυνσης εμφανίζονται **μόνο** όταν ο άνθρωπος δήλωσε ότι θα πει
        τη θέση — ο κανόνας 3 της Α14 §17.2 («η φόρμα μικραίνει»). Και το κείμενο
        **μένει** στη μνήμη της φόρμας αν αλλάξει γνώμη και ξαναγυρίσει.
      */}
      {answer === 'declared' ? (
        <div className="flex flex-col gap-2">
          <label htmlFor={inputId} className="text-sm text-foreground">
            {t(`${K}.form.placeQueryLabel`)}
          </label>

          <div className="flex flex-wrap gap-2">
            <input
              id={inputId}
              type="search"
              {...form.register('placeQuery', {
                // Το σημείο ανήκει στο **προηγούμενο** κείμενο· μόλις αλλάξει το
                // κείμενο, παύει να είναι αλήθεια. Χωρίς αυτό, η φόρμα θα δεχόταν
                // υποβολή με συντεταγμένες που δεν αντιστοιχούν σε ό,τι διαβάζει ο
                // άνθρωπος.
                onChange: () => {
                  if (point !== null) {
                    form.setValue('placePoint', null, { shouldDirty: true });
                    form.setValue('placeAccuracy', null, { shouldDirty: true });
                  }
                  if (state !== 'idle') reset();
                },
              })}
              placeholder={t(`${K}.form.placeQueryPlaceholder`)}
              disabled={busy}
              className="min-w-56 flex-1 rounded-md border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground"
            />
            <button
              type="button"
              onClick={() => void resolve(query ?? '')}
              disabled={busy || (query ?? '').trim() === ''}
              className="rounded-md border border-border bg-card px-4 py-2 font-medium text-foreground disabled:opacity-50"
            >
              {busy ? t(`${K}.form.placeResolving`) : t(`${K}.form.placeResolve`)}
            </button>
          </div>

          {point !== null && (
            <p className="text-sm text-muted-foreground">
              {t(`${K}.form.placeResolved`, {
                label: `${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}`,
              })}
            </p>
          )}
          {state === 'not-found' && (
            <p className="text-sm text-foreground">{t(`${K}.form.placeNotFound`)}</p>
          )}
          {state === 'error' && (
            <p className="text-sm text-foreground">{t(`${K}.form.placeFailed`)}</p>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t(`${K}.form.placeDeclinedNote`)}</p>
      )}
    </FormFieldset>
  );
}
