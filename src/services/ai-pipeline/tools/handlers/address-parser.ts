/**
 * GREEK ADDRESS PARSER — Parse address strings into structured AddressInfo
 * @module services/ai-pipeline/tools/handlers/address-parser
 * @see ADR-171 (Autonomous AI Agent)
 */

import { extractPostalCode, splitStreetAndNumber } from '@/utils/address/address-parse';
import type { AddressInfo } from '@/types/contacts/contracts';

/** Label → AddressInfo.type mapping (SSoT) */
export const ADDRESS_LABEL_MAP: Record<string, AddressInfo['type']> = {
  'σπίτι': 'home', 'home': 'home', 'κατοικία': 'home',
  'εργασία': 'work', 'work': 'work', 'γραφείο': 'work', 'δουλειά': 'work',
  'αποστολή': 'shipping', 'shipping': 'shipping',
  'χρέωση': 'billing', 'billing': 'billing',
};

/**
 * Parse a Greek address string into structured AddressInfo fields.
 * Handles patterns like: "Τσιμισκή 42, Θεσσαλονίκη 54623"
 * or "Λ. Κηφισίας 120, Αθήνα, 11526"
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 Η ΓΡΑΜΜΑΤΙΚΗ ΖΕΙ ΑΛΛΟΥ — ΕΔΩ ΜΕΝΕΙ ΜΟΝΟ Η ΠΑΡΑΔΟΧΗ ΤΟΥ ΤΟΜΕΑ (2026-09-02)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο **μηχανισμός** (πότε ένα λεκτικό είναι αριθμός, πώς βρίσκεται ο Τ.Κ., πού κόβεται
 * η οδός) μετακόμισε στο `utils/address/address-parse` — ήταν γραμμένος **τρεις
 * φορές**, και το regex αυτού του αρχείου ήταν **κατά λέξη** ίδιο με εκείνο του
 * `api/contacts/resolve`. Ό,τι διορθωνόταν εδώ («8-10», «25ης Μαρτίου 12») έμενε
 * χαλασμένο εκεί.
 *
 * ⚠️ **Η ΠΑΡΑΔΟΧΗ ΟΜΩΣ ΜΕΝΕΙ, ΚΑΙ ΕΙΝΑΙ ΔΙΚΗ ΤΟΥ ΤΟΜΕΑ**: εδώ το πρώτο τμήμα
 * θεωρείται **οδός ακόμη και χωρίς αριθμό** («Ερμού, Αθήνα» → οδός Ερμού). Ο κεντρικός
 * αναλυτής **αρνείται** αυτή τη μαντεψιά, επίτηδες: εκεί το κείμενο έρχεται από
 * **αναζήτηση** ανθρώπου, όπου «Σαμοθράκης» μπορεί κάλλιστα να είναι τοπωνύμιο και μια
 * λάθος απόφαση παράγει **σημείο που μοιάζει σωστό**. Εδώ το κείμενο έχει **ήδη
 * αναγνωριστεί ως διεύθυνση** από τον αγωγό, και το ρίσκο είναι άλλο.
 *
 * 🔑 Ίδια αρχή με τον `overpass-client`: **ο μεταφορέας κεντρικός, η ερώτηση του
 * καλούντος.** Κεντρικοποίηση της παραδοχής θα ήταν λάθος κεντρικοποίηση.
 */
export function parseGreekAddress(
  raw: string
): Pick<AddressInfo, 'street' | 'number' | 'city' | 'postalCode' | 'country'> {
  const { postalCode, remainder } = extractPostalCode(raw);
  const segments = remainder
    .split(',')
    .map((segment) => segment.trim())
    .filter((segment) => segment !== '');

  const { street, number } = splitStreetAndNumber(segments[0] ?? '');

  return {
    street: segments.length > 0 ? street : '',
    number: number ?? '',
    city: segments[1] ?? '',
    postalCode: postalCode ?? '',
    country: 'GR',
  };
}
