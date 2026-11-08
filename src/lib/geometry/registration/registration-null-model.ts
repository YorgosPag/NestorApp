/**
 * @fileoverview **ΜΗΔΕΝΙΚΟ ΜΟΝΤΕΛΟ ΣΕ ΕΠΙΠΕΔΟ ΤΜΗΜΑΤΟΣ** (SSoT, ADR-929 §6.9 #9) — «θα κάλυπτε αυτό το τμήμα μελάνι σε τυχαία
 * θέση **αυτής** της εικόνας;».
 * @module lib/geometry/registration/registration-null-model
 *
 * 🔴 **Γιατί υπάρχει.** Το NFA του #7 μετρούσε **δείγματα** ως ανεξάρτητα. Μα τα δείγματα ενός τοίχου πετυχαίνουν ή
 * αποτυγχάνουν **μαζί**: αν μια λάθος θέση ακουμπήσει τον τοίχο σε μια γραμμή της εικόνας, τα 60 δείγματά του μετράνε
 * σαν 60 ανεξάρτητες επιτυχίες. Μετρήθηκε (§6.9 #8): λάθος κατόψεις με log₁₀NFA −700, και **κανένα** NFA > 0.
 * 🔑 **Μονάδα = τμήμα.** Ένα τμήμα πετυχαίνει όταν ≥ `segmentHitShare` των δειγμάτων του βρίσκει κέντρο πινελιάς.
 * 🔑 **p εμπειρικό, από την ίδια την εικόνα.** Το ίδιο τμήμα (ίδιο μήκος, ίδια διεύθυνση) τοποθετείται σε ντετερμινιστικό
 * πλέγμα θέσεων και μετράμε πόσο συχνά «πετυχαίνει». Έτσι η p απορροφά τη **δομή** της εικόνας: πολλές οριζόντιες ⇒ μεγάλη
 * p για οριζόντιο τμήμα· γραμμοσκίαση ⇒ p → 1. Η «διεύθυνση γραμμής» μόνη της δεν αρκούσε (οι κατόψεις είναι ορθογώνιες).
 * Εκτιμητής (1 + επιτυχίες)/(1 + θέσεις) — ποτέ 0, όπως κάθε εμπειρική p-τιμή.
 * 🔑 **Κρυφή μνήμη συντηρητική.** Η p εξαρτάται μόνο από (εικόνα, μήκος, διεύθυνση). Μήκη σε κάδους ×1,25 με αντιπρόσωπο το
 * **κάτω** άκρο (κοντύτερο ⇒ ευκολότερα καλυμμένο ⇒ μεγαλύτερη p), διεύθυνση σε κάδους 1°.
 * ⚠️ **Τι ΔΕΝ λύνει:** τμήματα **μεταξύ τους** μένουν υποτιθέμενα ανεξάρτητα (οι δύο παρειές ενός τοίχου δεν είναι). Γι' αυτό
 * το κριτήριο **βαθμονομείται** σε λάθος ζεύγη (§6.9 #9 Δ) — όχι πίστη στη θεωρία.
 *
 * 📐 Desolneux, Moisan & Morel (2008) · Grompone von Gioi et al., LSD (2010) — εδώ με εμπειρική H0 αντί για αναλυτική.
 */

import { applyAffine, type Affine2x3, type AffinePoint } from '../affine-2x3';
import { probeStrokeCentre } from './chamfer-register';
import type { InkMask, RegisterOptions, RegistrationSegment } from './registration-types';

const LENGTH_BIN_RATIO = 1.25;
const ANGLE_BIN_RAD = Math.PI / 180;

/** Ένα τμήμα του σχεδίου **στην εικόνα**: αρχή, μοναδιαία διεύθυνση, μήκος (px), μοναδιαία κάθετος. */
export interface ImageSegment {
  readonly a: AffinePoint;
  readonly dir: AffinePoint;
  readonly lengthPx: number;
  readonly normal: AffinePoint;
}

export function toImageSegment(t: Affine2x3, seg: RegistrationSegment): ImageSegment | null {
  const a = applyAffine(t, seg.a);
  const b = applyAffine(t, seg.b);
  const lengthPx = Math.hypot(b.x - a.x, b.y - a.y);
  if (!(lengthPx > 0)) return null;
  const dir = { x: (b.x - a.x) / lengthPx, y: (b.y - a.y) / lengthPx };
  return { a, dir, lengthPx, normal: { x: -dir.y, y: dir.x } };
}

/** Οι παράμετροι του «πέτυχε το τμήμα;» — **ένα** probe για καταγραφή, H0 σελίδας και τοπική H0. */
export interface SegmentProbe {
  readonly ink: InkMask;
  readonly radius: number;
  /** Πάχος πινελιάς (px) — §6.9 #15. */
  readonly strokeWidthPx: number;
  readonly stepPx: number;
  readonly share: number;
}

/** Το σημείο τυλιγμένο στον τόρο της εικόνας (κυκλική μετατόπιση: κρατά πυκνότητα και δομή, όπως το circular-shift null). */
function wrapPoint(ink: InkMask, p: AffinePoint): AffinePoint {
  const mod = (v: number, m: number) => ((v % m) + m) % m;
  return { x: mod(p.x, ink.width), y: mod(p.y, ink.height) };
}

/**
 * Πετυχαίνει το τμήμα (με αρχή `origin`); Σταματά μόλις η απάντηση είναι βέβαιη. `wrap` ⇒ κάθε δείγμα τυλίγεται στην εικόνα
 * (τοπική H0, §6.9 #15), ώστε μια μετατόπιση κοντά στο όριο να μη μετρά «χαρτί έξω από τη σελίδα» ως αποτυχία.
 * ⚠️ Το probe ενός τυλιγμένου δείγματος δίπλα στο όριο βλέπει μόνο τη μία πλευρά — αμελητέο μέσα σε παράθυρο ±1 αποτύπωμα.
 */
export function segmentHits(s: ImageSegment, origin: AffinePoint, q: SegmentProbe, wrap = false): boolean {
  const n = Math.max(1, Math.floor(s.lengthPx / q.stepPx));
  const need = Math.ceil(q.share * n);
  let hits = 0;
  for (let i = 0; i < n; i++) {
    const k = ((i + 0.5) / n) * s.lengthPx;
    const raw = { x: origin.x + s.dir.x * k, y: origin.y + s.dir.y * k };
    const p = wrap ? wrapPoint(q.ink, raw) : raw;
    if (probeStrokeCentre(q.ink, p, s.normal, q.radius, q.strokeWidthPx) !== null) hits++;
    if (hits >= need) return true;
    if (hits + (n - 1 - i) < need) return false;
  }
  return hits >= need;
}

/** Ποιες αρχές χωρούν όλο το τμήμα μέσα στην εικόνα, σε πλέγμα ≤ `maxPlacements` θέσεων. */
function placements(s: ImageSegment, ink: InkMask, radius: number, maxPlacements: number): AffinePoint[] {
  const dx = s.dir.x * s.lengthPx;
  const dy = s.dir.y * s.lengthPx;
  const x0 = Math.max(0, -dx), x1 = ink.width - 1 - Math.max(0, dx);
  const y0 = Math.max(0, -dy), y1 = ink.height - 1 - Math.max(0, dy);
  if (x1 < x0 || y1 < y0) return [];
  const area = (x1 - x0 + 1) * (y1 - y0 + 1);
  const stride = Math.max(2 * radius + 1, Math.sqrt(area / maxPlacements));
  const out: AffinePoint[] = [];
  for (let y = y0 + stride / 2; y <= y1; y += stride) for (let x = x0 + stride / 2; x <= x1; x += stride) out.push({ x, y });
  return out;
}

/** Εμπειρική p υπό H0 για ένα τμήμα: (1 + επιτυχίες)/(1 + θέσεις) στο πλέγμα της ίδιας εικόνας. */
export function segmentNullProbability(s: ImageSegment, q: SegmentProbe, maxPlacements: number): number {
  const spots = placements(s, q.ink, q.radius, maxPlacements);
  let hits = 0;
  for (const origin of spots) if (segmentHits(s, origin, q)) hits++;
  return (1 + hits) / (1 + spots.length);
}

/**
 * Ο αντιπρόσωπος του κάδου: μήκος = **κάτω** άκρο του κάδου ×1,25 (συντηρητικό), διεύθυνση = **πλησιέστερο** πολλαπλάσιο
 * του πλάτους κάδου. Το πλάτος είναι ≤ 1/μήκος rad, ώστε ο αντιπρόσωπος να μην αποκλίνει > ½ px σε όλο το μήκος.
 * 🔴 Με κέντρο κάδου 1° (0,5°) ένα οριζόντιο τμήμα 300 px γλιστρούσε 2,6 px ⇒ μικρότερη p από την αληθινή, δηλαδή
 * **μη** συντηρητικό. Με στρογγύλεμα, τα ορθογώνια τμήματα (η πλειονότητα σε κάτοψη) έχουν **ακριβή** αντιπρόσωπο.
 */
function binOf(s: ImageSegment): { key: string; rep: ImageSegment } {
  const lb = Math.floor(Math.log(s.lengthPx) / Math.log(LENGTH_BIN_RATIO));
  const lengthPx = LENGTH_BIN_RATIO ** lb;
  // Η διεύθυνση modulo π: ένα τμήμα και το αντίστροφό του καλύπτουν το ίδιο μελάνι.
  let angle = Math.atan2(s.dir.y, s.dir.x);
  if (angle < 0) angle += Math.PI;
  if (angle >= Math.PI) angle -= Math.PI;
  // Πλάτος από το μήκος του ΚΑΔΟΥ (ένα ανά κάδο ⇒ η μνήμη δουλεύει)· σε ×1,25 μήκος η απόκλιση μένει ≤ 0,63 px.
  const width = Math.min(ANGLE_BIN_RAD, 1 / Math.max(1, lengthPx));
  const ab = Math.round(angle / width);
  const theta = ab * width;
  const dir = { x: Math.cos(theta), y: Math.sin(theta) };
  const rep = { a: { x: 0, y: 0 }, dir, lengthPx, normal: { x: -dir.y, y: dir.x } };
  return { key: `${lb}:${ab}`, rep };
}

/** Το αποτέλεσμα ανά τμήμα: πέτυχε στη θέση της καταγραφής, και με ποια p θα πετύχαινε τυχαία. */
export interface SegmentOutcome {
  readonly segment: ImageSegment;
  readonly hit: boolean;
  readonly p: number;
}

/** Ντετερμινιστική αραίωση στα `max` (ίδιο βήμα με το `sampleSegments`). */
function thin<T>(items: readonly T[], max: number): readonly T[] {
  if (items.length <= max) return items;
  const stride = items.length / max;
  return Array.from({ length: max }, (_, i) => items[Math.floor(i * stride)]);
}

/** Το probe τμήματος της αξιολόγησης, από τις επιλογές — ο **ένας** τόπος που το συναρμολογεί. */
export function segmentProbe(ink: InkMask, radius: number, strokeWidthPx: number, o: RegisterOptions): SegmentProbe {
  return { ink, radius, strokeWidthPx, stepPx: o.sampleStepPx, share: o.acceptance.segmentHitShare };
}

/**
 * Για κάθε τμήμα ≥ `minSegmentPx` στην εικόνα του `t`: πέτυχε; και την εμπειρική του p **σε όλη τη σελίδα** (H0 του #9 —
 * από το #15 μόνο αναφορά). Η p υπολογίζεται **μία** φορά ανά κάδο (μήκος, διεύθυνση).
 */
export function segmentOutcomes(
  segments: readonly RegistrationSegment[],
  ink: InkMask,
  t: Affine2x3,
  radius: number,
  o: RegisterOptions,
  strokeWidthPx = radius,
): SegmentOutcome[] {
  const q = segmentProbe(ink, radius, strokeWidthPx, o);
  const image = segments.map((s) => toImageSegment(t, s)).filter((s): s is ImageSegment => s !== null && s.lengthPx >= o.minSegmentPx);
  const cache = new Map<string, number>();
  return thin(image, o.acceptance.maxSegments).map((segment) => {
    const { key, rep } = binOf(segment);
    let p = cache.get(key);
    if (p === undefined) {
      p = segmentNullProbability(rep, q, o.acceptance.maxNullPlacements);
      cache.set(key, p);
    }
    return { segment, hit: segmentHits(segment, segment.a, q), p };
  });
}
