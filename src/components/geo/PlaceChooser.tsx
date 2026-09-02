'use client';

/**
 * @fileoverview **ΔΕΙΞΕ ΜΟΥ ΤΟΝ ΤΟΠΟ** — οι τρεις χειρονομίες του χάρτη, σε ένα χειριστήριο.
 * @related ADR-777 · SPEC-777A §13.6 · §14.3 · §21.4 · hooks/geo/usePlaceIdentity.ts
 * @module components/geo/PlaceChooser
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΤΡΕΙΣ ΤΡΟΠΟΙ ΚΑΙ ΟΧΙ ΕΝΑΣ — ΤΟ §13.6 ΩΣ ΟΘΟΝΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * *«Το OSM στην Ελλάδα έχει κενά. Αν η **μόνη** διαδρομή είναι “διάλεξε κτίριο OSM”, η
 * Ζ3/Ζ5 **αποτυγχάνει σιωπηλά** ακριβώς εκεί που ο χρήστης ξέρει τι θέλει.»*
 *
 * Μετρήθηκε πόσο μεγάλο είναι το κενό (Overpass, 2026-08-11): στο **κέντρο** της
 * Θεσσαλονίκης μόλις **46 %** των κτιρίων έχουν διεύθυνση, και **0,24 %** των κτιρίων
 * είναι σχέσεις που ο επιλογέας **δεν** μπορεί να πιάσει. Άρα η εναλλακτική δεν είναι
 * ευγένεια — είναι η **συνηθισμένη** περίπτωση σε μεγάλο μέρος της χώρας.
 *
 * 🔑 **Και οι τρεις τρόποι δίνουν ΤΗΝ ΙΔΙΑ ΤΑΞΗ ΠΡΑΓΜΑΤΟΣ**: μια ταυτότητα επιπέδου Α
 * στην οποία μπορούν να δείξουν **και** η ζήτηση **και** η προσφορά (§14.5). Αυτό που
 * αλλάζει είναι η **προέλευση**, και η προέλευση είναι που αποφασίζει ποια πηγή νικά
 * αργότερα — δεν είναι «καλύτερος» και «χειρότερος» τρόπος, είναι **σκαλοπάτια της
 * ίδιας σκάλας** (§21.4: *«κανένα σκαλοπάτι δεν είναι λάθος»*).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { GEOGRAPHIC_CONFIG } from '@/config/geographic-config';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { usePlaceIdentity } from '@/hooks/geo/usePlaceIdentity';
import type { PlaceClaim, PlaceTarget } from '@/lib/places/place-claim';
import type { PlaceFocus } from '@/lib/geo/geocoding-focus';
import type { GeoOutline, GeoPoint } from '@/types/geo/coordinates';
import type { PlaceRef } from '@/types/geo/public-place';

import { PlaceMap } from './PlaceMap';
import { IdentityStatus, LookupStatus } from './PlaceChooserStatus';
import { OutlineDraftControls, useOutlineDraft } from './outline-draft';

/** Οι χειρονομίες που γίνονται **πάνω στον χάρτη** — σκαλοπάτια 4 · 2 · 3 του §21.4. */
const MAP_GESTURES = ['pick', 'pin', 'draw'] as const;
type MapGesture = (typeof MAP_GESTURES)[number];

export interface PlaceChooserProps {
  readonly target: PlaceTarget;
  /** Κλήθηκε όταν ο τόπος απέκτησε **ταυτότητα** — αυτό είναι το προϊόν. */
  readonly onChosen: (ref: PlaceRef) => void;
  /**
   * **Η ΑΠΑΝΤΗΣΗ ΤΟΥ ΓΕΩΚΩΔΙΚΟΠΟΙΗΤΗ**, όταν ο άνθρωπος έχει ήδη πει τη διεύθυνσή του.
   *
   * 🔴 **ΑΝΤΙΚΑΤΕΣΤΗΣΕ ΤΟ `center`, ΚΑΙ Η ΑΝΤΙΚΑΤΑΣΤΑΣΗ ΕΙΝΑΙ ΤΟ ΝΟΗΜΑ** (2026-09-02).
   * Το `center?: GeoPoint` υπήρχε εδώ ως prop και **κανείς δεν το περνούσε ποτέ** —
   * μετρημένο σε όλους τους καταναλωτές. Ο χάρτης έπεφτε πάντα στο
   * `GEOGRAPHIC_CONFIG.DEFAULT_*` (Πλατεία Ομονοίας) ενώ ο άνθρωπος μόλις είχε
   * εντοπίσει διεύθυνση **στη Θεσσαλονίκη**.
   *
   * 🔑 **Δεν ξαναδόθηκε ως `center`, δόθηκε ως `focus` — και ΔΕΝ είναι το ίδιο πράγμα
   * με άλλο όνομα.** Ένα σκέτο σημείο απαντά μόνο *«πού»*· το {@link PlaceFocus}
   * κουβαλά **βαθμό ακρίβειας και μετρημένη έκταση**, δηλαδή απαντά και *«πόσο
   * σίγουρα»* — και αυτό είναι που κρίνει **ζουμ** και **σχήμα ένδειξης**. Δύο props
   * («πού» + «πόσο») θα μπορούσαν να διαφωνήσουν· ένα δεν μπορεί.
   */
  readonly focus?: PlaceFocus | null;
}

const DEFAULT_CENTER: GeoPoint = {
  lat: GEOGRAPHIC_CONFIG.DEFAULT_LATITUDE,
  lng: GEOGRAPHIC_CONFIG.DEFAULT_LONGITUDE,
};

export function PlaceChooser({
  target,
  onChosen,
  focus = null,
}: PlaceChooserProps): React.ReactElement {
  /**
   * ⚠️ **ΤΟ ΑΡΧΙΚΟ ΑΝΟΙΓΜΑ ΚΑΙ Η ΠΤΗΣΗ ΕΙΝΑΙ ΔΥΟ ΠΡΑΞΕΙΣ, ΚΑΙ ΧΡΕΙΑΖΟΝΤΑΙ ΚΑΙ ΟΙ ΔΥΟ.**
   * Στη **συνήθη** ροή ο άνθρωπος εντοπίζει τη διεύθυνση **πριν** ανοίξει ο επιλογέας:
   * τότε ο χάρτης οφείλει να **γεννηθεί** ήδη εκεί — μια πτήση από την Αθήνα θα ήταν
   * θέαμα χωρίς πληροφορία. Το `focus` περνά **και** ως αρχική θέση (`center`) **και**
   * στην κάμερα (`focus`), ώστε η δεύτερη να καλύπτει μόνο τις **επόμενες** απαντήσεις.
   */
  const center = focus?.point ?? DEFAULT_CENTER;
  const { t } = useTranslation(['search-results']);
  const { lookup, state, look, claim, reset } = usePlaceIdentity();

  const [gesture, setGesture] = useState<MapGesture>('pick');
  const [pin, setPin] = useState<GeoPoint | null>(null);
  const draft = useOutlineDraft();

  const switchGesture = useCallback(
    (next: MapGesture) => {
      // ⚠️ Η αλλαγή τρόπου **καθαρίζει ό,τι έδειξε ο άνθρωπος πριν**: αλλιώς θα
      // υπέβαλλε πινέζα ενώ κοιτάζει σχέδιο, και το αποτέλεσμα θα ήταν σωστό μεν αλλά
      // **όχι αυτό που είδε** — η ακριβής σιωπηλή αναντιστοιχία που κυνηγά η Α5.
      setGesture(next);
      setPin(null);
      draft.clear();
      reset();
    },
    [draft, reset],
  );

  const handlePick = useCallback(
    (point: GeoPoint) => {
      if (gesture === 'pick') return void look(point);
      if (gesture === 'pin') {
        setPin(point);
        return;
      }
      draft.addVertex(point);
    },
    [draft, gesture, look],
  );

  /** Η χειρονομία, έτοιμη να υποβληθεί — ή `null` όταν λείπει κάτι. */
  const pending: PlaceClaim | null = useMemo(() => {
    if (gesture === 'pick') {
      return lookup.kind === 'found'
        ? { gesture: 'picked-osm-building', elementType: lookup.elementType, elementId: lookup.elementId }
        : null;
    }
    if (gesture === 'pin') return pin === null ? null : { gesture: 'dropped-pin', point: pin };
    // ⚠️ **Μόνο το έγκυρο σχήμα** υποβάλλεται — το `draft.outline` είναι `null` όσο
    // υπάρχει ελάττωμα, οπότε το κουμπί μένει κλειστό αντί να στείλει κάτι που ο
    // διακομιστής θα απορρίψει.
    return draft.outline === null ? null : { gesture: 'drew-outline', outline: draft.outline };
  }, [draft.outline, gesture, lookup, pin]);

  const shownOutline: GeoOutline | null =
    gesture === 'pick' && lookup.kind === 'found' ? lookup.outline : null;

  const submit = useCallback(
    (distinctFromNearby: boolean) => {
      if (pending !== null) void claim(pending, target, distinctFromNearby);
    },
    [claim, pending, target],
  );

  /**
   * Ο τόπος απέκτησε ταυτότητα — το προϊόν φεύγει προς τα πάνω.
   *
   * ⚠️ **`useEffect` και όχι κλήση μέσα στο render.** Μια ειδοποίηση γονέα κατά την
   * απόδοση είναι παρενέργεια: θα έτρεχε σε **κάθε** πέρασμα και, επειδή ο γονέας
   * αποθηκεύει την ταυτότητα στη δική του κατάσταση, θα γεννούσε βρόχο. Το `landId`
   * στις εξαρτήσεις — και όχι το αντικείμενο — γιατί το `ref` είναι **νέο
   * αντικείμενο** σε κάθε απόδοση: ίδιο σχήμα με το `selector ?? []` που το
   * `reference_firestore_reactivity_hub` καταγράφει ως αιτία βρόχου.
   */
  const settledRef = state.kind === 'settled' ? state.ref : null;
  useEffect(() => {
    if (settledRef !== null) onChosen(settledRef);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- δες παραπάνω: ταυτότητα κατά ΤΙΜΗ
  }, [settledRef?.landId, settledRef?.buildingId]);

  return (
    <section className="space-y-3">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-foreground">{t('place.legend')}</legend>
        <div className="flex flex-wrap gap-2">
          {MAP_GESTURES.map((option) => (
            <Button
              key={option}
              type="button"
              size="sm"
              variant={gesture === option ? 'default' : 'outline'}
              onClick={() => switchGesture(option)}
              aria-pressed={gesture === option}
            >
              {t(`place.mode.${option}`)}
            </Button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">{t(`place.modeHint.${gesture}`)}</p>
      </fieldset>

      <PlaceMap
        center={center}
        focus={focus}
        // 🔑 **Δύο πηγές αναμονής, ένα prop** — και οι δύο είναι «περίμενε τον
        //    διακομιστή»: το `searching` ρωτά *«τι υπάρχει εδώ;»*, το `working`
        //    καταχωρεί. Ο χάρτης δεν έχει λόγο να τις ξεχωρίζει· η **γραμμή
        //    κατάστασης** τις ξεχωρίζει με λέξεις, που είναι το σωστό όργανο.
        busy={lookup.kind === 'searching' || state.kind === 'working'}
        onPick={handlePick}
        outline={shownOutline}
        trace={gesture === 'draw' ? draft.vertices : []}
        pin={gesture === 'pin' ? pin : null}
        disabled={state.kind === 'working'}
      />
      <p className="text-xs text-muted-foreground">{t('place.attribution')}</p>

      {gesture === 'draw' && <OutlineDraftControls draft={draft} />}

      {gesture === 'pick' && <LookupStatus lookup={lookup} />}
      <IdentityStatus state={state} />

      {state.kind === 'duplicate' ? (
        <aside className="space-y-2 rounded-lg border border-border bg-card p-3">
          <p className="text-sm font-medium text-foreground">{t('place.duplicate.title')}</p>
          <p className="text-sm text-muted-foreground">
            {t('place.duplicate.body', {
              label: state.displayAddress ?? t('place.picker.noAddress'),
            })}
          </p>
          <div className="flex flex-wrap gap-2">
            {/* «Ο ίδιος» ⇒ **καμία νέα ταυτότητα**: δείχνουμε σε αυτήν που ήδη υπάρχει. */}
            <Button type="button" size="sm" onClick={() => onChosen(state.existing)}>
              {t('place.duplicate.same')}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => submit(true)}>
              {t('place.duplicate.distinct')}
            </Button>
          </div>
        </aside>
      ) : (
        <Button
          type="button"
          onClick={() => submit(false)}
          disabled={pending === null || state.kind === 'working'}
        >
          {t('place.confirm')}
        </Button>
      )}
    </section>
  );
}
