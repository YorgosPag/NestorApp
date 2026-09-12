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
import { buildAdminNameIndex, type AdminPlace } from '@/lib/places/admin-name-index';
import type { AdminIdentitySources } from '@/lib/places/admin-identity';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('administrative-hierarchy.reader');

/**
 * Ό,τι χρειάζεται από κάθε εγγραφή — **τέσσερα** πεδία, όχι οκτώ.
 *
 * ⚠️ **Ήταν δύο** *(`id` + `p`)*, όσα ζητούσε η γενεαλογία. Το `n`/`l` προστέθηκαν για την
 * **ταυτοποίηση από την ετικέτα** (ADR-332 D27 Φάση Β′): ο κριτής ρωτά *«ποιος τόπος αυτής
 * της βαθμίδας λέγεται έτσι;»*, και χωρίς όνομα και βαθμίδα η ερώτηση δεν έχει υποκείμενο.
 * **Δεύτερη φόρτωση των 3,7 MB για το ίδιο αρχείο θα ήταν το σχήμα που ονομάζει ο N.18** —
 * γι' αυτό μεγάλωσε **αυτή** η δομή αντί να προστεθεί δεύτερος αναγνώστης.
 */
interface RawEntity {
  readonly id: string;
  readonly p: string | null;
  readonly n: string;
  readonly l: number;
  readonly pc?: string;
}

/**
 * Τα ευρετήρια που χτίζονται από **ένα** πέρασμα.
 *
 * ⚠️ **Το `nameIndex` χτίζεται ΕΔΩ, όχι στον καλούντα, και είναι μέτρηση όχι γούστο**: το
 * `build` τρέχει **μία φορά ανά διεργασία** *(module cache + single-flight του
 * `server-json-file`)*, ενώ ο καλών είναι **κάθε** αντίστροφη γεωκωδικοποίηση. Χτισμένο
 * στον καλούντα, θα ήταν ένα πέρασμα 20.720 οντοτήτων **ανά σύρσιμο πινέζας**.
 */
interface HierarchyIndexes {
  readonly parents: ReadonlyMap<string, string | null>;
  readonly places: ReadonlyMap<string, AdminPlace>;
  readonly nameIndex: ReturnType<typeof buildAdminNameIndex>;
}

/** Το cache ζει όσο η διεργασία. Η ιεραρχία αλλάζει με διοικητική μεταρρύθμιση. */
const HIERARCHY_FILE = createServerJsonFile<HierarchyIndexes>({
  publicPath: ['data', 'administrative-hierarchy.json'],
  build: (payload) => {
    const parsed = payload as { data?: unknown };
    // 🔑 **Ο έλεγχος σχήματος προστέθηκε με την εξαγωγή**: πριν, ένα μισογραμμένο
    //    αρχείο περνούσε το `JSON.parse` και έσκαγε ως `not iterable` **αλλού**.
    if (!Array.isArray(parsed.data)) {
      throw new TypeError('Η διοικητική ιεραρχία δεν έχει το αναμενόμενο σχήμα');
    }
    const parents = new Map<string, string | null>();
    const places = new Map<string, AdminPlace>();
    for (const entity of parsed.data as readonly RawEntity[]) {
      parents.set(entity.id, entity.p);
      places.set(entity.id, {
        id: entity.id,
        name: entity.n,
        level: entity.l,
        parentId: entity.p,
        ...(entity.pc ? { postalCode: entity.pc } : {}),
      });
    }
    return { parents, places, nameIndex: buildAdminNameIndex(places.values()) };
  },
  onFailure: (error) => {
    // ⚠️ **«Δεν μπόρεσα να ρωτήσω» ≠ «δεν υπάρχει»** (N.12). Ο καλών παίρνει `null`
    //    και απαντά *«ξαναδοκίμασε»* (503), ποτέ *«διόρθωσε την επιλογή σου»* (422).
    logger.error('Δεν διαβάστηκε η διοικητική ιεραρχία', {
      error: error instanceof Error ? error.message : String(error),
    });
  },
});

/** Η γενεαλογία πάνω σε **δεδομένο** χάρτη γονέων — ένας ορισμός, δύο καταναλωτές. */
function lineageOver(parents: ReadonlyMap<string, string | null>): LineageResolver {
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

/**
 * **Ο επιλυτής γενεαλογίας, από τη μεριά του διακομιστή** — ίδια σύμβαση με το
 * `lineageIdsOf` του περιηγητή: **με τον εαυτό πρώτο**, κενός πίνακας = «δεν ξέρω».
 *
 * @returns `null` **μόνο** όταν η ιεραρχία δεν διαβάστηκε — βλάβη **δική μας**.
 */
export async function readAdministrativeLineage(): Promise<LineageResolver | null> {
  const indexes = await HIERARCHY_FILE.read();
  if (!indexes) return null;
  return lineageOver(indexes.parents);
}

/**
 * **Οι τρεις αναγνώστες που ζητά ο κριτής ταυτότητας**, από τη μεριά του διακομιστή.
 *
 * 🔑 **Εδώ είναι το σημείο όπου η ταυτοποίηση έχει νόημα** (ADR-332 D27 Φάση Β′): το
 * `api/geocoding/reverse` κρατά την **ωμή** διοικητική αλυσίδα του Nominatim — με τα
 * προθέματα ακέραια, δηλαδή **με τη βαθμίδα δηλωμένη**. Ο πελάτης δεν τη βλέπει ποτέ
 * *(το `cleanPlaceName` τη σβήνει)*, και ούτε χρειάζεται να κατεβάσει **0,75 MB** για να
 * ξαναρωτήσει αυτό που ο διακομιστής ήξερε ήδη.
 *
 * @returns `null` **μόνο** όταν η ιεραρχία δεν διαβάστηκε — ο καλών οφείλει να μη γράψει
 *   **τίποτα** στην ιεραρχία, ποτέ να μην ερμηνεύσει το κενό ως «δεν υπάρχει».
 */
export async function readAdminIdentitySources(): Promise<AdminIdentitySources | null> {
  const indexes = await HIERARCHY_FILE.read();
  if (!indexes) return null;

  return {
    index: indexes.nameIndex,
    placeOf: (id: string) => indexes.places.get(id),
    lineageOf: lineageOver(indexes.parents),
  };
}
