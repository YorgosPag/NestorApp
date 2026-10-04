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
import { COLLECTIONS } from '@/config/firestore-collections';
import { ENTITY_TYPES } from '@/config/domain-constants';
import {
  republishProjectListings,
  resolveAddressPositionsWithinDeadline,
  type ProjectAddressLike,
} from '@/services/listings/address-place-writeback';
import { scheduleAddressPositionCompletion } from '@/services/listings/address-position-completion-schedule';
import type { AddressPositionDrift } from '@/lib/geocoding/address-position';
import { extractLegacyFields } from '@/types/project/address-helpers';
import { invalidateProjectCaches } from './project-cache';

const logger = createModuleLogger('ProjectAddressWrite');

/** Τι έκρινε ο γραφέας θέσης για μια αποθήκευση έργου. */
export interface ProjectAddressWriteOutcome {
  /** Κρατημένες ανθρώπινες πινέζες που απέχουν από τη νέα τους διεύθυνση (Φ2β). */
  readonly advisories: readonly AddressPositionDrift[];
  /**
   * Διευθύνσεις που **γράφτηκαν χωρίς νέα θέση** επειδή η προθεσμία έληξε πριν απαντήσει ο πάροχος
   * (ADR-332 D29). Δεν είναι «άλυτες»: η μηχανή συνεχίζει, και η θέση γράφεται μετά την απάντηση
   * — δες {@link scheduleProjectAddressCompletion}.
   */
  readonly pendingIds: readonly string[];
  /**
   * Όσες από τις εκκρεμείς ήταν ρητή **«μετακίνησε την πινέζα»**. Η δήλωση είναι αίτημα και δεν
   * αποθηκεύεται· αν δεν ταξιδέψει ως την ολοκλήρωση, η μετακίνηση που έληξε **δεν γίνεται ποτέ**.
   */
  readonly pendingRelocateIds: readonly string[];
}

const NOTHING_RESOLVED: ProjectAddressWriteOutcome = { advisories: [], pendingIds: [], pendingRelocateIds: [] };

/**
 * Αντικαθιστά **επί τόπου** τα `addresses` του σώματος με ό,τι θα γραφτεί (θέση λυμένη) και
 * παράγει το κάτοπτρο `address`/`city`. Σώμα χωρίς `addresses` μένει ανέγγιχτο.
 *
 * @param storedProjectData Το αποθηκευμένο έργο· `undefined` στη **δημιουργία** (τίποτα αποθηκευμένο
 *   ⇒ κάθε διεύθυνση είναι «νέα» για τον γραφέα θέσης).
 * @returns Οι αποκλίσεις των κρατημένων πινεζών **και** οι διευθύνσεις που έμειναν εκκρεμείς.
 */
export async function resolveAddressesForWrite(
  body: Record<string, unknown>,
  storedProjectData: Record<string, unknown> | undefined,
): Promise<ProjectAddressWriteOutcome> {
  // ADR-332 D27 Βήμα Β (Φ2β): η δήλωση μετακίνησης είναι ΑΙΤΗΜΑ, όχι πεδίο του έργου —
  // φεύγει από το σώμα ΠΡΙΝ τη γραφή, αλλιώς θα γραφόταν στο έγγραφο.
  const relocateIds = new Set(
    Array.isArray(body['relocateAddressIds']) ? (body['relocateAddressIds'] as string[]) : [],
  );
  delete body['relocateAddressIds'];
  if (!Array.isArray(body['addresses'])) return NOTHING_RESOLVED;

  const stored = Array.isArray(storedProjectData?.['addresses'])
    ? (storedProjectData['addresses'] as ProjectAddressLike[])
    : [];

  // ADR-332 D29 — **μία προθεσμία για όλη την επίλυση**, η ίδια με των επαφών και των κτιρίων (ο ένας
  // βοηθός). Χωρίς αυτήν μια διεύθυνση που δεν λύνεται κρατούσε την «Αποθήκευση» **8,4″** (μετρημένο
  // ζωντανά, 2026-10-04).
  const { addresses, tally, drifts, pendingIds } = await resolveAddressPositionsWithinDeadline(
    stored,
    body['addresses'] as ProjectAddressLike[],
    relocateIds,
  );

  body['addresses'] = addresses;
  // ADR-332 D27 Β11: το κάτοπτρο παράγεται από ό,τι ΓΡΑΦΕΤΑΙ — ό,τι έστειλε ο πελάτης αγνοείται
  // (το έφτιαχνε από τη γραφή πριν το `trim` του συνόρου).
  Object.assign(body, extractLegacyFields(addresses));
  // Η λογιστική τυπώνεται **πάντα**, ακόμη και όταν κάθε κάδος είναι μηδέν: ένα «0»
  // που δεν τυπώνεται διαβάζεται ως «δεν υπάρχει τέτοιος έλεγχος».
  logger.info('[Projects/AddressWrite] Θέσεις διευθύνσεων', {
    ...tally,
    drifts: drifts.length,
    pending: pendingIds.length,
  });
  return {
    advisories: drifts,
    pendingIds,
    pendingRelocateIds: pendingIds.filter((id) => relocateIds.has(id)),
  };
}

/**
 * **Η ΘΕΣΗ ΠΟΥ ΔΕΝ ΠΡΟΛΑΒΕ, ΟΛΟΚΛΗΡΩΝΕΤΑΙ ΜΕΤΑ ΤΗΝ ΑΠΑΝΤΗΣΗ** (ADR-332 D29) — ώστε ο άνθρωπος να
 * μην περιμένει τον πάροχο. Καμία εκκρεμότητα ⇒ καμία εργασία.
 *
 * 🔑 Η αγγελία διαβάζει τη θέση από το **έργο** (ADR-777 Α1): όταν η ολοκλήρωση γράψει έστω μία
 * θέση, οι αγγελίες του έργου ξαναπροβάλλονται — αλλιώς θα έμεναν χωρίς σημείο, σιωπηλά.
 */
export function scheduleProjectAddressCompletion(
  projectId: string,
  companyId: Parameters<typeof invalidateProjectCaches>[0],
  outcome: Pick<ProjectAddressWriteOutcome, 'pendingIds' | 'pendingRelocateIds'>,
): void {
  scheduleAddressPositionCompletion(
    {
      collection: COLLECTIONS.PROJECTS,
      docId: projectId,
      entityType: ENTITY_TYPES.PROJECT,
      pendingIds: outcome.pendingIds,
      relocateIds: outcome.pendingRelocateIds,
    },
    async (adminDb) => {
      invalidateProjectCaches(companyId);
      await republishProjectListings(adminDb, projectId);
    },
  );
}
