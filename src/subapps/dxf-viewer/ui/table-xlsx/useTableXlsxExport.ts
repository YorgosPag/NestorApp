'use client';

/**
 * 🔴 ADR-833 Φάση 6 — **«Αποθήκευση ως .xlsx»**: ο πίνακας φεύγει, με ΟΛΑ του τα φύλλα.
 *
 * ## Γιατί δικός του hook και όχι τρίτη μέθοδος στο {@link useTableXlsxImport}
 * Δεν είναι διαχωρισμός για την τάξη: οι δύο εντολές εισαγωγής μοιράζονται **πραγματικά** ένα
 * κρυφό `<input type="file">` και μια ref πρόθεσης, και ο λόγος ύπαρξης εκείνου του hook είναι
 * ακριβώς αυτό. Η εξαγωγή **δεν αγγίζει τίποτα από τα δύο**: δεν ανοίγει επιλογέα, δεν διαβάζει
 * αρχείο, δεν εκτελεί εντολή, δεν αγγίζει τη σκηνή. Χωμένη εκεί, θα κουβαλούσε τρεις
 * εξαρτήσεις που δεν την αφορούν (`levelManager`, `execute`, `sceneUnits`) — δηλαδή θα ήταν το
 * σχήμα «μια κλάση, δύο λόγοι να αλλάξει».
 *
 * ## 🔴 ΤΟ ΣΤΥΛ ΔΙΑΒΑΖΕΤΑΙ ΤΗ ΣΤΙΓΜΗ ΤΟΥ ΠΑΤΗΜΑΤΟΣ, ΟΧΙ ΣΕ RENDER
 * Ο κανόνας #2 του ADR-040: ο πίνακας **και** το στυλ του ρωτιούνται με getter όταν πέφτει το
 * κλικ. Ένα στιγμιότυπο κλεισμένο σε render θα εξήγαγε το στυλ που ίσχυε **πριν** την τελευταία
 * αλλαγή στο μητρώο — και η εξαγωγή είναι ακριβώς η στιγμή που ο χρήστης μόλις τελείωσε τη
 * μορφοποίηση.
 *
 * @module subapps/dxf-viewer/ui/table-xlsx/useTableXlsxExport
 * @see bim/table/export/table-to-xlsx.ts — η πόρτα Β της μηχανής (§5.7.1)
 */

import { useCallback } from 'react';
import { nowISO } from '@/lib/date-local';
import { downloadTableAsXlsx } from '../../bim/table/export/table-to-xlsx';
import { resolveTableStyle } from '../../bim/table/table-entity-geometry';
import { resolveWorksheets } from '../../bim/table/table-worksheet-resolve';
import type { TableEntity } from '../../types/table-entity';

/**
 * Το πρόθεμα του ονόματος αρχείου — **σταθερά ASCII, όχι κείμενο διεπαφής**.
 *
 * Ίδια σύμβαση με το `bim-schedule` του ADR-363: ένα όνομα αρχείου ταξιδεύει σε λειτουργικά
 * συστήματα, σε συνημμένα και σε ονόματα φακέλων, οπότε **δεν** μεταφράζεται (θα πάγωνε τη
 * γλώσσα του εξαγωγέα μέσα στο παραδοτέο) και **δεν** είναι παράβαση του N.11: δεν το διαβάζει
 * κανείς ως μήνυμα.
 */
const FILENAME_PREFIX = 'nestor-table';

export interface UseTableXlsxExportParams {
  /** Ο επιλεγμένος πίνακας **τη στιγμή του πατήματος** — `null` ⇒ καμία πράξη. */
  readonly getSelectedTable: () => TableEntity | null;
}

export interface TableXlsxExport {
  readonly onExportRequested: () => Promise<void>;
}

export function useTableXlsxExport(params: UseTableXlsxExportParams): TableXlsxExport {
  const { getSelectedTable } = params;

  const onExportRequested = useCallback(async (): Promise<void> => {
    const entity = getSelectedTable();
    if (!entity) return;
    // Ο ΕΝΑΣ αναγνώστης φύλλων (`table-worksheet-resolve`) και ο ΕΝΑΣ επιλυτής στυλ: ένας
    // πίνακας που δείχνει σε σβησμένο στυλ εξάγεται με το ενεργό, ποτέ άδειος.
    await downloadTableAsXlsx(
      resolveWorksheets(entity),
      resolveTableStyle(entity),
      `${FILENAME_PREFIX}-${nowISO().slice(0, 10)}`,
    );
  }, [getSelectedTable]);

  return { onExportRequested };
}
