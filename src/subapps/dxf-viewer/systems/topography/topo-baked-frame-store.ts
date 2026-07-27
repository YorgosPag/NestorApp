/**
 * ADR-650 §M10g — Η ΣΦΡΑΓΙΔΑ: σε ποιο πλαίσιο ψήθηκε κάθε ομάδα ψημένων προϊόντων.
 *
 * Runtime SSoT (vanilla store, ADR-040 pattern — μηδέν React state), που ταξιδεύει μαζί με
 * το υπόλοιπο topo state μέσα στο persisted έγγραφο (`topo-persistence-types.bakedFrames`).
 *
 * ## Γιατί κλειδί ανά ΕΠΙΠΕΔΟ (και όχι μία σφραγίδα ανά ομάδα για όλο το έργο)
 * Το τοπογραφικό είναι SITE-level (ένα έδαφος ανά έργο), αλλά τα **ψημένα** προϊόντα είναι
 * οντότητες σκηνής: ζουν στο επίπεδο πάνω στο οποίο τα έψησε ο χρήστης. Μία σφραγίδα ανά
 * ομάδα για όλο το έργο θα δημιουργούσε σιωπηλή απώλεια: ο χρήστης ψήνει κάναβο στο ισόγειο
 * ΚΑΙ στον όροφο, αλλάζει γεωαναφορά, ο reconciler τρέχει στο ενεργό επίπεδο, ενημερώνει τη
 * μοναδική σφραγίδα — και ο κάναβος του άλλου ορόφου μένει **οριστικά** στο παλιό πλαίσιο,
 * γιατί πλέον η σφραγίδα λέει «όλα εντάξει». Με κλειδί ανά επίπεδο η διόρθωση είναι **οκνηρή
 * αλλά πλήρης**: κάθε επίπεδο διορθώνεται όταν το επισκεφθείς (Revit: ένα link
 * επανασυμφιλιώνεται όταν ανοίξεις τη view του).
 *
 * @see ./topo-baked-groups.ts — ποιες ομάδες υπάρχουν και τι σημαίνει η καθεμιά
 * @see ./persistence/topo-frame-reconcile.ts — ο μόνος που γράφει σφραγίδα εκτός ψησίματος
 */

import { createExternalStore } from '../../stores/createExternalStore';
import type { ProjectFrameStamp } from '../geo-referencing/project-frame';
import { isValidFrameStamp } from '../geo-referencing/project-frame';
import type { TopoBakedGroup } from './topo-baked-groups';
import { TOPO_BAKED_GROUP_IDS } from './topo-baked-groups';

/** Οι σφραγίδες ενός επιπέδου. Απούσα ομάδα ⇒ **ασφράγιστη** (legacy ή ποτέ ψημένη). */
export type TopoLevelBakedFrames = Readonly<Partial<Record<TopoBakedGroup, ProjectFrameStamp>>>;

/** Όλες οι σφραγίδες του έργου, κλειδωμένες στο `levelId` της σκηνής που τις φιλοξενεί. */
export type TopoBakedFrames = Readonly<Record<string, TopoLevelBakedFrames>>;

const EMPTY_LEVEL: TopoLevelBakedFrames = {};

const store = createExternalStore<TopoBakedFrames>({});

/** Όλες οι σφραγίδες (η μορφή που σειριοποιείται στο έγγραφο). */
export function getBakedFrames(): TopoBakedFrames {
  return store.get();
}

/** Οι σφραγίδες ενός επιπέδου (σταθερό αντικείμενο όταν λείπει — δεν αλλάζει ταυτότητα ανά κλήση). */
export function getLevelBakedFrames(levelId: string): TopoLevelBakedFrames {
  return store.get()[levelId] ?? EMPTY_LEVEL;
}

/** Η σφραγίδα μιας ομάδας, ή `null` όταν είναι **ασφράγιστη** (ποτέ «μάλλον το τρέχον»). */
export function getBakedFrame(levelId: string, group: TopoBakedGroup): ProjectFrameStamp | null {
  return getLevelBakedFrames(levelId)[group] ?? null;
}

/** Σφράγισε μία ομάδα — η ραφή του ψησίματος (`topo-bake-commit`). */
export function setBakedFrame(
  levelId: string,
  group: TopoBakedGroup,
  stamp: ProjectFrameStamp,
): void {
  setLevelBakedFrames(levelId, { ...getLevelBakedFrames(levelId), [group]: stamp });
}

/**
 * Αντικατάστησε ΟΛΕΣ τις σφραγίδες ενός επιπέδου (η έξοδος του reconciler, που μπορεί
 * ταυτόχρονα να ενημερώσει άλλες ομάδες και να **σβήσει** τη σφραγίδα μιας ομάδας που
 * ο χρήστης άδειασε). Ίδιο περιεχόμενο ⇒ καμία ειδοποίηση, άρα κανένα περιττό save.
 */
export function setLevelBakedFrames(levelId: string, frames: TopoLevelBakedFrames): void {
  const current = store.get();
  if (sameLevelFrames(current[levelId] ?? EMPTY_LEVEL, frames)) return;
  const next: Record<string, TopoLevelBakedFrames> = { ...current };
  if (Object.keys(frames).length === 0) delete next[levelId];
  else next[levelId] = frames;
  store.set(next);
}

/**
 * Επαναφορά από το έγγραφο — **fail-closed απολύμανση**: ό,τι δεν είναι έγκυρη σφραγίδα
 * (legacy `undefined`, κατεστραμμένο `null`, `NaN` από χειρόγραφη επεξεργασία) πέφτει έξω
 * και η ομάδα μένει ασφράγιστη. Ποτέ δεν «στρογγυλοποιούμε» σε κάτι πιθανό.
 */
export function restoreBakedFrames(frames: TopoBakedFrames | undefined | null): void {
  store.set(sanitizeBakedFrames(frames));
}

/** Subscribe (useSyncExternalStore-compatible). */
export function subscribeBakedFrames(listener: () => void): () => void {
  return store.subscribe(listener);
}

/** Test/lifecycle reset — καθαρίζει και τους συνδρομητές (jest isolation). */
export function resetBakedFramesForTest(): void {
  store.reset({});
}

/**
 * Ίδιες σφραγίδες επιπέδου; Σύγκριση **περιεχομένου** (όχι ταυτότητας αντικειμένου): ο
 * reconciler χτίζει φρέσκο αντικείμενο σε κάθε πέρασμα, οπότε μια σύγκριση αναφοράς θα
 * ειδοποιούσε πάντα και θα έστελνε το έγγραφο για save σε κάθε αλλαγή επιπέδου.
 */
function sameLevelFrames(a: TopoLevelBakedFrames, b: TopoLevelBakedFrames): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((key) => {
    const sa = a[key as TopoBakedGroup];
    const sb = b[key as TopoBakedGroup];
    return !!sa && !!sb &&
      sa.originWorldXMm === sb.originWorldXMm &&
      sa.originWorldYMm === sb.originWorldYMm &&
      sa.rotationDeg === sb.rotationDeg;
  });
}

/** Κρατά μόνο έγκυρες σφραγίδες γνωστών ομάδων· άδεια επίπεδα δεν αποθηκεύονται. */
function sanitizeBakedFrames(frames: TopoBakedFrames | undefined | null): TopoBakedFrames {
  if (!frames || typeof frames !== 'object') return {};
  const out: Record<string, TopoLevelBakedFrames> = {};
  for (const [levelId, levelFrames] of Object.entries(frames)) {
    if (!levelFrames || typeof levelFrames !== 'object') continue;
    const clean: Partial<Record<TopoBakedGroup, ProjectFrameStamp>> = {};
    for (const [group, stamp] of Object.entries(levelFrames)) {
      if (!isKnownGroup(group) || !isValidFrameStamp(stamp)) continue;
      clean[group] = stamp;
    }
    if (Object.keys(clean).length > 0) out[levelId] = clean;
  }
  return out;
}

/**
 * Ανήκει το κλειδί σε δηλωμένη ομάδα;
 *
 * Η λίστα διαβάζεται από τον ΙΔΙΟ δηλωτικό πίνακα (`TOPO_BAKED_GROUPS`) — καμία δεύτερη
 * απαρίθμηση ομάδων που θα ξεχνιόταν όταν προστεθεί ο τέταρτος παραγωγός.
 */
function isKnownGroup(key: string): key is TopoBakedGroup {
  return KNOWN_GROUPS.has(key);
}

const KNOWN_GROUPS: ReadonlySet<string> = new Set<string>(TOPO_BAKED_GROUP_IDS);
