/**
 * **Η θέση λύνεται ΠΡΙΝ τη γραφή** — ο ΕΝΑΣ γραφέας διευθύνσεων έργου, για δημιουργία ΚΑΙ ενημέρωση.
 *
 * 🔴 Μέχρι σήμερα ο επεξεργαστής διευθύνσεων γεωκωδικοποιούσε **για την οθόνη** και
 * πετούσε την απάντηση: το `coordinates` γραφόταν **μόνο** αν ο άνθρωπος έσερνε την
 * πινέζα, και το `geocodingMetadata` **ποτέ** (μετρημένο: 12 αναγνώστες, 0 γραφείς).
 * Άρα μια πλήρης διεύθυνση κατέληγε σε αγγελία `never-asked` — σιωπηλά.
 *
 * ⚠️ **Ο διακομιστής και όχι ο περιηγητής**, με τρεις λόγους: (α) η απάντηση είναι
 * **μία** για όλους αντί για μία ανά καρτέλα· (β) η πολιτική **1 αιτήματος/δευτ.** του
 * Nominatim είναι επιβλητή μόνο κεντρικά· (γ) το ίδιο μονοπάτι λύνει ήδη τη θέση για
 * τον προβολέα. Είναι και η πρακτική του Revit: η γεωκωδικοποίηση είναι **πράξη του
 * χρήστη**, εδώ η αποθήκευση, ποτέ παρενέργεια ανοίγματος.
 *
 * 🔑 **Γιατί ζει εδώ και όχι στο `[projectId]/project-mutations.service`** (2026-10-04):
 * το «Fill then Create» στέλνει πλέον τις διευθύνσεις του πρόχειρου **μαζί** με τη
 * δημιουργία. Ο χειριστής δημιουργίας έγραφε το σώμα **ωμό** — χωρίς γραφέα θέσης και
 * χωρίς κάτοπτρο `address`/`city`. Δύο διαδρομές γραφής, **ένας** γραφέας.
 *
 * @module app/api/projects/_shared/project-address-write
 * @see ADR-332 D27 · ADR-777 Α5
 */

import 'server-only';

import { createModuleLogger } from '@/lib/telemetry';
import {
  resolveProjectAddressPositions,
  type ProjectAddressLike,
} from '@/services/listings/address-place-writeback';
import type { AddressPositionDrift } from '@/lib/geocoding/address-position';
import { extractLegacyFields } from '@/types/project/address-helpers';

const logger = createModuleLogger('ProjectAddressWrite');

/**
 * Αντικαθιστά **επί τόπου** τα `addresses` του σώματος με ό,τι θα γραφτεί (θέση λυμένη) και
 * παράγει το κάτοπτρο `address`/`city`. Σώμα χωρίς `addresses` μένει ανέγγιχτο.
 *
 * @param storedProjectData Το αποθηκευμένο έργο· `undefined` στη **δημιουργία** (τίποτα αποθηκευμένο
 *   ⇒ κάθε διεύθυνση είναι «νέα» για τον γραφέα θέσης).
 * @returns Οι κρατημένες ανθρώπινες πινέζες που απέχουν από τη νέα τους διεύθυνση (Φ2β).
 */
export async function resolveAddressesForWrite(
  body: Record<string, unknown>,
  storedProjectData: Record<string, unknown> | undefined,
): Promise<readonly AddressPositionDrift[]> {
  // ADR-332 D27 Βήμα Β (Φ2β): η δήλωση μετακίνησης είναι ΑΙΤΗΜΑ, όχι πεδίο του έργου —
  // φεύγει από το σώμα ΠΡΙΝ τη γραφή, αλλιώς θα γραφόταν στο έγγραφο.
  const relocateIds = new Set(
    Array.isArray(body['relocateAddressIds']) ? (body['relocateAddressIds'] as string[]) : [],
  );
  delete body['relocateAddressIds'];
  if (!Array.isArray(body['addresses'])) return [];

  const stored = Array.isArray(storedProjectData?.['addresses'])
    ? (storedProjectData['addresses'] as ProjectAddressLike[])
    : [];

  const { addresses, tally, drifts } = await resolveProjectAddressPositions(
    stored,
    body['addresses'] as ProjectAddressLike[],
    Date.now(),
    { relocateIds },
  );

  body['addresses'] = addresses;
  // ADR-332 D27 Β11: το κάτοπτρο παράγεται από ό,τι ΓΡΑΦΕΤΑΙ — ό,τι έστειλε ο πελάτης αγνοείται
  // (το έφτιαχνε από τη γραφή πριν το `trim` του συνόρου).
  Object.assign(body, extractLegacyFields(addresses));
  // Η λογιστική τυπώνεται **πάντα**, ακόμη και όταν κάθε κάδος είναι μηδέν: ένα «0»
  // που δεν τυπώνεται διαβάζεται ως «δεν υπάρχει τέτοιος έλεγχος».
  logger.info('[Projects/AddressWrite] Θέσεις διευθύνσεων', { ...tally, drifts: drifts.length });
  return drifts;
}
