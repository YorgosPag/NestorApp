/**
 * mesh-reveal-fade — progressive reveal ενός πλέγματος που μόλις φορτώθηκε (ADR-693 Φ2).
 *
 * ## Τι κάνει
 *
 * Όταν το `.glb` ενός asset κατέβει, το «φορτώνει» ghost (Φ1) δεν εξαφανίζεται απότομα: **διαλύεται**
 * μέσα σε ~260ms αποκαλύπτοντας το πραγματικό πλέγμα από κάτω. Είναι το crossfade που κάνουν το
 * Speckle / Autodesk APS Viewer στο progressive streaming και το Figma στο skeleton→περιεχόμενο.
 *
 * ## Γιατί σβήνει το ghost αντί να εμφανίζεται το πλέγμα (η κρίσιμη απόφαση)
 *
 * Το προφανές θα ήταν να ανέβει η αδιαφάνεια του ΠΡΑΓΜΑΤΙΚΟΥ mesh από 0→1. **Είναι λάθος εδώ:** ο
 * `bimMeshCache.getInstance` επιστρέφει `template.clone(true)`, και το three.js clone **ΜΟΙΡΑΖΕΤΑΙ
 * τα υλικά** με το template. Μετάλλαξη του `opacity` σε ένα instance θα άλλαζε ΟΛΑ τα instances του
 * asset και — χειρότερα — θα άφηνε το cached template μόνιμα ημιδιάφανο αν το fade διακοπτόταν από
 * resync. Το ghost αντίθετα είναι **δικό μας, per-instance, εφήμερο**: το σβήνουμε ελεύθερα και το
 * πετάμε. Το πραγματικό πλέγμα δεν αγγίζεται ΠΟΤΕ.
 *
 * ## Γιατί δεν υπάρχει μηχανή καταστάσεων
 *
 * Η αδιαφάνεια είναι **καθαρή συνάρτηση του χρόνου**: `readyAt` του asset (σφραγισμένο μία φορά στον
 * cache) → ηλικία → πρόοδος. Άρα ένα resync στη μέση του fade ξαναχτίζει το ghost με τη ΣΩΣΤΗ
 * υπολειπόμενη αδιαφάνεια αντί να ξεκινά από την αρχή ή να κολλάει. Idempotent by construction.
 *
 * ## Κύκλος ζωής
 *
 * `meshToObject3D` (cache hit εντός παραθύρου) → `registerRevealGhost`. Ο `ThreeJsSceneManager.tick`
 * καλεί `tickMeshReveal(now)` κάθε καρέ, και το `isMeshRevealActive()` μπαίνει στο dirty state του
 * ADR-040 ώστε να ΣΥΝΕΧΙΣΟΥΝ να έρχονται καρέ όσο διαρκεί το fade (η σκηνή είναι on-demand).
 * Καθαρισμός **αυτο-ιάσιμος**: ένα ghost που το resync αποσύνδεσε (`parent === null`) πέφτει από το
 * μητρώο στο επόμενο tick — καμία ρητή σύνδεση με τον κύκλο ζωής του resync, κανένα leak.
 *
 * @see ../materials/loading-placeholder-material — το ghost (Φ1) που εδώ διαλύεται
 * @see ../converters/mesh-to-object3d — ο μοναδικός registrar
 * @see docs/centralized-systems/reference/adrs/ADR-693-loading-ghost-and-unknown-material-fallback.md
 */

import type * as THREE from 'three';
import { easeOutCubic } from '../viewport/easing-functions';
import { DXF_TIMING } from '../../config/dxf-timing';

/**
 * Διάρκεια αποκάλυψης. ~260ms = το εύρος που διαβάζεται ως «ομαλή εμφάνιση» χωρίς να καθυστερεί
 * αισθητά (Material Design 200-300ms για εισερχόμενο περιεχόμενο· το Speckle fade είναι στην ίδια
 * τάξη). Πάνω από ~400ms το μοντέλο μοιάζει να «κολλάει»· κάτω από ~120ms δεν διαβάζεται καθόλου.
 * Ο κανονικός αριθμός ζει στο DXF_TIMING SSoT (ADR-516)· εδώ μόνο re-export για τους καταναλωτές.
 */
export const MESH_REVEAL_DURATION_MS = DXF_TIMING.animation.MESH_REVEAL;

interface ActiveReveal {
  readonly ghost: THREE.Mesh;
  readonly material: THREE.Material & { opacity: number };
  /** Η αδιαφάνεια εκκίνησης του ghost (Φ1) — από εκεί κατεβαίνει στο 0. */
  readonly baseOpacity: number;
  /** `performance.now()` τη στιγμή που το asset έγινε διαθέσιμο (ΟΧΙ όταν χτίστηκε το ghost). */
  readonly readyAtMs: number;
}

const active = new Set<ActiveReveal>();

/**
 * Η πρόοδος αποκάλυψης για ένα asset ηλικίας `ageMs`, στο 0..1 (1 = τελείωσε). Καθαρή — το
 * καταναλώνει και ο converter (για να αποφασίσει αν χρειάζεται ghost) και το tick.
 */
export function revealProgress(ageMs: number): number {
  if (ageMs <= 0) return 0;
  return Math.min(ageMs / MESH_REVEAL_DURATION_MS, 1);
}

/** Είναι αυτό το asset ακόμη μέσα στο παράθυρο αποκάλυψης; `null` ηλικία → όχι (ποτέ δεν φορτώθηκε). */
export function isRevealing(ageMs: number | null): boolean {
  return ageMs !== null && revealProgress(ageMs) < 1;
}

/**
 * Καταχωρεί ένα ghost που πρέπει να διαλυθεί. Το `material` ΠΡΕΠΕΙ να είναι per-instance (ιδιοκτησία
 * του ghost) — το tick το μεταλλάσσει και το κάνει dispose στο τέλος.
 */
export function registerRevealGhost(
  ghost: THREE.Mesh,
  material: THREE.Material & { opacity: number },
  ageMs: number,
): void {
  const reveal: ActiveReveal = {
    ghost,
    material,
    baseOpacity: material.opacity,
    readyAtMs: performance.now() - ageMs,
  };
  active.add(reveal);
}

/** Τρέχει αυτή τη στιγμή κάποια αποκάλυψη; Είσοδος στο dirty state του ADR-040. */
export function isMeshRevealActive(): boolean {
  return active.size > 0;
}

/**
 * Προχωρά κάθε ενεργή αποκάλυψη στο `nowMs`. Καλείται ΜΙΑ φορά ανά καρέ από τον
 * `ThreeJsSceneManager.tick` — καμία δική του `requestAnimationFrame` (ADR-040: ένας RAF).
 */
export function tickMeshReveal(nowMs: number): void {
  for (const reveal of active) {
    // Το resync αποσύνδεσε το ghost (ξαναχτίστηκε η σκηνή) → αυτή η εγγραφή είναι νεκρή. Το φρέσκο
    // ghost έχει ήδη καταχωρηθεί με τη σωστή υπολειπόμενη πρόοδο, άρα εδώ απλώς καθαρίζουμε.
    if (!reveal.ghost.parent) {
      finish(reveal, false);
      continue;
    }
    const progress = revealProgress(nowMs - reveal.readyAtMs);
    if (progress >= 1) {
      finish(reveal, true);
      continue;
    }
    reveal.material.opacity = reveal.baseOpacity * (1 - easeOutCubic(progress));
  }
}

/** Αφαιρεί το ghost από τη σκηνή (αν ζητηθεί) και ελευθερώνει τους per-instance πόρους του. */
function finish(reveal: ActiveReveal, detach: boolean): void {
  if (detach) reveal.ghost.removeFromParent();
  reveal.ghost.geometry.dispose();
  reveal.material.dispose();
  active.delete(reveal);
}

/**
 * Ακυρώνει τα πάντα (αποσύνδεση viewport). Δεν αποσυνδέει τα ghosts — η σκηνή απορρίπτεται ούτως ή
 * άλλως — αλλά ελευθερώνει τα per-instance υλικά/γεωμετρίες τους.
 */
export function disposeMeshReveal(): void {
  for (const reveal of active) finish(reveal, false);
  active.clear();
}
