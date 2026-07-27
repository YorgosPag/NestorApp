'use client';

/**
 * ADR-650 §M10g — Η ΜΙΑ ΡΑΦΗ ΤΟΥ ΨΗΣΙΜΑΤΟΣ: γράψε τη σκηνή, σφράγισε το πλαίσιο, έλεγξε το όριο.
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
 * @see ./topo-baked-groups.ts — οι ομάδες
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
import type { TopoBakedGroup } from './topo-baked-groups';
import { setBakedFrame } from './topo-baked-frame-store';

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
 * Γράψε τα ψημένα προϊόντα στη σκηνή (μέσω `completeEntities` — undo / persistence / render /
 * export ως έχει) και **σφράγισε** την ομάδα με το ενεργό πλαίσιο.
 *
 * Η σφραγίδα γράφεται ΜΕΤΑ την επιτυχή εγγραφή: αν το `completeEntities` πετάξει, δεν μένει
 * σφραγίδα που να ισχυρίζεται ότι κάτι ψήθηκε.
 */
export function commitBakedTopoEntities(input: CommitBakedTopoInput): void {
  const frame = getActiveProjectFrame();
  assertBakedInDisplayFrame(input.entities, input.group, frame);

  completeEntities(input.entities as Entity[], {
    tool: input.tool,
    levelId: input.levelId,
    getScene: input.getScene,
    setScene: input.setScene,
  });

  setBakedFrame(input.levelId, input.group, frame);
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
