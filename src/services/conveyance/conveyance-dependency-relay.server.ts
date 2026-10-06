/**
 * =============================================================================
 * ADR-905 §6 — Στάδιο 3 (CDC): «άλλαξε έγγραφο που ΔΕΝ γράφει η υπόθεση — ποιες όψεις το βλέπουν;»
 * =============================================================================
 *
 * Ο trigger των Functions στέλνει (υπογεγραμμένα) **ποιο** έγγραφο άλλαξε και τις **δύο** καταστάσεις του. Εδώ:
 *
 *   1. **ποιες υποθέσεις** — ερώτημα στο ευρετήριο `dependencyKeys` (ετικέτες του πριν ∪ μετά, ίδιο λεξιλόγιο με
 *      το `linkedTo`) · μόνο ανοιχτές · μόνο του μισθωτή του εγγράφου.
 *   2. **ποιες όψεις** — σήμα ⇔ **η προβολή αυτής της όψης άλλαξε**, κρινόμενη με τις **ίδιες** συναρτήσεις που την
 *      παράγουν: αρχείο → `evidenceOfFile` ανά θεατή (μισθωτής · `ready` · κάτοχος/σύνδεση · ενεργό · εμβέλεια CDE)
 *      ∩ `visibleRowFiles` (γραμμές που βλέπει ο θεατής · αντιστοίχιση γραμμής — ό,τι κάνει το `deriveChecklist`)·
 *      ακίνητο/έργο → `subjectContextOf` → `subjectViewFacts`. Μικρογραφία που δεν αλλάζει τίποτα ορατό ⇒ **κανένα**
 *      σήμα· αρχείο που πέρασε σε WIP ⇒ σήμα **μόνο** σε όποιον το έχασε (κανένα πλάγιο κανάλι χρονισμού).
 *   3. **ο ΕΝΑΣ γραφέας** — `signalCaseChangeInTx`. Αυτό το αρχείο **δεν** γράφει σήματα.
 *
 * @module services/conveyance/conveyance-dependency-relay.server
 */

import 'server-only';

import type { DocumentData, Firestore } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import { itemsForProfile } from '@/config/conveyance-checklist/catalog';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { ownedOrNull } from '@/lib/auth/tenant-ownership';
import { parseConveyanceCase } from '@/lib/conveyance/conveyance-case-schema';
import { visibleRowFiles } from '@/lib/conveyance/derive-checklist';
import type { DependencyChangeEvent, WireDocument } from '@/lib/conveyance/dependency-change-event';
import { fileLinkTag } from '@/lib/files/file-link-tag';
import type { CaseChange } from '@/lib/conveyance/view-signal-audience';
import type { CaseViewKey } from '@/lib/conveyance/view-signal-key';
import type { ConveyanceCase } from '@/types/conveyance-case';
import type { Engagement } from '@/types/engagement';
import { HOST_EVIDENCE_VIEWER, type CaseEvidenceViewer } from './conveyance-case-evidence.server';
import { engagementChecklistViewer } from './conveyance-engagement-access.service';
import { activeCaseEngagements } from './conveyance-engagement-support';
import { evidenceOfFile, evidenceTargets, fileDependencyKeys } from './conveyance-evidence.server';
import { readSubjectProject, subjectContextOf, subjectViewFacts } from './conveyance-subject.server';
import { caseViewersOf, engagementViewOf, signalCaseChangeInTx } from './conveyance-view-signal.server';

/** Όριο του Firestore για `array-contains-any`. */
const DISJUNCTION_LIMIT = 30;

/** Ό,τι σήμανε ένα γεγονός — για καταγραφή και tests, ποτέ για τον αποστολέα (ο trigger δεν το χρειάζεται). */
export interface RelayOutcome {
  readonly cases: number;
  readonly signalled: number;
}

/** Η απόφαση για μία υπόθεση: ποια αλλαγή, και ποιες συμμετοχές **ρητά** (`extra`). `null` ⇒ καμία όψη δεν άλλαξε. */
interface CaseSignal {
  readonly change: CaseChange;
  readonly extra: readonly CaseViewKey[];
}

type Doc = DocumentData | undefined;

function docOf(wire: WireDocument | null): Doc {
  return wire ?? undefined;
}

function companyOf(doc: Doc): string | null {
  return typeof doc?.companyId === 'string' && doc.companyId !== '' ? doc.companyId : null;
}

/** Οι μισθωτές του γεγονότος (σχεδόν πάντα ένας· δύο αν άλλαξε κάτοχος — τότε ρωτιούνται και οι δύο). */
function companiesOf(event: DependencyChangeEvent): string[] {
  return [...new Set([companyOf(docOf(event.before)), companyOf(docOf(event.after))].filter((c): c is string => c !== null))];
}

/** Οι ετικέτες που ψάχνουμε στο ευρετήριο. */
function keysOf(event: DependencyChangeEvent): string[] {
  switch (event.source) {
    case 'file':
      return [...new Set([...fileDependencyKeys(docOf(event.before)), ...fileDependencyKeys(docOf(event.after))])];
    case 'property':
      return [fileLinkTag(ENTITY_TYPES.PROPERTY, event.docId)];
    case 'project':
      return [fileLinkTag(ENTITY_TYPES.PROJECT, event.docId)];
  }
}

async function dependentCases(db: Firestore, companyId: string, keys: readonly string[]): Promise<ConveyanceCase[]> {
  const chunks: string[][] = [];
  for (let i = 0; i < keys.length; i += DISJUNCTION_LIMIT) chunks.push(keys.slice(i, i + DISJUNCTION_LIMIT));
  const snaps = await Promise.all(chunks.map((chunk) =>
    db.collection(COLLECTIONS.CONVEYANCE_CASES)
      .where('companyId', '==', companyId)
      .where('storedState', '==', 'open')
      .where('dependencyKeys', 'array-contains-any', chunk)
      .get(),
  ));
  const unique = new Map<string, ConveyanceCase>();
  for (const doc of snaps.flatMap((snap) => snap.docs)) {
    const record = parseConveyanceCase(doc.data());
    if (record) unique.set(record.id, record);
  }
  return [...unique.values()];
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Άλλαξε η προβολή αυτού του αρχείου **για αυτόν τον θεατή**; Η όψη είναι ο κατάλογος, όχι ο συλλέκτης: το τεκμήριο
 * (`evidenceOfFile`) μετρά **μόνο** όπου πέφτει σε γραμμή που βλέπει ο θεατής (`visibleRowFiles` — `visibleTo` ∩
 * αντιστοίχιση γραμμής, οι κρίσεις του `deriveChecklist`). Αρχείο εκτός γραμμής ⇒ κενή προβολή πριν **και** μετά ⇒
 * κανένα σήμα, όσο κι αν αλλάξει το `updatedAt` του· γραμμή της άλλης πλευράς ⇒ ούτε χρονισμός.
 */
function fileChangedFor(record: ConveyanceCase, event: DependencyChangeEvent, viewer: CaseEvidenceViewer): boolean {
  const targets = evidenceTargets(record.subject, record.parties);
  const items = itemsForProfile(record.profile);
  const project = (doc: Doc) => visibleRowFiles(items, viewer.role, evidenceOfFile(record.companyId, event.docId, doc, targets, viewer.audience));
  return !sameJson(project(docOf(event.before)), project(docOf(event.after)));
}

function fileSignal(record: ConveyanceCase, event: DependencyChangeEvent, engaged: readonly Engagement[]): CaseSignal | null {
  const hostChanged = fileChangedFor(record, event, HOST_EVIDENCE_VIEWER);
  const extra = engaged.filter((e) => fileChangedFor(record, event, engagementChecklistViewer(e))).map(engagementViewOf);
  if (!hostChanged && extra.length === 0) return null;
  return { change: { kind: 'scoped', roles: hostChanged ? ['host'] : [] }, extra };
}

async function readOwned(db: Firestore, collection: string, id: string | null, companyId: string): Promise<Doc> {
  if (id === null) return undefined;
  const data = (await db.collection(collection).doc(id).get()).data();
  return ownedOrNull(data, companyId, { resource: collection, resourceId: id, path: 'conveyance-cdc' }) ?? undefined;
}

/** Το πλαίσιο που **βλέπει** η υπόθεση, με ένα από τα δύο έγγραφα αντικατεστημένο από την κατάσταση του γεγονότος. */
async function viewFacts(db: Firestore, record: ConveyanceCase, event: DependencyChangeEvent, side: Doc): Promise<string> {
  const propertyId = record.subject.propertyId;
  if (event.source === 'property') {
    if (!side) return 'absent';
    return JSON.stringify(subjectViewFacts(subjectContextOf(propertyId, side, await readSubjectProject(db, side, record.companyId))));
  }
  const property = await readOwned(db, COLLECTIONS.PROPERTIES, propertyId, record.companyId);
  if (!property) return 'absent';
  return JSON.stringify(subjectViewFacts(subjectContextOf(propertyId, property, side ?? null)));
}

async function subjectSignal(db: Firestore, record: ConveyanceCase, event: DependencyChangeEvent): Promise<CaseSignal | null> {
  const [before, after] = await Promise.all([viewFacts(db, record, event, docOf(event.before)), viewFacts(db, record, event, docOf(event.after))]);
  return before === after ? null : { change: { kind: 'case-wide' }, extra: [] };
}

async function signalCase(db: Firestore, record: ConveyanceCase, event: DependencyChangeEvent, nowMs: number): Promise<boolean> {
  const engaged = await activeCaseEngagements(db, record, nowMs);
  const signal = event.source === 'file' ? fileSignal(record, event, engaged) : await subjectSignal(db, record, event);
  if (!signal) return false;
  await db.runTransaction(async (tx) => {
    signalCaseChangeInTx(tx, db, signal.change, caseViewersOf(record, engaged), signal.extra);
  });
  return true;
}

/** **Η είσοδος** του αποδέκτη: ένα γεγονός → σήματα μόνο στις όψεις που άλλαξαν. */
export async function relayDependencyChange(db: Firestore, event: DependencyChangeEvent, nowMs: number = Date.now()): Promise<RelayOutcome> {
  const keys = keysOf(event);
  if (keys.length === 0) return { cases: 0, signalled: 0 };
  const cases = (await Promise.all(companiesOf(event).map((companyId) => dependentCases(db, companyId, keys)))).flat();
  const results = await Promise.all(cases.map((record) => signalCase(db, record, event, nowMs)));
  return { cases: cases.length, signalled: results.filter(Boolean).length };
}
