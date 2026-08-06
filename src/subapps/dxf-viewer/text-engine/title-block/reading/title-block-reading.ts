/**
 * @fileoverview Λ1 — DXF κελιά ⇒ `TitleBlockReading[]`. Καθαρή συνάρτηση, **μηδέν I/O**.
 *
 * Η σύνθεση των τεσσάρων βημάτων που έχουν ήδη αποδειχθεί χωριστά:
 *
 * ```
 *   κελιά ─▶ ομαδοποίηση σε πινακίδες ─▶ ζευγάρωμα ετικέτα→τιμή ─▶ πρόσωπα ─▶ Reading
 * ```
 *
 * 🔴 Επιστρέφει **πίνακα**. Το ADR περιέγραφε ένα `TitleBlockReading` ανά layer· η μέτρηση
 * στο `G753_ergasia F.dxf` έδειξε **δύο** πινακίδες στο ίδιο layer (§2.3 Παγίδα Δ). Ένα
 * αποτέλεσμα θα σήμαινε είτε σιωπηλή απώλεια της μιας είτε ανάμειξη των δύο.
 *
 * Ο Λ1 **δεν γνωρίζει τη βάση** (ADR-745 §5.3): δεν ψάχνει επαφές, δεν γράφει τίποτα, δεν
 * αποφασίζει ταυτότητες. Παράγει προτάσεις που ο Λ2 θα φέρει σε άνθρωπο για έγκριση.
 *
 * @see ADR-745 §5.1 — η πινακίδα δεν είναι ποτέ SSoT
 */

import { mtextToSegments } from './mtext-segments';
import { groupIntoTitleBlocks } from './title-block-grouping';
import { extractPeople } from './title-block-people';
import { pairTitleBlockCells } from './title-block-pairing';
import type { TitleBlockReading, TitleBlockSourceCell } from './title-block-reading.types';
import { GREEK_SURVEYOR_PROFILE, type TitleBlockProfile } from './title-block-vocabulary';

/** Περίγραμμα από τα σημεία εισαγωγής — βλ. `TitleBlockReading.bbox` για το γιατί όχι μελάνι. */
function boundsOf(cells: readonly TitleBlockSourceCell[]): TitleBlockReading['bbox'] {
  const xs = cells.map((c) => c.x);
  const ys = cells.map((c) => c.y);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}

/** Μία πινακίδα: ζευγάρωμα, μετά πρόσωπα από το κελί που κέρδισε το `designers`. */
function readOneTitleBlock(
  layerName: string,
  cells: readonly TitleBlockSourceCell[],
  profile: TitleBlockProfile,
): TitleBlockReading {
  const paired = pairTitleBlockCells(cells, profile);
  const designers = paired.valueCellOf.get('designers');
  const read = designers
    // Ο κωδ. 40 του **κελιού** είναι η μονάδα των απόλυτων `\H` (ADR-745 Φ3β): χωρίς αυτόν η
    // τυπογραφική ιεραρχία μετριέται σε δύο μονάδες ταυτόχρονα και η κατάταξη αντιστρέφεται.
    ? extractPeople(mtextToSegments(designers.cell.raw, designers.cell.height), profile)
    : { people: [], unparsed: [] };

  return {
    layerName,
    bbox: boundsOf(cells),
    fields: paired.fields,
    people: read.people,
    // Η πινακίδα **έχει** αυτές τις ετικέτες τυπωμένες — η απουσία τιμής είναι γεγονός, όχι
    // σιωπή (ADR-762 §5). Δεν είναι πεδία, άρα ο Λ2 δεν μπορεί να γράψει κενό από αυτές.
    unmatchedLabels: paired.unmatchedLabels.map((slot) => ({
      key: slot.key,
      labelHandle: slot.cell.handle,
      at: { x: slot.cell.x, y: slot.cell.y },
    })),
    // Πρώτα τα ορφανά κελιά, μετά ό,τι δεν διαβάστηκε μέσα στο κελί μελετητών.
    unparsed: [...paired.orphanValues.map((v) => v.plain), ...read.unparsed],
  };
}

/**
 * Διαβάζει όλες τις πινακίδες ενός layer.
 *
 * Το `profile` είναι δεδομένα, όχι κώδικας: άλλο τοπογραφικό γραφείο ⇒ άλλο προφίλ, ίδια
 * συνάρτηση (ADR-745 §12 — μετριασμός της ευθραυστότητας απέναντι σε ξένες διατάξεις).
 */
export function readTitleBlocks(
  layerName: string,
  cells: readonly TitleBlockSourceCell[],
  profile: TitleBlockProfile = GREEK_SURVEYOR_PROFILE,
): TitleBlockReading[] {
  return groupIntoTitleBlocks(cells).map((group) => readOneTitleBlock(layerName, group, profile));
}
