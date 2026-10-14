/**
 * @fileoverview **Το λεξιλόγιο της εισαγωγής ΠΕΑ** (ADR-777 §8.96) — τι απαντά ο server, ως καθαρό module, ώστε να το
 * διαβάζουν και η διαδρομή και η οθόνη χωρίς η οθόνη να αγγίξει αρχείο `server-only`.
 * @related `services/energy-certificate/energy-certificate-import.service.ts` (ο παραγωγός) ·
 *   `hooks/energy-certificate/useEnergyCertificateImport.ts` (ο καταναλωτής)
 * @module lib/energy-certificate/pea-import-outcome
 */

import { CONTAINER_FILE_REFUSALS } from '@/lib/files/container-file-verdict';

import type { PeaProposal } from './pea-proposal';

/** Οι αρνήσεις με όνομα: «αυτό το αρχείο δεν διαβάζεται έτσι» — η επανάληψη δεν θα βοηθήσει. */
export const PEA_IMPORT_REFUSALS = [...CONTAINER_FILE_REFUSALS, 'file-too-large', 'not-a-certificate'] as const;
export type PeaImportRefusal = (typeof PEA_IMPORT_REFUSALS)[number];

export type PeaImportOutcome =
  | { readonly kind: 'proposal'; readonly proposal: PeaProposal }
  | { readonly kind: 'refused'; readonly reason: PeaImportRefusal };

export function isPeaImportRefusal(raw: unknown): raw is PeaImportRefusal {
  return PEA_IMPORT_REFUSALS.some((refusal) => refusal === raw);
}

/** Ό,τι διαφέρει ανά κάτοχο: πού ανεβαίνει το αρχείο και ποια διαδρομή το διαβάζει. */
export interface EnergyCertificateImportPort {
  /** Ανεβάζει στα «Έγγραφα» του ακινήτου και επιστρέφει το `fileId`. Πετά σε αποτυχία. */
  readonly upload: (file: File) => Promise<string>;
  readonly endpoint: string;
}

/** Τι γίνεται μετά την «Εφαρμογή»: η φόρμα του γραφείου θέλει «Αποθήκευση»· ο ιδιώτης αποθηκεύει αμέσως. */
export type EnergyCertificateImportCommit = 'form-save' | 'immediate';
