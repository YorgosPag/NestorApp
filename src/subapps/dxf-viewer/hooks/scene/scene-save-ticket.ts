/**
 * scene-save-ticket — immutable write-identity descriptor for a DXF scene save (ADR-714).
 *
 * ## Γιατί υπάρχει
 *
 * Το auto-save είναι debounced (`STORAGE_TIMING.SCENE_AUTOSAVE_DEBOUNCE` = 2000ms) και
 * async. Πριν το ADR-714 η ταυτότητα του προορισμού διαβαζόταν σε **δύο διαφορετικές
 * χρονικές στιγμές** από **μεταβλητά refs**:
 *
 *   - `fileName`  → τη στιγμή του scheduling (Τ₀)
 *   - `fileId`    → **μέσα** στο `setTimeout`, στο Τ₀ + 2000ms
 *
 * Μια εναλλαγή ορόφου ενδιάμεσα (`useLevelSceneLoader` → `setFileRecordId(...)`)
 * άλλαζε το `fileId` κάτω από το ήδη προγραμματισμένο save. Αποτέλεσμα: **ο όροφος Α
 * προγραμμάτιζε την εγγραφή και ο όροφος Β την εκτελούσε** — η σκηνή του Α γραφόταν
 * στο αρχείο του Β. Επειδή το `canonicalScenePath` παράγεται από το FileRecord, δύο
 * όροφοι κατέληγαν να γράφουν στο **ίδιο φυσικό `.scene.json`**: όποιος έσωζε
 * τελευταίος έσβηνε τον άλλο (περιστατικό 2026-07-26, `lvl_2a7ff5cc` ↔ `lvl_dabeb3bb`).
 *
 * ## Η αρχή
 *
 * Revit (transaction με ρητό document target), Figma (κάθε operation φέρει το `fileKey`
 * της), ArchiCAD Teamwork (reserve-before-write) συγκλίνουν στο ίδιο:
 * **το save φέρει μαζί του τον προορισμό του** αντί να τον διαβάζει από ambient
 * mutable state τη στιγμή της εκτέλεσης.
 *
 * Το `SceneSaveTicket` «παγώνει» στο Τ₀ και είναι η **ΜΟΝΗ** πηγή ταυτότητας μέσα στο
 * async save. Ο executor (`execute-scene-save.ts`) δεν διαβάζει **κανένα** `*Ref.current`.
 *
 * Πλεονέκτημα έναντι του προφανούς «ακύρωσε το pending save στην εναλλαγή ορόφου»:
 * **καμία απώλεια δουλειάς** — το save του Α ολοκληρώνεται σωστά στον Α ακόμη κι αν ο
 * χρήστης βρίσκεται ήδη στον Β.
 *
 * Pure + dependency-free (μόνο types), όπως το αδελφό `systems/levels/cross-floor-link.ts`.
 *
 * @module subapps/dxf-viewer/hooks/scene/scene-save-ticket
 * @see docs/centralized-systems/reference/adrs/ADR-714-level-scene-write-identity.md
 */

import type { DxfSaveContext } from '../../services/dxf-firestore.service';
import { isBimEntityType } from '../../types/entities';
import type { SceneModel } from '../../types/scene';

/**
 * Immutable ταυτότητα ενός προγραμματισμένου scene save.
 *
 * `fileId` / `canonicalScenePath` επιτρέπεται να λείπουν στο Τ₀ (π.χ. πρώτο standalone
 * save, ή fresh import όπου το `setSaveContext` κλήθηκε χωρίς path). Ο executor τα
 * επιλύει async — **αλλά αποκλειστικά από τα πεδία του ticket** (`floorId`, `companyId`,
 * `fileName`), ποτέ από live refs. Έτσι η επίλυση παραμένει δεμένη στον όροφο που
 * γέννησε την εγγραφή.
 */
export interface SceneSaveTicket {
  /** Το επίπεδο που γέννησε την εγγραφή — ΑΥΤΟ linkάρεται, όχι το «τρέχον». */
  readonly levelId: string;
  /** Ο όροφος του `levelId`. Το κλειδί που κάνει την επίλυση floor-scoped. */
  readonly floorId: string | null;
  readonly companyId: string | null;
  /** Ο συνδεδεμένος χρήστης τη στιγμή Τ₀ — γίνεται `createdBy` στο metadata. */
  readonly userUid: string | null;
  readonly fileId: string | null;
  readonly fileName: string;
  readonly canonicalScenePath: string | null;
  /**
   * Το injected `DxfSaveContext` (Wizard/loader) όπως ήταν στο Τ₀ — παγώνει μαζί με
   * την υπόλοιπη ταυτότητα. Πριν το ADR-714 διαβαζόταν από ref μέσα στο timeout, οπότε
   * μια εναλλαγή ορόφου άλλαζε και τον `floorId` του context κάτω από το save.
   */
  readonly saveContext: DxfSaveContext | null;
  /** Το snapshot που θα γραφτεί (ήδη περασμένο από `stripForeignFloorBim`). */
  readonly scene: SceneModel;
}

/** Πεδία του ticket χωρίς τη σκηνή — βολικό για logging χωρίς το ~950KB blob. */
export type SceneSaveTicketIdentity = Omit<SceneSaveTicket, 'scene'>;

/**
 * Φτιάχνει ένα παγωμένο ticket. `Object.freeze` ώστε ένα λάθος «patch το ticket στο
 * μεταξύ» να σπάει θορυβωδώς αντί να ξαναγεννά σιωπηλά το bug που έκλεισε το ADR-714.
 *
 * Δεν κάνει deep-freeze: η `scene` είναι μεγάλο γράφημα και ο deep-freeze θα κόστιζε
 * ανά save· ούτως ή άλλως ο executor τη μεταχειρίζεται read-only.
 */
export function createSceneSaveTicket(input: SceneSaveTicket): SceneSaveTicket {
  return Object.freeze({ ...input });
}

/** Η ταυτότητα του ticket χωρίς τη σκηνή (για logger/telemetry). */
export function ticketIdentity(ticket: SceneSaveTicket): SceneSaveTicketIdentity {
  const { scene: _scene, ...identity } = ticket;
  return identity;
}

/**
 * Πλήθος **DXF-native** (μη-BIM) οντοτήτων μιας σκηνής.
 *
 * Ο διαχωριστής είναι το υπάρχον SSoT `isBimEntityType` (`types/entities.ts`) — καμία
 * δεύτερη hardcoded λίστα τύπων, όπως ακριβώς κάνει και το
 * `export/core/export-entity-scope.ts` (ADR-505 §A).
 *
 * Σημείωση: το `stair` σκόπιμα ΔΕΝ ανήκει στο `isBimEntityType` (γνωστό gap, ADR-587 §6),
 * άρα μετριέται εδώ ως DXF. Αυτό είναι **συντηρητικό** για τον σκοπό του `isDxfWipe`:
 * μεγαλώνει το baseline, δηλαδή κάνει τον φρουρό πιο πρόθυμο να μπλοκάρει, ποτέ λιγότερο.
 */
export function countDxfEntities(scene: SceneModel | null | undefined): number {
  const entities = scene?.entities;
  if (!Array.isArray(entities)) return 0;
  let count = 0;
  for (const entity of entities) {
    if (!isBimEntityType(entity.type)) count += 1;
  }
  return count;
}

/**
 * Φρουρός καταστροφικής απώλειας: true όταν η υπό εγγραφή σκηνή **μηδενίζει** τη
 * DXF γεωμετρία ενός αρχείου που αποδεδειγμένα την είχε.
 *
 * ### Γιατί «μηδέν» και όχι ποσοστό
 *
 * Ο προηγούμενος φρουρός ρωτούσε `scene.entities.length === 0` και **αστόχησε**: η
 * καταστροφική εγγραφή είχε 12 κολόνες (BIM) και **μηδέν** DXF, οπότε `12 > 0` →
 * πέρασε και έγραψε 12 πάνω από 1181. Το αποτύπωμα της ζημιάς είναι ακριβώς
 * «DXF → 0 ενώ το BIM επιβιώνει», γιατί το BIM ξαναγεμίζει από τα per-entity
 * Firestore docs ενώ η DXF γεωμετρία ζει **μόνο** στο blob.
 *
 * Ένα ποσοστιαίο κατώφλι θα εισήγαγε false positives σε νόμιμες μαζικές διαγραφές. Το
 * «έπεσε στο απόλυτο μηδέν ενώ πριν υπήρχε» είναι ντετερμινιστικό και πρακτικά
 * αδύνατο ως πρόθεση χρήστη (ποιος σβήνει ΟΛΕΣ τις γραμμές και κρατά μόνο BIM;).
 *
 * Fail-safe κατεύθυνση: με άγνωστο baseline (`0`) επιστρέφει `false` — δεν μπλοκάρουμε
 * ποτέ ένα γνήσιο πρώτο save.
 *
 * @param nextScene        Η σκηνή που πρόκειται να γραφτεί.
 * @param baselineDxfCount Οι DXF οντότητες που ξέρουμε ότι έχει ήδη ο προορισμός.
 */
export function isDxfWipe(
  nextScene: SceneModel | null | undefined,
  baselineDxfCount: number,
): boolean {
  if (baselineDxfCount <= 0) return false;
  return countDxfEntities(nextScene) === 0;
}
