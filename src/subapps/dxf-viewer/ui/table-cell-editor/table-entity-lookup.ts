/**
 * ADR-739 Φ.Δ βήμα 4 — **ο εντοπισμός της οντότητας πίνακα μέσα στη σκηνή**, μία φορά.
 *
 * ## Γιατί ξεχωριστό αρχείο
 * Μέχρι το βήμα 3 υπήρχε **ένας** δρόμος εισόδου στη λειτουργία πίνακα (διπλό κλικ), οπότε
 * αυτές οι δύο συναρτήσεις ζούσαν ιδιωτικά μέσα στον οδηγό του. Το βήμα 4 προσθέτει **δύο
 * ακόμη** (`Enter`/`F2` σε επιλεγμένο πίνακα, εντολή `TABLEDIT`) που ρωτούν **ακριβώς** το
 * ίδιο: «ποιος πίνακας;». Αντιγραφή τους θα ήταν το κλασικό sibling clone που πιάνει το
 * CHECK 3.28 (N.18) — και, χειρότερα, τρία σημεία που μπορούν να αποκλίνουν στο τι μετρά
 * ως «έγκυρη επιλογή πίνακα».
 *
 * ## 🔴 Ο ΕΝΑΣ κανόνας: ΠΟΤΕ στιγμιότυπο
 * Και οι δύο διαβάζουν τη σκηνή **τη στιγμή της κλήσης** (ADR-040: event-time read μέσω
 * getter). Ο λόγος δεν είναι στιλιστικός: το `getLevelScene` ανανεώνεται **ασύγχρονα**
 * (autosave / εξωτερική ενημέρωση), και μια αποθηκευμένη αναφορά οντότητας γίνεται
 * μπαγιάτικη χωρίς κανένα ορατό σημάδι — ακριβώς το σφάλμα που κόστισε τη διαλείπουσα
 * απώλεια πληκτρολόγησης του βήματος 3 (δες το σχόλιο του `draft` στο store).
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/table-entity-lookup
 * @see state/table-cell-cursor-store.ts — τι γίνεται με τον πίνακα αφού βρεθεί
 */

import { isTableEntity } from '../../types/table-entity';
// 🔴 ADR-768 — η **ΜΙΑ** ερώτηση «πού έπεσε αυτό;», η ίδια που ρωτούν ο pointer και το κλείδωμα.
// Δεύτερη διατύπωσή της εδώ θα ήταν pixel όπου ο ένας βρίσκει κελί και ο άλλος όχι.
import { tablePointerHitAtWorld } from './table-cell-pointer-hit';
import type { TableEntity } from '../../types/table-entity';
import type { LevelManagerLike } from '../../hooks/canvas/canvas-click-types';
import type { Point2D } from '../../rendering/types/Types';

/** Η οντότητα πίνακα με αυτό το id, διαβασμένη **τη στιγμή της κλήσης**· `null` αν δεν υπάρχει. */
export function resolveTableById(
  levelManager: LevelManagerLike,
  entityId: string,
): TableEntity | null {
  const levelId = levelManager.currentLevelId;
  const scene = levelId ? levelManager.getLevelScene(levelId) : null;
  const entity = scene?.entities.find((e) => e.id === entityId);
  return entity && isTableEntity(entity) ? entity : null;
}

/**
 * Η επιλεγμένη οντότητα, αν είναι **ΑΚΡΙΒΩΣ μία** και είναι πίνακας — αλλιώς `null`.
 *
 * ⚠️ Το «ακριβώς μία» είναι απαίτηση, όχι αυστηρότητα: η λειτουργία πίνακα κατέχει το
 * πληκτρολόγιο ολόκληρο, οπότε πρέπει να είναι μονοσήμαντο **ποιου** πίνακα. Ίδιο κριτήριο
 * με την είσοδο σε ομάδα / block editor (`ids.length === 1`, ADR-575 / ADR-641), ώστε και
 * τα τρία drill-in της εφαρμογής να απαντούν το ίδιο.
 */
export function resolveSelectedTable(
  levelManager: LevelManagerLike,
  getSelectedEntityIds: () => readonly string[],
): TableEntity | null {
  const ids = getSelectedEntityIds();
  if (ids.length !== 1) return null;
  return resolveTableById(levelManager, ids[0]);
}

/**
 * 🔴 ADR-768 Βήμα 5 — **ο πίνακας ΚΑΤΩ ΑΠΟ ΤΟ ΧΕΡΙ**, όποιος κι αν είναι· `null` αν το σημείο
 * δεν πέφτει σε κελί κανενός.
 *
 * Η **τρίτη** ερώτηση ταυτότητας πίνακα, και η μόνη που δεν ξεκινά από ταυτότητα ή επιλογή αλλά
 * από **σημείο**. Υπάρχει για μία χειρονομία: το πινέλο μορφοποίησης βάφει **από πίνακα σε
 * πίνακα** (Excel μεταξύ φύλλων και βιβλίων· AutoCAD MATCHPROP μεταξύ σχεδίων· Revit Match Type
 * μεταξύ όψεων), οπότε ο πίνακας του δρομέα **δεν** είναι απάντηση στο «πού βάφω».
 *
 * ## ⚠️ ΚΟΣΤΟΣ — γι' αυτό καλείται ΜΟΝΟ με οπλισμένο πινέλο
 * Σαρώνει τις οντότητες του επιπέδου και για κάθε πίνακα πληρώνει έναν πλήρη υπολογισμό
 * διάταξης (`tablePointerHitAtWorld`). Σε ακροατή `mousemove` που τρέχει ~60 φορές το
 * δευτερόλεπτο αυτό θα ήταν απαράδεκτο ως **μόνιμη** συμπεριφορά· ο μοναδικός καλών το
 * περιφράσσει ρητά πίσω από το `isTableFormatPainterArmed()`.
 *
 * ## Γιατί από το τέλος προς την αρχή
 * Ο ζωγράφος περνά τις οντότητες με τη σειρά του πίνακα, άρα η **τελευταία** είναι από πάνω. Δύο
 * πίνακες που επικαλύπτονται πρέπει να απαντούν όπως φαίνονται — αλλιώς ο χρήστης θα έβαφε
 * εκείνον που είναι από κάτω, με αποτέλεσμα απολύτως έγκυρο και εντελώς λάθος.
 *
 * ⚠️ Δέχεται **μόνο** `where: 'cell'`. Ένα σημείο πάνω σε λωρίδα, διαχωριστικό, ⊕/⊖ ή γωνία
 * **δεν** είναι στόχος βαψίματος (Δ2): εκεί ο δείκτης υπόσχεται άλλη πράξη, και η πράξη εκτελείται.
 */
export function resolveTableAtWorld(
  levelManager: LevelManagerLike,
  world: Point2D,
  viewScale: number,
): TableEntity | null {
  const levelId = levelManager.currentLevelId;
  const scene = levelId ? levelManager.getLevelScene(levelId) : null;
  const entities = scene?.entities;
  if (!entities) return null;
  for (let index = entities.length - 1; index >= 0; index--) {
    const entity = entities[index];
    if (!isTableEntity(entity)) continue;
    if (tablePointerHitAtWorld(entity, world, viewScale)?.where === 'cell') return entity;
  }
  return null;
}
