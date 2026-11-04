/**
 * Το prompt του αναγνώστη κάτοψης (ADR-929 Δ5). Καθαρό κείμενο: το διαβάζουν ο προσαρμογέας του διακομιστή **και** το
 * σενάριο μέτρησης, ώστε να μετριέται ακριβώς ό,τι στέλνεται στην παραγωγή.
 *
 * 🔑 Αλλαγή σε αυτό το αρχείο ⇒ αύξηση του `PLAN_READING_SCHEMA_VERSION` (νέο κλειδί κρυφής μνήμης, Δ11).
 * 🔑 Τα αγγλικά εδώ **δεν** είναι κείμενο προς χρήστη (N.11): είναι οδηγίες προς το μοντέλο, που τις ακολουθεί καλύτερα
 * στα αγγλικά. Τα κείμενα του σχεδίου ζητούνται **αυτούσια**, στα ελληνικά όπως γράφτηκαν.
 *
 * @module subapps/dxf-viewer/bim/plan-recognition/reading/plan-reading-prompt
 */

import type { PlanViewSegment } from './plan-reading-view';

export const PLAN_READING_SYSTEM_PROMPT = `You read architectural floor plans (mostly Greek: building-permit scans, listing plans, hand sketches).
You do NOT produce geometry. A separate computer-vision step already measured the wall lines; they are given to you as numbered segments.
Your job is the semantics that only reading can give:
1. texts: every legible text of the drawing area, exactly as written (keep Greek as Greek), with its box.
   kind: "dimension" (a written length, e.g. 3.50, 350, 2,85), "room-name" (ΣΑΛΟΝΙ, ΚΟΥΖΙΝΑ, Υ/Δ, WC…),
   "area" (24 τ.μ., 24 m²), "scale" (1:100, Κλ. 1:50), "title" (drawing title), "opening-size" (door/window labels such as
   0.80/2.20 or 1.30/2.20 inside a small circle or box: width/height), "other" (anything else: street names, section marks, levels).
2. dimensions: for each dimension text, its length in millimetres and the segment ids it measures.
   Greek plans write metres with two decimals (3.50 = 3500 mm); a bare integer of 2-3 digits is usually centimetres (350 = 3500 mm).
   If you cannot tell the unit, valueMm = null. segmentIds = the TWO segments between which the distance is measured: the faces
   at the two ends of the measurement, PERPENDICULAR to its direction (a horizontal "3.75" across a room = the left and the right
   wall faces, both vertical). Never the wall the dimension line runs along. Give both ids or an empty list, never one.
3. writtenScale: only if a scale like 1:100 is written in the given area; denominator = 100.
4. rooms: each named space, with the text id of its name, its written area if one is written, and the ids of the segments that bound it.
5. openings: doors (swing arcs, gaps with a leaf) and windows (thin parallel lines in a wall), each on its host segment id with the
   position along it (0 at the segment's first point, 1 at its second) and the id of its opening-size label if any.
Rules: never invent text that is not visible; never invent segment ids; prefer omission to guessing; confidence 0..1 per item,
calibrated (0.9 only when you would bet on it). Coordinates are per-mille of the image width/height, origin top-left, integers 0..1000.
White rectangles are redacted areas: ignore them.`;

/** Μία γραμμή ανά τμήμα: `ps3 120,40 560,40 stroke`. Συμπαγές, επειδή μια σάρωση άδειας έχει εκατοντάδες τμήματα. */
export function planSegmentTable(segments: readonly PlanViewSegment[]): string {
  return segments.map((s) => `${s.id} ${s.x0},${s.y0} ${s.x1},${s.y1} ${s.style === 'stroke' ? 'line' : 'fill-face'}`).join('\n');
}

export function planReadingUserText(segments: readonly PlanViewSegment[]): string {
  return [
    `Segments (${segments.length}): id x0,y0 x1,y1 kind, per-mille of the image. "line" = centre line of a drawn stroke,`,
    '"fill-face" = one face of a solid-filled (poché) wall.',
    planSegmentTable(segments),
    'Read the plan in the attached image and answer with the JSON schema.',
  ].join('\n');
}
