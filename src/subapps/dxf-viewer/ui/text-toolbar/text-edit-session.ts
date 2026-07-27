/**
 * ADR-344 Φ6.E / Φ-3D — «τι σημαίνει να επεξεργάζεσαι ένα κείμενο», ΜΙΑ φορά.
 *
 * Ο πυρήνας του in-place text editor, χωρίς καμία γνώση διάστασης. Πριν από αυτό το
 * αρχείο, ο κανόνας «ακριβώς 1 επιλεγμένη οντότητα τύπου TEXT/MTEXT» και ο κανόνας
 * «diff → ΕΝΑ undo βήμα» ζούσαν inline μέσα στο `useTextDoubleClickEditor` — δηλαδή
 * μέσα στο 2D. Ο 3D editor (ADR-537 §text) θα τα αντέγραφε αυτούσια· δύο αντίγραφα
 * ενός κανόνα επιλογής είναι ακριβώς το είδος του διδύμου που σαπίζει σιωπηλά
 * (το ένα μαθαίνει τον νέο τύπο κειμένου, το άλλο όχι).
 *
 * ΤΙ ΜΕΝΕΙ ΕΞΩ (και γιατί): η **αγκύρωση** — πού κάθεται ο editor στην οθόνη. Αυτό
 * είναι το ΜΟΝΟ πράγμα που διαφέρει ουσιωδώς μεταξύ 2D και 3D (affine transform vs
 * προβολή κάμερας), οπότε είναι το μόνο που δικαιολογεί δύο υλοποιήσεις:
 *   - 2D → `useTextDoubleClickEditor.computeAnchorRect`
 *   - 3D → `bim-3d/text/text-edit-anchor-3d.ts`
 *
 * Import-time καθαρό: μηδέν React, μηδέν THREE, μηδέν DOM. Πλήρως jest-driveable.
 *
 * @see ui/text-toolbar/hooks/useTextDoubleClickEditor.ts — ο 2D καταναλωτής
 * @see bim-3d/text/use-bim3d-text-double-click-editor.ts — ο 3D καταναλωτής
 */

import { CompoundCommand, type ICommand } from '../../core/commands';
import { diffTextNode, ensureTextNode } from '../../text-engine/edit';
import type { DxfTextNode } from '../../text-engine/types';
import type { AnySceneEntity, SceneModel } from '../../types/scene';
import type { DxfTextServices } from './hooks/useDxfTextServices';

/** Η οντότητα-στόχος μαζί με το AST της, έτοιμη να ανοίξει ο editor. */
export interface TextEditTarget {
  readonly entity: AnySceneEntity;
  readonly node: DxfTextNode;
}

/**
 * Οι τύποι σκηνής που δέχεται ο editor.
 *
 * ⚠️ Ο διαχωρισμός `text` / `mtext` επιβιώνει ΜΟΝΟ στο `SceneModel`. Στο `DxfScene`
 * (render + hit-test, 2D και 3D) το MTEXT έχει ήδη κανονικοποιηθεί σε `type:'text'`
 * από τον `convertTextEntity` — «DxfEntityUnion has no `mtext` variant». Γι' αυτό η
 * αναζήτηση εδώ γίνεται ΠΑΝΤΑ πάνω στο `SceneModel`: είναι το μόνο επίπεδο όπου το
 * ερώτημα «είναι MTEXT;» έχει ακόμη απάντηση.
 */
const EDITABLE_TEXT_TYPES: ReadonlySet<string> = new Set(['text', 'mtext']);

/** True όταν ο τύπος της οντότητας ανοίγει τον editor κειμένου (TEXT ή MTEXT). */
export function isEditableTextType(type: string | undefined): boolean {
  return type !== undefined && EDITABLE_TEXT_TYPES.has(type);
}

/**
 * Ο κανόνας ενεργοποίησης του editor, AutoCAD `DBLCLKEDIT = 1`: ακριβώς ΜΙΑ επιλεγμένη
 * οντότητα, και αυτή να είναι TEXT/MTEXT. Οτιδήποτε άλλο (0 επιλογές, πολλαπλή επιλογή,
 * άλλος τύπος, id που δεν υπάρχει στη σκηνή) → `null`, δηλαδή «το διπλό κλικ δεν είναι
 * δικό μου» και ο καλών το προωθεί παρακάτω.
 *
 * Πολλαπλή επιλογή ΔΕΝ ανοίγει editor σκόπιμα: «επεξεργάσου αυτό» και «επέλεξε πολλά»
 * είναι αντίθετες προθέσεις — η ίδια αρχή με το drill-down του ADR-715 Φ2.
 */
export function resolveTextEditTarget(
  scene: SceneModel | null,
  ids: readonly string[],
): TextEditTarget | null {
  if (!scene || ids.length !== 1) return null;
  const id = ids[0];
  if (!id) return null;
  const entity = scene.entities.find((e) => e.id === id);
  if (!entity || !isEditableTextType(entity.type)) return null;
  const node = ensureTextNode(entity as unknown as Parameters<typeof ensureTextNode>[0]);
  return { entity, node };
}

/**
 * Το commit: το AST πριν vs μετά → ΕΝΑ undoable βήμα, όσα πεδία κι αν άλλαξαν (AutoCAD
 * MTEXTEDIT undo grain). Καμία αλλαγή → `null`, ώστε ο καλών να κλείσει τον editor χωρίς
 * να λερώσει το ιστορικό με no-op.
 *
 * Ένα σκέτο command επιστρέφεται ΩΣ ΕΧΕΙ (χωρίς περιτύλιγμα σε CompoundCommand): το
 * `CompoundCommand` του ενός παιδιού είναι θόρυβος στο undo stack.
 */
export function buildTextEditCommand(
  entityId: string,
  initial: DxfTextNode,
  next: DxfTextNode,
  services: DxfTextServices,
): ICommand | null {
  const commands = diffTextNode(entityId, initial, next, services);
  if (commands.length === 0) return null;
  return commands.length === 1 ? commands[0]! : new CompoundCommand('Edit text', commands);
}
