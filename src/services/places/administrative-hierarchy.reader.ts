import 'server-only';

/**
 * @fileoverview **Η ΔΙΟΙΚΗΤΙΚΗ ΙΕΡΑΡΧΙΑ, ΔΙΑΒΑΣΜΕΝΗ ΑΠΟ ΤΟΝ ΔΙΑΚΟΜΙΣΤΗ** — η εγκυρότητα
 * μιας δηλωμένης περιοχής δεν έρχεται ποτέ από το σύρμα.
 * @related ADR-846 · ADR-772 · services/esco/occupation-classification.reader
 * @module services/places/administrative-hierarchy.reader
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΘΕΡΑΠΕΥΕΙ — Η ΙΔΙΑ ΚΛΑΣΗ ΜΕ ΤΟ «ΣΩΣΤΟ ΦΙΛΤΡΟ, ΨΕΥΤΙΚΗ ΚΑΡΤΑ»
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Χωρίς αυτόν τον αναγνώστη, ένας πελάτης θα μπορούσε να στείλει
 * `coverage.adminIds = ['municipality:ΟΤΙΔΗΠΟΤΕ']` — ταυτότητα που **δεν υπάρχει**.
 * Δεν θα έσκαγε τίποτα: ο κριτής θα απαντούσε `disjoint` για κάθε ερώτημα, και η
 * βιτρίνα θα κουβαλούσε **μια δήλωση που δεν σημαίνει τίποτα**, δείχνοντας στον
 * επαγγελματία *«δήλωσα περιοχή»* ενώ **κανείς δεν μπορεί να τον βρει από αυτήν**.
 * Σιωπηλή αποτυχία, ακριβώς όπως το `escoUri` με ξένη ετικέτα.
 *
 * ⚠️ **Και ο ΙΔΙΟΣ αναγνώστης κάνει την κανονικοποίηση** *(απορρόφηση απογόνων)*: η
 * πράξη χρειάζεται **ακριβώς** την ίδια γνώση, και δεύτερη φόρτωση των 4,1 MB για την
 * ίδια ερώτηση θα ήταν το σχήμα που το N.18 ονομάζει.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ `fs`, ΚΑΙ ΟΧΙ `import … from '@/data/…'`
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ένα στατικό `import` θα έδενε **4,1 MB** μέσα στο bundle **κάθε** διαδρομής που
 * αγγίζει έστω και έμμεσα αυτό το module — δηλαδή θα πλήρωνε ο κρύος χρόνος εκκίνησης
 * διαδρομών που **ποτέ** δεν ρωτούν για περιοχές. Με `fs` + module cache, το κόστος
 * πληρώνεται **μία φορά, από όποιον το ζήτησε**.
 *
 * ⚠️ Διαβάζεται το **δημόσιο** αντίγραφο *(`public/data/`)* — το ίδιο αρχείο που
 * κατεβάζει ο περιηγητής. **Μία αυθεντία για τα δύο μονοπάτια**: αν αποκλίνανε, ο
 * επαγγελματίας θα δήλωνε περιοχή που ο διακομιστής θα απέρριπτε ως ανύπαρκτη.
 *
 * ⚠️ **Ο ΜΗΧΑΝΙΣΜΟΣ ΔΕΝ ΓΡΑΦΕΤΑΙ ΠΛΕΟΝ ΕΔΩ** *(ADR-846 §9 #13)*: το cache +
 * single-flight + «η αποτυχία δεν κλειδώνει τη διεργασία» **εξήχθη** στο
 * `lib/data/server-json-file.ts`, όταν η ίδια φάση χρειάστηκε **δεύτερο** αναγνώστη
 * *(τα αποτυπώματα)*. Γραμμένος με το χέρι, θα ήταν sibling clone του **N.18** — με
 * τις τέσσερις αποφάσεις να **αποκλίνουν σιωπηλά**.
 */

import { createServerJsonFile } from '@/lib/data/server-json-file';
import type { LineageResolver } from '@/lib/agency/coverage-match';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('administrative-hierarchy.reader');

/** Ό,τι χρειάζεται από κάθε εγγραφή — **δύο** πεδία, όχι οκτώ. */
interface RawEntity {
  readonly id: string;
  readonly p: string | null;
}

/** Το cache ζει όσο η διεργασία. Η ιεραρχία αλλάζει με διοικητική μεταρρύθμιση. */
const HIERARCHY_FILE = createServerJsonFile<ReadonlyMap<string, string | null>>({
  publicPath: ['data', 'administrative-hierarchy.json'],
  build: (payload) => {
    const parsed = payload as { data?: unknown };
    // 🔑 **Ο έλεγχος σχήματος προστέθηκε με την εξαγωγή**: πριν, ένα μισογραμμένο
    //    αρχείο περνούσε το `JSON.parse` και έσκαγε ως `not iterable` **αλλού**.
    if (!Array.isArray(parsed.data)) {
      throw new TypeError('Η διοικητική ιεραρχία δεν έχει το αναμενόμενο σχήμα');
    }
    const parents = new Map<string, string | null>();
    for (const entity of parsed.data as readonly RawEntity[]) parents.set(entity.id, entity.p);
    return parents;
  },
  onFailure: (error) => {
    // ⚠️ **«Δεν μπόρεσα να ρωτήσω» ≠ «δεν υπάρχει»** (N.12). Ο καλών παίρνει `null`
    //    και απαντά *«ξαναδοκίμασε»* (503), ποτέ *«διόρθωσε την επιλογή σου»* (422).
    logger.error('Δεν διαβάστηκε η διοικητική ιεραρχία', {
      error: error instanceof Error ? error.message : String(error),
    });
  },
});

/**
 * **Ο επιλυτής γενεαλογίας, από τη μεριά του διακομιστή** — ίδια σύμβαση με το
 * `lineageIdsOf` του περιηγητή: **με τον εαυτό πρώτο**, κενός πίνακας = «δεν ξέρω».
 *
 * @returns `null` **μόνο** όταν η ιεραρχία δεν διαβάστηκε — βλάβη **δική μας**.
 */
export async function readAdministrativeLineage(): Promise<LineageResolver | null> {
  const parents = await HIERARCHY_FILE.read();
  if (!parents) return null;

  return (entityId: string): readonly string[] => {
    if (!parents.has(entityId)) return [];
    const lineage: string[] = [];
    let current: string | null = entityId;
    // 🔒 Ίδιος φρουρός κύκλου με τον περιηγητή: βάθος 8, όριο 16.
    let guard = 16;
    while (current !== null && guard-- > 0) {
      lineage.push(current);
      current = parents.get(current) ?? null;
    }
    return lineage;
  };
}
