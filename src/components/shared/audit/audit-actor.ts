/**
 * 📜 Ο **δράστης** μιας εγγραφής ιστορικού, στη γλώσσα αυτού που κοιτάζει — ADR-195
 *
 * 🔑 Η μηχανή δεν έχει όνομα· έχει **ταυτότητα** (`system`, `system:address-position`). Ο γραφέας
 * αποθηκεύει δίπλα της ένα στιγμιότυπο («System») που είναι αναγκαστικά σε **μία** γλώσσα — το
 * ίδιο διπλό κανάλι με τις ετικέτες πεδίων (`audit-field-descriptor.ts`): **λύνε ζωντανά από την
 * ταυτότητα, πέσε στο στιγμιότυπο μόνο όταν δεν ξέρεις**. Έτσι μεταφράζονται και οι εγγραφές που
 * γράφτηκαν πριν υπάρξει αυτό το αρχείο.
 *
 * ⚠️ Ο άνθρωπος **δεν** μεταφράζεται: το `performedByName` του είναι το όνομά του.
 *
 * @module components/shared/audit/audit-actor
 */

import { SYSTEM_IDENTITY, isSystemActorId } from '@/config/domain-constants';
import { translated, type Translate } from './audit-field-descriptor';

/** Το γενικό όνομα της μηχανής — και η πτώση κάθε διεργασίας χωρίς δικό της. */
const SYSTEM_ACTOR_KEY = 'audit.actors.system';

/** Διεργασίες της μηχανής με δικό τους όνομα: ο άνθρωπος θέλει να ξέρει **ποια** μηχανή. */
const SYSTEM_ACTOR_KEYS: Readonly<Record<string, string>> = {
  [SYSTEM_IDENTITY.ADDRESS_POSITION_ID]: 'audit.actors.addressPosition',
  [SYSTEM_IDENTITY.INGESTION_ID]: 'audit.actors.ingestion',
};

export interface ResolveActorNameParams {
  readonly performedBy: string;
  /** Το όνομα όπως **γράφτηκε τότε** — για άνθρωπο η αλήθεια, για μηχανή στιγμιότυπο. */
  readonly performedByName: string | null;
  readonly translate: Translate;
}

/** Το όνομα του δράστη για την οθόνη· `null` ⇒ δεν υπάρχει τίποτα να ειπωθεί. */
export function resolveActorName({
  performedBy,
  performedByName,
  translate,
}: ResolveActorNameParams): string | null {
  if (!isSystemActorId(performedBy)) return performedByName;
  const processKey = SYSTEM_ACTOR_KEYS[performedBy];
  return (
    (processKey ? translated(translate, processKey) : undefined) ??
    translated(translate, SYSTEM_ACTOR_KEY) ??
    performedByName
  );
}
