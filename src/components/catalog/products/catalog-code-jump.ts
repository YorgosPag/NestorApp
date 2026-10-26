/**
 * 🏆 **Άλμα σε κωδικό σε ΟΛΟ τον κατάλογο** — όχι μόνο στο φορτωμένο παράθυρο (ADR-923 §5.10.4 Β2).
 *
 * Το Akeneo θέλει Elasticsearch για να βρει «016-15-001» σε 100.000 προϊόντα. Εδώ δεν χρειάζεται ερώτημα καν: οι
 * ταυτότητες είναι **ντετερμινιστικές** (Δ3) και φορητές (`deterministicV4Uuid`):
 * - **μοντέλο** ⇒ id από τον κωδικό (`generateDeterministicCatalogProductModelId`) ⇒ **μία** ανάγνωση εγγράφου;
 * - **SKU** ⇒ η **κράτηση** μοναδικότητας (`catalog_unique_values`, id από χώρο + ιδιότητα + κανονικοποιημένη τιμή —
 *   η **ίδια** `uniqueValueKey` με τον γραφέα: «016–15–001» ≡ « 016-15-001 ») ⇒ κάτοχος.
 *
 * Η κράτηση μπορεί να είναι **μπαγιάτικη** (κάτοχος διαγραμμένος): ο κάτοχος επαληθεύεται ότι **ζει** — όπως το
 * `isLive` του διακομιστή. Ο αναγνώστης εγχέεται ⇒ δοκιμάζεται χωρίς Firestore.
 *
 * @module components/catalog/products/catalog-code-jump
 */

import {
  generateDeterministicCatalogProductModelId,
  generateDeterministicCatalogUniqueValueId,
} from '@/services/enterprise-id-convenience';
import type { AttributeType } from '@/subapps/catalog/vocabulary/attribute-types';
import type { AttributeValue } from '@/subapps/catalog/types/product';
import { parseEnteredAmount } from '@/subapps/catalog/values/decimal-amount';
import { uniqueValueKey } from '@/subapps/catalog/values/normalize-unique';

export type CodeJumpCollection = 'CATALOG_PRODUCT_MODELS' | 'CATALOG_PRODUCTS' | 'CATALOG_UNIQUE_VALUES';
export type CodeJumpReader = (collection: CodeJumpCollection, id: string) => Promise<Readonly<Record<string, unknown>> | null>;

export interface CodeJumpTarget {
  readonly kind: 'productModel' | 'product';
  readonly id: string;
}

export interface UniqueAttributeRef {
  readonly id: string;
  readonly type: AttributeType;
}

const isLive = (doc: Readonly<Record<string, unknown>> | null): boolean => doc !== null && doc.isDeleted !== true;

/** Η τιμή που θα είχε ένα πεδίο `unique` αν ο άνθρωπος έγραψε αυτόν τον κωδικό. */
function typedValue(type: AttributeType, code: string): AttributeValue | null {
  if (type === 'text') return { type: 'text', text: code };
  if (type === 'number') {
    const parsed = parseEnteredAmount(code);
    return parsed ? { type: 'number', amount: parsed.amount } : null;
  }
  return null;
}

async function modelByCode(companyId: string, code: string, read: CodeJumpReader): Promise<CodeJumpTarget | null> {
  const id = generateDeterministicCatalogProductModelId(companyId, code.trim().toLowerCase());
  return isLive(await read('CATALOG_PRODUCT_MODELS', id)) ? { kind: 'productModel', id } : null;
}

async function holderByReservation(companyId: string, attribute: UniqueAttributeRef, code: string, read: CodeJumpReader): Promise<CodeJumpTarget | null> {
  const value = typedValue(attribute.type, code);
  const key = value ? uniqueValueKey(value) : null;
  if (key === null) return null;
  const reservation = await read('CATALOG_UNIQUE_VALUES', generateDeterministicCatalogUniqueValueId(companyId, attribute.id, key));
  const holderId = typeof reservation?.holderId === 'string' ? reservation.holderId : null;
  if (!holderId) return null;
  const kind = reservation?.holderKind === 'productModel' ? 'productModel' : 'product';
  const holder = await read(kind === 'product' ? 'CATALOG_PRODUCTS' : 'CATALOG_PRODUCT_MODELS', holderId);
  return isLive(holder) ? { kind, id: holderId } : null;
}

/** Μοντέλο πρώτα (κωδικός = ταυτότητα), μετά κάθε ιδιότητα `unique` με τη σειρά της. `null` ⇒ δεν υπάρχει. */
export async function resolveCatalogCode(
  companyId: string,
  code: string,
  uniqueAttributes: readonly UniqueAttributeRef[],
  read: CodeJumpReader,
): Promise<CodeJumpTarget | null> {
  if (code.trim() === '') return null;
  const [model, ...holders] = await Promise.all([
    modelByCode(companyId, code, read),
    ...uniqueAttributes.map((attribute) => holderByReservation(companyId, attribute, code, read)),
  ]);
  return model ?? holders.find((target) => target !== null) ?? null;
}
