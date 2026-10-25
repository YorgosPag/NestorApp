import 'server-only';

/**
 * =============================================================================
 * Η ΜΗΧΑΝΗ ΤΟΥ ΣΥΝΟΛΟΥ — κάθε εγγραφή μοντέλου/SKU περνά από εδώ (ADR-923 §5.10 · handoff 2β §2)
 * =============================================================================
 *
 * Η σειρά, σε **μία** συναλλαγή:
 *   1. φόρτωση συνόλου + εφαρμογή αλλαγών (CAS ανά μέλος, αμετάβλητα, καταρράκτης) — `catalog-aggregate-load`
 *   2. σχήμα **τώρα** + ό,τι αναφέρουν οι τιμές (μέσα, κατηγορίες, στόχοι)
 *   3. **καθαρή** κρίση: τοποθέτηση → τιμές → όριο → άξονες → κανόνες «καμία νέα παράβαση» (`judge-aggregate`)
 *   4. κρατήσεις μοναδικότητας (+ προειδοποίηση ομοιότητας)
 *   5. παράγωγα **όλων** των μελών (`derive-aggregate`)
 *   6. σκηνοθεσία: αλλαγές ανθρώπου με αναθεώρηση + ίχνος· παράγωγα ανέγγιχτων μελών με `stageDerived`
 *      (**μόνο** όσα άλλαξαν — ένα ίδιο παράγωγο δεν ξαναγράφεται).
 * Όλες οι αναγνώσεις (1, 2, 4) πριν από κάθε εγγραφή (6) — κανόνας της Firestore.
 *
 * 🔑 **Σειριοποίηση χωρίς ερώτημα**: κάθε αλλαγή απογόνου ξαναγράφει τα παράγωγα της **ρίζας** (ευρετήριο,
 * περίληψη) ⇒ δύο ταυτόχρονες εγγραφές στην ίδια οικογένεια παραλλαγών συγκρούονται στη ρίζα και η δεύτερη
 * ξανατρέχει πάνω στην πρώτη. Ο συνδυασμός αξόνων και οι κανόνες κρίνονται πάντα πάνω σε **συνεπές** σύνολο.
 *
 * @module server/catalog/catalog-aggregate.server
 */

import { canonicalJson } from '@/lib/legal/canonical-json';
import { deriveAggregate, type MemberDerived } from '@/subapps/catalog/aggregate/derive-aggregate';
import { judgeAggregate, memberPath } from '@/subapps/catalog/aggregate/judge-aggregate';
import { liveMembers, type AggregateMember, type CatalogAggregate } from '@/subapps/catalog/aggregate/aggregate-model';
import { uniqueKeysOf } from '@/subapps/catalog/derived/holder-derived';
import type { CatalogSchemaSnapshot } from '@/subapps/catalog/derived/chain-derived';
import type { CatalogIssue } from '@/subapps/catalog/schema/catalog-issues';
import type { CatalogValueHolder } from '@/subapps/catalog/types/product';
import { loadAggregate, type HolderChange, type LoadedAggregate, type StoredMember } from './catalog-aggregate-load.server';
import { collectHolderReferences, readReferenceSnapshot, readSchemaSnapshot } from './catalog-product-reads.server';
import {
  stageCreate,
  stageDerived,
  stageReplace,
  stageSoftDelete,
  type CatalogTx,
  type StoredCatalogRecord,
} from './catalog-store.server';
import { assertNoIssues, CatalogWriteError } from './catalog-write-error';
import {
  planUniqueReservations,
  stageReservationPlan,
  type HolderUniqueDelta,
  type ReservationPlan,
} from './unique-reservations.server';

export type { HolderChange } from './catalog-aggregate-load.server';

/** Ό,τι έγραψε η μηχανή: κάθε μέλος με την τελική του εγγραφή (και τα διαγραμμένα) + τα ids που γεννήθηκαν. */
export interface CommittedAggregate {
  readonly records: ReadonlyMap<string, StoredCatalogRecord<object>>;
  /** Τα ids των δημιουργιών, με τη σειρά των αλλαγών. */
  readonly createdIds: readonly string[];
  readonly rootId: string | null;
}

/** Η εγγραφή ενός μέλους από το αποτέλεσμα — υπάρχει πάντα για μέλος που άλλαξε (αλλιώς σφάλμα προγραμματισμού). */
export function committedRecord<T>(committed: CommittedAggregate, id: string): StoredCatalogRecord<T> {
  const record = committed.records.get(id);
  if (!record) throw new Error(`catalog aggregate did not commit ${id}`);
  return record as StoredCatalogRecord<T>;
}

/** Η οικογένεια και το σχήμα παραλλαγών του συνόλου: της ρίζας, ή του απλού προϊόντος. */
function schemaKeyOf(aggregate: CatalogAggregate): { readonly familyId: string; readonly schemeCode: string | null } {
  const root = aggregate.rootId === null ? undefined : aggregate.members.get(aggregate.rootId);
  const anchor = root ?? [...aggregate.members.values()][0];
  const definition = anchor?.after ?? anchor?.before;
  // Άδειο σύνολο: η ρίζα/το προϊόν χάθηκε ανάμεσα σε ερώτημα και συναλλαγή (ή ήταν ξένο) ⇒ ξένο ≡ ανύπαρκτο.
  if (!anchor || !definition) throw new CatalogWriteError('notFound');
  const schemeCode = anchor.kind === 'productModel' && 'variantSchemeCode' in definition ? definition.variantSchemeCode : null;
  return { familyId: definition.familyId, schemeCode };
}

function changedHolders(aggregate: CatalogAggregate): CatalogValueHolder[] {
  return [...aggregate.members.values()].flatMap((member) => (member.changed && member.after ? [member.after] : []));
}

function uniqueDeltas(aggregate: CatalogAggregate, schema: CatalogSchemaSnapshot): HolderUniqueDelta[] {
  return [...aggregate.members.values()]
    .filter((member) => member.changed)
    .map((member) => ({
      holderKind: member.kind,
      holderId: member.id,
      before: member.before?.derived.uniqueKeys ?? {},
      after: member.after ? uniqueKeysOf(member.after, schema.attributes) : {},
      pathOf: (attributeId: string) => `${memberPath(member.id)}.values.${attributeId}`,
    }));
}

/** Προειδοποιήσεις ανά μέλος: νέες από τις κρατήσεις· αλλιώς οι αποθηκευμένες, όσο τα κλειδιά δεν άλλαξαν. */
function warningsOf(aggregate: CatalogAggregate, plan: ReservationPlan, deltas: readonly HolderUniqueDelta[]) {
  const sameKeys = new Set(deltas.filter((d) => canonicalJson(d.before) === canonicalJson(d.after)).map((d) => d.holderId));
  const warnings = new Map<string, readonly CatalogIssue[]>();
  for (const member of liveMembers(aggregate, 'after')) {
    const kept = !member.changed || sameKeys.has(member.id) ? member.before?.derived.warnings ?? [] : [];
    warnings.set(member.id, plan.warnings.get(member.id) ?? kept);
  }
  return warnings;
}

function stageMember(
  scope: CatalogTx,
  loaded: LoadedAggregate,
  member: AggregateMember,
  derived: MemberDerived | undefined,
): StoredCatalogRecord<object> | null {
  const stored: StoredMember | undefined = loaded.stored.get(member.id);
  if (member.after === null) return stored ? stageSoftDelete(scope, member.kind, stored.record) : null;
  if (!derived) throw new Error(`no derived for live member ${member.id}`);
  const next = { ...member.after, derived: derived.derived };
  const target = loaded.targets.get(member.id);
  if (target) return stageCreate(scope, member.kind, target, next);
  if (!stored) throw new Error(`member ${member.id} is neither stored nor created`);
  if (member.changed) return stageReplace(scope, member.kind, stored.record, next);
  const same = canonicalJson(stored.record.derived) === canonicalJson(derived.derived);
  return same ? stored.record : stageDerived(scope, member.kind, stored.record, derived.derived);
}

/**
 * Εφαρμόζει τις αλλαγές στο σύνολο της ρίζας `rootId` (ή σε απλό προϊόν, `null`). Ρίχνει `CatalogWriteError`
 * (422 με ευρήματα ανά κελί, 409 CAS, 404) — **τίποτα** δεν γράφεται αν κάτι απορριφθεί.
 */
export async function commitAggregate(scope: CatalogTx, rootId: string | null, changes: readonly HolderChange[]): Promise<CommittedAggregate> {
  const loaded = await loadAggregate(scope, rootId, changes);
  const { aggregate } = loaded;
  const { familyId, schemeCode } = schemaKeyOf(aggregate);
  const schema = await readSchemaSnapshot(scope, familyId, schemeCode);
  const refs = await readReferenceSnapshot(scope, collectHolderReferences(changedHolders(aggregate)));
  const verdict = judgeAggregate({ aggregate, schema, refs });
  assertNoIssues(verdict.issues);
  const deltas = uniqueDeltas(aggregate, schema);
  const plan = await planUniqueReservations(scope, deltas);
  assertNoIssues(plan.issues);
  const derived = deriveAggregate({ aggregate, schema, findings: verdict.findings, warnings: warningsOf(aggregate, plan, deltas) });
  const committed = new Map<string, StoredCatalogRecord<object>>();
  for (const member of aggregate.members.values()) {
    const record = stageMember(scope, loaded, member, derived.get(member.id));
    if (record) committed.set(member.id, record);
  }
  stageReservationPlan(scope, plan);
  return { records: committed, createdIds: [...loaded.targets.keys()], rootId: aggregate.rootId };
}
