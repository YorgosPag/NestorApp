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
import type { EntityAuditEntry } from '@/types/audit-trail';
import { translated, type Translate } from './audit-field-descriptor';

/** Το γενικό όνομα της μηχανής — και η πτώση κάθε διεργασίας χωρίς δικό της. */
const SYSTEM_ACTOR_KEY = 'audit.actors.system';

/** Διεργασίες της μηχανής με δικό τους όνομα: ο άνθρωπος θέλει να ξέρει **ποια** μηχανή. */
const SYSTEM_ACTOR_KEYS: Readonly<Record<string, string>> = {
  [SYSTEM_IDENTITY.ADDRESS_POSITION_ID]: 'audit.actors.addressPosition',
  [SYSTEM_IDENTITY.INGESTION_ID]: 'audit.actors.ingestion',
  [SYSTEM_IDENTITY.FLOOR_STACK_ID]: 'audit.actors.floorStack',
  [SYSTEM_IDENTITY.FLOOR_REF_ID]: 'audit.actors.floorRef',
};

/**
 * **Η αιτία** μιας παράγωγης εγγραφής, σε μία φράση — `null` όταν η εγγραφή είναι άμεση πράξη.
 *
 * 🔑 Εκτελεστής (η μηχανή, `resolveActorName`) και εμπνευστής (ο άνθρωπος, εδώ) λέγονται **χωριστά**:
 * «από Σύστημα · στοίβα ορόφων — λόγω αλλαγής από Γιώργο στο «1ος Όροφος»».
 *
 * ⚠️ Η οντότητα της αιτίας **δεν** αναφέρεται όταν είναι η ίδια με της γραμμής: θα ήταν πλεονασμός.
 */
export function resolveCauseText(
  entry: Pick<EntityAuditEntry, 'cause' | 'entityType' | 'entityId'>,
  translate: TranslateWithParams,
): string | null {
  const { cause } = entry;
  if (!cause) return null;
  const name = cause.initiatedByName;
  const sameEntity = cause.entityType === entry.entityType && cause.entityId === entry.entityId;
  const entity = sameEntity ? null : cause.entityName;
  const key = causeKey(name !== null, entity !== null);
  if (!key) return null;
  const text = translate(key, { name: name ?? '', entity: entity ?? '' });
  return typeof text === 'string' && text !== '' && text !== key ? text : null;
}

/** Μεταφραστής με παραμέτρους — το `t` του `useTranslation`. */
type TranslateWithParams = (key: string, params?: Record<string, string>) => unknown;

function causeKey(hasName: boolean, hasEntity: boolean): string | null {
  if (hasName && hasEntity) return 'audit.cause.byUserOnEntity';
  if (hasName) return 'audit.cause.byUser';
  return hasEntity ? 'audit.cause.onEntity' : null;
}

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
