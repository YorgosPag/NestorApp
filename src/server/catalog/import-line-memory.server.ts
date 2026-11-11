import 'server-only';

/**
 * **Η γραμμή επιστρέφει στην κρίση της μνήμης** (ADR-923 §5.5.2 Β9δ · απόφαση Β).
 *
 * Η αναίρεση μιας ανθρώπινης απόφασης που είχε μπει **πάνω** σε απόφαση της μνήμης του προμηθευτή δεν στέλνει «ποια ήταν η μνήμη»: ο
 * client δεν δηλώνει ποτέ προέλευση. Στέλνει `decision: null` με `fallback: 'memory'`, και ο server **ξαναρωτά τη μνήμη** για αυτή
 * τη μία γραμμή με τον **ίδιο** κανόνα που την εφαρμόζει (`memoryOverridesFor`) — όπως το `null` ενός πεδίου γυρνά στην κρίση του
 * κανόνα. Αν η μνήμη άλλαξε στο μεταξύ, η γραμμή παίρνει ό,τι λέει η μνήμη **σήμερα**, με τη σωστή σήμανση· ποτέ ψευδή προέλευση.
 * @module server/catalog/import-line-memory.server
 */

import type { AuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/auth';
import { nowISO } from '@/lib/date-local';
import { isMemorable, memoryKeysOf, memoryOverridesFor } from '@/subapps/catalog/import/label-memory';
import { lineOverrideOf, sameLine } from '@/subapps/catalog/import/page-line-overrides';
import type { CatalogSchemaSnapshot } from '@/subapps/catalog/derived/chain-derived';
import type { ImportBatchDefinition, ImportLineIdentity, ImportLineOverride } from '@/subapps/catalog/types/catalog-import';
import type { SetImportLineRequest } from '@/subapps/catalog/types/catalog-import-requests';
import { CATALOG_AUTHORITY_PERMISSIONS } from '@/subapps/catalog/vocabulary/catalog-authorities';
import { labelMemoryScopeOf, readLabelMemoryBook } from './import-label-memory.server';

/**
 * Τιμή από μνήμη: τιμοκατάλογος στην παρτίδα **και** δικαίωμα τιμολόγησης (ίδιο δόγμα με το `judgePriceLine`). Ο ΕΝΑΣ κανόνας για
 * τη ρητή εφαρμογή της μνήμης (`import-memory-apply.server`) και για την επιστροφή μιας γραμμής σε αυτήν.
 */
export async function memoryMayPrice(ctx: AuthContext, batch: Pick<ImportBatchDefinition, 'target'>): Promise<boolean> {
  return batch.target.purpose === 'attributes' && Boolean(batch.target.priceListVersionId) && (await hasPermission(ctx, CATALOG_AUTHORITY_PERMISSIONS.pricing));
}

type LineAddress = Pick<SetImportLineRequest, 'page' | 'table' | 'line'>;

/** Η ταυτότητα της γραμμής: από την απόφαση που φεύγει (τη φέρει κάθε απόφαση με ταυτότητα), αλλιώς από ό,τι έγραψε η ανάγνωση. */
function identityOf(batch: ImportBatchDefinition, address: LineAddress): ImportLineIdentity | undefined {
  const current = lineOverrideOf(batch.pages?.lineOverrides, address);
  if (current?.identity) return current.identity;
  return batch.pages?.unmappedLines?.find((line) => sameLine(line, address))?.identity;
}

/**
 * Η απόφαση που θα έδινε η μνήμη στη γραμμή **αν δεν είχε απόφαση ανθρώπου** — με την προέλευσή της — ή `null` (καμία ταυτότητα,
 * κανένας προμηθευτής, η μνήμη δεν αποφασίζει ή δεν εφαρμόζεται εδώ).
 */
export async function memoryOverrideForLine(
  ctx: AuthContext,
  batch: ImportBatchDefinition,
  schema: CatalogSchemaSnapshot,
  address: LineAddress,
): Promise<ImportLineOverride | null> {
  const scope = labelMemoryScopeOf(batch);
  const identity = identityOf(batch, address);
  if (scope === null || !isMemorable(identity)) return null;
  const book = await readLabelMemoryBook(ctx, memoryKeysOf(scope, [identity]));
  if (book.size === 0) return null;
  // Οι αποφάσεις του πίνακα ΧΩΡΙΣ αυτή τη γραμμή: ο κανόνας τη βλέπει «χωρίς απόφαση ανθρώπου» — αυτό ακριβώς ζητήθηκε.
  const others = (batch.pages?.lineOverrides ?? []).filter((override) => !sameLine(override, address));
  const application = {
    scope,
    book,
    knownAttributeIds: new Set(schema.attributes.keys()),
    pricesEnabled: await memoryMayPrice(ctx, batch),
    stamp: { by: ctx.uid, at: nowISO() },
  };
  const [found] = memoryOverridesFor({ page: address.page, table: address.table, identities: new Map([[address.line, identity]]) }, others, application);
  return found ?? null;
}

/** Ο έλεγχος που κρατά το συμβόλαιο: η επιστροφή στη μνήμη υπάρχει μόνο ως **αναίρεση** (`decision: null`). */
export const wantsMemoryFallback = (request: SetImportLineRequest): boolean => request.fallback === 'memory' && request.decision === null;
