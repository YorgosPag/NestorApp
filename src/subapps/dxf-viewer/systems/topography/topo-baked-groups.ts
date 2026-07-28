/**
 * ADR-650 §M10g — ΤΑ ΨΗΜΕΝΑ ΠΡΟΪΟΝΤΑ ως ονοματισμένες ομάδες, με δηλωμένη σημασιολογία.
 *
 * ── Γιατί ομάδα και όχι οντότητα ──────────────────────────────────────────────────────────
 * Η σφραγίδα πλαισίου (§M10g) μπαίνει **ανά ομάδα**, όχι ανά οντότητα: τα layers είναι ήδη ο
 * διαχωριστής (κάθε παραγωγός ψήνει στα δικά του), οπότε μια σφραγίδα ανά ομάδα είναι φθηνή,
 * αρκετή, και **δεν μολύνει τον τύπο `Entity`** με πεδίο που θα κουβαλούσε κάθε γραμμή του
 * σχεδίου για χάρη τριών τοπογραφικών προϊόντων.
 *
 * ── Η δήλωση που εμποδίζει τον reconciler να μαντέψει ─────────────────────────────────────
 * Τα δύο είδη κειμένου στα ψημένα προϊόντα **δεν συμπεριφέρονται το ίδιο** όταν αλλάξει το
 * πλαίσιο, και η διαφορά είναι σημασιολογική, όχι τεχνική:
 *
 *   • Η ετικέτα καννάβου «407650» και το «Χ407723.10» μιας κορυφής είναι **υπόμνημα του
 *     χαρτιού**: τα glyphs σχεδιάζονται οριζόντια (§M10f κανόνας 3). Αν το πλαίσιο στρίψει,
 *     ένα φρέσκο ψήσιμο θα τα ξανάγραφε **πάλι οριζόντια** — άρα ο reconciler που θα τα
 *     έστριβε θα απέκλινε από τον ίδιο του τον παραγωγό.
 *   • Το «Β» του βορρά είναι **μέγεθος του κόσμου**: διαβάζεται κατά μήκος του βέλους, που
 *     δείχνει τον πραγματικό Βορρά (`rotation: angleDeg − 90` στο `north-arrow-entities`).
 *     Αν το πλαίσιο στρίψει, ΠΡΕΠΕΙ να στρίψει μαζί — αλλιώς το σύμβολο λέει ψέματα.
 *
 * Ένας reconciler που **μαντεύει** ποιο από τα δύο ισχύει είναι ακριβώς η κλάση σφάλματος που
 * έκλεισε το §M10f (κάθε παραγωγός αποφάσιζε μόνος του). Γι' αυτό η απάντηση **δηλώνεται εδώ,
 * μία φορά, μαζί με τα layers** — ο reconciler τη διαβάζει, δεν τη συμπεραίνει.
 *
 * @see ./persistence/topo-frame-reconcile.ts — ο καταναλωτής
 * @see ./persistence/topo-baked-frame-store.ts — πού ζει η σφραγίδα κάθε ομάδας
 */

import { TOPO_GRID_LAYER_NAME } from './topo-grid-config';
import { TOPO_NORTH_LAYER_NAME } from './north-arrow-config';
import {
  TOPO_POINT_ELEV_LAYER_NAME, TOPO_POINT_CODE_LAYER_NAME,
  TOPO_POINT_NUM_LAYER_NAME, TOPO_BOUNDARY_XY_LAYER_NAME,
} from './topo-point-label-config';

/**
 * Οι ομάδες ψημένων προϊόντων που **ο χρήστης πειράζει** (μετακινεί, σβήνει, ξαναψήνει) —
 * γι' αυτό μετακινούνται με delta αντί να αναγεννηθούν.
 *
 * Οι ισοϋψείς και το footprint **δεν** είναι εδώ: είναι καθαρά παράγωγα της πηγής και
 * ξαναχτίζονται (`regenerate-topo`) — η αναγέννηση δεν σβήνει καμία επεξεργασία, γιατί δεν
 * υπάρχει επεξεργασία να σβηστεί.
 */
export type TopoBakedGroup = 'grid' | 'pointLabels' | 'north';

/**
 * Πού ζει ο προσανατολισμός των glyphs μιας ομάδας — στο **χαρτί** ή στον **κόσμο**.
 * Βλ. το docblock του module για το γιατί δεν μπορεί να συμπερανθεί.
 */
export type GlyphOrientation = 'paper' | 'world';

/**
 * ADR-722 — **ΠΟΙΟΣ ΚΑΤΕΧΕΙ ΤΟ «ΠΟΥ»**: ο παραγωγός ή ο χρήστης.
 *
 * Η ερώτηση γεννιέται στο **ξανα-ψήσιμο**, και είναι ακριβώς ίδιου είδους με το
 * {@link GlyphOrientation}: δεν συμπεραίνεται, δηλώνεται.
 *
 *   • `derived` — η θέση είναι **παράγωγο της πηγής** (ο σταυρός του καννάβου κάθεται στη
 *     διασταύρωση· η ετικέτα κάθεται δίπλα στο σημείο της). Αν το σημείο μετακινηθεί, η ετικέτα
 *     **πρέπει** να το ακολουθήσει — άρα το ξανα-ψήσιμο γράφει τη νέα θέση. Ένα σύρσιμο του
 *     χρήστη εδώ είναι διακοσμητικό και δεν επιβιώνει· ο Civil 3D κάνει το ίδιο (η ετικέτα
 *     ενός COGO point ακολουθεί το σημείο, με ρητό «Reset» για την προεπιλεγμένη θέση).
 *   • `user` — **ο χρήστης** την τοποθετεί (ο βορράς πάει στη γωνιά του φύλλου, εκεί που τον
 *     θέλει ο μηχανικός). Το ξανα-ψήσιμο ενημερώνει το **περιεχόμενο** (π.χ. τη νέα γωνία) και
 *     **σέβεται τη θέση**. Ο Revit κάνει ακριβώς αυτό: το «Tag All Not Tagged» δεν αγγίζει
 *     ποτέ tag που υπάρχει ήδη, οπότε το σύρσιμο του χρήστη επιβιώνει κάθε επανάληψη.
 *
 * 🔴 Η διάκριση **δεν είναι αισθητική**: ο ίδιος ο reconciler (§M10g) γεννήθηκε επειδή
 * «ο βορράς που ο χρήστης έσυρε στη γωνιά θα ξαναγεννιόταν στη θέση-άγκιστρο, δηλαδή η αλλαγή
 * γεωαναφοράς θα **έσβηνε δουλειά**». Ένα ιδεμποτεντικό ψήσιμο που αγνοούσε αυτή τη δήλωση θα
 * ξανάφερνε την ίδια ακριβώς καταστροφή από την μπροστινή πόρτα.
 */
export type BakedPlacement = 'derived' | 'user';

export interface TopoBakedGroupSpec {
  readonly group: TopoBakedGroup;
  /** Τα layers που ψήνει ο παραγωγός της ομάδας (canonical ονόματα από τα configs). */
  readonly layerNames: readonly string[];
  readonly glyphOrientation: GlyphOrientation;
  /** ADR-722 — ποιος κατέχει τη θέση στο ξανα-ψήσιμο. Βλ. {@link BakedPlacement}. */
  readonly placement: BakedPlacement;
}

/** Ο πίνακας — μία γραμμή ανά παραγωγό ψημένου προϊόντος. */
export const TOPO_BAKED_GROUPS: readonly TopoBakedGroupSpec[] = [
  {
    group: 'grid',
    layerNames: [TOPO_GRID_LAYER_NAME],
    // Οι σταυροί (γεωμετρία) στρίβουν· οι αριθμοί του υπομνήματος μένουν οριζόντιοι.
    glyphOrientation: 'paper',
    // Ο σταυρός κάθεται ΣΤΗ διασταύρωση· άλλο βήμα καννάβου ⇒ άλλες διασταυρώσεις.
    placement: 'derived',
  },
  {
    group: 'pointLabels',
    layerNames: [
      TOPO_POINT_ELEV_LAYER_NAME, TOPO_POINT_CODE_LAYER_NAME,
      TOPO_POINT_NUM_LAYER_NAME, TOPO_BOUNDARY_XY_LAYER_NAME,
    ],
    glyphOrientation: 'paper',
    // Η ετικέτα ανήκει στο σημείο της: αν το σημείο μετακινηθεί, οφείλει να το ακολουθήσει.
    placement: 'derived',
  },
  {
    group: 'north',
    layerNames: [TOPO_NORTH_LAYER_NAME],
    // Το «Β» διαβάζεται κατά μήκος του βέλους — μέγεθος του κόσμου, στρίβει μαζί του.
    glyphOrientation: 'world',
    // Ο χρήστης τον σέρνει στη γωνιά του φύλλου. Το ξανα-ψήσιμο σέβεται τη θέση του.
    placement: 'user',
  },
];

/** Όλες οι ομάδες, ως τιμές (σειρά του πίνακα — σταθερή, ώστε οι αναφορές να μη χοροπηδούν). */
export const TOPO_BAKED_GROUP_IDS: readonly TopoBakedGroup[] = TOPO_BAKED_GROUPS.map((g) => g.group);

const SPEC_BY_GROUP = new Map<TopoBakedGroup, TopoBakedGroupSpec>(
  TOPO_BAKED_GROUPS.map((spec) => [spec.group, spec]),
);

const GROUP_BY_LAYER_NAME = new Map<string, TopoBakedGroup>(
  TOPO_BAKED_GROUPS.flatMap((spec) => spec.layerNames.map((name) => [name, spec.group] as const)),
);

/** Η δήλωση μιας ομάδας. */
export function bakedGroupSpec(group: TopoBakedGroup): TopoBakedGroupSpec {
  const spec = SPEC_BY_GROUP.get(group);
  /* istanbul ignore next — αδύνατο όσο ο τύπος `TopoBakedGroup` παράγεται από τον πίνακα. */
  if (!spec) throw new Error(`TOPO_BAKED_GROUP_UNKNOWN:${group}`);
  return spec;
}

/** Σε ποια ομάδα ανήκει ένα layer (κατ' ΟΝΟΜΑ — τα ids γεννιούνται εκ νέου ανά σκηνή). */
export function bakedGroupOfLayerName(layerName: string): TopoBakedGroup | null {
  return GROUP_BY_LAYER_NAME.get(layerName) ?? null;
}
