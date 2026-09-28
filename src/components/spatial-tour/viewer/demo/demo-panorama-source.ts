/**
 * @fileoverview **ΕΙΚΟΝΙΚΑ ΠΑΝΟΡΑΜΑΤΑ ΠΟΥ ΑΠΟΔΕΙΚΝΥΟΥΝ ΤΟΝ ΠΡΟΣΑΝΑΤΟΛΙΣΜΟ** — έξι όψεις ζωγραφισμένες σε canvas, με την
 * **παγκόσμια διόπτευση** γραμμένη στον ορίζοντα (ADR-884 Φ1 · §4.8).
 * @related `../tour-panorama-source.ts` (η διεπαφή) · `lib/spatial-tour/viewer/tour-cube-faces.ts` (η ΙΔΙΑ σύμβαση με τον
 *   shader και τον ψήστη της Φ2)
 * @module components/spatial-tour/viewer/demo/demo-panorama-source
 *
 * 🔑 **Γιατί διόπτευση και όχι «μπροστά/πίσω»**: σε κάθε κόμβο το «0°» είναι γραμμένο εκεί που πέφτει ο **βορράς** της
 * κάτοψης, όποια κι αν είναι η κατεύθυνση λήψης. Αν η ευθυγράμμιση (heading · shader · κάμερα · κώνος) έχει λάθος
 * πρόσημο, ο κώνος του mini-map δείχνει βόρεια και η εικόνα γράφει «90°» — **ορατό με μια ματιά**, όχι μόνο σε test.
 * 🔑 Καμία λέξη μέσα στην εικόνα (N.11): μόνο αριθμοί μοιρών και ο αριθμός του σημείου.
 * ⚠️ Τα χρώματα είναι **δεδομένα της εικόνας** (όπως τα pixel μιας φωτογραφίας), όχι χρώματα διεπαφής — δεν περνούν από token.
 */

import { degToRad, normalizeAngleDiff } from '@/lib/geometry/angle';
import {
  TOUR_CUBE_FACES, type TourCubeFace, cubeFaceUvToDirection,
} from '@/lib/spatial-tour/viewer/tour-cube-faces';
import type { TourManifestStop } from '@/lib/spatial-tour/tour-manifest-stop';

import type { TourCubeFaceImages, TourPanoramaSource } from '../tour-panorama-source';

/** Οι εικονικές όψεις δεν χρειάζονται περισσότερη ανάλυση — και φτιάχνονται γρήγορα σε αδύναμο κινητό. */
const DEMO_FACE_SIZE = 1024;
const TICK_EVERY_DEG = 30;
const SKY = '#9ec9ea';
const FLOOR = '#8a7560';

function hueOf(stop: TourManifestStop): number {
  let hash = 0;
  for (const char of stop.nodeId) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return hash;
}

/** Κλίση της κάτω άκρης του «τοίχου» — κάτω από αυτή είναι πάτωμα. */
const WALL_BAND_PITCH = degToRad(-17);
/** Πόσο έξω από την όψη ζωγραφίζεται μια ετικέτα (ο καμβάς κόβει το υπόλοιπο) — ώστε να μην κόβεται στη ραφή. */
const LABEL_REACH = degToRad(60);

/** Το yaw του κέντρου μιας πλευρικής όψης — **από τη σύμβαση** (`cubeFaceUvToDirection`), όχι γραμμένο ξανά εδώ. */
function faceCenterYaw(face: TourCubeFace): number {
  const d = cubeFaceUvToDirection(face, 0.5, 0.5);
  return Math.atan2(d.x, -d.z);
}

/**
 * Το ύψος (pixel) μιας γραμμής σταθερής κλίσης σε πλευρική όψη, στη στήλη `u`: μια οριζόντια γραμμή του κόσμου είναι
 * **καμπύλη** πάνω στην όψη — ζωγραφισμένη ίσια θα έσπαγε σε «V» σε κάθε ραφή.
 */
function pitchLineY(size: number, pitch: number, u: number): number {
  const a = 2 * u - 1;
  return size * (0.5 - 0.5 * Math.tan(pitch) * Math.sqrt(1 + a * a));
}

function fillBelowPitch(ctx: CanvasRenderingContext2D, size: number, pitch: number, color: string): void {
  const columns = 32;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, size);
  for (let i = 0; i <= columns; i++) ctx.lineTo((i / columns) * size, pitchLineY(size, pitch, i / columns));
  ctx.lineTo(size, size);
  ctx.closePath();
  ctx.fill();
}

function paintBackground(ctx: CanvasRenderingContext2D, face: TourCubeFace, size: number, hue: number): void {
  ctx.fillStyle = face === 'down' ? FLOOR : SKY;
  ctx.fillRect(0, 0, size, size);
  if (face === 'up' || face === 'down') return;
  fillBelowPitch(ctx, size, 0, `hsl(${hue} 35% 70%)`);
  fillBelowPitch(ctx, size, WALL_BAND_PITCH, FLOOR);
}

/** Σημείο του ορίζοντα σε παγκόσμια διόπτευση → pixel πλευρικής όψης (και λίγο έξω από αυτήν), ή `null`. */
function horizonPixel(face: TourCubeFace, size: number, heading: number, bearingDeg: number) {
  const delta = normalizeAngleDiff(degToRad(bearingDeg) - heading - faceCenterYaw(face));
  if (Math.abs(delta) > LABEL_REACH) return null;
  return { x: size * (0.5 + 0.5 * Math.tan(delta)), y: size / 2 };
}

function paintBearings(ctx: CanvasRenderingContext2D, face: TourCubeFace, size: number, heading: number): void {
  if (face === 'up' || face === 'down') return;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let bearing = 0; bearing < 360; bearing += TICK_EVERY_DEG) {
    const at = horizonPixel(face, size, heading, bearing);
    if (at === null) continue;
    const north = bearing === 0;
    ctx.fillStyle = north ? '#c62828' : '#1f2937';
    ctx.fillRect(at.x - (north ? 4 : 2), at.y - size * 0.08, north ? 8 : 4, size * 0.16);
    ctx.font = `bold ${Math.round(size * (north ? 0.07 : 0.045))}px sans-serif`;
    ctx.fillText(`${bearing}°`, at.x, at.y - size * 0.14);
  }
}

function paintNumber(ctx: CanvasRenderingContext2D, face: TourCubeFace, size: number, number: number): void {
  if (face !== 'down') return;
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.round(size * 0.3)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${number}`, size / 2, size / 2);
}

function paintFace(face: TourCubeFace, size: number, stop: TourManifestStop, number: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx === null) return canvas;
  paintBackground(ctx, face, size, hueOf(stop));
  paintBearings(ctx, face, size, stop.headingRad);
  paintNumber(ctx, face, size, number);
  return canvas;
}

/** Εικονική πηγή — `numberOf` δίνει τον αριθμό του σημείου (ό,τι δείχνει και ο θεατής), ώστε εικόνα και UI να συμφωνούν. */
export function createDemoPanoramaSource(numberOf: (nodeId: string) => number): TourPanoramaSource {
  return {
    async base(stop, signal) {
      if (signal.aborted) throw signal.reason;
      const faces = Object.fromEntries(
        TOUR_CUBE_FACES.map((face) => [face, paintFace(face, DEMO_FACE_SIZE, stop, numberOf(stop.nodeId))]),
      ) as Record<TourCubeFace, HTMLCanvasElement>;
      return faces satisfies TourCubeFaceImages;
    },
    // Οι εικονικές όψεις είναι ήδη η τελική εικόνα — κανένα πλακίδιο, καμία κάτοψη.
    tiles: null,
    planImageUrl: () => null,
  };
}
