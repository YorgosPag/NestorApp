/**
 * ADR-650 §M10g — ΤΟ ΣΗΜΑΔΙ: ποια ψημένα προϊόντα ο reconciler **αρνήθηκε** να μετακινήσει.
 *
 * Το fail-closed χωρίς ορατότητα είναι απλώς σιωπή με άλλο όνομα. Ο reconciler δεν μαντεύει
 * πλαίσιο για ένα legacy ψημένο προϊόν — αλλά ο χρήστης πρέπει να **μάθει** ότι ο κάναβός του
 * κάθεται σε ξεπερασμένο σύστημα και ότι η θεραπεία είναι ένα ξανα-ψήσιμο. (Εδώ πάμε πιο πέρα
 * από τον Revit: εκείνος δείχνει το link σε λάθος θέση μέχρι να κάνει ο χρήστης acquire, χωρίς
 * να ξέρει καν ότι υπάρχει πρόβλημα.)
 *
 * Runtime-only store (ADR-040 pattern): **δεν** σειριοποιείται — είναι το αποτέλεσμα του
 * τελευταίου περάσματος, όχι δεδομένο του έργου. Ξαναϋπολογίζεται σε κάθε reconcile.
 *
 * ⚠️ **ΔΥΟ συγγραφείς, και οι δύο είναι στιγμές του ίδιου κύκλου ζωής** (ADR-722): ο reconciler
 * καταθέτει το αποτέλεσμα ενός **περάσματος πλαισίου**, και η ραφή του ψησίματος καταθέτει το
 * αποτέλεσμα ενός **ξανα-ψησίματος**. Μέχρι το ADR-722 έγραφε μόνο ο πρώτος — και επειδή τίποτα
 * δεν ξανακαλούσε τον reconciler μετά από ψήσιμο, το κόκκινο μήνυμα «άγνωστο πλαίσιο» **έμενε
 * στην οθόνη** για μια ομάδα που ο χρήστης μόλις είχε ξαναψήσει σωστά. Το σήμα είναι παράγωγο
 * τριών εισόδων (σκηνή · σφραγίδες · ενεργό πλαίσιο)· το ψήσιμο αλλάζει τις **δύο** πρώτες.
 *
 * @see ./persistence/topo-frame-reconcile.ts — ο συγγραφέας του περάσματος πλαισίου
 * @see ./topo-bake-commit.ts — ο συγγραφέας του ξανα-ψησίματος (ADR-722)
 * @see ../../ui/panels/topography/TopoFrameNotice.tsx — ο μοναδικός αναγνώστης (UI)
 */

import { createExternalStore } from '../../stores/createExternalStore';
import type { TopoBakedGroup } from './topo-baked-groups';

/** Το εύρημα του περάσματος, χωρίς πλαίσιο — ό,τι παράγει ο reconciler. */
export interface TopoFrameStatus {
  /** Ψημένα προϊόντα **χωρίς σφραγίδα** (legacy): άγνωστο πλαίσιο ⇒ θέλουν ξανα-ψήσιμο. */
  readonly unstampedGroups: readonly TopoBakedGroup[];
  /** Ομάδες που περιέχουν τύπο εκτός του SSoT της στροφής ⇒ δεν μετακινήθηκαν καθόλου. */
  readonly unsupportedGroups: readonly TopoBakedGroup[];
}

/**
 * Το εύρημα **μαζί με το επίπεδο που το γέννησε** — αδιαίρετα, σε ΕΝΑ snapshot.
 *
 * ADR-721 §9. Μέχρι εδώ το `levelId` ζούσε σε module variable δίπλα στο store, με getter
 * (`getTopoFrameStatusLevelId`) που **δεν κάλεσε ποτέ κανείς** — δηλαδή ο φρουρός «το μήνυμα
 * δεν ζει πέρα από την οθόνη που το γέννησε» ήταν γραμμένος αλλά ασύνδετος, και το panel
 * έδειχνε το εύρημα άλλου ορόφου όποτε ο reconciler δεν προλάβαινε (`sceneLoading`).
 *
 * Η θεραπεία δεν είναι «να καλέσει κάποιος τον getter»: μια τιμή που συμμετέχει στο render
 * **πρέπει** να ζει μέσα στο snapshot, αλλιώς το `useSyncExternalStore` δεν την βλέπει και το
 * React διαβάζει out-of-band κατάσταση (tearing σε concurrent render). Μπαίνοντας στο value
 * object, η αλλαγή επιπέδου γίνεται από μόνη της λόγος ειδοποίησης — βλ. `equals`.
 */
export interface TopoFrameStatusSnapshot extends TopoFrameStatus {
  /** Το επίπεδο στο οποίο αναφέρεται η κατάσταση (`null` πριν το πρώτο πέρασμα). */
  readonly levelId: string | null;
}

const EMPTY_STATUS: TopoFrameStatusSnapshot = {
  levelId: null,
  unstampedGroups: [],
  unsupportedGroups: [],
};

const store = createExternalStore<TopoFrameStatusSnapshot>(EMPTY_STATUS, {
  // Ίδιο περιεχόμενο ⇒ καμία ειδοποίηση: ο reconciler τρέχει σε κάθε αλλαγή επιπέδου και
  // θα ξανα-έγραφε το ίδιο άδειο αποτέλεσμα, ξυπνώντας το panel χωρίς λόγο.
  //
  // Το `levelId` μετράει ΚΑΙ ΑΥΤΟ στην ισότητα: δύο όροφοι μπορούν κάλλιστα να έχουν ταυτόσημο
  // εύρημα, και τότε ο αναγνώστης πρέπει να ξυπνήσει για να ξαναπαραβάλει «ποιον όροφο αφορά»
  // με «ποιον όροφο βλέπω». Χωρίς αυτό, το μήνυμα θα κολλούσε κρυφό στη μία περίπτωση.
  equals: (a, b) =>
    a.levelId === b.levelId &&
    sameGroups(a.unstampedGroups, b.unstampedGroups) &&
    sameGroups(a.unsupportedGroups, b.unsupportedGroups),
});

/** Το τελευταίο αποτέλεσμα του reconciler, μαζί με το επίπεδό του. */
export function getTopoFrameStatus(): TopoFrameStatusSnapshot {
  return store.get();
}

/**
 * Κατάθεσε το αποτέλεσμα του περάσματος για ένα επίπεδο.
 *
 * Το `levelId` γίνεται μέρος της τιμής ώστε το μήνυμα να μη ζήσει περισσότερο από την οθόνη
 * που το γέννησε: ο χρήστης που αλλάζει επίπεδο βλέπει την κατάσταση **του επιπέδου που κοιτά**.
 */
export function setTopoFrameStatus(levelId: string, status: TopoFrameStatus): void {
  store.set({
    levelId,
    unstampedGroups: status.unstampedGroups,
    unsupportedGroups: status.unsupportedGroups,
  });
}

/**
 * ADR-722 — μια ομάδα **μόλις ξαναψήθηκε**: κατάθεσε το φρέσκο εύρημα γι' αυτό το επίπεδο.
 *
 * Δύο πράγματα άλλαξαν με το ψήσιμο, και το σήμα οφείλει να τα δει **και τα δύο**:
 *   • `unstampedGroups` **ξαναμετρήθηκε** από τη ζωντανή σκηνή + τις σφραγίδες (ο καλών το
 *     περνά έτοιμο — εκείνος κρατά τη σκηνή· εδώ δεν διαβάζουμε σκηνή, μένουμε καθαροί).
 *   • `unsupportedGroups` **έχασε την ομάδα που ξαναψήθηκε**: το προηγούμενο εύρημα («περιέχει
 *     τύπο εκτός του SSoT της στροφής») αφορούσε γεωμετρία που **δεν υπάρχει πια** — η ομάδα
 *     αντικαταστάθηκε ολόκληρη. Το να κρατηθεί θα ήταν κατηγορία εναντίον σβησμένων οντοτήτων.
 *
 * Εύρημα **άλλου** επιπέδου δεν μεταφέρεται: εκεί δεν ξέρουμε τίποτα για τις υπόλοιπες ομάδες,
 * και μια εικασία θα ήταν ακριβώς το μάντεμα που το §M10g απαγορεύει. Το επόμενο πέρασμα του
 * reconciler (επίσκεψη ορόφου) ξαναγεμίζει την πλήρη εικόνα.
 */
export function recordBakeInTopoFrameStatus(
  levelId: string,
  group: TopoBakedGroup,
  unstampedGroups: readonly TopoBakedGroup[],
): void {
  const previous = store.get();
  const carried = previous.levelId === levelId ? previous.unsupportedGroups : [];
  store.set({
    levelId,
    unstampedGroups,
    unsupportedGroups: carried.filter((candidate) => candidate !== group),
  });
}

/** Subscribe (useSyncExternalStore-compatible). */
export function subscribeTopoFrameStatus(listener: () => void): () => void {
  return store.subscribe(listener);
}

/** Test/lifecycle reset. */
export function resetTopoFrameStatusForTest(): void {
  store.reset(EMPTY_STATUS);
}

function sameGroups(a: readonly TopoBakedGroup[], b: readonly TopoBakedGroup[]): boolean {
  return a.length === b.length && a.every((group, index) => group === b[index]);
}
