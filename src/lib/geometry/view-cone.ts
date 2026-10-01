/**
 * @fileoverview **Ο ΚΩΝΟΣ ΘΕΑΣΗΣ** — μία γεωμετρία για κάθε «προς τα πού κοιτάζει η κάμερα» πάνω σε κάτοψη.
 * @related ADR-884 (spatial-tour: θεατής + επεξεργαστής) · ADR-897 (σημεία λήψης φωτογραφιών)
 * @module lib/geometry/view-cone
 *
 * 🔑 Εξήχθη από το `lib/spatial-tour/viewer/tour-viewer-plan.ts` τη μέρα που ήρθε ο **τρίτος** καταναλωτής
 * (σημεία λήψης, ADR-897): ένας κώνος δεν ανήκει στο spatial-tour, ανήκει στη γεωμετρία. Ίδιος κώνος παντού ⇒
 * ο επισκέπτης βλέπει το ίδιο σχήμα στην περιήγηση 360° και στη συλλογή φωτογραφιών.
 *
 * ⚠️ **Καθαρό module** — καμία εξάρτηση.
 */

/**
 * Ο κώνος θέασης ως διαδρομή SVG με κορυφή στο `(0, 0)`, ανοιχτός προς τα **πάνω** (`-y`), πριν την περιστροφή.
 * Ο καλών τον τοποθετεί με `transform="translate(x y) rotate(μοίρες)"` — δεξιόστροφα, όπως το SVG.
 */
export function conePath(halfAngleRad: number, radius: number): string {
  const dx = Math.sin(halfAngleRad) * radius;
  const dy = -Math.cos(halfAngleRad) * radius;
  return `M 0 0 L ${-dx} ${dy} A ${radius} ${radius} 0 0 1 ${dx} ${dy} Z`;
}

/**
 * Το σημείο στην **άκρη** μιας ακτίνας μήκους `radius` από το `(x, y)` προς την κατεύθυνση `headingRad`
 * (0 = πάνω, δεξιόστροφα) — η θέση της λαβής-στόχου και των λαβών του πεδίου.
 */
export function pointAlongHeading(
  origin: { readonly x: number; readonly y: number },
  headingRad: number,
  radius: number,
): { readonly x: number; readonly y: number } {
  return { x: origin.x + Math.sin(headingRad) * radius, y: origin.y - Math.cos(headingRad) * radius };
}

/** Το αντίστροφο: η κατεύθυνση (0 = πάνω, δεξιόστροφα, ∈ [0, 2π)) από το `origin` προς το `target`. */
export function headingTowards(
  origin: { readonly x: number; readonly y: number },
  target: { readonly x: number; readonly y: number },
): number {
  const raw = Math.atan2(target.x - origin.x, origin.y - target.y);
  return raw < 0 ? raw + Math.PI * 2 : raw;
}

/**
 * **Πόσο μακριά** μπορεί να πάει μια ακτίνα από το `origin` προς το `headingRad` πριν βγει από το κουτί
 * `[margin, width − margin] × [margin, height − margin]`· `Infinity` όταν η ακτίνα δεν το συναντά ποτέ (αδύνατο για
 * σημείο μέσα στο κουτί, αλλά η συνάρτηση είναι ολική).
 *
 * 🔑 Για λαβές που ζουν **πάνω** σε ακτίνα (στόχος κατεύθυνσης, άκρες πεδίου): η λαβή κοντεύει, η κατεύθυνση μένει
 * **ίδια**. Λαβή έξω από την εικόνα κόβεται από το SVG — σε σημείο κοντά στο άκρο γινόταν **απρόσιτη** στο ποντίκι
 * (ADR-897, ζωντανός έλεγχος 01/10).
 */
export function reachInsideBox(
  origin: { readonly x: number; readonly y: number },
  headingRad: number,
  box: { readonly width: number; readonly height: number },
  margin = 0,
): number {
  const dx = Math.sin(headingRad);
  const dy = -Math.cos(headingRad);
  const along = (position: number, step: number, size: number): number => {
    if (Math.abs(step) < 1e-9) return Infinity;
    const wall = step > 0 ? size - margin : margin;
    return Math.max(0, (wall - position) / step);
  };
  return Math.min(along(origin.x, dx, box.width), along(origin.y, dy, box.height));
}
