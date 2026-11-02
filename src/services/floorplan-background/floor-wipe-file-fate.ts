/**
 * ⚖️ **Τι γίνεται με κάθε εγγραφή `files` ενός ορόφου που αντικαθίσταται** (ADR-340 · ADR-899 §2.2.1 · ADR-864 §21).
 *
 * Το wipe **δεν** σβήνει αρχεία μόνο του: είναι μία ακόμη πόρτα της ΜΙΑΣ αγωγού οριστικής διαγραφής.
 *
 * | τύχη | πότε | τι κάνει το wipe |
 * |---|---|---|
 * | `held` | `isFileHeld` — δέσμευση · ενεργή διατήρηση · record | **τίποτα** — μένει όπως είναι, μετριέται (το μοτίβο `CASCADE_PRESERVATION` του `deletion-guard`) |
 * | `settled` | ήδη στον κάδο (`isInTrash`) ή `purged` | **τίποτα** — δεύτερος κάδος δεν ξαναγράφει `purgeAt` (ADR-866 §2.6.11 Β3) και το επιτύμβιο μένει |
 * | `trash` | όλα τα άλλα | `fileTrashFields` με `purgeAt = τώρα` ⇒ το cron περνά τον ίδιο κριτή και τον ΕΝΑ γραφέα (`purgeFileRecord`) |
 *
 * 🔑 **Γιατί το κρατημένο ΔΕΝ πάει καν στον κάδο** (ενώ ο απλός χρήστης μπορεί να πετάξει αρχείο σε σιωπηλή δέσμευση):
 * το wipe είναι **μαζική πράξη συστήματος** πριν από νέο ανέβασμα, όχι απόφαση ανθρώπου για το συγκεκριμένο αρχείο· και το
 * cron **παραλείπει** χωρίς να βγάζει από την ουρά — κάθε κρατημένο με `purgeAt` περασμένο ξαναδιαβάζεται κάθε μέρα μέσα
 * στο `limit(100)`. Ό,τι κρατείται μένει εκεί που ήταν (Google Vault: *«the file isn't purged»* · Purview: record ⇒
 * *«Delete: Blocked»*), και ο άνθρωπος το μαθαίνει από τον αριθμό της προεπισκόπησης.
 *
 * ⚠️ Η σειρά είναι συμβόλαιο: **πρώτα** η δέσμευση. Κρατημένο που είναι ήδη στον κάδο μετριέται `held` — ο άνθρωπος πρέπει
 * να μάθει ότι κάτι του ορόφου δεν θα σβηστεί, όπου κι αν βρίσκεται.
 *
 * @module services/floorplan-background/floor-wipe-file-fate
 */

import 'server-only';

import { FILE_LIFECYCLE_STATES } from '@/config/domain-constants';
import { isInTrash } from '@/lib/files/file-trash-state';
import { isFileHeld } from '@/services/file-record/file-purge-helpers';
import type { FileRow } from './floor-wipe-queries';

export type FloorFileFate = 'held' | 'settled' | 'trash';

/** Η τύχη μίας εγγραφής — καθαρή, χωρίς βάση. */
export function floorFileFate(data: Readonly<FirebaseFirestore.DocumentData>): FloorFileFate {
  if (isFileHeld(data)) return 'held';
  if (isInTrash(data) || data.lifecycleState === FILE_LIFECYCLE_STATES.PURGED) return 'settled';
  return 'trash';
}

export type FloorFilesByFate = Readonly<Record<FloorFileFate, readonly FileRow[]>>;

/** Οι εγγραφές του ορόφου, μοιρασμένες κατά τύχη — η ΜΙΑ μοιρασιά για προεπισκόπηση **και** wipe. */
export function partitionFloorFiles(rows: readonly FileRow[]): FloorFilesByFate {
  const byFate: Record<FloorFileFate, FileRow[]> = { held: [], settled: [], trash: [] };
  for (const row of rows) byFate[floorFileFate(row.data)].push(row);
  return byFate;
}
