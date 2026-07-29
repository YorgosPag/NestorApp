'use client';

/**
 * ADR-650 §M10g + ADR-722 — Η ΜΙΑ ΡΑΦΗ ΤΟΥ ΨΗΣΙΜΑΤΟΣ: έλεγξε το όριο, **αντικατάστησε** την
 * ομάδα, σφράγισε το πλαίσιο, ξαναπαρατήρησε το σήμα.
 *
 * ── Γιατί υπάρχει ─────────────────────────────────────────────────────────────────────────
 * Οι τρεις παραγωγοί ψημένων προϊόντων (`useTopoGrid`, `useTopoPointLabels`, `useNorthArrow`)
 * κατέληγαν ο καθένας σε ένα σκέτο `completeEntities(...)`. Αν η σφραγίδα του πλαισίου γραφόταν
 * «και στους τρεις», ο **τέταρτος** παραγωγός θα γεννιόταν χωρίς αυτήν — ακριβώς όπως γεννήθηκαν
 * τέσσερις παραγωγοί χωρίς τη γέφυρα WORLD→DISPLAY (§M10f). Άρα η σφραγίδα **δεν** μπαίνει
 * «και στους τρεις»: μπαίνει στη ΜΙΑ ραφή απ' όπου περνούν υποχρεωτικά όλοι, με το `group` ως
 * **υποχρεωτική** παράμετρο — δεν υπάρχει τρόπος να ψήσεις χωρίς να απαντήσεις «ποια ομάδα».
 *
 * ── Το όριο ως συμβόλαιο με δόντια (§M10g.4.1) ────────────────────────────────────────────
 * Ο Revit *προειδοποιεί* όταν η γεωμετρία απομακρυνθεί από το Internal Origin. Εδώ ο έλεγχος
 * τρέχει **πριν** γραφτεί η σκηνή, σε dev, και **σκάει** (DCHECK semantics): μια ψημένη οντότητα
 * σε ωμές ΕΓΣΑ είναι αόρατη, άπιαστη και σιωπηλή — δηλαδή το χειρότερο είδος σφάλματος.
 *
 * ── Οι ΤΕΣΣΕΡΙΣ πράξεις, και γιατί καμία δεν μπορεί να λείψει (ADR-722) ────────────────────
 * Το ψήσιμο **δεν** είναι «γράψε οντότητες». Είναι μια αλλαγή κατάστασης με τέσσερα αδιαίρετα
 * σκέλη, και το §M10g είχε υλοποιήσει μόνο τα δύο μεσαία:
 *
 *   1. **έλεγχος** — η γεωμετρία είναι όντως στο display frame (§M10g.4.1)·
 *   2. **αντικατάσταση** — η ομάδα περιέχει *ακριβώς* τα φρέσκα προϊόντα (ADR-722)· χωρίς αυτό
 *      το δεύτερο πάτημα στοίβαζε διπλότυπα και η σφραγίδα από κάτω γινόταν **ψέμα**·
 *   3. **σφραγίδα** — σε ποιο πλαίσιο ψήθηκε (§M10g)·
 *   4. **σήμα** — το «ποιος είναι σε άγνωστο πλαίσιο» άλλαξε, άρα ξαναμετριέται (ADR-722)·
 *      χωρίς αυτό το κόκκινο μήνυμα έμενε στην οθόνη μετά από σωστό ξανα-ψήσιμο.
 *
 * Και τα τέσσερα ζουν **εδώ**, στη ΜΙΑ ραφή, για τον ίδιο λόγο που ζει εδώ η σφραγίδα: ο
 * τέταρτος παραγωγός τα κληρονομεί χωρίς να τα ξέρει.
 *
 * @see ./topo-baked-groups.ts — οι ομάδες + `placement` (ποιος κατέχει τη θέση)
 * @see ./topo-bake-upsert.ts — ο καθαρός σχεδιαστής της αντικατάστασης
 * @see ./topo-baked-frame-store.ts — πού πάει η σφραγίδα
 * @see ./persistence/topo-frame-reconcile.ts — τι κάνει η σφραγίδα αργότερα
 */

import type { SceneModel } from '../../types/scene';
import type { Entity } from '../../types/entities';
import type { ToolType } from '../../ui/toolbar/types';
import { completeEntities } from '../../hooks/drawing/completeEntity';
import { SCENE_COORD_BAND_MM } from '../../config/geometry-constants';
import { resolveEntityBounds } from '../../rendering/hitTesting/entity-bounds-ssot';
import { getActiveProjectFrame } from '../geo-referencing/geo-reference-store';
import type { ProjectFrameStamp } from '../geo-referencing/project-frame';
import { getGlobalCommandHistory } from '../../core/commands/CommandHistory';
import { DeleteMultipleEntitiesCommand } from '../../core/commands/entity-commands/DeleteEntityCommand';
import { createLevelSceneManagerAdapter } from '../entity-creation/LevelSceneManagerAdapter';
import type { TopoBakedGroup } from './topo-baked-groups';
import { getLevelBakedFrames, setBakedFrame } from './topo-baked-frame-store';
import { planBakedUpsert } from './topo-bake-upsert';
import { unstampedBakedGroups } from './topo-baked-scan';
import { recordBakeInTopoFrameStatus } from './topo-frame-status-store';

export interface CommitBakedTopoInput {
  /** Τα έτοιμα προϊόντα του παραγωγού — ήδη περασμένα από τη γέφυρα WORLD→DISPLAY. */
  readonly entities: readonly Entity[];
  /** Ποια ομάδα ψήνεται (υποχρεωτικό — βλ. το docblock του module). */
  readonly group: TopoBakedGroup;
  readonly tool: ToolType;
  readonly levelId: string;
  readonly getScene: (levelId: string) => SceneModel | null;
  readonly setScene: (levelId: string, scene: SceneModel) => void;
}

/**
 * Ψήσε μια ομάδα: **αντικατάστησε** ό,τι υπάρχει ήδη σ' αυτήν με τα φρέσκα προϊόντα (μέσω
 * `completeEntities` — undo / persistence / render / export ως έχει), **σφράγισε** την ομάδα με
 * το ενεργό πλαίσιο, και **ξαναπαρατήρησε** ποιος έμεινε σε άγνωστο πλαίσιο.
 *
 * ## Η σειρά είναι φέρουσα
 * Η **διαγραφή προηγείται** της εγγραφής: αν γινόταν μετά, το ενδιάμεσο καρέ θα περιείχε και τα
 * δύο σύνολα, και μια εγγραφή που πετάει στη μέση θα άφηνε τον χρήστη με διπλότυπα — δηλαδή
 * ακριβώς το σφάλμα που το ADR-722 κλείνει.
 *
 * Η **σφραγίδα γράφεται ΤΕΛΕΥΤΑΙΑ**, μετά την επιτυχή εγγραφή: αν το `completeEntities` πετάξει,
 * δεν μένει πίσω σφραγίδα που να ισχυρίζεται ότι κάτι ψήθηκε — και το ίδιο για το σήμα, που
 * διαβάζει τις σφραγίδες.
 *
 * ## ΕΝΑ βήμα undo (ADR-729)
 * Μέχρι το ADR-729 εδώ υπήρχαν **δύο** βήματα αναίρεσης (διαγραφή· δημιουργία) και το σχόλιο
 * αυτό τα δικαιολογούσε: «τύλιγμα και των δύο θα απαιτούσε παράκαμψη της SSoT». **Αυτό δεν
 * ισχύει πλέον** — και δεν ίσχυε ποτέ ως δίλημμα: η `CommandHistory.runAsSingleUndo` τυλίγει
 * **γύρω** από το `completeEntities` αντί να το παρακάμψει, οπότε η διαδρομή που επιβάλλει το
 * capability anchor του §M10g μένει **ακέραιη** και το ψήσιμο γίνεται ΜΙΑ ενέργεια χρήστη =
 * **ΜΙΑ** αναίρεση. Η αναίρεση ξετυλίγεται αντίστροφα (πρώτα φεύγουν τα φρέσκα, μετά
 * επιστρέφουν τα αντικατασταθέντα από τα snapshots του `DeleteMultipleEntitiesCommand`), άρα ο
 * χρήστης δεν βλέπει ποτέ ενδιάμεση κατάσταση με **κανένα** από τα δύο σύνολα.
 */
export function commitBakedTopoEntities(input: CommitBakedTopoInput): void {
  const frame = getActiveProjectFrame();
  assertBakedInDisplayFrame(input.entities, input.group, frame);

  const plan = planBakedUpsert(input.getScene(input.levelId), input.group, input.entities);

  // ADR-729 — αντικατάσταση = ΜΙΑ ενέργεια χρήστη: η διαγραφή της παλιάς ομάδας και η εγγραφή
  // της φρέσκιας προσγειώνονται ως ΕΝΑ βήμα αναίρεσης. Το `completeEntities` ανοίγει τη δική
  // του (ένθετη) εμβέλεια, η οποία ενώνεται με αυτήν — δεν παρακάμπτεται τίποτα.
  getGlobalCommandHistory().runAsSingleUndo(`Bake ${input.group}`, () => {
    if (plan.replacedIds.length > 0) {
      getGlobalCommandHistory().execute(new DeleteMultipleEntitiesCommand(
        [...plan.replacedIds],
        createLevelSceneManagerAdapter(input.getScene, input.setScene, input.levelId),
      ));
    }

    completeEntities(plan.entities as Entity[], {
      tool: input.tool,
      levelId: input.levelId,
      getScene: input.getScene,
      setScene: input.setScene,
    });
  });

  setBakedFrame(input.levelId, input.group, frame);
  refreshFrameStatusAfterBake(input);
}

/**
 * Το σήμα «άγνωστο πλαίσιο» είναι **παράγωγο** (σκηνή · σφραγίδες), και το ψήσιμο μόλις άλλαξε
 * και τα δύο. Ξαναμετριέται εδώ, από τη ΜΙΑ ανάγνωση σκηνής (`topo-baked-scan`) που χρησιμοποιεί
 * και ο reconciler — ώστε το κόκκινο μήνυμα και η απόφαση «μετακινώ / δεν αγγίζω» να μην
 * μπορούν να διαφωνήσουν.
 *
 * **Δεν** καλείται ο reconciler: εκείνος είναι ο ιδιοκτήτης της *συμφιλίωσης* (ξαναχτίζει
 * ισοϋψείς, μετακινεί με delta, γράφει σκηνή) και δεν έχει καμία δουλειά να τρέξει επειδή ο
 * χρήστης πάτησε «Ετικέτες σημείων». Εδώ δεν συμφιλιώνουμε — απλώς **ξανακοιτάμε**.
 */
function refreshFrameStatusAfterBake(input: CommitBakedTopoInput): void {
  const scene = input.getScene(input.levelId);
  if (!scene) return; // δεν υπάρχει σκηνή να παρατηρηθεί — το επόμενο πέρασμα θα το πει
  recordBakeInTopoFrameStatus(
    input.levelId,
    input.group,
    unstampedBakedGroups(scene, getLevelBakedFrames(input.levelId)),
  );
}

/**
 * DEV-ONLY: πιάνει την **κλάση** «ο παραγωγός ξέχασε τη γέφυρα WORLD→DISPLAY», όχι το μέγεθος.
 *
 * ## Γιατί όχι σκέτο κατώφλι
 * Ένα σταθερό «έξω από ±1e6 mm ⇒ σφάλμα» θα χτυπούσε ψευδώς σε ένα **υπαρκτό** μεγάλο οικόπεδο
 * (2 χλμ. διάμετρος είναι νόμιμο σχέδιο). Η διάγνωση όμως δεν χρειάζεται κατώφλι: όταν υπάρχει
 * ενεργή γεωαναφορά με origin `O`, η **προβεβλημένη** γεωμετρία κάθεται κοντά στο 0, ενώ η
 * **αξήμωτη** κάθεται κοντά στο `O` (4·10⁸ mm στα ΕΓΣΑ'87). Ένα φράγμα στο `|O|/2` **ανά άξονα**
 * χωρίζει τα δύο με τάξεις μεγέθους περιθώριο και δεν εξαρτάται από καμία μαγική σταθερά.
 *
 * Χωρίς ενεργή γεωαναφορά ο έλεγχος **παραλείπεται**: εκεί WORLD ≡ DISPLAY, δεν υπάρχει γέφυρα
 * να ξεχαστεί, και οποιοδήποτε όριο θα ήταν αυθαίρετη κρίση για το μέγεθος του σχεδίου.
 */
function assertBakedInDisplayFrame(
  entities: readonly Entity[],
  group: TopoBakedGroup,
  frame: ProjectFrameStamp,
): void {
  if (process.env.NODE_ENV === 'production') return;

  // Ανά άξονα, ανεξάρτητα: ένα έργο μπορεί να κουβαλά τεράστιο northing και μηδενικό easting.
  const guardX = axisGuard(frame.originWorldXMm);
  const guardY = axisGuard(frame.originWorldYMm);
  if (guardX === null && guardY === null) return; // μη-γεωαναφερμένο — τίποτα να ξεχαστεί

  for (const entity of entities) {
    const bounds = resolveEntityBounds(entity);
    if (!bounds) continue; // τύπος χωρίς provider — δεν εφευρίσκουμε γεωμετρία
    const outside =
      exceeds(bounds.minX, guardX) || exceeds(bounds.maxX, guardX) ||
      exceeds(bounds.minY, guardY) || exceeds(bounds.maxY, guardY);
    if (!outside) continue;
    throw new Error(
      `TOPO_BAKE_OUTSIDE_DISPLAY_FRAME: η ομάδα «${group}» ψήνει οντότητα (${entity.type}) σε ` +
      `[${bounds.minX.toFixed(1)}, ${bounds.minY.toFixed(1)}] — πέρα από το φράγμα ` +
      `[${guardX ?? '—'}, ${guardY ?? '—'}] mm. Αυτό σημαίνει ωμές ΕΓΣΑ συντεταγμένες: ο ` +
      'παραγωγός δεν πέρασε από τη γέφυρα WORLD→DISPLAY (ADR-650 §M10f, `topo-display-frame`).',
    );
  }
}

/** Το φράγμα ενός άξονα, ή `null` όταν ο άξονας δεν κουβαλά γεωαναφορά (τίποτα να ελεγχθεί). */
function axisGuard(originMm: number): number | null {
  const half = Math.abs(originMm) / 2;
  return half > SCENE_COORD_BAND_MM ? half : null;
}

/** Ξεπερνά η συντεταγμένη το φράγμα του άξονά της; Άξονας χωρίς φράγμα ⇒ ποτέ. */
function exceeds(coordinate: number, guard: number | null): boolean {
  return guard !== null && Math.abs(coordinate) > guard;
}
