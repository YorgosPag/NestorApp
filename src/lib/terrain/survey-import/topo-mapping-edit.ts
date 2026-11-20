/**
 * @fileoverview **Η αντιστοίχιση στηλών ως ΕΠΕΞΕΡΓΑΣΙΑ** — πρόταση, προσαρμογή πλάτους, ανάθεση ρόλου (ADR-650 M2 · ADR-920 Β4.7).
 * @related ./topo-column-mapping (τι ΣΗΜΑΙΝΕΙ μια αντιστοίχιση) · ./topo-column-sniffer (πρόταση από τα δεδομένα) ·
 *   subapps/dxf-viewer/ui/panels/topography/useTopoImport · hooks/listings/useTerrainSurveyImport (οι δύο οδηγοί)
 * @module lib/terrain/survey-import/topo-mapping-edit
 *
 * Ζούσαν ιδιωτικά μέσα στον οδηγό του viewer· ο δεύτερος οδηγός (η φόρμα του ιδιοκτήτη) χρειάζεται ακριβώς τα ίδια ⇒
 * **μεταφορά**, όχι αντίγραφο: ο μηχανικός και ο ιδιοκτήτης βλέπουν την ίδια πρόταση για το ίδιο αρχείο.
 *
 * Η μία αλλαγή σημασίας: αρχείο **χωρίς** επικεφαλίδα δεν ανοίγει πια ολόκληρο «αγνόησε» — ρωτιέται ο sniffer των
 * δεδομένων, όπως έκανε ήδη ο δρόμος του νέφους (M8β/Δ). Αν δεν βλέπει τρεις στήλες συντεταγμένων, δεν προτείνει
 * τίποτα και η συμπεριφορά μένει η παλιά.
 */

import { suggestMappingFromHeaders } from './topo-column-mapping';
import { sniffMappingFromRows, type SniffBasis } from './topo-column-sniffer';
import type { ColumnMapping, ColumnRole, RawTable } from './topo-import-types';

/**
 * Πόσες γραμμές βλέπει ο sniffer — **κατανεμημένες σε όλο το αρχείο** (ADR-920 §13.10 Α). Οι πρώτες 50 ενός πλέγματος
 * μπορεί να έχουν σταθερό X και Z ⇒ λάθος σειρά. Ένα πέρασμα O(n) ανά υποψήφια στήλη· ο αριθμός είναι εκτίμηση.
 */
const PROPOSAL_SAMPLE_ROWS = 1000;

/** Από πού βγήκε η πρόταση — `headers` = από τις ετικέτες· τα υπόλοιπα από τα δεδομένα (`SniffBasis`). */
export type MappingBasis = 'headers' | SniffBasis;

export interface MappingProposal {
  readonly mapping: ColumnMapping;
  /** `null` = καμία πρόταση (λιγότερες από τρεις αριθμητικές στήλες) — όλα «αγνόησε». */
  readonly basis: MappingBasis | null;
}

/** Τεντώνει/κόβει μια αντιστοίχιση στο πλήθος στηλών του πίνακα· ό,τι λείπει γίνεται «αγνόησε». */
export function padMapping(mapping: ColumnMapping, width: number): ColumnMapping {
  return Array.from({ length: width }, (_, i) => mapping[i] ?? ('ignore' as ColumnRole));
}

/** Πλάτος του πίνακα: η φαρδύτερη από επικεφαλίδα και γραμμές (οι γραμμές μπορεί να είναι ανισομήκεις). */
function widthOf(table: RawTable): number {
  return Math.max(table.headers.length, ...table.rows.map((row) => row.length), 0);
}

/** `count` γραμμές ομοιόμορφα από όλο τον πίνακα (πρώτη και τελευταία μέσα)· όλες, αν είναι λιγότερες. */
function spreadRows<T>(rows: readonly T[], count: number): readonly T[] {
  if (rows.length <= count) return rows;
  if (count <= 1) return rows.slice(0, count);
  const step = (rows.length - 1) / (count - 1);
  return Array.from({ length: count }, (_, i) => rows[Math.round(i * step)]);
}

/** **Η πρώτη πρόταση**: επικεφαλίδες αν υπάρχουν, αλλιώς τα ίδια τα δεδομένα, αλλιώς τίποτα — μαζί με το από πού. */
export function proposeColumnMapping(table: RawTable): MappingProposal {
  const width = widthOf(table);
  if (table.headers.length > 0) {
    return { mapping: padMapping(suggestMappingFromHeaders(table.headers), width), basis: 'headers' };
  }
  const sniffed = sniffMappingFromRows(spreadRows(table.rows, PROPOSAL_SAMPLE_ROWS));
  return { mapping: padMapping(sniffed?.mapping ?? [], width), basis: sniffed?.basis ?? null };
}

/**
 * Ανάθεση ρόλου, αποδεσμεύοντας τη στήλη που τον κρατούσε. Ένας ρόλος έχει ΕΝΑΝ κάτοχο (το X δεν είναι δύο στήλες)·
 * αλλιώς το `isMappingComplete` θα απέρριπτε αντιστοίχιση που ο άνθρωπος πιστεύει ότι μόλις διόρθωσε.
 */
export function assignRole(mapping: ColumnMapping, columnIndex: number, role: ColumnRole): ColumnMapping {
  return mapping.map((current, i) => {
    if (i === columnIndex) return role;
    return role !== 'ignore' && current === role ? 'ignore' : current;
  });
}
