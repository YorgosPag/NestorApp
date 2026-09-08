'use client';

/**
 * @fileoverview **ΟΙ ΠΕΝΤΕ ΥΠΟΨΗΦΙΟΙ ΠΑΥΟΥΝ ΝΑ ΕΙΝΑΙ ΑΟΡΑΤΟΙ** — ADR-332 **D26**.
 * @related address-map-candidates · lib/geo/offscreen-edge-indicator · lib/geo/format-geo-distance
 * @module components/shared/addresses/AddressMapCandidateLayer
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΕΥΡΗΜΑ — ζωντανή μέτρηση 2026-09-05
 * ────────────────────────────────────────────────────────────────────────────
 *
 * «Αθηνάς 5» σε έργο **Θεσσαλονίκης** ⇒ πέντε αληθινές διευθύνσεις σε **292-318 χλμ**,
 * σε πέντε δήμους της Αττικής, **όλες με βεβαιότητα 65%**. Στον χάρτη δεξιά: **καμία**.
 * Ο άνθρωπος διάλεγε διαβάζοντας ονόματα δήμων.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🎯 ΤΡΕΙΣ ΑΠΟΦΑΣΕΙΣ, ΚΑΙ ΚΑΜΙΑ ΤΟΥΣ ΔΕΝ ΕΙΝΑΙ «ΟΠΩΣ Ο ZILLOW»
 * ────────────────────────────────────────────────────────────────────────────
 *
 * **1. Η κάμερα ΔΕΝ κουνιέται μόνη της.** *(απόφαση Giorgio 2026-09-05)* Ο Zillow δείχνει
 * ήδη όλες τις πινέζες και το hover απλώς τονίζει — εκεί δουλεύει, γιατί τα αποτελέσματά
 * του είναι **εντός πόλης**. Εδώ ένα fit-bounds Θεσσαλονίκη+Αττική είναι μισή Ελλάδα, όπου
 * και οι έξι πινέζες γίνονται κουκκίδες: δείχνει *«μακριά»*, όχι *«πού»* — και πετάει τον
 * άνθρωπο έξω από κάδρο που δεν ζήτησε να αλλάξει.
 *
 * **2. Ό,τι δεν χωράει, το δείχνει δείκτης στην ΑΚΡΗ** *(`lib/geo/offscreen-edge-indicator`)*.
 * Βέλος στραμμένο προς τα εκεί, ο αριθμός της γραμμής και η απόσταση. Κανένας από τους
 * Zillow / Idealista / Google Places / Mapbox Search δεν το κάνει σε επιλογέα διεύθυνσης —
 * επειδή κανένας τους δεν έχει υποψήφιους 300 χλμ μακριά. Το μοτίβο είναι δανεισμένο από
 * τη χαρτογραφία και τα παιχνίδια, όχι από τους ανταγωνιστές.
 *
 * **3. Οι πινέζες είναι ΑΡΙΘΜΗΜΕΝΕΣ, και ο αριθμός είναι ο ίδιος με της γραμμής.** Αυτό
 * λύνει την αντιστοίχιση **χωρίς καμία χειρονομία**: ο Zillow απαιτεί hover για να μάθεις
 * ποια πινέζα είναι ποια κάρτα. Το hover εδώ **προσθέτει** έμφαση· δεν είναι η μόνη πόρτα.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ♿ ΓΙΑΤΙ ΤΟ ΣΧΗΜΑ ΚΑΙ ΟΧΙ ΤΟ ΧΡΩΜΑ ΞΕΧΩΡΙΖΕΙ ΠΡΟΤΑΣΗ ΑΠΟ ΔΕΔΟΜΕΝΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Οι αποθηκευμένες διευθύνσεις είναι **συμπαγείς σταγόνες** *(`DraggableMarkerPin`)*. Οι
 * υποψήφιοι είναι **κύκλοι με διάστικτο περίγραμμα και αριθμό**. Η σύγχυση «πρόταση ⇄
 * δεδομένο» είναι το χειρότερο που μπορεί να συμβεί σε αυτή την οθόνη, και μια απόχρωση
 * δεν είναι αρκετή: θα εξαφανιζόταν σε αχρωματοψία, σε ασπρόμαυρη εκτύπωση και σε ήλιο
 * (**CHECK 3.41**, WCAG 1.4.1). Το ίδιο ισχύει και για την **έμφαση**: το τονισμένο
 * περνά από **διάστικτο σε συμπαγές** και μεγαλώνει — δύο κανάλια πριν καν το χρώμα.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Marker, useMap } from '@/lib/maps/maplibre';
import { LngLatBounds } from '@/lib/maps/maplibre';
import { Maximize2 } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatGeoDistance } from '@/lib/geo/format-geo-distance';
import type { ScreenPoint, ScreenSize } from '@/lib/geo/offscreen-edge-indicator';
import {
  CandidateBadge,
  edgeIndicatorForCandidate,
  EdgeIndicatorArrow,
} from '@/components/shared/addresses/address-map-edge-indicator';
import type { AddressMapCandidate } from '@/components/shared/addresses/address-map-candidates';
import { cameraFraming } from '@/lib/geo/camera-motion';

/**
 * 🔑 **ΤΑ ΔΥΟ ΙΔΙΩΤΙΚΑ ΟΡΙΑ ΕΦΥΓΑΝ** *(`FIT_MAX_ZOOM = 15` · `FIT_PADDING_PX = 56`)*.
 * Ο λόγος του πρώτου ήταν σωστός και **επιβίωσε ονομασμένος** *(`'suggested'`: ένας
 * υποψήφιος δίνει ορθογώνιο μηδενικού εμβαδού, και μια γεωκωδικοποιημένη πρόταση δεν
 * στηρίζει ισχυρισμό ακρίβειας κτιρίου)*. Το δεύτερο **δεν είχε γραμμένο λόγο** — και
 * ήταν το τρίτο από τέσσερα διαφορετικά περιθώρια για την ίδια ερώτηση.
 */

export interface AddressMapCandidateLayerProps {
  /** Οι γραμμές του καταλόγου, **στη σειρά που τις δείχνει το πάνελ**. */
  readonly candidates: readonly AddressMapCandidate[];
  /** Ποια είναι τονισμένη τώρα — `null` όταν καμία. */
  readonly highlightedRank: number | null;
  /** Ο δεσμός χάρτης → λίστα. Μία μορφή, δύο καταστάσεις *(precedent: `ListingCard`)*. */
  readonly onHighlight: (rank: number | null) => void;
  /** Κλικ σε πινέζα ή δείκτη = **επιλογή**, ταυτόσημη με το κλικ στη γραμμή. */
  readonly onSelect?: (rank: number) => void;
  /**
   * Η **αφετηρία** από την οποία μετριούνται οι αποστάσεις (D23/D25).
   *
   * 🔑 Μπαίνει στο «δες τα όλα» ώστε το κάδρο να απαντά *«296 χλμ **από πού**;»*. Κανένας
   * επιλογέας διεύθυνσης δεν το δείχνει — επειδή κανένας δεν έχει αφετηρία εγγύτητας.
   */
  readonly anchor?: { readonly lat: number; readonly lng: number } | null;
}

// =============================================================================
// ΠΡΟΒΟΛΗ — από γεωγραφία σε pixel, μία φορά ανά καρέ
// =============================================================================

interface ScreenGeometry {
  readonly points: ReadonlyMap<number, ScreenPoint>;
  readonly size: ScreenSize;
}

const EMPTY_GEOMETRY: ScreenGeometry = {
  points: new Map(),
  size: { width: 0, height: 0 },
};

/**
 * Πού πέφτει κάθε υποψήφιος **στην οθόνη**, τώρα.
 *
 * ⚠️ **Ο υπολογισμός γίνεται στον ακροατή, ΟΧΙ στη ζωγραφική.** Το `map.project()` είναι
 * ερώτημα σε **μεταβλητή** κατάσταση έξω από τη React· κλήση του μέσα στο render θα έδινε
 * αποτέλεσμα που η React δεν ξέρει πότε άλλαξε — δηλαδή δείκτες που «κολλάνε» ένα καρέ
 * πίσω από τον χάρτη.
 *
 * ⚠️ **Και συμπυκνώνεται σε ένα `requestAnimationFrame`.** Το `move` πυροδοτεί δεκάδες
 * φορές ανά καρέ κατά το σύρσιμο· χωρίς τη συμπύκνωση θα γίνονταν δεκάδες `setState` για
 * την ίδια εικόνα.
 */
function useCandidateScreenGeometry(
  candidates: readonly AddressMapCandidate[],
): ScreenGeometry {
  const { current: mapRef } = useMap();
  const [geometry, setGeometry] = useState<ScreenGeometry>(EMPTY_GEOMETRY);
  const frameRef = useRef(0);

  useEffect(() => {
    if (!mapRef) return;
    const map = mapRef.getMap();

    const recompute = () => {
      frameRef.current = 0;
      const container = map.getContainer();
      const points = new Map<number, ScreenPoint>();
      for (const candidate of candidates) {
        const projected = map.project([candidate.lng, candidate.lat]);
        points.set(candidate.rank, { x: projected.x, y: projected.y });
      }
      setGeometry({
        points,
        size: { width: container.clientWidth, height: container.clientHeight },
      });
    };

    const schedule = () => {
      if (frameRef.current === 0) frameRef.current = requestAnimationFrame(recompute);
    };

    recompute();
    map.on('move', schedule);
    map.on('resize', schedule);
    return () => {
      if (frameRef.current !== 0) cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
      map.off('move', schedule);
      map.off('resize', schedule);
    };
  }, [mapRef, candidates]);

  return geometry;
}

// =============================================================================
// ΟΙ ΠΙΝΕΖΕΣ — για όσους χωράνε στο κάδρο (και για όσους θα χωρέσουν)
// =============================================================================

interface CandidateHandlers {
  readonly highlightedRank: number | null;
  readonly onHighlight: (rank: number | null) => void;
  readonly onSelect?: (rank: number) => void;
  /** Ολόκληρη η γραμμή + απόσταση, έτοιμη για `aria-label`. */
  readonly describe: (candidate: AddressMapCandidate) => string;
}

/**
 * Οι **τέσσερις πόρτες** προς τον ίδιο δεσμό, γραμμένες **μία φορά**.
 *
 * 🔴 **Ήταν δύο φορές, και το έπιασε η CHECK 3.28** *(85 tokens, σε αυτό ακριβώς το
 * commit)*: η πινέζα και ο δείκτης άκρης είχαν πανομοιότυπο μπλοκ χειριστών. Δεν είναι
 * καλλωπισμός — είναι **δύο επιφάνειες που δείχνουν το ίδιο πράγμα**, και ο επόμενος που
 * θα προσθέσει χειρισμό *(π.χ. `Enter`/`Space` ή μακρύ πάτημα)* θα τον έβαζε στη μία.
 * Έτσι, η απόκλιση δεν αποφεύγεται με προσοχή — **δεν μπορεί να γραφτεί**.
 *
 * ⚠️ Το `onSelect` είναι προαιρετικό ⇒ κλικ χωρίς παραλήπτη δεν κάνει τίποτα, αντί να
 * βάφει δείκτη «χεράκι» πάνω σε υπόσχεση που δεν τηρείται.
 */
function candidateButtonProps(
  candidate: AddressMapCandidate,
  handlers: CandidateHandlers,
) {
  return {
    type: 'button',
    'aria-label': handlers.describe(candidate),
    onMouseEnter: () => handlers.onHighlight(candidate.rank),
    onMouseLeave: () => handlers.onHighlight(null),
    onFocus: () => handlers.onHighlight(candidate.rank),
    onBlur: () => handlers.onHighlight(null),
    onClick: () => handlers.onSelect?.(candidate.rank),
  } as const;
}

function CandidateMarkers({
  candidates,
  handlers,
}: {
  readonly candidates: readonly AddressMapCandidate[];
  readonly handlers: CandidateHandlers;
}) {
  return (
    <>
      {candidates.map((candidate) => (
        <Marker
          key={candidate.rank}
          longitude={candidate.lng}
          latitude={candidate.lat}
          anchor="center"
        >
          <button
            {...candidateButtonProps(candidate, handlers)}
            className="flex flex-col items-center gap-0.5 bg-transparent border-0 p-0 cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <CandidateBadge
              position={candidate.position}
              highlighted={handlers.highlightedRank === candidate.rank}
            />
            {/* Η ετικέτα ανοίγει **μόνο** στην τονισμένη: πέντε ετικέτες μόνιμα ανοιχτές
                πάνω σε πέντε γειτονικούς δήμους είναι κουρτίνα, όχι πληροφορία. */}
            {handlers.highlightedRank === candidate.rank && (
              <span className="rounded border border-border bg-background px-1 py-0.5 text-[10px] font-semibold leading-none text-foreground shadow-sm whitespace-nowrap">
                {candidate.label}
              </span>
            )}
          </button>
        </Marker>
      ))}
    </>
  );
}

// =============================================================================
// ΟΙ ΔΕΙΚΤΕΣ ΑΚΡΗΣ — για όσους ΔΕΝ χωράνε
// =============================================================================

interface PlacedIndicator {
  readonly candidate: AddressMapCandidate;
  readonly x: number;
  readonly y: number;
  readonly angleDeg: number;
}

/*
  🔑 **Η ΜΟΝΑΔΙΚΗ ΕΞΑΙΡΕΣΗ ΣΤΟΝ N.3 ΕΔΩ, ΚΑΙ ΕΙΝΑΙ Η ΔΗΛΩΜΕΝΗ.** Οι τιμές είναι
  **γεωμετρία σε pixel**, παραγόμενη σε χρόνο εκτέλεσης από την προβολή του χάρτη· δεν
  υπάρχει κλάση Tailwind που να την εκφράζει, και μια γεννήτρια κλάσεων για 360 γωνίες θα
  ήταν χειρότερη από το πρόβλημα. Ίδιο precedent, ίδια αιτιολόγηση: `FloatingPanel.tsx:268`
  *(«η γεωμετρία είναι εξ ορισμού δυναμική — δεν εκφράζεται με κλάσεις Tailwind»)*.
*/
function edgeStyle(x: number, y: number): React.CSSProperties {
  // `translate(-50%, -50%)`: η θέση που δίνει η γεωμετρία είναι το **κέντρο** του σήματος,
  // όχι η πάνω αριστερή γωνία του — αλλιώς κάθε δείκτης κάθεται μισό σήμα πιο μέσα.
  return { left: x, top: y, transform: 'translate(-50%, -50%)' };
}

function CandidateEdgeIndicators({
  placed,
  handlers,
  groupLabel,
}: {
  readonly placed: readonly PlacedIndicator[];
  readonly handlers: CandidateHandlers;
  readonly groupLabel: string;
}) {
  if (placed.length === 0) return null;

  return (
    <ul
      aria-label={groupLabel}
      className="pointer-events-none absolute inset-0 z-10 m-0 list-none p-0"
    >
      {placed.map(({ candidate, x, y, angleDeg }) => (
        <li key={candidate.rank} className="absolute" style={edgeStyle(x, y)}>
          <button
            {...candidateButtonProps(candidate, handlers)}
            className="pointer-events-auto flex items-center bg-transparent border-0 p-0 cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <EdgeIndicatorArrow
              angleDeg={angleDeg}
              highlighted={handlers.highlightedRank === candidate.rank}
            />
            <CandidateBadge
              position={candidate.position}
              highlighted={handlers.highlightedRank === candidate.rank}
            />
          </button>
        </li>
      ))}
    </ul>
  );
}

// =============================================================================
// Η ΣΥΝΘΕΣΗ
// =============================================================================

export function AddressMapCandidateLayer({
  candidates,
  highlightedRank,
  onHighlight,
  onSelect,
  anchor,
}: AddressMapCandidateLayerProps) {
  const { t, currentLanguage } = useTranslation('addresses');
  const { current: mapRef } = useMap();
  const geometry = useCandidateScreenGeometry(candidates);

  /**
   * Ολόκληρη η γραμμή **και** η απόσταση, στη γλώσσα του ανθρώπου.
   *
   * ⚠️ Η απόσταση περνά από το `formatGeoDistance` (`Intl`, ADR-332 D25 §μονάδα) — ποτέ
   * από χειρόγραφο κλειδί. Εκείνο έγραφε **«296.0κμμ»**, με 476 άγκυρες πράσινες.
   */
  const describe = useCallback(
    (candidate: AddressMapCandidate) => {
      const distance = formatGeoDistance(candidate.distanceM, currentLanguage);
      return distance === null
        ? candidate.fullLabel
        : `${candidate.fullLabel} — ${distance}`;
    },
    [currentLanguage],
  );

  const handlers = useMemo<CandidateHandlers>(
    () => ({ highlightedRank, onHighlight, onSelect, describe }),
    [highlightedRank, onHighlight, onSelect, describe],
  );

  /** Ποιοι **δεν χωράνε** — και πού ακουμπούν την άκρη. */
  const placed = useMemo<PlacedIndicator[]>(() => {
    const result: PlacedIndicator[] = [];
    for (const candidate of candidates) {
      const point = geometry.points.get(candidate.rank);
      if (!point) continue;
      /*
        Δύο περιθώρια, δύο ερωτήματα — *«φαίνεται η πινέζα;»* και *«πού επιτρέπεται να
        καθίσει ο δείκτης;»*. Η σύγχυσή τους ήταν το μετρημένο ελάττωμα της 05/09
        *(δείκτης πάνω στο «δες τα όλα», 15×23 px)*, και **δεν περνούν από εδώ**: τα
        κρατά το ίδιο το `edgeIndicatorForCandidate`, ώστε να μην υπάρχει παράμετρος να
        ξεχαστεί — και ώστε η άγκυρα να δοκιμάζει **αυτή ακριβώς** τη διαδρομή.
      */
      const indicator = edgeIndicatorForCandidate(point, geometry.size);
      if (indicator) result.push({ candidate, ...indicator });
    }
    return result;
  }, [candidates, geometry]);

  const fitAll = useCallback(() => {
    if (!mapRef || candidates.length === 0) return;
    const bounds = new LngLatBounds();
    for (const candidate of candidates) bounds.extend([candidate.lng, candidate.lat]);
    if (anchor) bounds.extend([anchor.lng, anchor.lat]);
    if (bounds.isEmpty()) return;
    /*
      ⚠️ **Η ΜΟΝΗ ΚΛΗΣΗ ΤΗΣ ΕΦΑΡΜΟΓΗΣ ΠΟΥ ΤΟ ΕΚΑΝΕ ΣΩΣΤΑ — ΚΑΤΑ ΛΑΘΟΣ.** Δεν περνούσε
      `duration`, άρα ήταν η **μόνη** που άφηνε τον van Wijk να δουλέψει. Τώρα το κάνει
      **επειδή το λέει**: `'label'` γιατί στην άκρη κάθεται σήμα υποψηφίου, όχι πινέζα.
    */
    mapRef.fitBounds(bounds, cameraFraming('travel', 'label', 'suggested'));
  }, [mapRef, candidates, anchor]);

  if (candidates.length === 0) return null;

  return (
    <>
      <CandidateMarkers candidates={candidates} handlers={handlers} />
      <CandidateEdgeIndicators
        placed={placed}
        handlers={handlers}
        groupLabel={t('editor.suggestions.title')}
      />
      {/*
        «Δες τα όλα» — η **ρητή** πόρτα προς τη συνολική εικόνα (απόφαση Giorgio 05/09).
        Κάτω δεξιά θα έπεφτε πάνω στο «Βρες τη θέση μου» του `AddressMap`· πάνω δεξιά πάνω
        στο χειριστήριο του `InteractiveMap`. Μένει **κάτω κεντρικά**.

        🔴 **ΚΑΙ ΑΚΡΙΒΩΣ ΓΙ' ΑΥΤΟ Η ΚΑΤΩ ΠΛΕΥΡΑ ΕΙΝΑΙ ΔΕΣΜΕΥΜΕΝΗ.** Ο δείκτης ενός
        υποψήφιου **ακριβώς νότια** έπεφτε εδώ πάνω — μετρημένη επικάλυψη **15×23 px**
        στους «Αγίους Αναργύρους», 05/09. Το `bottom-3` και το ύψος αυτού του κουμπιού
        είναι δηλωμένα στο `FIT_BUTTON_BOX`, και το `EDGE_PLACEMENT_INSETS.bottom`
        **υπολογίζεται από εκεί**: αν αλλάξει η θέση του κουμπιού χωρίς τη σταθερά, την
        ασυμφωνία τη δείχνει άγκυρα, όχι η οθόνη.
      */}
      <button
        type="button"
        onClick={fitAll}
        aria-label={t('map.fitCandidates')}
        className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground shadow-md transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Maximize2 aria-hidden="true" className="h-3.5 w-3.5" />
        {t('map.fitCandidates')}
      </button>
    </>
  );
}
