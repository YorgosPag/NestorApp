/**
 * @fileoverview **Η ταυτότητα της μηχανής αντικειμενικής αξίας** — ποια έκδοση του κανόνα παρήγαγε ένα αποτέλεσμα (ADR-947 Δ3).
 * @related `compute-objective-value.ts` (η μηχανή) · `objective-value-tables.ts` (οι πίνακες του νόμου) ·
 *   `objective-value-snapshot.ts` (ο καταναλωτής: το στιγμιότυπο τη γράφει, η απόκλιση τη συγκρίνει)
 * @module lib/objective-value/objective-value-engine-version
 *
 * 🔑 **Δύο ταυτότητες, όχι μία**:
 *   - `OBJECTIVE_VALUE_ENGINE_VERSION`: **ανθρώπινη** δήλωση («αλλαγή νόμου ή κανόνα»), αυξάνεται με το χέρι, μαζί με
 *     γραμμή στο changelog του ADR-898.
 *   - **αποτύπωμα πινάκων**: sha256 του κανονικού JSON **όλων** των συντελεστών του νόμου, παράγεται, δεν δηλώνεται.
 *   Η άγκυρα (`objective-value-engine-version.test.ts`) καρφώνει το ζεύγος: αλλαγή αριθμού σε πίνακα **χωρίς** νέα
 *   έκδοση ⇒ κόκκινο. Η χειρόγραφη έκδοση δεν μπορεί έτσι να ξεχαστεί σιωπηλά.
 *
 * ⚠️ Το αποτύπωμα καλύπτει τους **πίνακες**, όχι τη λογική των συναρτήσεων: αλλαγή κανόνα σε κώδικα (π.χ. νέο όριο
 *    ορόφου) θέλει **πάντα** νέα έκδοση με το χέρι. Αυτό το κενό το λέει το ADR-947 §Φ2, δεν το κρύβει.
 */

import { canonicalJson } from '@/lib/legal/canonical-json';
import { sha256HexOfText } from '@/lib/hash/sha256';

import * as OBJECTIVE_VALUE_TABLES from './objective-value-tables';

/** Η έκδοση του κανόνα· `ΠΟΛ.1149/1994` όπως κωδικοποιήθηκε έως την ΥΑ 138311 ΕΞ 2024 (ADR-898). */
export const OBJECTIVE_VALUE_ENGINE_VERSION = '2024.1';

/** Η ταυτότητα της μηχανής που γράφεται σε κάθε στιγμιότυπο. */
export interface ObjectiveValueEngineIdentity {
  readonly version: string;
  /** sha256 (hex) του κανονικού JSON των πινάκων του νόμου. */
  readonly tablesSha256: string;
}

let cached: Promise<ObjectiveValueEngineIdentity> | null = null;

/** **Η ταυτότητα της τρέχουσας μηχανής** — υπολογίζεται μία φορά ανά διεργασία (καθαρά δεδομένα, δεν αλλάζουν). */
export function objectiveValueEngineIdentity(): Promise<ObjectiveValueEngineIdentity> {
  cached ??= sha256HexOfText(canonicalJson(OBJECTIVE_VALUE_TABLES)).then((tablesSha256) => ({
    version: OBJECTIVE_VALUE_ENGINE_VERSION,
    tablesSha256,
  }));
  return cached;
}
