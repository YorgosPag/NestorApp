/**
 * @fileoverview **Η θέση του ΠΕΑ στον κατάλογο τύπων εγγράφου** (ADR-777 §8.96) — προβολή, όχι αντίγραφο.
 * @related `./entries-studies.ts` (η ΜΙΑ γραμμή `study-energy-certificate`) · `./entries-property-dossier.ts` (η όψη
 *   του φακέλου που ήδη την προσφέρει) · `hooks/energy-certificate/useEnergyCertificateImportPorts.ts`
 * @module config/upload-entry-points/energy-certificate-slot
 *
 * 🔑 Η εισαγωγή ΠΕΑ ανεβάζει το αρχείο **με την ταυτότητα του καταλόγου** — ίδιο `domain`/`category`/`purpose` με όποιον
 * το ανεβάζει από την καρτέλα «Έγγραφα». Έτσι είναι **ένα** έγγραφο: ο κατάλογος μεταβίβασης (ADR-901) και ο φάκελος
 * το αναγνωρίζουν ως ΠΕΑ, όποιος δρόμος κι αν το έφερε. Τα τρία πεδία **διαβάζονται** από τη γραμμή, δεν ξαναγράφονται.
 */

import { STUDY_ENTRIES } from './entries-studies';
import type { UploadEntryPoint } from './types';

export const ENERGY_CERTIFICATE_ENTRY_ID = 'study-energy-certificate';

export type EnergyCertificateSlot = Pick<UploadEntryPoint, 'domain' | 'category' | 'purpose'>;

/** Η ταυτότητα του ΠΕΑ στο σύστημα αρχείων — `null` μόνο αν χαθεί η γραμμή από τον κατάλογο (το φυλάει test). */
export function energyCertificateSlot(): EnergyCertificateSlot | null {
  const entry = STUDY_ENTRIES.find((candidate) => candidate.id === ENERGY_CERTIFICATE_ENTRY_ID);
  return entry === undefined ? null : { domain: entry.domain, category: entry.category, purpose: entry.purpose };
}
