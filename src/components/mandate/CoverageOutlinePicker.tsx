'use client';

/**
 * @fileoverview **ΤΟ ΧΑΡΑΓΜΕΝΟ ΠΟΛΥΓΩΝΟ ΩΣ ΔΗΛΩΣΗ** — ο άνθρωπος δείχνει πού δουλεύει.
 * @related ADR-846 Φάση 3 · components/geo/outline-draft · lib/agency/coverage-outline
 * @module components/mandate/CoverageOutlinePicker
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * 🏆 ΚΑΜΙΑ ΝΕΑ ΜΗΧΑΝΗ ΣΧΕΔΙΑΣΗΣ — Ο ΤΡΙΤΟΣ ΚΑΤΑΝΑΛΩΤΗΣ ΤΗΣ ΙΔΙΑΣ ΧΕΙΡΟΝΟΜΙΑΣ
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * Η χειρονομία *«κλικ, κλικ, κλικ»* ζει **μία** φορά *(`useOutlineDraft` +
 * `OutlineDraftControls`)* και εξυπηρετούσε ήδη **δύο** ερωτήσεις τομέα — *«πού είναι ο
 * τόπος;»* και *«πού ψάχνεις;»*. Αυτή είναι η **τρίτη**: *«πού δουλεύεις;»*.
 *
 * ⇒ Η επικύρωση δακτυλίου *(≥3 κορυφές · μη εκφυλισμένο · χωρίς αυτοτομή)* **δεν
 * ξαναγράφεται**: ζητιέται το `draft.outline`, που είναι `null` όσο το σχέδιο δεν είναι
 * σχήμα. Ο ίδιος χάρτης *(`PlaceMap`)*, τα ίδια χειριστήρια, τα **ίδια λόγια**.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔴 ΤΙ ΠΡΟΣΘΕΤΕΙ: ΤΑ ΤΑΒΑΝΙΑ ΤΗΣ **ΕΜΒΕΛΕΙΑΣ**, ΜΕ ΤΗΝ ΙΔΙΑ ΣΥΝΑΡΤΗΣΗ ΜΕ ΤΟΝ ΔΙΑΚΟΜΙΣΤΗ
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * Ένα σχήμα μπορεί να είναι **τέλειος δακτύλιος** και να μην επιτρέπεται ως δήλωση: 400
 * κορυφές *(εισαγωγή αρχείου)* ή άνοιγμα 120 χλμ *(ολόκληρη περιφέρεια)*. Τα δύο
 * ταβάνια κρίνονται από το `coverageOutlineDefect` — **την ίδια συνάρτηση** που τρέχει
 * ο γραφέας. Δεύτερη τιμή εδώ θα άφηνε τον άνθρωπο να πατήσει υποβολή και να πάρει
 * άρνηση για σχήμα που η οθόνη είχε **δεχτεί**.
 *
 * 🔑 **ΚΑΙ ΤΟ ΑΝΟΙΓΜΑ ΓΡΑΦΕΤΑΙ ΟΣΟ ΧΑΡΑΖΕΙ** *(«απλώνεται ~X χλμ»)*: το ταβάνι δεν
 * εμφανίζεται ως έκπληξη στο 51ο χιλιόμετρο — ο άνθρωπος βλέπει τον αριθμό να ανεβαίνει.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * ⚠️ Η ΚΑΜΕΡΑ ΔΕΝ ΑΚΟΛΟΥΘΕΙ — ΓΝΩΣΤΟ, ΚΟΙΝΟ ΜΕ ΤΗΝ ΑΚΤΙΝΑ, ΚΑΙ **ΔΕΝ** ΛΥΝΕΤΑΙ ΕΔΩ
 *
 * Το `PlaceMap` διαβάζει `center` και `initialZoom` **όταν ανοίγει**. Ο επαγγελματίας
 * που επιστρέφει σε δημοσιευμένη χάραξη μακριά από την προεπιλογή θα δει τον χάρτη στην
 * αρχική θέση. Είναι το **ίδιο** ανοιχτό ζήτημα με τον `CoverageRadiusPicker`
 * *(ADR-846 §9 #4)* και ⛔ **δεν λύνεται με `focus`**: εκείνο κουβαλά **βαθμό
 * βεβαιότητας γεωκωδικοποιητή**, έννοια που η δήλωση εμβέλειας **δεν έχει**. Θέλει δικό
 * του λεξιλόγιο σε **κοινό** component ⇒ απόφαση Giorgio, όχι παρενέργεια αυτού του αρχείου.
 */

import React from 'react';

import { OutlineDraftControls, useOutlineDraft } from '@/components/geo/outline-draft';
import { PlaceMap } from '@/components/geo/PlaceMap';
import {
  COVERAGE_MAP_HEIGHT_CLASS,
  COVERAGE_MAP_HEIGHT_PX,
  coverageCameraFrame,
} from '@/lib/agency/coverage-camera';
import { GEOGRAPHIC_CONFIG } from '@/config/geographic-config';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { coverageOutlineDefect } from '@/lib/agency/coverage-outline';
import { ringsFootprint } from '@/lib/geo/geo-footprint';
import { mapZoomForRadiusKm } from '@/lib/geo/geo-map-zoom';
import { vertexCentroid } from '@/lib/geo/geo-ring';
import { COVERAGE_MAX_OUTER_KM, COVERAGE_MAX_VERTICES } from '@/types/agency-coverage';
import type { OutlineCoverage } from '@/types/agency-coverage';
import type { GeoOutline, GeoPoint } from '@/types/geo/coordinates';

import {
  COVERAGE_OUTLINE_DEFECT_KEYS,
  OUTLINE_DEFECT_NS,
  SHOWCASE_KEYS,
  SHOWCASE_NS,
} from './agency-showcase-labels';

/**
 * **Πού ανοίγει ο άδειος χάρτης** — στο **μισό** του επιτρεπτού ανοίγματος.
 *
 * 🔑 Ούτε «κτίριο» *(όπου τίποτα χαράξιμο δεν χωράει)* ούτε «όλη η χώρα» *(όπου κάθε
 * κλικ είναι χιλιόμετρα)*. Στα ~25 χλμ ακτίνας ο άνθρωπος βλέπει **περίπου όσο του
 * επιτρέπεται να δηλώσει**, οπότε το ταβάνι γίνεται αντιληπτό **πριν** το συναντήσει.
 */
const EMPTY_MAP_ZOOM = mapZoomForRadiusKm(COVERAGE_MAX_OUTER_KM / 2, COVERAGE_MAP_HEIGHT_PX);

/** Πού ανοίγει ο χάρτης όταν δεν υπάρχει ούτε σχήμα ούτε έδρα. */
const FALLBACK_CENTRE: GeoPoint = {
  lat: GEOGRAPHIC_CONFIG.DEFAULT_LATITUDE,
  lng: GEOGRAPHIC_CONFIG.DEFAULT_LONGITUDE,
};

export interface CoverageOutlinePickerProps {
  readonly value: OutlineCoverage | null;
  /** Η δημοσιευμένη έδρα — **μόνο** για να ανοίξει ο χάρτης κάπου χρήσιμα. */
  readonly home: GeoPoint | null;
  readonly onChange: (coverage: OutlineCoverage | null) => void;
  readonly disabled?: boolean;
}

export function CoverageOutlinePicker({
  value,
  home,
  onChange,
  disabled = false,
}: CoverageOutlinePickerProps): React.ReactElement {
  const { t } = useTranslation([SHOWCASE_NS, OUTLINE_DEFECT_NS]);
  const draft = useOutlineDraft(value?.outline ?? null);

  /**
   * 🔴 **Η ΔΗΜΟΣΙΕΥΜΕΝΗ ΔΗΛΩΣΗ ΦΤΑΝΕΙ ΜΕΤΑ ΤΟ ΠΡΩΤΟ RENDER** — η ίδια παγίδα που
   * τεκμηριώνει το `preferred` του {@link CoverageAreaPicker} και ο `AreaCombobox`
   * *(§8.1)*: ένα `useState(αρχική τιμή από prop)` κρατά **το κενό**, και ο
   * επαγγελματίας νομίζει ότι η χάραξή του χάθηκε.
   *
   * ⚠️ **Σπέρνει ΜΟΝΟ σε άδειο σχέδιο, ΜΟΝΟ μία φορά.** Χωρίς το πρώτο, μια δήλωση που
   * φτάνει αργά θα **έσβηνε** κορυφές που ο άνθρωπος ήδη χάραξε· χωρίς το δεύτερο, το
   * `onChange` μας θα γύριζε πίσω ως `value` και θα ξανάσπερνε — βρόχος.
   */
  const seeded = React.useRef(false);
  const { reset } = draft;
  const initial = value?.outline ?? null;
  const drawnCount = draft.vertices.length;
  React.useEffect(() => {
    if (seeded.current || initial === null || drawnCount > 0) return;
    seeded.current = true;
    reset(initial);
  }, [initial, drawnCount, reset]);

  /**
   * ⚠️ **Το ελάττωμα εμβέλειας κρίνεται ΜΟΝΟ σε σχήμα** — όσο ο δακτύλιος δεν στέκει,
   * το `OutlineDraftControls` ήδη το λέει, και μια δεύτερη κόκκινη γραμμή από πάνω θα
   * ήταν δύο μηνύματα για ένα πρόβλημα.
   */
  const defect = React.useMemo(
    () => (draft.outline === null ? null : coverageOutlineDefect(draft.outline)),
    [draft.outline],
  );

  /** Το άνοιγμα, όσο χαράζει — ώστε το ταβάνι να μην είναι έκπληξη. */
  const spreadKm = React.useMemo(
    () => (draft.outline === null ? null : (ringsFootprint([draft.outline])?.outerKm ?? null)),
    [draft.outline],
  );

  /**
   * 🔑 **ΑΝΕΒΑΙΝΕΙ ΜΟΝΟ Ο,ΤΙ ΘΑ ΔΕΧΤΕΙ Ο ΔΙΑΚΟΜΙΣΤΗΣ.** Ένα σχήμα με ελάττωμα
   * εμβέλειας είναι «μη δήλωση», ακριβώς όπως η ακτίνα χωρίς κέντρο: αν ανέβαινε, η
   * φόρμα θα νόμιζε ότι έχει δήλωση και θα έτρωγε 422 στην υποβολή.
   */
  const accepted = draft.outline !== null && defect === null ? draft.outline : null;
  React.useEffect(() => {
    onChange(accepted === null ? null : { outline: accepted });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ο γονέας κρατά νέα ταυτότητα callback ανά απόδοση
  }, [accepted]);

  const centre = draft.vertices.length > 0 ? vertexCentroid(draft.vertices) : (home ?? FALLBACK_CENTRE);

  /**
   * 🔴 **Η ΚΑΜΕΡΑ ΧΩΡΑΕΙ ΤΟ ΣΧΗΜΑ ΠΟΥ ΗΡΘΕ — ΟΧΙ ΑΥΤΟ ΠΟΥ ΧΑΡΑΖΕΤΑΙ** (ADR-846 Φ4).
   *
   * Ο επαγγελματίας που **επιστρέφει** σε δημοσιευμένο πολύγωνο μακριά από την
   * προεπιλογή έβλεπε τον χάρτη στην αρχική θέση, με το σχήμα του **πουθενά**.
   *
   * ⛔ **Και όμως το `fit` ΔΕΝ δείχνει στο `draft`**, όσο κι αν μοιάζει προφανές: το
   * σχήμα αλλάζει σε **κάθε κορυφή**, οπότε η κάμερα θα πετούσε σε κάθε κλικ —
   * ο άνθρωπος θα χάραζε πάνω σε χάρτη που **του φεύγει από κάτω**. Η ακτίνα *(Φ2)*
   * θέλει το αντίθετο: εκεί **κάθε** αλλαγή βήματος αξίζει πτήση. Ίδια μηχανή, **άλλη
   * σκανδάλη** — και γι' αυτό το καρέ το χτίζει η κάθε επιφάνεια, όχι το `PlaceMap`.
   *
   * 🔑 **Μανταλάκι στην πρώτη άφιξη**: η δήλωση φτάνει **μετά** την προσάρτηση (ασύγχρονη
   * φόρτωση), άρα ένα `useRef(value)` θα κρατούσε για πάντα το `null` του πρώτου render.
   */
  const arrived = React.useRef<GeoOutline | null>(null);
  if (arrived.current === null && value !== null) arrived.current = value.outline;
  const fit = React.useMemo(
    () => coverageCameraFrame(arrived.current === null ? null : { outline: arrived.current }),
    [arrived.current],
  );

  return (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
      <p className="m-0 text-sm text-muted-foreground">{t(SHOWCASE_KEYS.coverageOutlineHint)}</p>

      <PlaceMap
        center={centre}
        onPick={disabled ? undefined : draft.addVertex}
        trace={draft.vertices}
        outline={draft.outline}
        heightClass={COVERAGE_MAP_HEIGHT_CLASS}
        initialZoom={EMPTY_MAP_ZOOM}
        fit={fit}
        disabled={disabled}
      />

      <OutlineDraftControls draft={draft} />

      {/* ⚠️ **Η απουσία δηλώνεται** — «άγνωστο ≠ κενό» (N.12): ο επαγγελματίας που
          άνοιξε τον χάρτη και δεν χάραξε δεν πρέπει να νομίζει ότι δήλωσε. */}
      {draft.vertices.length === 0 && (
        <p className="m-0 text-sm text-muted-foreground">
          {t(SHOWCASE_KEYS.coverageOutlineMissing)}
        </p>
      )}

      {spreadKm !== null && defect === null && (
        <p className="m-0 text-sm text-muted-foreground">
          {t(SHOWCASE_KEYS.coverageOutlineExtent, {
            spread: spreadKm.toFixed(1),
            max: COVERAGE_MAX_OUTER_KM,
            vertices: draft.vertices.length,
            maxVertices: COVERAGE_MAX_VERTICES,
          })}
        </p>
      )}

      {defect !== null && (
        <p className="m-0 text-sm text-destructive" role="alert">
          {t(COVERAGE_OUTLINE_DEFECT_KEYS[defect], {
            max: COVERAGE_MAX_OUTER_KM,
            maxVertices: COVERAGE_MAX_VERTICES,
          })}
        </p>
      )}
    </fieldset>
  );
}
