import 'server-only';

/**
 * =============================================================================
 * Η ΜΗΧΑΝΗ ΣΥΝΟΛΟΥ ΤΗΣ ΕΚΔΟΣΗΣ — η έκδοση είναι η ΡΙΖΑ των γραμμών της (ADR-923 §5.11 «3β»)
 * =============================================================================
 *
 * Όπως το μοντέλο προϊόντος για τις παραλλαγές του (`catalog-aggregate.server.ts`), η **έκδοση** κλειδώνει τις
 * γραμμές της: κάθε εγγραφή γραμμής **διαβάζει** την έκδοση στην ίδια συναλλαγή και ανεβάζει το `linesRevision`.
 * Άρα:
 *   - γραμμή σε **μη πρόχειρη** έκδοση είναι αδύνατη (`versionNotDraft`) — το αμετάβλητο της δημοσίευσης ζει
 *     **εδώ** και στους κανόνες·
 *   - γραμμή και δημοσίευση **σειριοποιούνται**: όποια περάσει πρώτη, η άλλη ξανατρέχει και βλέπει την αλήθεια·
 *   - η δημοσίευση κάνει CAS στο `linesRevision` ⇒ δημοσιεύει **ακριβώς** τις γραμμές της διαφοράς που είδε ο άνθρωπος.
 *
 * Το `linesRevision` είναι **παράγωγο** (`stageDerived`): δεν ανεβάζει την αναθεώρηση της έκδοσης, ώστε η
 * επικόλληση 400 γραμμών να μη δίνει ψευδές 409 σε όποιον αλλάζει την ημερομηνία ισχύος (ADR-923 §5.10 Θωράκιση 1).
 *
 * 🔑 **Σπορά** («νέα έκδοση από την τρέχουσα»): οι γραμμές της βάσης αντιγράφονται σε τμήματα, **ιδεμπότητα**
 * (ντετερμινιστικά id) και **χωρίς** ίχνος ανά γραμμή (`stageCopied` — η πηγή είναι δημοσιευμένη, αμετάβλητη)·
 * όσο διαρκεί, καμία γραμμή και καμία δημοσίευση (`versionSeeding`).
 *
 * ⛔ Μόνο αυτό το αρχείο (και η μηχανή) καλεί `stageDerived` / `stageCopied` για εκδόσεις — CHECK 3.106 Κ6.
 * @module server/catalog/price-version-aggregate.server
 */

import { priceLineSubjectKey } from '@/subapps/catalog/pricing/price-line-subject';
import { priceListLineKey } from '@/subapps/catalog/pricing/pricing-keys';
import type {
  PriceListLineDefinition,
  PriceListVersionDerived,
  StoredPriceListLineDefinition,
  StoredPriceListVersionDefinition,
} from '@/subapps/catalog/types/price-list';
import { PRICE_LINES_PER_TRANSACTION } from '@/subapps/catalog/vocabulary/pricing';
import {
  naturalKeyId,
  readOwned,
  stageCopied,
  stageDerived,
  type CatalogTx,
  type StoredCatalogRecord,
} from './catalog-store.server';
import { CatalogWriteError } from './catalog-write-error';
import { versionLinesPage } from './price-version-reads.server';

export type StoredPriceVersion = StoredCatalogRecord<StoredPriceListVersionDefinition>;
export type StoredPriceLine = StoredCatalogRecord<StoredPriceListLineDefinition>;

/** Τα παράγωγα μιας **νέας** έκδοσης. */
export function initialVersionDerived(seedFromVersionId: string | null): PriceListVersionDerived {
  return {
    linesRevision: 0,
    seed: seedFromVersionId === null ? null : { fromVersionId: seedFromVersionId, copied: 0, cursor: null, done: false },
  };
}

/** Η σπορά δεν τελείωσε ⇒ ούτε γραμμές ούτε δημοσίευση (αλλιώς θα δημοσιευόταν μισή έκδοση). */
export function assertSeeded(version: StoredPriceVersion): void {
  if (version.derived.seed !== null && !version.derived.seed.done) {
    throw new CatalogWriteError('invalid', [{ code: 'versionSeeding', path: 'derived.seed' }]);
  }
}

/** Η μόνη πόρτα προς τις γραμμές: πρόχειρη, σπαρμένη, και με το `linesRevision` που διάβασε ο πελάτης. */
export async function readDraftForLines(scope: CatalogTx, versionId: string, expectedLinesRevision: number): Promise<StoredPriceVersion> {
  const version = await readOwned<StoredPriceListVersionDefinition>(scope, 'priceListVersion', versionId);
  if (version.status !== 'draft') throw new CatalogWriteError('immutable', [{ code: 'versionNotDraft', path: 'status' }]);
  assertSeeded(version);
  if (version.derived.linesRevision !== expectedLinesRevision) {
    throw new CatalogWriteError('revisionMismatch', [], { currentRevision: version.derived.linesRevision });
  }
  return version;
}

/** Ο ορισμός της έκδοσης χωρίς περίβλημα — ό,τι δέχεται το `stageReplace` (ένας τρόπος για γραφέα και δημοσίευση). */
export function versionDefinitionOf(version: StoredPriceVersion): StoredPriceListVersionDefinition {
  const { priceListId, number, status, validFrom, basedOnVersionId, seal, derived } = version;
  return { priceListId, number, status, validFrom, basedOnVersionId, seal, derived };
}

/** Οι γραμμές άλλαξαν: `linesRevision` +1 — **χωρίς** αναθεώρηση ή ίχνος της έκδοσης. */
export function stageLinesTouched(scope: CatalogTx, version: StoredPriceVersion): StoredPriceVersion {
  return stageDerived(scope, 'priceListVersion', version, { ...version.derived, linesRevision: version.derived.linesRevision + 1 });
}

/** Η αποθηκευμένη μορφή μιας γραμμής της έκδοσης: ορισμός + κλειδιά δεικτών. */
export function storedLineOf(version: StoredPriceVersion, line: PriceListLineDefinition): StoredPriceListLineDefinition {
  const definition: PriceListLineDefinition = {
    versionId: version.id,
    subject: line.subject,
    netPrice: line.netPrice,
    priceQuantity: line.priceQuantity,
    unitCode: line.unitCode,
    discountGroupId: line.discountGroupId,
    breakdown: line.breakdown,
  };
  const derived = { subjectKey: priceLineSubjectKey(line.subject), priceListId: version.priceListId, versionNumber: version.number };
  return { ...definition, derived };
}

/** Ένα τμήμα γραμμών της πηγής, μετά από τον δρομέα — μέσα στη συναλλαγή, με το **ίδιο** ερώτημα της ανάγνωσης. */
export async function readSeedPage(scope: CatalogTx, sourceVersionId: string, cursor: string | null): Promise<StoredPriceLine[]> {
  const snap = await scope.tx.get(versionLinesPage(scope.db, scope.ctx.companyId, sourceVersionId, cursor));
  return snap.docs.map((doc) => doc.data() as StoredPriceLine);
}

/**
 * Ένα **τμήμα** σποράς: αντιγράφει τη σελίδα, προωθεί τον δρομέα και, αν η σελίδα δεν ήταν γεμάτη, κλείνει τη σπορά.
 * Ο δρομέας είναι CAS: δύο ταυτόχρονες επαναλήψεις διαβάζουν την έκδοση, η δεύτερη ξανατρέχει από τον **νέο** δρομέα.
 */
export function stageSeedChunk(scope: CatalogTx, version: StoredPriceVersion, page: readonly StoredPriceLine[]): StoredPriceVersion {
  const seed = version.derived.seed;
  if (seed === null || seed.done) return version;
  for (const source of page) {
    const line = storedLineOf(version, source);
    const id = naturalKeyId(scope, 'priceListLine', priceListLineKey(version.id, line.derived.subjectKey));
    stageCopied(scope, 'priceListLine', { id, previousRevision: 0 }, line);
  }
  const done = page.length < PRICE_LINES_PER_TRANSACTION;
  const cursor = page.length > 0 ? page[page.length - 1].id : seed.cursor;
  const nextSeed = { ...seed, copied: seed.copied + page.length, cursor, done };
  return stageDerived(scope, 'priceListVersion', version, { linesRevision: version.derived.linesRevision + 1, seed: nextSeed });
}
