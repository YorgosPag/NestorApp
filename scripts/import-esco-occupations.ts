/**
 * ============================================================================
 * ΕΙΣΑΓΩΓΗ ΕΠΑΓΓΕΛΜΑΤΩΝ ESCO (ADR-132 · ADR-798 §20.4)
 * ============================================================================
 *
 * Κατεβάζει **όλα** τα ESCO occupations και τα γράφει στο
 * `system/esco_cache/occupations`.
 *
 * Χρήση:
 *   npm run import:esco:occupations
 *   npm run import:esco:occupations -- --allow-partial   (εν γνώσει σου, μερικό)
 *
 * ⚠️ **ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ ΕΙΝΑΙ ΔΗΛΩΣΗ, ΟΧΙ ΜΗΧΑΝΗ.** Ο κύκλος
 * *(συγκομιδή → πύλη fail-closed → γραφή → λογιστική)* ζει στο
 * `scripts/lib/esco/`, κοινός με την εισαγωγή δεξιοτήτων. Μέχρι τις 2026-08-26
 * τα δύο σενάρια ήταν **δίδυμα** και κουβαλούσαν το **ίδιο** ελάττωμα σε δύο
 * αντίγραφα. ⛔ Μην αντιγράψεις αυτό το αρχείο για τρίτο λεξιλόγιο — πρόσθεσε
 * δηλωτικό, όχι μηχανή.
 *
 * Προϋποθέσεις:
 * - Firebase Admin: `serviceAccountKey.json` ή `gcloud auth application-default login`
 * - Πρόσβαση στο δημόσιο ESCO API (χωρίς κλειδί)
 *
 * @see https://ec.europa.eu/esco/api/doc/esco_api_doc.html
 */

import { runEscoImport } from './lib/esco/esco-import-runner';
import { transformOccupations } from './lib/esco/esco-occupation-document';
import type { EscoOccupationDocument } from '../src/types/contacts/esco-types';

const OCCUPATIONS_SCHEME = 'http://data.europa.eu/esco/concept-scheme/occupations';

void runEscoImport<EscoOccupationDocument>({
  title: 'Εισαγωγή επαγγελμάτων ESCO (ADR-132)',
  conceptType: 'occupation',
  scheme: OCCUPATIONS_SCHEME,
  collection: 'system/esco_cache/occupations',
  uriPrefix: 'http://data.europa.eu/esco/occupation/',
  noun: 'επαγγέλματα',
  transform: transformOccupations,
  uriOf: (document) => document.uri,
}).then((exitCode) => {
  process.exitCode = exitCode;
});
