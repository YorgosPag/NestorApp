/**
 * @fileoverview **Αποτυπώματα έκδοσης ρήτρας** (ADR-928 §5.2.2 · §5.6) — canonical JSON + sha256.
 * @module subapps/procurement/subcontracts/clauses/clause-content-hash
 *
 * Επαναχρήση, όχι δεύτερη υλοποίηση: `canonicalJson` του ADR-861 (`lib/legal/canonical-json`) και `sha256HexOfText`
 * (`lib/hash/sha256`, Web Crypto — ίδιο αποτέλεσμα σε διακομιστή και browser).
 *
 * - `contentHash` = σώμα **+** παράμετροι: ό,τι δεσμεύει νομικά ένα συμφωνητικό που καρφώνει την έκδοση.
 * - `sourceHash` = **μόνο** το ελληνικό σώμα: ό,τι μεταφράζει μια μετάφραση. Αλλάζει ⇒ η μετάφραση παύει δομικά να
 *   είναι εγκεκριμένη.
 */

import { sha256HexOfText } from '@/lib/hash/sha256';
import { canonicalJson } from '@/lib/legal/canonical-json';
import type { ClauseBody } from '../types/clause';
import type { ClauseParameterDefinition } from '../types/clause-parameter';

export function clauseContentHash(body: ClauseBody, parameters: readonly ClauseParameterDefinition[]): Promise<string> {
  return sha256HexOfText(canonicalJson({ body, parameters }));
}

export function clauseSourceHash(body: ClauseBody): Promise<string> {
  return sha256HexOfText(canonicalJson(body));
}
