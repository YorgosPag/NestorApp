/**
 * @fileoverview **ΔΗΜΟΣΙΕΥΜΕΝΗ ΚΑΤΟΨΗ ΟΡΟΦΟΥ → ΣΧΗΜΑΤΑ ΠΑΝΩ ΣΤΗΝ ΕΙΚΟΝΑ** — η γεωμετρία της όψης (ADR-907 §11.9).
 * @related ./floor-plate-outline (`readFloorPlateOutline`) · lib/geometry/polygon-label-point · components/listing-detail/media/FloorPlateUnitLayer
 * @module lib/listings/floor-plate/floor-plate-view
 *
 * 🔑 **Μονάδες = φυσικά pixels της εικόνας**, όπως το `viewBox` του `CaptureSpotLayer`: σε `0..1` μια μη τετράγωνη
 * κάτοψη θα παραμόρφωνε κάθε σχήμα, και ο πόλος απροσπέλαστου θα υπολογιζόταν σε χώρο που δεν βλέπει κανείς.
 *
 * 🔑 **Ο αριθμός της μονάδας είναι η θέση της στο έγγραφο** (1-based) — ο ΕΝΑΣ δεσμός ανάμεσα στο σχήμα και στη γραμμή
 * της λίστας από κάτω. Δεν είναι όνομα ούτε αναγνωριστικό: το έγγραφο δεν κουβαλά κανένα από τα δύο για γείτονα.
 *
 * 🔑 **Η ετικέτα στον πόλο απροσπέλαστου, όχι στο κεντροειδές**: σε διαμέρισμα σχήματος Γ το κεντροειδές πέφτει στον
 * διάδρομο ή στο διπλανό — ο αριθμός θα ονόμαζε λάθος μονάδα.
 *
 * ⚠️ **Καθαρό module** — κανένα React, καμία I/O. Ζει πίσω από το όριο `next/dynamic` της σκηνής: ο πόλος
 * απροσπέλαστου δεν ανήκει στο πρώτο καρέ της αγγελίας.
 */

import { polygonLabelPoint } from '@/lib/geometry/polygon-label-point';
import type { PlanarPoint } from '@/lib/geometry/planar-polygon';
import type { FloorPlateUnit } from '@/types/public-listing';

import { readFloorPlateOutline } from './floor-plate-outline';
import { FLOOR_PLATE_SELF_STATE, FLOOR_PLATE_STATES, type FloorPlateState } from './floor-plate-state';

export interface FloorPlateImageSize {
  readonly width: number;
  readonly height: number;
}

/** Μία μονάδα έτοιμη να ζωγραφιστεί — σε pixels της εικόνας. */
export interface FloorPlateShape {
  /** Η θέση της μονάδας στο έγγραφο, 1-based — ίδιος αριθμός στο σχέδιο και στη λίστα. */
  readonly number: number;
  readonly state: FloorPlateState;
  /** Η αγγελία του γείτονα, ή `null` όταν δεν έχει δική του δημόσια αγγελία (και **πάντα** `null` για «αυτό το ακίνητο»). */
  readonly listingId: string | null;
  /** Το γνώρισμα `points` του `<polygon>`: `x,y x,y …`. */
  readonly points: string;
  /** Πού γράφεται ο αριθμός — εγγυημένα **μέσα** στο σχήμα. */
  readonly label: PlanarPoint;
  /** Η ακτίνα του μεγαλύτερου κύκλου που χωρά γύρω από την ετικέτα: λέει στην όψη πόσο μεγάλος αριθμός χωρά. */
  readonly clearance: number;
}

/** Ακρίβεια του πόλου απροσπέλαστου, ως κλάσμα της μεγάλης πλευράς — κάτω από ένα pixel οθόνης σε κάθε πλάτος. */
const LABEL_PRECISION_FRACTION = 0.002;
const PIXEL_DECIMALS = 100;

function toPixel(value: number): number {
  return Math.round(value * PIXEL_DECIMALS) / PIXEL_DECIMALS;
}

function ringOf(outline: readonly number[], size: FloorPlateImageSize): PlanarPoint[] {
  const ring: PlanarPoint[] = [];
  for (let index = 0; index < outline.length; index += 2) {
    ring.push({ x: toPixel(outline[index] * size.width), y: toPixel(outline[index + 1] * size.height) });
  }
  return ring;
}

/** Ο γείτονας γίνεται σύνδεσμος **μόνο** με δική του αγγελία· η μονάδα της ίδιας της σελίδας ποτέ (θα έδειχνε στον εαυτό της). */
function linkOf(unit: FloorPlateUnit): string | null {
  if (unit.state === FLOOR_PLATE_SELF_STATE) return null;
  return typeof unit.listingId === 'string' && unit.listingId.length > 0 ? unit.listingId : null;
}

/**
 * **Οι μονάδες ως σχήματα**, με τη σειρά του εγγράφου.
 *
 * ⚠️ Μονάδα με μη αναγνώσιμο περίγραμμα **παραλείπεται** — αλλά ο αριθμός των υπολοίπων **δεν μετακινείται**. Ο κριτής
 * της όψης (`presentableFloorPlate`) έχει ήδη αρνηθεί τέτοιον όροφο· αυτό είναι το δίχτυ, όχι ο δρόμος.
 */
export function floorPlateShapes(units: readonly FloorPlateUnit[], size: FloorPlateImageSize): readonly FloorPlateShape[] {
  const precision = Math.max(size.width, size.height, 1) * LABEL_PRECISION_FRACTION;
  const shapes: FloorPlateShape[] = [];
  units.forEach((unit, index) => {
    const outline = readFloorPlateOutline(unit.outline);
    if (outline === null) return;
    const ring = ringOf(outline, size);
    const pole = polygonLabelPoint(ring, precision);
    shapes.push({
      number: index + 1,
      state: unit.state,
      listingId: linkOf(unit),
      points: ring.map((point) => `${point.x},${point.y}`).join(' '),
      label: pole.point,
      clearance: pole.clearance,
    });
  });
  return shapes;
}

/**
 * **Η σειρά ζωγραφικής**: στο SVG η σειρά είναι ο άξονας z, άρα «αυτό το ακίνητο» ζωγραφίζεται **τελευταίο** — το
 * έντονο περίγραμμά του δεν κρύβεται ποτέ κάτω από τον γείτονα με τον οποίο μοιράζεται τοίχο.
 */
export function inPaintOrder(shapes: readonly FloorPlateShape[]): readonly FloorPlateShape[] {
  const self = shapes.filter((shape) => shape.state === FLOOR_PLATE_SELF_STATE);
  return [...shapes.filter((shape) => shape.state !== FLOOR_PLATE_SELF_STATE), ...self];
}

/** Οι καταστάσεις που **υπάρχουν** σε αυτόν τον όροφο, με τη σειρά του λεξιλογίου — οι γραμμές του υπομνήματος. */
export function floorPlateLegendStates(shapes: readonly FloorPlateShape[]): readonly FloorPlateState[] {
  return FLOOR_PLATE_STATES.filter((state) => shapes.some((shape) => shape.state === state));
}
