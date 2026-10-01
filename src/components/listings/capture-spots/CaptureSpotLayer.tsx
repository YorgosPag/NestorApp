'use client';

/**
 * @fileoverview 📍 **ΤΑ ΣΗΜΕΙΑ ΛΗΨΗΣ ΠΑΝΩ ΣΤΗΝ ΚΑΤΟΨΗ** — η μία απόδοση, για θεατή και επεξεργαστή (ADR-897 Φ2).
 * @related capture-spot-metrics.ts · lib/geometry/view-cone · components/spatial-tour/viewer/tour-plan-overlay-palette
 * @module components/listings/capture-spots/CaptureSpotLayer
 *
 * 🎨 **Μηδέν inline style (N.3)** — ιδίωμα `FocalPointSurface` / `TourPlanMap`: SVG με `viewBox` = **διαστάσεις της
 *   εικόνας**, θέσεις σε χαρακτηριστικά (`cx`, `transform`). ⚠️ Όχι `0..100`: σε μη τετράγωνη κάτοψη ο κώνος θα
 *   παραμορφωνόταν, και η γωνία που βλέπει ο επισκέπτης δεν θα ήταν αυτή που δήλωσε ο άνθρωπος.
 * 🎨 **Χρώματα της κάτοψης** (`--plan-*`, ίδια στα δύο θέματα — η κάτοψη είναι λευκό χαρτί): ίδια με την περιήγηση 360°,
 *   ώστε ο επισκέπτης να βλέπει **ένα** λεξιλόγιο σε όλη την αγγελία.
 * 🏆 **Πάνω από τη Zillow**: κάθε σημείο έχει μικρή «μύτη» κατεύθυνσης — βλέπεις προς τα πού κοιτάζει **κάθε** φωτογραφία
 *   πριν την ανοίξεις· ο τρέχων κώνος έχει το **πραγματικό** πλάτος του φακού (`fovRad`).
 * ♿ Κάθε σημείο είναι `role="button"` με όνομα, Enter/Space· ο τρέχων έχει `aria-current`. Χωρίς `onActivate` ⇒ διακοσμητικό.
 */

import type { KeyboardEvent, PointerEvent } from 'react';

import { conePath } from '@/lib/geometry/view-cone';
import { cn } from '@/lib/utils';
import { PLAN_CONE_CLASS, PLAN_DOT_CLASS } from '@/components/spatial-tour/viewer/tour-plan-overlay-palette';

import { captureSpotMetrics, spotTransform, type CaptureSpotMetrics } from './capture-spot-metrics';

/** Η γεωμετρία ενός σημείου — κοινή στη δημόσια και στην αποθηκευμένη μορφή. */
export interface CaptureSpotGeometry {
  readonly x: number;
  readonly y: number;
  readonly headingRad: number;
  readonly fovRad: number;
}

export interface CaptureSpotMarker {
  /** Σταθερή ταυτότητα στη λίστα (δείκτης φωτογραφίας ή `FileRecord.id`). */
  readonly key: string;
  readonly spot: CaptureSpotGeometry;
  /** Το όνομα για τεχνολογίες υποβοήθησης — **ήδη μεταφρασμένο** από τον καλούντα. */
  readonly label: string;
}

export interface CaptureSpotLayerProps {
  readonly image: { readonly width: number; readonly height: number };
  readonly markers: readonly CaptureSpotMarker[];
  readonly currentKey: string | null;
  readonly onActivate?: (key: string) => void;
  /** Το όνομα της ομάδας σημείων (π.χ. «Κάτοψη ισογείου») — απαιτείται όταν τα σημεία είναι διαδραστικά. */
  readonly ariaLabel?: string;
  readonly className?: string;
}

const NOTCH_HALF_ANGLE_RAD = Math.PI / 7;
const FOCUS_CLASS = 'cursor-pointer outline-none focus-visible:stroke-ring';
/**
 * 👆 **Δακτύλιος αφής σε pixel ΟΘΟΝΗΣ** γύρω από κάθε διαδραστικό σημείο. Το σημείο κλιμακώνεται με την εικόνα (σωστό
 * για το σχέδιο)· ο **στόχος** όμως όχι: μετρημένο 01/10, σε κινητό 390 px το σημείο ήταν **8×8 px** και στην κάρτα
 * υπολογιστή ~5 px — κάτω από το 24×24 της WCAG 2.5.8. Το `vector-effect="non-scaling-stroke"` κρατά το πάχος σε pixel
 * οθόνης χωρίς καμία μέτρηση (κανένα `ResizeObserver`): στόχος = σημείο + 2×10 px (κάρτα ~25, κινητό 28, επεξεργαστής 46).
 * ⚠️ Η «μύτη» κατεύθυνσης ζωγραφίζεται **πάνω** από τον δακτύλιο ⇒ `pointer-events-none`, αλλιώς έτρωγε την αφή χωρίς
 *   να κάνει τίποτα (μετρημένο: σημείο που κοιτά ανατολικά, πάτημα 11 px δεξιά = νεκρό).
 */
const TAP_RING_SCREEN_PX = 20;

interface MarkerProps {
  readonly marker: CaptureSpotMarker;
  readonly current: boolean;
  readonly image: CaptureSpotLayerProps['image'];
  readonly metrics: CaptureSpotMetrics;
  readonly onActivate?: (key: string) => void;
}

function Marker({ marker, current, image, metrics, onActivate }: MarkerProps) {
  const x = marker.spot.x * image.width;
  const y = marker.spot.y * image.height;
  const interactive = onActivate !== undefined;
  const activate = (event: KeyboardEvent) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onActivate?.(marker.key);
  };
  const radius = current ? metrics.current : metrics.dot;
  const pointer = {
    onClick: () => onActivate?.(marker.key),
    onPointerDown: (event: PointerEvent) => event.stopPropagation(),
  };
  return (
    <g>
      {interactive && (
        <circle cx={x} cy={y} r={radius} fill="transparent" stroke="transparent" strokeWidth={TAP_RING_SCREEN_PX}
          vectorEffect="non-scaling-stroke" className="cursor-pointer" data-tap-ring="" aria-hidden {...pointer} />
      )}
      <path d={conePath(NOTCH_HALF_ANGLE_RAD, current ? metrics.current * 1.9 : metrics.notch)}
        transform={spotTransform(x, y, marker.spot.headingRad)}
        className={cn('pointer-events-none', current ? PLAN_DOT_CLASS.here : PLAN_DOT_CLASS.other)} strokeWidth={metrics.stroke * 0.5}
        aria-hidden />
      <circle cx={x} cy={y} r={radius} strokeWidth={metrics.stroke}
        className={cn(interactive && FOCUS_CLASS, current ? PLAN_DOT_CLASS.here : PLAN_DOT_CLASS.other)}
        {...(interactive
          ? {
            role: 'button', tabIndex: 0, 'aria-label': marker.label, 'aria-current': current ? 'true' : undefined,
            ...pointer, onKeyDown: activate,
          }
          : { 'aria-hidden': true })} />
    </g>
  );
}

export interface CaptureSpotMarkersProps
  extends Pick<CaptureSpotLayerProps, 'image' | 'markers' | 'currentKey' | 'onActivate'> {
  readonly metrics: CaptureSpotMetrics;
}

/**
 * **Τα σημεία και ο κώνος, ΧΩΡΙΣ το `<svg>`** — για όποιον έχει ήδη δική του επιφάνεια (ο επεξεργαστής, που ζωγραφίζει
 * από πάνω τις λαβές του). Ένας τόπος απόδοσης σημείων: ο θεατής και ο επεξεργαστής δεν μπορούν να δείχνουν άλλο σχήμα.
 *
 * ⚠️ Τα διαδραστικά σημεία **σταματούν** το `pointerdown`: αλλιώς θα έφτανε στην επιφάνεια του επεξεργαστή, που το
 * διαβάζει ως «τοποθέτησε εδώ» — δηλαδή κλικ σε άλλη φωτογραφία θα μετακινούσε την επιλεγμένη πάνω της.
 */
export function CaptureSpotMarkers({ image, markers, currentKey, onActivate, metrics }: CaptureSpotMarkersProps) {
  const current = markers.find((marker) => marker.key === currentKey) ?? null;
  // 🔑 Ο τρέχων ζωγραφίζεται **τελευταίος**: στο SVG η σειρά είναι ο άξονας z, και ο τονισμένος δεν κρύβεται ποτέ.
  const ordered = current === null ? markers : [...markers.filter((marker) => marker !== current), current];
  return (
    <g>
      {current !== null && (
        <path d={conePath(current.spot.fovRad / 2, metrics.cone)}
          transform={spotTransform(current.spot.x * image.width, current.spot.y * image.height, current.spot.headingRad)}
          className={cn('pointer-events-none', PLAN_CONE_CLASS)} strokeWidth={metrics.stroke} aria-hidden />
      )}
      {ordered.map((marker) => (
        <Marker key={marker.key} marker={marker} current={marker === current} image={image} metrics={metrics}
          onActivate={onActivate} />
      ))}
    </g>
  );
}

export function CaptureSpotLayer({ image, markers, currentKey, onActivate, ariaLabel, className }: CaptureSpotLayerProps) {
  return (
    <svg viewBox={`0 0 ${image.width} ${image.height}`} className={cn('absolute inset-0 h-full w-full', className)}
      role={onActivate === undefined ? 'presentation' : 'group'} aria-label={onActivate === undefined ? undefined : ariaLabel}>
      <CaptureSpotMarkers image={image} markers={markers} currentKey={currentKey} onActivate={onActivate}
        metrics={captureSpotMetrics(image)} />
    </svg>
  );
}
