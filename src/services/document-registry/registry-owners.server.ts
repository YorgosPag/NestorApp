/**
 * @fileoverview Μητρώο λήξεων — **ΠΟΙΟΣ** φέρνει κάθε έγγραφο: οι ιδιοκτήτες και τα ονόματά τους, ζωντανά (ADR-915 §25).
 * @related lib/document-validity/registry-owners.ts (ο κανόνας) · services/conveyance/conveyance-party-labels.server.ts
 *   (το ίδιο ιδίωμα ονομάτων) · services/conveyance/conveyance-subject.server.ts (`subjectContextOf` — η κυριότητα)
 * @module services/document-registry/registry-owners.server
 *
 * 🔑 **Καμία νέα πηγή κυριότητας**: αγοραστές · νομική φάση · εταιρεία του έργου βγαίνουν από τον **ίδιο**
 *    μετασχηματισμό με την υπόθεση (`subjectContextOf`)· οι μεταβιβάζοντες από τις υποθέσεις που ήδη διάβασε το μητρώο·
 *    οι πελάτες εντολών από τον αναγνώστη εντολών. Το έργο διαβάζεται **μόνο** όταν χρειάζεται (καμία άλλη απάντηση).
 * 🔑 **Όνομα ζωντανά, ποτέ αντίγραφο** (§23.10 Ζ4): `readOwnedContactDocs` — ξένη ≡ ανύπαρκτη (ADR-742) — και
 *    `extractContactDisplayName`. Μόνο όνομα ταξιδεύει (5(1)(γ)).
 * 🔑 **Μόνο όσα θα δειχτούν**: ο καλών δίνει τα ακίνητα των τρεχουσών γραμμών· ποτέ σάρωση.
 * ⚠️ **Αποτυχία ⇒ το μητρώο ζει**: κανένας ιδιοκτήτης (`null` = «δεν ξέρω», όχι «κανείς») και `warn` **χωρίς** όνομα.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { chunkArray } from '@/lib/array-utils';
import { ownedOrNull } from '@/lib/auth/tenant-ownership';
import { companyPropertyOwners, distinctContactIds } from '@/lib/document-validity/registry-owners';
import { getErrorMessage } from '@/lib/error-utils';
import { createModuleLogger } from '@/lib/telemetry';
import { trimmedStringOrNull } from '@/lib/type-guards';
import { extractContactDisplayName } from '@/server/lib/contact-doc-fields';
import { readOwnedContactDocs } from '@/server/lib/owned-contact-docs';
import { subjectContextOf } from '@/services/conveyance/conveyance-subject.server';
import type { ConveyanceCase } from '@/types/conveyance-case';
import { REGISTRY_GET_ALL_CHUNK, type RegistryLabel } from './document-registry.types';
import type { RegistryProperty } from './registry-properties.server';

const logger = createModuleLogger('registry-owners');

type DocData = Readonly<Record<string, unknown>>;

export interface RegistryOwnersQuestion {
  /** Τα ακίνητα των τρεχουσών γραμμών — κανένα άλλο δεν ρωτιέται. */
  readonly wanted: ReadonlySet<string>;
  /** Ό,τι είναι «του γραφείου», όπως το διάβασε ήδη το μητρώο. */
  readonly subjects: ReadonlyMap<string, RegistryProperty>;
  /** Οι ανοιχτές υποθέσεις που διάβασε ήδη το μητρώο. */
  readonly cases: readonly ConveyanceCase[];
  /** 5γ — οι επαφές των γραμμών **ανά πρόσωπο** (ενημερότητες · ΕΝΦΙΑ): ονομάζονται μαζί με τους ιδιοκτήτες. */
  readonly partyContactIds: readonly string[];
}

export interface RegistryOwners {
  /** Ακίνητο → ιδιοκτήτες· ακίνητο που λείπει = «δεν ρωτήθηκε / δεν ξέρω». */
  readonly owners: ReadonlyMap<string, readonly string[]>;
  /** Επαφή → όνομα, μόνο για επαφές του μισθωτή. */
  readonly people: Readonly<Record<string, RegistryLabel>>;
}

const NOBODY: RegistryOwners = { owners: new Map(), people: {} };

/** Οι μεταβιβάζοντες κάθε ακινήτου, από **όλες** τις ανοιχτές του υποθέσεις. */
function sellersByProperty(cases: readonly ConveyanceCase[]): ReadonlyMap<string, readonly (string | null)[]> {
  const sellers = new Map<string, (string | null)[]>();
  for (const record of cases) {
    const id = record.subject.propertyId;
    sellers.set(id, [...(sellers.get(id) ?? []), ...record.parties.sellers.map((party) => party.contactId)]);
  }
  return sellers;
}

/** Τα έργα (του μισθωτή) — ένα `getAll` ανά ομάδα. Ξένο ή ανύπαρκτο ⇒ λείπει. */
async function readOwnedProjects(db: AdminFirestore, companyId: string, projectIds: readonly string[]): Promise<Map<string, DocData>> {
  const projects = new Map<string, DocData>();
  for (const group of chunkArray([...new Set(projectIds)], REGISTRY_GET_ALL_CHUNK)) {
    const snapshots = await db.getAll(...group.map((id) => db.collection(COLLECTIONS.PROJECTS).doc(id)));
    for (const snapshot of snapshots) {
      const data = ownedOrNull(snapshot.data(), companyId, { resource: 'project', resourceId: snapshot.id, path: 'registry-owners' });
      if (data) projects.set(snapshot.id, data);
    }
  }
  return projects;
}

/** Η κυριότητα ενός ακινήτου εταιρείας, από τον ΙΔΙΟ μετασχηματισμό με την υπόθεση (`subjectContextOf`). */
function ownersOf(property: RegistryProperty, project: DocData | null, sellers: readonly (string | null)[]): readonly string[] {
  const context = subjectContextOf(property.id, property.data, project);
  return companyPropertyOwners({
    legalPhase: context.legalPhase,
    buyerContactIds: context.parties.buyers.map((buyer) => buyer.contactId),
    sellerContactIds: sellers,
    projectCompanyContactId: context.sellerSources.principalContactId,
  });
}

/**
 * Ακίνητα εταιρείας. Αγοραστές και μεταβιβάζοντες δεν θέλουν το έργο ⇒ πρώτα χωρίς αυτό· το έργο διαβάζεται **μόνο**
 * για όσα έμειναν χωρίς απάντηση (η εταιρεία του έργου είναι η τελευταία εφεδρεία).
 */
async function companyOwners(
  db: AdminFirestore,
  companyId: string,
  properties: readonly RegistryProperty[],
  cases: readonly ConveyanceCase[],
): Promise<Map<string, readonly string[]>> {
  const sellers = sellersByProperty(cases);
  const sellersOf = (property: RegistryProperty) => sellers.get(property.id) ?? [];
  const projectIdOf = (property: RegistryProperty) => trimmedStringOrNull(property.data[FIELDS.PROJECT_ID]);
  const owners = new Map(properties.map((property) => [property.id, ownersOf(property, null, sellersOf(property))] as const));
  const unanswered = properties.flatMap((property) => {
    const projectId = projectIdOf(property);
    return owners.get(property.id)?.length === 0 && projectId !== null ? [{ property, projectId }] : [];
  });
  const projects = await readOwnedProjects(db, companyId, unanswered.map(({ projectId }) => projectId));
  for (const { property, projectId } of unanswered) {
    owners.set(property.id, ownersOf(property, projects.get(projectId) ?? null, sellersOf(property)));
  }
  return owners;
}

/** Τα ονόματα — μόνο επαφές του μισθωτή· κενό όνομα ⇒ `null` («επαφή χωρίς όνομα»). */
async function readPeople(db: AdminFirestore, companyId: string, contactIds: readonly string[]): Promise<Record<string, RegistryLabel>> {
  const people: Record<string, RegistryLabel> = {};
  for (const group of chunkArray([...contactIds], REGISTRY_GET_ALL_CHUNK)) {
    const contacts = await readOwnedContactDocs(db, companyId, group);
    for (const [id, data] of contacts) people[id] = { name: trimmedStringOrNull(extractContactDisplayName(data)) };
  }
  return people;
}

/** **Ποιος** είναι ο ιδιοκτήτης κάθε ζητούμενου ακινήτου, και πώς λέγεται. */
export async function readRegistryOwners(db: AdminFirestore, companyId: string, question: RegistryOwnersQuestion): Promise<RegistryOwners> {
  const wanted = [...question.wanted].flatMap((id) => { const p = question.subjects.get(id); return p ? [p] : []; });
  if (wanted.length === 0 && question.partyContactIds.length === 0) return NOBODY;
  try {
    const mandated = wanted.filter((p) => p.scope === 'owner-property').map((p) => [p.id, p.mandateClientContactIds] as const);
    const company = await companyOwners(db, companyId, wanted.filter((p) => p.scope === 'property'), question.cases);
    const owners = new Map<string, readonly string[]>([...mandated, ...company]);
    const people = await readPeople(db, companyId, distinctContactIds([...[...owners.values()].flat(), ...question.partyContactIds]));
    return { owners, people };
  } catch (error) {
    logger.warn('Οι ιδιοκτήτες του μητρώου δεν διαβάστηκαν — η οθόνη δείχνει μόνο τον ρόλο', {
      data: { companyId, properties: wanted.length, error: getErrorMessage(error, 'unknown') },
    });
    return NOBODY;
  }
}
