/**
 * @fileoverview Μητρώο λήξεων — **ΠΟΙΟΣ** φέρνει κάθε έγγραφο: οι ιδιοκτήτες και τα ονόματά τους, ζωντανά (ADR-915 §25).
 * @related lib/document-validity/registry-owners.ts (ο κανόνας) · lib/document-validity/obligor-lead.ts (ο υπεύθυνος) ·
 *   services/conveyance/conveyance-party-labels.server.ts (το ίδιο ιδίωμα ονομάτων) ·
 *   services/conveyance/conveyance-subject.server.ts (`subjectContextOf` — η κυριότητα)
 * @module services/document-registry/registry-owners.server
 *
 * 🔑 **Καμία νέα πηγή κυριότητας**: αγοραστές · νομική φάση · εταιρεία του έργου βγαίνουν από τον **ίδιο**
 *    μετασχηματισμό με την υπόθεση (`subjectContextOf`)· οι μεταβιβάζοντες από τις υποθέσεις που ήδη διάβασε το μητρώο·
 *    οι πελάτες εντολών από τον αναγνώστη εντολών. Το έργο διαβάζεται **μόνο** όταν χρειάζεται (καμία άλλη απάντηση).
 * 🔑 **Όνομα ζωντανά, ποτέ αντίγραφο** (§23.10 Ζ4): `readOwnedContactDocs` — ξένη ≡ ανύπαρκτη (ADR-742) — και
 *    `extractContactDisplayName`. Μόνο όνομα ταξιδεύει (5(1)(γ)).
 * 🔑 **Μόνο όσα θα δειχτούν**: ο καλών δίνει τα ακίνητα των τρεχουσών γραμμών· ποτέ σάρωση.
 * 🔑 ADR-915 §26 — **ο υπεύθυνος** (`obligorLeadOf`) από τα **ίδια** δεδομένα: μερίδια **μόνο** όταν οι ιδιοκτήτες
 *    είναι οι αγοραστές (`readStoredOwners`, ADR-244) · κύριος πωλητής **μόνο** όταν είναι οι μεταβιβάζοντες · η ρητή
 *    επιλογή του γραφείου με μία ανάγνωση `getAll` (`readObligorDesignations`). Η παλιά επιλογή ονομάζεται κι αυτή.
 * ⚠️ **Αποτυχία ⇒ το μητρώο ζει**: κανένας ιδιοκτήτης (`null` = «δεν ξέρω», όχι «κανείς») και `warn` **χωρίς** όνομα.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { chunkArray } from '@/lib/array-utils';
import { ownedOrNull } from '@/lib/auth/tenant-ownership';
import { obligorLeadOf, type ObligorLead } from '@/lib/document-validity/obligor-lead';
import { companyPropertyOwners, distinctContactIds } from '@/lib/document-validity/registry-owners';
import { getErrorMessage } from '@/lib/error-utils';
import { readStoredOwners } from '@/lib/ownership/owner-utils';
import { createModuleLogger } from '@/lib/telemetry';
import { isRecord, trimmedStringOrNull } from '@/lib/type-guards';
import { extractContactDisplayName } from '@/server/lib/contact-doc-fields';
import { readOwnedContactDocs } from '@/server/lib/owned-contact-docs';
import { subjectContextOf } from '@/services/conveyance/conveyance-subject.server';
import type { ConveyanceCase, ConveyanceSellerParty } from '@/types/conveyance-case';
import { REGISTRY_GET_ALL_CHUNK, type RegistryLabel } from './document-registry.types';
import { readObligorDesignations } from './obligor-designations.server';
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
  /**
   * Επαφές που **ονομάζονται** χωρίς να κρίνονται ιδιοκτήτες: 5γ — τα πρόσωπα των γραμμών (ενημερότητες · ΕΝΦΙΑ)· §27 —
   * οι επαγγελματίες των αναθέσεων και οι υποψήφιοι. Μία ανάγνωση, ένας έλεγχος μισθωτή.
   */
  readonly partyContactIds: readonly string[];
}

export interface RegistryOwners {
  /** Ακίνητο → ιδιοκτήτες· ακίνητο που λείπει = «δεν ρωτήθηκε / δεν ξέρω». */
  readonly owners: ReadonlyMap<string, readonly string[]>;
  /** §26 — ακίνητο → ο υπεύθυνος (`null` = κανείς ιδιοκτήτης)· ίδια κλειδιά με το `owners`. */
  readonly leads: ReadonlyMap<string, ObligorLead | null>;
  /** §26 — ακίνητο → (επαφή → μερίδιο %), **μόνο** όταν οι ιδιοκτήτες είναι αγοραστές με γνωστά μερίδια. */
  readonly shares: ReadonlyMap<string, Readonly<Record<string, number>>>;
  /** Επαφή → όνομα, μόνο για επαφές του μισθωτή. */
  readonly people: Readonly<Record<string, RegistryLabel>>;
}

const NOBODY: RegistryOwners = { owners: new Map(), leads: new Map(), shares: new Map(), people: {} };

/** Ό,τι ξέρει ο αναγνώστης για την κυριότητα ενός ακινήτου, πριν από τη ρητή επιλογή. */
interface PropertyOwnership {
  readonly owners: readonly string[];
  readonly shares: ReadonlyMap<string, number>;
  readonly principals: readonly string[];
}

const NO_SHARES: ReadonlyMap<string, number> = new Map();

/** Επαφή → μερίδιο % (`commercial.owners`)· μερίδιο που δεν είναι αριθμός ⇒ η επαφή λείπει («δεν ξέρω»). */
function sharesOf(data: DocData): ReadonlyMap<string, number> {
  const commercial = data.commercial;
  const shares = new Map<string, number>();
  for (const { contactId, ownershipPct } of readStoredOwners(isRecord(commercial) ? commercial.owners : undefined)) {
    if (ownershipPct !== null) shares.set(contactId, (shares.get(contactId) ?? 0) + ownershipPct);
  }
  return shares;
}

/** Οι μεταβιβάζοντες κάθε ακινήτου, από **όλες** τις ανοιχτές του υποθέσεις. */
function sellersByProperty(cases: readonly ConveyanceCase[]): ReadonlyMap<string, readonly ConveyanceSellerParty[]> {
  const sellers = new Map<string, ConveyanceSellerParty[]>();
  for (const record of cases) {
    const id = record.subject.propertyId;
    sellers.set(id, [...(sellers.get(id) ?? []), ...record.parties.sellers]);
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
function ownershipOf(property: RegistryProperty, project: DocData | null, sellers: readonly ConveyanceSellerParty[]): PropertyOwnership {
  const context = subjectContextOf(property.id, property.data, project);
  const answer = companyPropertyOwners({
    legalPhase: context.legalPhase,
    buyerContactIds: context.parties.buyers.map((buyer) => buyer.contactId),
    sellerContactIds: sellers.map((party) => party.contactId),
    projectCompanyContactId: context.sellerSources.principalContactId,
  });
  const principals = sellers.filter((party) => party.capacity === 'principal').map((party) => party.contactId);
  return {
    owners: answer.contactIds,
    shares: answer.source === 'buyers' ? sharesOf(property.data) : NO_SHARES,
    principals: answer.source === 'sellers' ? distinctContactIds(principals) : [],
  };
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
): Promise<Map<string, PropertyOwnership>> {
  const sellers = sellersByProperty(cases);
  const sellersOf = (property: RegistryProperty) => sellers.get(property.id) ?? [];
  const projectIdOf = (property: RegistryProperty) => trimmedStringOrNull(property.data[FIELDS.PROJECT_ID]);
  const owners = new Map(properties.map((property) => [property.id, ownershipOf(property, null, sellersOf(property))] as const));
  const unanswered = properties.flatMap((property) => {
    const projectId = projectIdOf(property);
    return owners.get(property.id)?.owners.length === 0 && projectId !== null ? [{ property, projectId }] : [];
  });
  const projects = await readOwnedProjects(db, companyId, unanswered.map(({ projectId }) => projectId));
  for (const { property, projectId } of unanswered) {
    owners.set(property.id, ownershipOf(property, projects.get(projectId) ?? null, sellersOf(property)));
  }
  return owners;
}

/** Ακίνητα ιδιώτη: οι πελάτες των εντολών — χωρίς μερίδια, χωρίς πωλητές. */
function mandatedOwnership(properties: readonly RegistryProperty[]): Map<string, PropertyOwnership> {
  return new Map(properties.map((p) => [p.id, { owners: p.mandateClientContactIds, shares: NO_SHARES, principals: [] }] as const));
}

/** §26 — ο υπεύθυνος κάθε ακινήτου· επιστρέφει και τις επαφές των ρητών επιλογών (για να ονομαστεί και η παλιά). */
async function leadsOf(
  db: AdminFirestore,
  companyId: string,
  ownership: ReadonlyMap<string, PropertyOwnership>,
): Promise<{ leads: Map<string, ObligorLead | null>; designated: string[] }> {
  const asked = [...ownership].filter(([, facts]) => facts.owners.length > 0).map(([id]) => id);
  const explicit = await readObligorDesignations(db, companyId, asked);
  const leads = new Map([...ownership].map(([id, facts]) => [id, obligorLeadOf({
    owners: facts.owners,
    explicitContactId: explicit.get(id)?.contactId ?? null,
    shares: facts.shares,
    principalContactIds: facts.principals,
  })] as const));
  return { leads, designated: [...explicit.values()].map((designation) => designation.contactId) };
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

/** **Ποιος** είναι ο ιδιοκτήτης κάθε ζητούμενου ακινήτου, ποιος ο **υπεύθυνος**, και πώς λέγονται. */
export async function readRegistryOwners(db: AdminFirestore, companyId: string, question: RegistryOwnersQuestion): Promise<RegistryOwners> {
  const wanted = [...question.wanted].flatMap((id) => { const p = question.subjects.get(id); return p ? [p] : []; });
  if (wanted.length === 0 && question.partyContactIds.length === 0) return NOBODY;
  try {
    const mandated = mandatedOwnership(wanted.filter((p) => p.scope === 'owner-property'));
    const company = await companyOwners(db, companyId, wanted.filter((p) => p.scope === 'property'), question.cases);
    const ownership = new Map<string, PropertyOwnership>([...mandated, ...company]);
    const owners = new Map([...ownership].map(([id, facts]) => [id, facts.owners] as const));
    const shares = new Map([...ownership].flatMap(([id, facts]) => (facts.shares.size > 0 ? [[id, Object.fromEntries(facts.shares)] as const] : [])));
    const { leads, designated } = await leadsOf(db, companyId, ownership);
    const people = await readPeople(db, companyId, distinctContactIds([...[...owners.values()].flat(), ...designated, ...question.partyContactIds]));
    return { owners, leads, shares, people };
  } catch (error) {
    logger.warn('Οι ιδιοκτήτες του μητρώου δεν διαβάστηκαν — η οθόνη δείχνει μόνο τον ρόλο', {
      data: { companyId, properties: wanted.length, error: getErrorMessage(error, 'unknown') },
    });
    return NOBODY;
  }
}
