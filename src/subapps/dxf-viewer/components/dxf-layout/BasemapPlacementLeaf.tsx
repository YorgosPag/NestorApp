'use client';

/**
 * ⚠️  ARCHITECTURE-CRITICAL — ΔΙΑΒΑΣΕ ADR-040 ΠΡΙΝ ΑΛΛΑΞΕΙΣ
 *
 * ADR-782 §23 — το micro-leaf της **χειροκίνητης τοποθέτησης** υποβάθρου.
 *
 * ## Τρεις πύλες, και καμία δεν είναι διακοσμητική
 * | Πύλη | Γιατί |
 * |---|---|
 * | ενεργή συνεδρία | αλλιώς μια αόρατη επιφάνεια θα έτρωγε **κάθε** κλικ του καμβά |
 * | κατάσταση «κατά προσέγγιση» | γεωαναφερμένο έργο ⇒ ο χάρτης ακολουθεί το **τοπογραφικό**· σύρσιμο εκεί θα ζητούσε να διορθώσουμε με το μάτι μια **μετρημένη** θέση |
 * | προβολή 2Δ | η τοποθέτηση χρησιμοποιεί το `transform` της κάτοψης· σε προοπτική 3Δ η ίδια κίνηση δείκτη δεν αντιστοιχεί σε σταθερή απόσταση εδάφους |
 *
 * ## Γιατί η επιφάνεια είναι **αδιαφανής στον δείκτη** και όχι διάφανη
 * Όσο η συνεδρία τρέχει, ο καμβάς ανήκει στην τοποθέτηση. Μια επιφάνεια `pointer-events-none` θα
 * άφηνε το ίδιο σύρσιμο να ξεκινήσει **και** μετακίνηση του χάρτη **και** επιλογή οντοτήτων από
 * κάτω. Έτσι η αποκλειστικότητα είναι **δομική** και δεν εξαρτάται από το να θυμηθεί κάθε
 * εργαλείο να ρωτήσει «μήπως τοποθετώ χάρτη;» — το σχήμα που ο `EscapeCommandBus` έλυσε για το
 * πληκτρολόγιο (ADR-364), εδώ για τον δείκτη.
 *
 * ## ADR-040
 * Μηδέν συνδρομές υψηλής συχνότητας. Το πλαίσιο διαβάζεται με `useSyncExternalStore` επειδή η
 * `getBasemapFrame` είναι **απομνημονευμένη** (άγκυρα `Φ7`) — μια μη σταθερή ταυτότητα εδώ θα
 * έριχνε το React σε ατέρμονο βρόχο. Το `transform` δεν διαβάζεται καθόλου σε render: ζει μόνο
 * μέσα στους χειριστές δείκτη, τη στιγμή του γεγονότος.
 */

import React, { useSyncExternalStore } from 'react';
import { Compass } from 'lucide-react';
import { useTranslation } from '@/i18n';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
import { useViewMode3DStore } from '../../bim-3d/stores/ViewMode3DStore';
import { ESC_PRIORITY, useEscapeHandler } from '../../systems/escape-bus';
import {
  getBasemapAvailability,
  getBasemapFrame,
  subscribeBasemapFrame,
  type BasemapFrame,
} from '../../systems/basemap/basemap-frame';
import {
  escapeBasemapPlacement,
  getBasemapPlacementSession,
  isBasemapPlacementActive,
  subscribeBasemapPlacementSession,
} from '../../systems/basemap/basemap-placement-session';
import { makeWorldToDisplayProjector, type GeoReference } from '../../systems/geo-referencing/geo-transform';
import { useBasemapPlacementInteraction } from '../../hooks/canvas/use-basemap-placement-interaction';
import { BasemapPlacementPanel } from './BasemapPlacementPanel';
import { BasemapCorrespondenceMarksLeaf } from './BasemapCorrespondenceMarksLeaf';
import type { Viewport } from '../../rendering/types/Types';

/** Απόσταση της λαβής από τον άξονα, σε εικονοστοιχεία οθόνης. */
const HANDLE_RADIUS_PX = 96;

/** Μήκος δοκιμαστικού διανύσματος προς τον βορρά, σε canonical mm (1 m). */
const NORTH_PROBE_MM = 1_000;

/**
 * Η διεύθυνση του **βορρά του χάρτη** σε συντεταγμένες οθόνης (Y προς τα κάτω).
 *
 * 🔑 Δεν υπολογίζεται με τριγωνομετρία γραμμένη εδώ: ζητά από τον **ίδιο** προβολέα που ζωγραφίζει
 * τα πλακίδια πού προσγειώνεται ένα σημείο ένα μέτρο βορειότερα. Έτσι η λαβή δεν μπορεί να
 * δείχνει αλλού από ό,τι δείχνει ο χάρτης — μια ξεχωριστή φόρμουλα θα συμφωνούσε μέχρι την πρώτη
 * αλλαγή προσήμου, και η διαφωνία θα φαινόταν ως «η λαβή είναι ανάποδα».
 */
function northScreenDirection(geo: GeoReference): { x: number; y: number } {
  const projector = makeWorldToDisplayProjector(geo);
  const origin = projector.unproject(0, 0);
  const north = projector.project(origin.x, origin.y + NORTH_PROBE_MM);
  const length = Math.hypot(north.x, north.y);
  if (length === 0) return { x: 0, y: -1 };
  // Ο άξονας Y της οθόνης δείχνει προς τα κάτω, του χαρτιού προς τα πάνω.
  return { x: north.x / length, y: -north.y / length };
}

interface RotateHandleProps {
  readonly geo: GeoReference;
  readonly label: string;
  readonly onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
}

/**
 * Η λαβή στροφής — ένα πραγματικό `<button>`, όχι σχήμα σε καμβά: έτσι έχει όνομα για τον
 * αναγνώστη οθόνης, δέχεται εστίαση και υπακούει στις πύλες αντίθεσης του αποθετηρίου.
 *
 * ⚠️ Η θέση είναι **γεωμετρία, όχι μορφοποίηση**: εξαρτάται από τη στροφή του πλαισίου, άρα δεν
 * μπορεί να εκφραστεί ως κλάση. Ίδιο πρότυπο με το `AutoAreaResultPanel` (`style={{ left, top }}`).
 */
const RotateHandle: React.FC<RotateHandleProps> = ({ geo, label, onPointerDown }) => {
  const colors = useSemanticColors();
  const direction = northScreenDirection(geo);
  return (
    <button
      type="button"
      // ⚠️ Μόνο `aria-label` — **όχι** `title`. Το εγγενές tooltip του browser είναι
      // απαγορευμένο (CHECK 3.23): δεν διαβάζεται από αφή, δεν υπακούει στο θέμα, και
      // εδώ θα ήταν **διπλή** εκφώνηση της ίδιας συμβολοσειράς στον αναγνώστη οθόνης.
      aria-label={label}
      onPointerDown={onPointerDown}
      style={
        {
          left: `calc(50% + ${(direction.x * HANDLE_RADIUS_PX).toFixed(1)}px)`,
          top: `calc(50% + ${(direction.y * HANDLE_RADIUS_PX).toFixed(1)}px)`,
        } as React.CSSProperties
      }
      className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-grab ${PANEL_LAYOUT.SPACING.XS} ` +
        `${PANEL_LAYOUT.ROUNDED.FULL} ${colors.bg.overlay} ${colors.border.default} border ` +
        `${colors.text.primary} ${PANEL_LAYOUT.SHADOW.MD}`}
    >
      <Compass size={16} aria-hidden="true" />
    </button>
  );
};

/**
 * Οι **τρεις πύλες**, μαζεμένες: επιστρέφει το πλαίσιο πάνω στο οποίο επιτρέπεται να δουλέψει ο
 * χρήστης, ή `null`.
 *
 * ⚠️ Οι εγγραφές γίνονται **πάντα**, πριν από κάθε πύλη: ένα hook που δεν καλείται σε κάποιο
 * render παραβιάζει τους κανόνες των hooks, και μια πύλη που έβγαινε νωρίς θα άφηνε το leaf
 * κουφό ακριβώς στην αλλαγή που το ξαναανοίγει.
 */
function usePlaceableFrame(): BasemapFrame | null {
  const session = useSyncExternalStore(
    subscribeBasemapPlacementSession,
    getBasemapPlacementSession,
    getBasemapPlacementSession,
  );
  const frame = useSyncExternalStore(subscribeBasemapFrame, getBasemapFrame, getBasemapFrame);
  const availability = useSyncExternalStore(
    subscribeBasemapFrame,
    getBasemapAvailability,
    getBasemapAvailability,
  );
  const is2D = useViewMode3DStore((state) => state.mode === '2d');

  if (!session.active || !frame || availability !== 'approximate' || !is2D) return null;
  return frame;
}

interface BasemapPlacementLeafProps {
  readonly className?: string;
  /**
   * Οι διαστάσεις του καμβά — **η ίδια** τιμή που παίρνει κάθε άλλο overlay αγκυρωμένο στον
   * κόσμο (`CanvasLayerStack2DOverlays`).
   *
   * ⚠️ Είναι prop και **όχι** μέτρηση της ίδιας της επιφάνειας με `getBoundingClientRect`: μια
   * δεύτερη πηγή για το «πόσο μεγάλος είναι ο καμβάς» θα σήμαινε ότι το σημάδι μπορεί να
   * προσγειωθεί αλλού από εκεί που κλικάρισε ο χρήστης — ακριβώς η κλάση σφάλματος που αυτό
   * το επίπεδο υπάρχει για να κάνει ορατή.
   */
  readonly viewport: Viewport;
}

export const BasemapPlacementLeaf: React.FC<BasemapPlacementLeafProps> = ({ className, viewport }) => {
  const { t } = useTranslation('dxf-viewer-shell');
  const session = useSyncExternalStore(
    subscribeBasemapPlacementSession,
    getBasemapPlacementSession,
    getBasemapPlacementSession,
  );
  const frame = usePlaceableFrame();
  const handlers = useBasemapPlacementInteraction();

  // ADR-364: **μία** εγγραφή, τρία σκαλιά μέσα της (δες `escapeBasemapPlacement`). Η πύλη είναι
  // πραγματική — χωρίς ενεργή συνεδρία ο handler δεν διεκδικεί τίποτα.
  useEscapeHandler({
    id: 'basemap-placement',
    priority: ESC_PRIORITY.BASEMAP_PLACEMENT,
    canHandle: isBasemapPlacementActive,
    handle: escapeBasemapPlacement,
  });

  if (!frame) return null;

  return (
    <section
      aria-label={t('basemap.placement.surfaceAria')}
      onPointerDown={handlers.onPointerDown}
      onPointerMove={handlers.onPointerMove}
      onPointerUp={handlers.onPointerUp}
      onPointerCancel={handlers.onPointerUp}
      className={`${className ?? ''} ${session.tool === 'drag' ? 'cursor-grab' : 'cursor-crosshair'}`}
    >
      {/*
        🔴 ADR-782 §27.4 — **ο χρήστης βλέπει τι έδειξε.** Πρώτο παιδί επίτηδες: τα σημάδια
        είναι το υπόστρωμα της συνεδρίας και το πάνελ κάθεται από πάνω τους. Το ίδιο το leaf
        είναι πύλη (`return null` εκτός `match`), οπότε στο «Σύρσιμο» δεν κοστίζει τίποτα.
      */}
      <BasemapCorrespondenceMarksLeaf session={session} geo={frame.geo} viewport={viewport} />
      {session.tool === 'drag' && (
        <RotateHandle
          geo={frame.geo}
          label={t('basemap.placement.rotateAria')}
          onPointerDown={handlers.onRotateHandleDown}
        />
      )}
      {/*
        🔴 ADR-782 §27 — **το πάνελ δεν είναι καμβάς.** Η επιφάνεια καταναλώνει κάθε γεγονός
        δείκτη, και η μπάρα εργαλείων ζει **μέσα** της: χωρίς αυτό το σύνορο, το `pointerdown`
        πάνω σε κουμπί έφτανε **πρώτο** στον χειριστή της επιφάνειας — σε `match` καταγραφόταν ως
        σημείο (και με εκκρεμές σημείο **ολοκλήρωνε ζεύγος** στη θέση του κουμπιού, δηλαδή ο
        χάρτης πήδαγε σε ό,τι έτυχε), σε `drag` ξεκινούσε χειρονομία με `setPointerCapture`.

        ⚠️ Η αποκλειστικότητα ήταν σχεδιασμένη προς **τα κάτω** (να μην διαρρέει κλικ στον καμβά)
        και κανείς δεν ρώτησε για τη διεπαφή **μέσα** της. Η λαβή στροφής είχε ήδη την απάντηση
        (`start()` κλείνει με `stopPropagation()`) — αλλά ως λύση **ενός σημείου**, όχι ως σύνορο.
        Άγκυρες: `Λ6`·`Λ6β`·`Λ7`, με μάρτυρα `Π0`.
      */}
      <nav
        onPointerDown={(event) => event.stopPropagation()}
        className="absolute bottom-2 left-1/2 -translate-x-1/2"
      >
        <BasemapPlacementPanel />
      </nav>
    </section>
  );
};
