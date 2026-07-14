/**
 * ADR-650 M8β/Β — PointCloud3DStore: το ΝΕΦΟΣ που ζει στην 3Δ όψη.
 *
 * Ο δίδυμος του `terrain-3d-store` (ίδιο pattern, ίδιος ρόλος: DISPLAY state, ποτέ survey data) —
 * με μία διαφορά που πρέπει να ειπωθεί ρητά: αυτός ο store κρατά **δεδομένα**, όχι μόνο flags.
 *
 * ΓΙΑΤΙ: το `PointCloudPreview` γεννιέται μέσα στον wizard και σήμερα πεθαίνει μαζί του (React
 * state). Για να δει η 3Δ όψη το νέφος πρέπει το preview να ΕΠΙΒΙΩΣΕΙ του wizard — κάπου έξω από
 * το React. Αυτό είναι το «κάπου».
 *
 * 🚨 ADR-650 §6 — ΤΟ ΝΕΦΟΣ ΕΙΝΑΙ VISUALIZATION, ΠΟΤΕ ΓΕΩΜΕΤΡΙΑ ΜΕΤΡΗΣΗΣ. Δεν αγγίζει τον
 * `TopoPointStore`, δεν μπαίνει στο TIN, δεν γίνεται snap/raycast πάνω του. Η μετρήσιμη γεωμετρία
 * είναι ΜΟΝΟ το αραιωμένο σύνολο εδάφους (voxel decimation) που ήδη πάει στον `TopoPointStore`.
 * Το νέφος υπάρχει για να ΒΛΕΠΕΙ ο μηχανικός τι κράτησε και τι πέταξε το φίλτρο, πριν εγκρίνει —
 * ReCap / CloudCompare / Potree parity (§9 human-certifier).
 *
 * ⚠️ ΜΝΗΜΗ — συνειδητή απόφαση, όχι παράπλευρη απώλεια:
 *   `PREVIEW_MAX_POINTS` (2M) × (3 θέσεις + 3 χρώματα) floats × 4 B = **48 MB** στο χειρότερο
 *   σενάριο (24 MB θέσεις + 24 MB χρώματα), και άλλα τόσα ως GPU buffers όταν το layer είναι
 *   ορατό. Είναι ένα bounded, γνωστό ταβάνι — αλλά ΔΕΝ το κρατάμε σιωπηλά για πάντα: ο μηχανικός
 *   έχει ρητό «Αφαίρεση νέφους» (`clearPointCloud3D`) που ελευθερώνει και τη heap και το GPU
 *   buffer. Ένα νέο import αντικαθιστά πάντα το προηγούμενο νέφος (ένα νέφος τη φορά — δεν
 *   συσσωρεύεται).
 *
 * Pattern: vanilla `createExternalStore` (ADR-040) — μηδέν React state· το 3Δ layer κάνει
 * imperative subscribe, το panel `useSyncExternalStore` (LOW-freq consumer).
 */

import { createExternalStore } from '../../stores/createExternalStore';
import type { PointCloudPreview } from './pointcloud/pointcloud-types';

export interface PointCloud3DState {
  /** Το display-only νέφος του τελευταίου import, ή `null` όταν δεν υπάρχει/αφαιρέθηκε. */
  readonly preview: PointCloudPreview | null;
  /** Ζωγραφίζεται στην 3Δ όψη; */
  readonly visible: boolean;
}

const INITIAL: PointCloud3DState = { preview: null, visible: false };

const store = createExternalStore<PointCloud3DState>(INITIAL);

/** Πλήρες snapshot (ασφαλές ως `useSyncExternalStore` getSnapshot — σταθερό όσο δεν αλλάζει). */
export function getPointCloud3DState(): PointCloud3DState {
  return store.get();
}

/**
 * Δημοσίευσε το νέφος του import (ή `null` για κανένα).
 *
 * Ένα φρέσκο νέφος γίνεται ΟΡΑΤΟ αμέσως: αυτός είναι όλος ο λόγος ύπαρξής του — ο μηχανικός μόλις
 * έτρεξε το φίλτρο εδάφους και πρέπει να ΔΕΙ τι κράτησε/πέταξε πριν το εγκρίνει (§9). Το `null`
 * σβήνει και τη σημαία, ώστε ένα επόμενο import από άλλο δρόμο (CSV/DXF) να μην αφήνει ορφανό
 * «ορατό» νέφος που ανήκει σε ΑΛΛΗ αποτύπωση.
 */
export function setPointCloud3D(preview: PointCloudPreview | null): void {
  store.set({ preview, visible: preview !== null });
}

/** Δείξε / κρύψε το νέφος. Τα δεδομένα μένουν — για να τα ελευθερώσεις, `clearPointCloud3D`. */
export function setPointCloud3DVisible(visible: boolean): void {
  const current = store.get();
  if (current.visible === visible) return;
  store.set({ ...current, visible });
}

/** Πέτα το νέφος (heap + GPU buffers, μέσω του layer dispose). Η αποτύπωση δεν αγγίζεται. */
export function clearPointCloud3D(): void {
  if (store.get().preview === null) return;
  setPointCloud3D(null);
}

/** Subscribe στις αλλαγές· επιστρέφει unsubscribe. */
export function subscribePointCloud3D(listener: () => void): () => void {
  return store.subscribe(listener);
}
