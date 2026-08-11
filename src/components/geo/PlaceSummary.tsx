'use client';

/**
 * @fileoverview **Ο ΤΟΠΟΣ ΑΠΟΚΤΑ ΠΡΟΣΩΠΟ** — από `pbld_24b3a8d7…` σε «Στέφανου Δραγούμη, 8».
 * @related ADR-777 · SPEC-777A §13.7.3 (Β3) · §13.4 (ODbL) · §14.5
 * @module components/geo/PlaceSummary
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΔΙΟΡΘΩΝΕΙ, ΚΑΙ ΓΙΑΤΙ ΔΕΝ ΗΤΑΝ «ΚΟΣΜΗΤΙΚΟ»
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η Β2 έδωσε **ταυτότητα** στον τόπο και το απέδειξε ζωντανά — αλλά **το είδε το
 * `curl`, όχι ο άνθρωπος**: η οθόνη έβαφε το ωμό `pbld_*` ενώ η γη είχε **ήδη
 * αποθηκευμένο** `displayAddress`. Δεν έλειπε δεδομένο· έλειπε **ανάγνωση**.
 *
 * Και η συνέπεια δεν ήταν αισθητική: ένας άνθρωπος που δεν αναγνωρίζει τον τόπο που
 * μόλις διάλεξε **δεν μπορεί να επαληθεύσει ότι διάλεξε σωστά**. Ο επιλογέας του
 * §13.6 έχει **τρεις** χειρονομίες και η μία (κλικ σε κτίριο OSM) μπορεί κάλλιστα να
 * πιάσει το **διπλανό** κτίριο. Χωρίς πρόσωπο, το λάθος γίνεται **σιωπηλό** και
 * ταξιδεύει μέχρι τη μηχανή ταιριάσματος.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΡΙΑ ΠΡΑΓΜΑΤΑ ΠΟΥ Η ΟΘΟΝΗ ΛΕΕΙ ΡΗΤΑ ΑΝΤΙ ΝΑ ΤΑ ΣΙΩΠΗΣΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * 1. **«Χωρίς καταχωρημένη διεύθυνση»** — μετρήθηκε ότι μόλις **46 %** των κτιρίων στο
 *    κέντρο της Θεσσαλονίκης έχουν διεύθυνση (§13.7.2 #2). Το κενό είναι **η μισή
 *    αγορά**, όχι σπάνια περίπτωση· η εναλλακτική (αντίστροφη γεωκωδικοποίηση στο
 *    κεντροειδές) **απορρίφθηκε** γιατί επιστρέφει την **πλησιέστερη** διεύθυνση, που
 *    μπορεί να ανήκει σε **άλλο** κτίριο, και το `displayAddress` δεν έχει `Attested`
 *    για να σημανθεί ως «κατά προσέγγιση».
 * 2. **Η ταυτότητα μένει ορατή**, σε δεύτερη γραμμή. Δεν είναι φιλική, αλλά είναι
 *    **αληθής** — και είναι το μόνο πράγμα που ταιριάζει προσφορά με ζήτηση (§14.5).
 *    Το να την κρύψει η οθόνη επειδή βρήκε διεύθυνση θα αφαιρούσε τον **μόνο** τρόπο
 *    να πει κανείς «*μιλάμε για το ίδιο πράγμα;*».
 * 3. **Ο σπασμένος δεσμός λέγεται.** Δες `PublicPlaceLookup.dangling-building`.
 *
 * ⚠️ **Το περίγραμμα είναι ΖΩΝΤΑΝΟ, ποτέ αποθηκευμένο** (§13.4 — ODbL). Έρχεται από το
 * `/api/places/[placeId]/outline` και ζει σε μνήμη περιηγητή. ⛔ Καμία προσωρινή μνήμη
 * περιγραμμάτων σε δική μας βάση, **ούτε «για απόδοση»**.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { usePlaceOutline, type PlaceOutlineState } from '@/hooks/geo/usePlaceOutline';
import {
  placeDisplayAddress,
  usePublicPlace,
  type PublicPlaceLookup,
} from '@/services/realtime/hooks/usePublicPlace';
import type { GeoPoint } from '@/types/geo/coordinates';
import type { PlaceRef, PublicBuilding, PublicLand } from '@/types/geo/public-place';

import { PlaceMap } from './PlaceMap';

const NS = 'search-results';

export interface PlaceSummaryProps {
  readonly place: PlaceRef;
  /**
   * Να ζωγραφιστεί ο χάρτης με το ζωντανό περίγραμμα.
   *
   * ⚠️ **Ρητή επιλογή του καλούντος**: ένας χάρτης είναι στιγμιότυπο MapLibre, και μια
   * λίστα καρτών **δεν** πρέπει να ανοίξει έναν ανά γραμμή. Στη φόρμα, όπου ο άνθρωπος
   * μόλις **διάλεξε**, το σχήμα είναι η επαλήθευση — εκεί αξίζει.
   */
  readonly withOutline?: boolean;
}

/**
 * **Ο τόπος, όπως τον βλέπει άνθρωπος.**
 *
 * ⚠️ Η **ταυτότητα του τόπου για το περίγραμμα** είναι το κτίριο όταν υπάρχει, αλλιώς η
 * γη — γιατί το ερώτημα *«τι σχήμα έχει;»* απαντιέται από **αυτό που δείχνει ο δεσμός**,
 * και ένα οικόπεδο έχει δικό του σχήμα ανεξάρτητα από κτίριο.
 */
export function PlaceSummary({ place, withOutline = false }: PlaceSummaryProps): React.ReactElement {
  const lookup = usePublicPlace(place);
  const outlinePlaceId = place.buildingId ?? place.landId;

  return (
    <section className="space-y-2">
      <PlaceFace lookup={lookup} placeId={outlinePlaceId} />
      {withOutline && <PlaceOutlineFigure lookup={lookup} placeId={outlinePlaceId} />}
    </section>
  );
}

// ============================================================================
// ΤΟ ΠΡΟΣΩΠΟ — έξι καταστάσεις, καμία σιωπηλή
// ============================================================================

function PlaceFace({
  lookup,
  placeId,
}: {
  readonly lookup: PublicPlaceLookup;
  readonly placeId: string;
}): React.ReactElement {
  const { t } = useTranslation([NS]);

  switch (lookup.state) {
    // ⚠️ Το `idle` δεν συμβαίνει μέσα από το {@link PlaceSummary} (ο δεσμός είναι
    // υποχρεωτικός), αλλά ο τύπος το επιτρέπει και ένα `default` θα το κατάπινε.
    case 'idle':
    case 'loading':
      return <p className="text-sm text-muted-foreground">{t(`${NS}:place.summary.loading`)}</p>;

    case 'absent':
      // ⚠️ Η ταυτότητα σε **αδελφό** στοιχείο, ποτέ ένθετη: το `IdentityLine` είναι
      // `<p>`, και ένα `<p>` μέσα σε `<p>` το κλείνει σιωπηλά ο αναλυτής HTML.
      return (
        <div className="space-y-1">
          <p className="text-sm text-foreground">{t(`${NS}:place.summary.absent`)}</p>
          <IdentityLine placeId={placeId} />
        </div>
      );

    case 'error':
      return <p className="text-sm text-foreground">{t(`${NS}:place.summary.error`)}</p>;

    case 'dangling-building':
      return (
        <div className="space-y-1">
          <AddressLine lookup={lookup} />
          <p className="text-sm text-foreground">{t(`${NS}:place.summary.danglingBuilding`)}</p>
          <IdentityLine placeId={placeId} />
        </div>
      );

    case 'found':
      return (
        <div className="space-y-1">
          <AddressLine lookup={lookup} />
          <PlaceFacts land={lookup.land} building={lookup.building} />
          <IdentityLine placeId={placeId} />
        </div>
      );
  }
}

/** Η διεύθυνση — ή η **ρητή** δήλωση ότι δεν έχει λυθεί. */
function AddressLine({ lookup }: { readonly lookup: PublicPlaceLookup }): React.ReactElement {
  const { t } = useTranslation([NS]);
  const address = placeDisplayAddress(lookup);

  return address === null ? (
    <p className="text-sm text-muted-foreground">{t(`${NS}:place.picker.noAddress`)}</p>
  ) : (
    <p className="text-sm font-medium text-foreground">{address}</p>
  );
}

/**
 * Τα γεγονότα του τόπου — **μόνο όσα υπάρχουν**.
 *
 * ⚠️ Το `useCode` **δεν** εμφανίζεται και είναι απόφαση, όχι παράλειψη: το OSM δίνει
 * `building=*` ως **ανοιχτό** σύνολο, ενώ ο τύπος ζητά κωδικό **κλειστού** λεξιλογίου
 * (N.11). Η ωμή τιμή θα γεννούσε **ωμό κλειδί i18n** στο πρώτο `building=greenhouse`.
 * Μένει `null` ειλικρινά, μέχρι να αποφασιστεί η χαρτογράφηση (απόφαση τομέα).
 */
function PlaceFacts({
  land,
  building,
}: {
  readonly land: PublicLand;
  readonly building: PublicBuilding | null;
}): React.ReactElement | null {
  const { t } = useTranslation([NS]);

  if (building === null) {
    return (
      <p className="text-sm text-muted-foreground">
        {t(`${NS}:place.summary.landOnly`)}
        {land.areaSqm !== null && ` · ${t(`${NS}:place.summary.area`, { sqm: Math.round(land.areaSqm.value) })}`}
      </p>
    );
  }

  const facts: string[] = [];
  if (building.floorsAboveGround !== null) {
    facts.push(t(`${NS}:place.summary.floors`, { floors: building.floorsAboveGround.value }));
  }
  if (building.constructionYear !== null) {
    facts.push(t(`${NS}:place.summary.constructionYear`, { year: building.constructionYear.value }));
  }
  if (facts.length === 0) return null;

  return <p className="text-sm text-muted-foreground">{facts.join(' · ')}</p>;
}

/** Η ταυτότητα, σε δεύτερη γραμμή — **αληθής και ορατή**, δες κεφαλίδα αρχείου #2. */
function IdentityLine({ placeId }: { readonly placeId: string }): React.ReactElement {
  const { t } = useTranslation([NS]);
  return (
    <p className="text-xs text-muted-foreground">{t(`${NS}:place.summary.identity`, { id: placeId })}</p>
  );
}

// ============================================================================
// ΤΟ ΠΕΡΙΓΡΑΜΜΑ — ζωντανά, με ρητή κάθε αποτυχία
// ============================================================================

/** Πού κοιτάζει ο χάρτης· `null` όταν **δεν ξέρουμε πού είναι** (§13.7.1: το `unknown` δεν είναι διακοσμητικό). */
function placeCenter(lookup: PublicPlaceLookup): GeoPoint | null {
  if (lookup.state !== 'found' && lookup.state !== 'dangling-building') return null;
  return lookup.land.position.kind === 'known' ? lookup.land.position.point : null;
}

function PlaceOutlineFigure({
  lookup,
  placeId,
}: {
  readonly lookup: PublicPlaceLookup;
  readonly placeId: string;
}): React.ReactElement | null {
  const { t } = useTranslation([NS]);
  const center = placeCenter(lookup);

  // ⚠️ **Το αίτημα φεύγει μόνο όταν υπάρχει τι να δειχθεί.** Ένα ερώτημα Overpass για
  // τόπο που δεν μπορούμε να ζωγραφίσουμε ξοδεύει ένα από τα **2 slots ανά IP**.
  const outline = usePlaceOutline(center === null ? null : placeId);

  if (center === null) return null;

  return (
    <div className="space-y-1">
      <PlaceMap center={center} outline={outline.kind === 'outline' ? outline.outline : null} heightClass="h-56" />
      <p className="text-xs text-muted-foreground">{t(`${NS}:place.attribution`)}</p>
      <OutlineNotice state={outline} />
    </div>
  );
}

/**
 * **Γιατί δεν βλέπεις σχήμα** — τρεις διαφορετικές απαντήσεις, τρία διαφορετικά μηνύματα.
 *
 * 🔴 Η συγχώνευση `none` ⇄ `unavailable` είναι **ακριβώς** το λάθος που η Β2 πλήρωσε
 * (§13.7.2 #5): «*δεν έχει σχήμα*» είναι **οριστικό**, «*δεν απάντησε*» καλεί σε
 * επανάληψη — και το δεύτερο ειπωμένο ως πρώτο σπρώχνει τον άνθρωπο να **ζωγραφίσει**
 * κτίριο που υπάρχει ήδη, γεννώντας δεύτερη ταυτότητα για ένα φυσικό πράγμα.
 */
function OutlineNotice({ state }: { readonly state: PlaceOutlineState }): React.ReactElement | null {
  const { t } = useTranslation([NS]);

  switch (state.kind) {
    case 'idle':
    case 'loading':
    case 'outline':
      return null;
    case 'none':
      return <p className="text-xs text-muted-foreground">{t(`${NS}:place.summary.outlineNone`)}</p>;
    case 'unavailable':
      return <p className="text-xs text-foreground">{t(`${NS}:place.summary.outlineUnavailable`)}</p>;
    case 'failed':
      return <p className="text-xs text-foreground">{t(`${NS}:place.summary.outlineFailed`)}</p>;
  }
}
