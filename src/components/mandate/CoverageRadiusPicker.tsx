'use client';

/**
 * @fileoverview **Η ΑΚΤΙΝΑ ΩΣ ΔΗΛΩΣΗ** — σημείο που ορίζει ο ίδιος, και απόσταση γύρω του.
 * @related ADR-846 Φάση 2 · `types/agency-coverage.ts` · `components/geo/PlaceMap`
 * @module components/mandate/CoverageRadiusPicker
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * 🏆 ΕΔΩ ΠΛΗΡΩΝΕΤΑΙ ΤΟ ΔΕΥΤΕΡΟ ΣΚΕΛΟΣ ΤΟΥ ΕΠΙΧΕΙΡΗΜΑΤΟΣ ΠΟΥ ΕΠΕΤΡΕΨΕ ΤΗΝ ΑΚΤΙΝΑ
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * Η απαγόρευση #6 του `types/agency-profile.ts` δεν έλεγε *«μεγάλο νούμερο»* — έλεγε
 * ότι η ακτίνα είναι **οπτικά αόρατη**: ο επισκέπτης βλέπει «Δήμος Θέρμης» και ξέρει τι
 * σημαίνει· ένα «50 χλμ» δεν το ξέρει, **και ούτε ο ίδιος ο δηλών**.
 *
 * 🔑 **Ο κύκλος ΖΩΓΡΑΦΙΖΕΤΑΙ.** Ο άνθρωπος που σέρνει το «50 χλμ» βλέπει το σχήμα να
 * σκεπάζει μισή Χαλκιδική **την ώρα που το δηλώνει**. Η υπερδήλωση παύει να είναι
 * αφηρημένος αριθμός και γίνεται **εικόνα που ο ίδιος αναγνωρίζει ως ψέμα** — που είναι
 * ασύγκριτα ισχυρότερο από κάθε ανιχνευτή spam.
 *
 * ⚠️ **ΚΑΙ ΤΟ ΤΑΒΑΝΙ ΕΙΝΑΙ ΤΥΠΟΣ**: το χειριστήριο απαριθμεί το `COVERAGE_RADIUS_STEPS`.
 * Δεν υπάρχει πεδίο να γράψει «500» — δεν είναι απαγορευμένο, είναι **ανέκφραστο**.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * ⛔ ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟΣ ΧΑΡΤΗΣ ΑΠΟ ΤΗΣ ΕΔΡΑΣ — ΚΑΙ ΟΧΙ ΤΕΤΑΡΤΗ ΛΕΙΤΟΥΡΓΙΑ ΕΚΕΙ
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * Ο `PlaceChooser` της έδρας απαντά *«ποιος τόπος είσαι;»* και παράγει **ταυτότητα**
 * *(`PlaceRef` → `landId`)*, την οποία ο **διακομιστής** μεταφράζει σε σημείο. Εδώ
 * ρωτιέται *«γύρω από πού δουλεύεις;»* και η απάντηση είναι **σημείο, όχι τόπος** — ο
 * μπετατζής της Θέρμης μπορεί να δηλώσει κύκλο γύρω από τα **Νέα Μουδανιά**, όπου δεν
 * έχει τίποτα δικό του. Μια τέταρτη λειτουργία στον `PlaceChooser` θα έδενε δύο
 * **διαφορετικές** ερωτήσεις σε ένα χειριστήριο, ακριβώς ό,τι απαγορεύει το
 * `types/agency-coverage.ts` για τους τύπους.
 *
 * ✅ Ο **χάρτης** όμως είναι ο **ίδιος** *(`PlaceMap`)* — SSoT της απόδοσης, δύο
 * καταναλωτές, καμία αντιγραφή *(N.18)*.
 */

import React from 'react';

import { Button } from '@/components/ui/button';
import { PlaceMap } from '@/components/geo/PlaceMap';
import {
  COVERAGE_MAP_HEIGHT_CLASS,
  COVERAGE_MAP_HEIGHT_PX,
  coverageCameraFrame,
} from '@/lib/agency/coverage-camera';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { GEOGRAPHIC_CONFIG } from '@/config/geographic-config';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { mapZoomForRadiusKm } from '@/lib/geo/geo-map-zoom';
import { geoCircleOutline } from '@/lib/geo/geo-ring';
import {
  COVERAGE_RADIUS_STEPS,
  asCoverageRadiusKm,
  type CoverageRadiusKm,
  type RadiusCoverage,
} from '@/types/agency-coverage';
import type { GeoPoint } from '@/types/geo/coordinates';

import { SHOWCASE_KEYS, SHOWCASE_NS } from './agency-showcase-labels';

/**
 * **Η προεπιλογή όταν δεν υπάρχει τίποτα** — μεσαίο βήμα, όχι το μικρότερο.
 *
 * 🔑 Το μικρότερο θα διαβαζόταν ως *«το σύστημα προτείνει να δηλώσεις λίγα»*, το
 * μεγαλύτερο ως *«δήλωσε πολλά»*. Και τα δύο είναι **σιωπηλή επιρροή** προς την ίδια
 * απόφαση που το ADR-846 φροντίζει να μην κατευθύνει.
 */
const DEFAULT_STEP: CoverageRadiusKm = 20;

/** Πού ανοίγει ο χάρτης όταν δεν υπάρχει ούτε κέντρο ούτε έδρα. */
const FALLBACK_CENTRE: GeoPoint = {
  lat: GEOGRAPHIC_CONFIG.DEFAULT_LATITUDE,
  lng: GEOGRAPHIC_CONFIG.DEFAULT_LONGITUDE,
};

export interface CoverageRadiusPickerProps {
  /** Η τρέχουσα δήλωση ακτίνας, ή `null` όταν δεν έχει οριστεί κέντρο ακόμη. */
  readonly value: RadiusCoverage | null;
  /**
   * **Η έδρα, αν έχει ήδη δημοσιευθεί** — για τη συντόμευση «χρησιμοποίησέ την».
   *
   * ⚠️ `null` πριν από την πρώτη δημοσίευση: το σημείο το **παράγει ο διακομιστής** από
   * τη γη *(`readLandPosition`)*, οπότε ο πελάτης δεν το ξέρει πριν το δει. Η
   * συντόμευση απλώς **δεν εμφανίζεται** — δεν εφευρίσκεται σημείο.
   */
  readonly home: GeoPoint | null;
  readonly onChange: (coverage: RadiusCoverage | null) => void;
  readonly disabled?: boolean;
}

export function CoverageRadiusPicker({
  value,
  home,
  onChange,
  disabled = false,
}: CoverageRadiusPickerProps): React.ReactElement {
  const { t } = useTranslation([SHOWCASE_NS]);

  /**
   * 🔴 **Η ΕΠΙΛΕΓΜΕΝΗ ΑΠΟΣΤΑΣΗ ΖΕΙ ΤΟΠΙΚΑ ΟΣΟ ΔΕΝ ΥΠΑΡΧΕΙ ΚΕΝΤΡΟ** *(μετρημένο στο
   * ζωντανό περπάτημα)*. Χωρίς αυτή τη μνήμη, η σειρά που κάνει κάθε άνθρωπος —
   * *«διαλέγω 30, μετά δείχνω πού»* — **έχανε σιωπηλά** την επιλογή: το `emit` με
   * `centre === null` εκπέμπει `null`, το `value` μένει `null`, και το χειριστήριο
   * γύριζε πίσω στα 20. Ο άνθρωπος έπαιρνε **άλλον κύκλο από αυτόν που ζήτησε**, χωρίς
   * κανένα μήνυμα.
   *
   * ⚠️ Ίδιο σχήμα με το `preferred` του `CoverageAreaPicker`: **τοπική προτίμηση, που η
   * δήλωση υπερισχύει μόλις υπάρξει** — ποτέ `useState` αρχικοποιημένο από prop που
   * φτάνει αργότερα.
   */
  const [preferredStep, setPreferredStep] = React.useState<CoverageRadiusKm>(DEFAULT_STEP);

  const centre = value?.circle.center ?? null;
  const radiusKm = value?.circle.radiusKm ?? preferredStep;

  /**
   * ⚠️ **Η ακτίνα ΔΕΝ εκπέμπεται χωρίς κέντρο.** Μισή δήλωση δεν είναι «μερικώς
   * χρήσιμη» — είναι **μη δήλωση**, και το `RadiusCoverage` δεν την εκφράζει. Ο άνθρωπος
   * αλλάζει την απόσταση όσο θέλει· μέχρι να δείξει σημείο, τίποτα δεν φεύγει.
   */
  const emit = (nextCentre: GeoPoint | null, nextRadius: CoverageRadiusKm): void => {
    onChange(nextCentre === null ? null : { circle: { center: nextCentre, radiusKm: nextRadius } });
  };

  return (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
      <p className="m-0 text-sm text-muted-foreground">{t(SHOWCASE_KEYS.coverageCenterHint)}</p>

      <label className="flex items-center gap-2 text-sm text-foreground">
        {t(SHOWCASE_KEYS.coverageRadiusLabel)}
        <Select
          value={String(radiusKm)}
          disabled={disabled}
          onValueChange={(next) => {
            const step = asCoverageRadiusKm(Number(next)) ?? DEFAULT_STEP;
            setPreferredStep(step);
            emit(centre, step);
          }}
        >
          <SelectTrigger className="min-w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COVERAGE_RADIUS_STEPS.map((km) => (
              <SelectItem key={km} value={String(km)}>
                {t(SHOWCASE_KEYS.coverageRadiusOption, { km })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>

      {/* 🔑 **Ο κύκλος ζωγραφίζεται με τον ΙΔΙΟ SSoT που τον κρίνει** — το
          `geoCircleOutline` δέχεται **μέτρα**, γι' αυτό ο πολλαπλασιασμός γίνεται εδώ
          και μία φορά. Ό,τι βλέπει ο άνθρωπος είναι ό,τι θα ρωτηθεί. */}
      <PlaceMap
        center={centre ?? home ?? FALLBACK_CENTRE}
        onPick={disabled ? undefined : (point) => emit(point, radiusKm)}
        pin={centre}
        outline={centre === null ? null : geoCircleOutline(centre, radiusKm * 1000)}
        heightClass={COVERAGE_MAP_HEIGHT_CLASS}
        initialZoom={mapZoomForRadiusKm(radiusKm, COVERAGE_MAP_HEIGHT_PX)}
        /* 🔑 **Το `initialZoom` ανοίγει, το `fit` ΑΚΟΛΟΥΘΕΙ** (ADR-846 Φ4). Χωρίς το
           δεύτερο, ο επαγγελματίας που αλλάζει βήμα με τον χάρτη ήδη ανοιχτό βλέπει τον
           κύκλο να μεγαλώνει **έξω από το κάδρο** — δεν σκάει τίποτα, και διαβάζεται ως
           «χάθηκε η δήλωσή μου». */
        fit={coverageCameraFrame(centre === null ? null : { circle: { center: centre, radiusKm } })}
        disabled={disabled}
      />

      {centre === null ? (
        // ⚠️ **Η απουσία δηλώνεται** — «άγνωστο ≠ κενό» (N.12). Χωρίς αυτό, ο
        //    επαγγελματίας που διάλεξε απόσταση αλλά δεν έδειξε σημείο νομίζει ότι δήλωσε.
        <p className="m-0 text-sm text-muted-foreground">
          {t(SHOWCASE_KEYS.coverageCenterMissing)}
        </p>
      ) : (
        <p className="m-0 text-sm text-muted-foreground">
          {/*
            🔴 **ΤΟ `lng` ΕΙΝΑΙ ΔΕΣΜΕΥΜΕΝΟ ΟΝΟΜΑ ΤΟΥ i18next** *(η γλώσσα της κλήσης)* —
            μετρημένο ζωντανά: με `{ lat, lng }` η οθόνη τύπωσε **«Κέντρο: {lat}, {lng}»**,
            δηλαδή τα ίδια τα άγκιστρα. Δεν σκάει τίποτα και δεν το πιάνει καμία πύλη:
            το κείμενο **λύνεται**, απλώς δεν αντικαθίσταται. ⛔ Ποτέ `lng`/`ns`/`count`/
            `context`/`defaultValue` ως όνομα μεταβλητής παρεμβολής.
          */}
          {t(SHOWCASE_KEYS.coverageCenterSet, {
            latitude: centre.lat.toFixed(5),
            longitude: centre.lng.toFixed(5),
          })}
        </p>
      )}

      {home !== null && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => emit(home, radiusKm)}
        >
          {t(SHOWCASE_KEYS.coverageCenterUseHome)}
        </Button>
      )}
    </fieldset>
  );
}
