'use client';

/**
 * @fileoverview 🏆 **ΙΣΧΥΕΙ ΑΚΟΜΑ ΤΟ ΜΟΝΤΕΛΟ ΠΟΥ ΔΗΜΟΣΙΕΥΣΑ;** — ο **ΕΝΑΣ** αναγνώστης (Ο-25).
 * @related ADR-845 §7.13 · lib/listings/model-source-revisions · services/file-record-queries
 * @module hooks/listings/usePublishedModelFreshness
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΓΕΓΟΝΟΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο κάτοχος κοίταξε τη **δική του** αγγελία, είδε παλιό μοντέλο, και **χρειάστηκε να ρωτήσει
 * άνθρωπο**. Το σύστημα ήξερε **και τους δύο** αριθμούς και δεν είπε κανέναν.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΕΝΑΣ ΚΑΝΟΝΑΣ, **ΔΥΟ ΟΘΟΝΕΣ** — απόφαση Giorgio, 2026-09-09
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Τη ρωτούν **ο viewer** *(εκεί που γίνεται η δουλειά και εκεί που θα ξαναδημοσιεύσει)* **και
 * η καρτέλα του ακινήτου** *(εκεί που βλέπει την αγγελία ως σύνολο)*. Το γραμμένο σκεπτικό του
 * `orderedPublishableAgencyMedia` ισχύει αυτούσιο: *«δύο `filter` σε δύο αρχεία θα ήταν δύο
 * απαντήσεις ελεύθερες να αποκλίνουν — και η απόκλιση θα ήταν **αόρατη**»*.
 *
 * ⛔ **Η ΚΡΙΣΗ ΔΕΝ ΖΕΙ ΕΔΩ.** Το *«ισχύει;»* το απαντά το `modelFreshness`, καθαρή συνάρτηση
 * χωρίς I/O. Αυτό το hook είναι **μεταφορά δεδομένων**: διαβάζει, δίνει, ξεχνά. Μια σύγκριση
 * revisions εδώ θα ήταν δεύτερη διατύπωση του κανόνα, σε μέρος όπου **καμία δοκιμή δεν την
 * εκτελεί χωρίς βάση**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⚠️ ΔΥΟ ΑΝΑΓΝΩΣΕΙΣ, ΚΑΙ Η ΔΕΥΤΕΡΗ ΕΙΝΑΙ **ΜΙΑ** ΓΙΑ ΟΛΑ ΤΑ ΜΟΝΤΕΛΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * 1. τα **μοντέλα** του ακινήτου *(`getFilesByEntity` με `category: 'models'`)*
 * 2. τα **σχέδια** που τα παρήγαγαν — ένα πέρασμα, χωρίς διπλότυπα *(`sourceFileIdsOf`)*
 *
 * 🔑 Δύο μοντέλα του ίδιου ακινήτου *(`as-built` + `proposal` — ο πληθυντικός που κρατά το
 * Ο-27)* μοιράζονται συνήθως **τα ίδια** σχέδια· ένα ερώτημα ανά μοντέλο θα πλήρωνε τις ίδιες
 * αναγνώσεις δύο φορές.
 *
 * ⚠️ **Δεν πετά ποτέ**: αποτυχία ⇒ `unknown` για όλα. Ίδιο συμβόλαιο με τον
 * `readPublishedAgencyMedia` — μια ένδειξη που δεν φορτώθηκε **δεν** επιτρέπεται να ρίξει την
 * οθόνη στην οποία κάθεται.
 */

import * as React from 'react';

import { FILE_CATEGORIES } from '@/config/domain-constants';
import {
  FRESHNESS_UNKNOWN,
  modelFreshness,
  sourceFileIdsOf,
  type ModelFreshness,
} from '@/lib/listings/model-source-revisions';
import { FileRecordService } from '@/services/file-record.service';
import { createModuleLogger } from '@/lib/telemetry';
import type { FileRecord } from '@/types/file-record';

const logger = createModuleLogger('usePublishedModelFreshness');

/** Ένα δημοσιευμένο μοντέλο, με την ετυμηγορία του. */
export interface PublishedModelState {
  readonly fileId: string;
  readonly freshness: ModelFreshness;
}

export interface PublishedModelFreshness {
  readonly models: readonly PublishedModelState[];
  readonly loading: boolean;
  /**
   * 🔑 **Η μία ερώτηση που ρωτούν και οι δύο οθόνες.**
   *
   * ⚠️ **`some`, όχι «όλα»**: αν **έστω ένα** δημοσιευμένο μοντέλο είναι μπαγιάτικο, ο κόσμος
   * βλέπει κάτι που δεν ισχύει. Ένα «όλα» θα σιωπούσε ακριβώς όταν το μισό είναι λάθος.
   */
  readonly hasStale: boolean;
}

const IDLE: PublishedModelFreshness = { models: [], loading: false, hasStale: false };

export function usePublishedModelFreshness(
  propertyId: string | null | undefined,
  companyId: string | null | undefined,
  options?: { readonly enabled?: boolean },
): PublishedModelFreshness {
  const enabled = options?.enabled !== false && Boolean(propertyId) && Boolean(companyId);
  const [state, setState] = React.useState<PublishedModelFreshness>(IDLE);

  React.useEffect(() => {
    if (!enabled || !propertyId || !companyId) {
      setState(IDLE);
      return;
    }

    // ⚠️ **Ακύρωση, όχι μόνο καθαρισμός**: ο άνθρωπος αλλάζει ακίνητο πιο γρήγορα από το
    //    δίκτυο, και μια αργοπορημένη απάντηση θα έγραφε την ετυμηγορία **άλλου** ακινήτου
    //    πάνω στην τρέχουσα οθόνη — σιωπηλά.
    let alive = true;
    setState((previous) => ({ ...previous, loading: true }));

    void readFreshness(propertyId, companyId)
      .then((models) => {
        if (alive) setState({ models, loading: false, hasStale: models.some(isStale) });
      });

    return () => { alive = false; };
  }, [enabled, propertyId, companyId]);

  return state;
}

/** ⚠️ Ονομασμένο, ώστε το *«τι μετράει ως μπαγιάτικο»* να μη γραφτεί δεύτερη φορά inline. */
function isStale(model: PublishedModelState): boolean {
  return model.freshness.state === 'stale';
}

/**
 * **Οι δύο αναγνώσεις** — και **καμία** κρίση.
 *
 * ⛔ Χωριστό σώμα από το hook: το `useEffect` δεν επιτρέπεται να είναι `async`, και μια
 * ενσωματωμένη `async` έκφραση θα έκρυβε τη σειρά των δύο αναγνώσεων μέσα σε φωλιά.
 */
async function readFreshness(
  propertyId: string,
  companyId: string,
): Promise<readonly PublishedModelState[]> {
  try {
    const models = await FileRecordService.getFilesByEntity('property', propertyId, {
      companyId,
      category: FILE_CATEGORIES.MODELS,
    });

    const active = models.filter((file) => file.isDeleted !== true);
    if (active.length === 0) return [];

    const current = await readCurrentRevisions(
      sourceFileIdsOf(active.map((file) => file.sourceRevisions)),
      companyId,
    );

    return active.map((file) => ({
      fileId: file.id,
      freshness: modelFreshness(file.sourceRevisions, current),
    }));
  } catch (error) {
    logger.warn('Η φρεσκάδα των μοντέλων δεν διαβάστηκε — η οθόνη λέει «δεν ξέρω»', {
      propertyId, error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * **Σε ποια έκδοση είναι ΤΩΡΑ τα σχέδια** — ένα ερώτημα, όχι ένα ανά αρχείο.
 *
 * 🔑 **`queryFileRecords` με `documentId` δεν υπάρχει στο συμβόλαιο του πελάτη**, οπότε τα
 * σχέδια διαβάζονται **ανά ταυτοποιητικό**. Είναι μονοψήφιο πλήθος *(ένα ανά όροφο του
 * εύρους)* και τρέχουν **παράλληλα**: ο κύριος όγκος είναι η καθυστέρηση, όχι το πλήθος.
 *
 * ⚠️ **Αρχείο που δεν διαβάζεται απλώς λείπει από τον χάρτη** — και το `modelFreshness` το
 * διαβάζει ως **μπαγιάτικο**, ποτέ ως «δεν άλλαξε». Fail-closed προς την ένδειξη.
 */
async function readCurrentRevisions(
  fileIds: readonly string[],
  companyId: string,
): Promise<ReadonlyMap<string, number>> {
  if (fileIds.length === 0) return new Map();

  const settled = await Promise.allSettled(
    fileIds.map((id) => FileRecordService.getFileRecord(id)),
  );

  const current = new Map<string, number>();
  for (const outcome of settled) {
    if (outcome.status !== 'fulfilled') continue;
    const record: FileRecord | null = outcome.value;
    // ⚠️ **Η κηδεμονία ελέγχεται και εδώ**, όπως στη γραφή: ένα αρχείο άλλης εταιρείας δεν
    //    επιτρέπεται να απαντήσει «ισχύει» για δικό μας μοντέλο.
    if (record === null || record.companyId !== companyId) continue;
    if (typeof record.revision === 'number') current.set(record.id, record.revision);
  }

  return current;
}
