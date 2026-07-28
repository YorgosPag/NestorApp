'use client';

/**
 * active-document-gateway — η **μία θύρα** προς το ενεργό έγγραφο από κώδικα εκτός React.
 *
 * ADR-721 §6. Zero-React module singleton: **ΕΝΑΣ γραφέας** (το `LevelsSystem` κατά το mount)
 * → **ΠΟΛΛΟΙ αναγνώστες** (commands, services, stores). Ίδιο μοτίβο με το
 * `active-storey-store` και το `Bim3DEntitiesStore.activeLevelId`.
 *
 * ## Γιατί χρειάστηκε
 *
 * Οι εντολές layer (`core/commands/layer/**`, ADR-616) και οι υπηρεσίες που αλλάζουν
 * ιδιότητες layer τρέχουν **εκτός React**: δεν έχουν context, άρα δεν είχαν τρόπο να
 * μάθουν ποιο level είναι ενεργό ούτε να γράψουν στο έγγραφο. Γι' αυτό — και μόνο γι'
 * αυτό — έγραφαν κατευθείαν στο `LayerStore`, το οποίο είναι **runtime προβολή**: η
 * αλλαγή φαινόταν αμέσως αλλά χανόταν στο επόμενο hydration από το έγγραφο. Δεκαέξι
 * σημεία έπασχαν από αυτό (isolate/freeze/lock commands, Layer Manager, layer picker,
 * οι 5 setters του `LayerOperationsService`).
 *
 * Η θύρα κλείνει το κενό χωρίς να σύρει React σε non-React κώδικα.
 *
 * ## Γιατί ΟΧΙ κατευθείαν `SceneStore.setLevelScene`
 *
 * Το `SceneStore` είναι το κατώτερο στρώμα και **δεν ξέρει από auto-save**. Η αποθήκευση
 * ζει στο `useAutoSaveSceneManager.setLevelSceneWithAutoSave` (γνωρίζει `SceneWriteOrigin`,
 * τον φρουρό κενής σκηνής, τον `isDxfWipe` φρουρό του ADR-714). Γράψιμο απευθείας στο
 * `SceneStore` θα ενημέρωνε την οθόνη αλλά **δεν θα αποθήκευε ποτέ** — δηλαδή θα
 * αντικαθιστούσε το παλιό bug με ένα χειρότερο, πιο δύσκολο να εντοπιστεί. Η θύρα
 * καταχωρεί τον auto-save-aware writer, όχι τον ωμό.
 *
 * ## Συμβόλαιο ασφαλείας
 *
 * `withActiveDocument` επιστρέφει `false` όταν δεν υπάρχει ενεργό έγγραφο (πριν το mount,
 * σε SSR, σε tests χωρίς provider). Ο caller **οφείλει** να τιμήσει το `false` — ποτέ
 * σιωπηλή μερική εγγραφή.
 *
 * @module systems/levels/active-document-gateway
 * @see systems/scene/SceneStore — το κατώτερο στρώμα κατάστασης
 * @see docs/centralized-systems/reference/adrs/ADR-721
 */

import type { SceneModel } from '../../types/scene';
import type { SceneWriteOrigin } from '../../hooks/scene/scene-write-origin';
import { getSceneForLevel } from '../scene/SceneStore';

type SceneWriter = (levelId: string, scene: SceneModel, origin?: SceneWriteOrigin) => void;

let activeLevelId: string | null = null;
let sceneWriter: SceneWriter | null = null;

/**
 * Καταχώρηση από το `LevelsSystem` (ο ΜΟΝΟΣ γραφέας). Καλείται σε effect ώστε το
 * `levelId` και ο writer να μένουν συγχρονισμένοι με το mounted provider.
 *
 * Το `levelId: null` (καμία ενεργή σκηνή) είναι έγκυρη κατάσταση, όχι σφάλμα.
 */
export function registerActiveDocument(levelId: string | null, writer: SceneWriter): void {
  activeLevelId = levelId;
  sceneWriter = writer;
}

/** Αποσύνδεση κατά το unmount του provider — αποτρέπει γραφή σε νεκρό δέντρο. */
export function unregisterActiveDocument(): void {
  activeLevelId = null;
  sceneWriter = null;
}

/** Το id του ενεργού level, ή `null`. Ασφαλές από οποιοδήποτε context. */
export function getActiveLevelId(): string | null {
  return activeLevelId;
}

/** Η σκηνή του ενεργού level, ή `null`. */
export function getActiveScene(): SceneModel | null {
  return activeLevelId ? getSceneForLevel(activeLevelId) : null;
}

/**
 * Εκτελεί μια read-modify-write πάνω στο ενεργό έγγραφο, μέσα από τον auto-save-aware writer.
 *
 * @param mutate Καθαρή συνάρτηση: παίρνει την τρέχουσα σκηνή, επιστρέφει τη νέα — ή `null`
 *   αν δεν χρειάζεται αλλαγή (τότε **δεν** γίνεται καμία εγγραφή, άρα κανένα auto-save).
 * @param origin Προέλευση για την πύλη auto-save· `'local-edit'` (η προεπιλογή του writer)
 *   είναι το σωστό για ενέργειες χρήστη.
 * @returns `true` αν έγινε εγγραφή· `false` αν δεν υπάρχει ενεργό έγγραφο **ή** αν το
 *   `mutate` επέστρεψε `null`. Ο caller πρέπει να διακρίνει τις δύο περιπτώσεις αν τον
 *   ενδιαφέρει — για τις περισσότερες, «δεν άλλαξε τίποτα» είναι αρκετό.
 */
export function withActiveDocument(
  mutate: (scene: SceneModel) => SceneModel | null,
  origin?: SceneWriteOrigin,
): boolean {
  if (!activeLevelId || !sceneWriter) return false;
  const current = getSceneForLevel(activeLevelId);
  if (!current) return false;
  const next = mutate(current);
  if (!next || next === current) return false;
  sceneWriter(activeLevelId, next, origin);
  return true;
}

/** Test-only reset — καθαρίζει την καταχώρηση χωρίς να απαιτεί provider. */
export function __resetActiveDocumentForTesting(): void {
  activeLevelId = null;
  sceneWriter = null;
}
