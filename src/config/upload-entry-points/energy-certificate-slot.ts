/**
 * @fileoverview **Οι θέσεις του ΠΕΑ και της ΜΕΑ στον κατάλογο τύπων εγγράφου** (ADR-777 §8.96 · §8.102) — προβολή, όχι
 * αντίγραφο.
 * @related `./entries-studies.ts` (οι ΜΙΑ γραμμές `study-energy-certificate` · `study-energy-mea`) ·
 *   `./entries-property-dossier.ts` (η όψη του φακέλου που ήδη τις προσφέρει) ·
 *   `hooks/energy-certificate/useEnergyCertificateImportPorts.ts` · `server/energy-certificate/energy-certificate-file-scope.ts`
 * @module config/upload-entry-points/energy-certificate-slot
 *
 * 🔑 Η εισαγωγή ΠΕΑ ανεβάζει το αρχείο **με την ταυτότητα του καταλόγου** — ίδιο `domain`/`category`/`purpose` με όποιον
 * το ανεβάζει από την καρτέλα «Έγγραφα». Έτσι είναι **ένα** έγγραφο: ο κατάλογος μεταβίβασης (ADR-901) και ο φάκελος
 * το αναγνωρίζουν ως ΠΕΑ, όποιος δρόμος κι αν το έφερε. Τα τρία πεδία **διαβάζονται** από τη γραμμή, δεν ξαναγράφονται.
 *
 * 🔑 **Η ΜΕΑ με τον ίδιο τρόπο** (§8.102): η εκτίμηση ακινήτου υπό κατασκευή παραπέμπει σε αρχείο **αυτού** του τύπου
 * στα έγγραφα του έργου — και ο server το ελέγχει με το **ίδιο** `purpose`, όχι με δεύτερο γραμμένο string.
 */

import { STUDY_ENTRIES } from './entries-studies';
import type { UploadEntryPoint } from './types';

export const ENERGY_CERTIFICATE_ENTRY_ID = 'study-energy-certificate';

/** Η γραμμή της Μελέτης Ενεργειακής Απόδοσης (ΜΕΑ / ΚΕΝΑΚ) — η πηγή της εκτίμησης για ακίνητο υπό κατασκευή. */
export const ENERGY_STUDY_ENTRY_ID = 'study-energy-mea';

export type EnergyCertificateSlot = Pick<UploadEntryPoint, 'domain' | 'category' | 'purpose'>;

/** Η ταυτότητα μιας γραμμής του καταλόγου μελετών — `null` μόνο αν χαθεί η γραμμή (το φυλάει test). */
function studySlotOf(entryId: string): EnergyCertificateSlot | null {
  const entry = STUDY_ENTRIES.find((candidate) => candidate.id === entryId);
  return entry === undefined ? null : { domain: entry.domain, category: entry.category, purpose: entry.purpose };
}

/** Η ταυτότητα του ΠΕΑ στο σύστημα αρχείων. */
export function energyCertificateSlot(): EnergyCertificateSlot | null {
  return studySlotOf(ENERGY_CERTIFICATE_ENTRY_ID);
}

/** Η ταυτότητα της ΜΕΑ στο σύστημα αρχείων (§8.102). */
export function energyStudySlot(): EnergyCertificateSlot | null {
  return studySlotOf(ENERGY_STUDY_ENTRY_ID);
}
