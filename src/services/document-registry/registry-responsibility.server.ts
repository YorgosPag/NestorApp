/**
 * =============================================================================
 * Τα ΓΕΓΟΝΟΤΑ της αλυσίδας υπευθυνότητας ενός γραφείου (ADR-915 Φ5β · §12.4)
 * =============================================================================
 *
 * Συλλέγει **ωμά** ό,τι χρειάζεται ο καθαρός κριτής (`expiry-alert-routing.ts`) — δεν κρίνει τίποτα εδώ:
 *
 * | Κρίκος | Πηγή (υπάρχον SSoT — καμία νέα πόρτα) |
 * |---|---|
 * | `explicit` (εντολή) | `NetworkActTeam.responsibleUid` — ο σπόρος `mandateActSeed(ακίνητο ιδιώτη, γραφείο)` (ADR-867) |
 * | `project` | `companies/{γραφείο}/projects/{έργο}/members` — `normalizeProjectMember` (ADR-862) |
 * | `document-manager` · `administrator` · ενεργοί | `listActiveWorkspaceMembers` → `permissionSetIds` · `isActiveWorkspaceAdministrator` |
 *
 * 🔑 **Ο μισθωτής κρίνεται τρεις φορές**: τα ακίνητα περνούν από `readCompanyProperties` (`companyId ==`), η ομάδα
 *    πράξης πρέπει να έχει `hostCompanyId` το ίδιο γραφείο, και ο κριτής κρατά **μόνο** ενεργά μέλη του χώρου.
 *
 * @module services/document-registry/registry-responsibility.server
 */

import 'server-only';

import type { Firestore } from 'firebase-admin/firestore';

import { FIELDS } from '@/config/firestore-field-constants';
import { chunkArray } from '@/lib/array-utils';
import { DOCUMENT_MANAGER_SET_ID } from '@/lib/auth/permission-sets';
import { normalizeProjectMember } from '@/lib/auth/project-member-read';
import { projectMembersCollection } from '@/lib/auth/project-member-ref';
import { listActiveWorkspaceMembers } from '@/lib/auth/workspace-membership';
import {
  PROJECT_RESPONSIBLE_ROLE_IDS,
  type OfficeResponsibilityFacts,
  type PropertyResponsibilityFacts,
} from '@/lib/document-validity/expiry-alert-routing';
import { mandateActSeed } from '@/lib/network-edge/edge-sources';
import { trimmedStringOrNull } from '@/lib/type-guards';
import { isActiveWorkspaceAdministrator } from '@/lib/workspace/workspace-administrators';
import { actTeamRef } from '@/services/network-messaging/act-team-writer';
import { REGISTRY_GET_ALL_CHUNK, type RegistryPropertyScope } from './document-registry.types';
import { readCompanyProperties } from './registry-properties.server';

type ScopedProperties = Readonly<Record<string, { readonly scope: RegistryPropertyScope }>>;

function idsOfScope(properties: ScopedProperties, scope: RegistryPropertyScope): string[] {
  return Object.entries(properties).filter(([, label]) => label.scope === scope).map(([id]) => id).sort();
}

/** Ο ρητός υπεύθυνος κάθε εντολής (ακίνητο ιδιώτη υπό θεματοφυλακή) — από την ομάδα πράξης, **μόνο** του ίδιου γραφείου. */
async function mandateResponsibles(db: Firestore, companyId: string, ownerPropertyIds: readonly string[]): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  for (const group of chunkArray([...ownerPropertyIds], REGISTRY_GET_ALL_CHUNK)) {
    const snapshots = await db.getAll(...group.map((id) => actTeamRef(db, mandateActSeed(id, companyId))));
    snapshots.forEach((snapshot, index) => {
      const data = snapshot.exists ? snapshot.data() : undefined;
      const responsibleUid = trimmedStringOrNull(data?.responsibleUid);
      if (data?.hostCompanyId === companyId && responsibleUid !== null) found.set(group[index], responsibleUid);
    });
  }
  return found;
}

/** Τα μέλη ενός έργου με ρόλο υπευθύνου (ο ενεργός χαρακτήρας κρίνεται από τον κριτή, πάνω στα μέλη του χώρου). */
async function projectResponsibles(db: Firestore, companyId: string, projectId: string): Promise<string[]> {
  const snapshot = await projectMembersCollection(db, companyId, projectId).get();
  return snapshot.docs.flatMap((doc) => {
    const data = doc.data();
    const uid = trimmedStringOrNull(data.uid);
    if (uid === null) return [];
    return PROJECT_RESPONSIBLE_ROLE_IDS.includes(normalizeProjectMember(uid, data).roleId) ? [uid] : [];
  });
}

/** Ακίνητα εταιρείας → η ομάδα του έργου τους (ένα ερώτημα **ανά έργο**, όχι ανά ακίνητο). */
async function companyPropertyFacts(
  db: Firestore,
  companyId: string,
  propertyIds: readonly string[],
): Promise<Record<string, PropertyResponsibilityFacts>> {
  const owned = await readCompanyProperties(db, companyId, propertyIds);
  const projectOf = new Map([...owned.values()].map((p) => [p.id, trimmedStringOrNull(p.data[FIELDS.PROJECT_ID])]));
  const projectIds = [...new Set([...projectOf.values()].filter((id): id is string => id !== null))].sort();
  const staff = new Map(await Promise.all(projectIds.map(async (id) => [id, await projectResponsibles(db, companyId, id)] as const)));
  return Object.fromEntries([...projectOf.entries()].map(([propertyId, projectId]) => [
    propertyId,
    { explicitUid: null, projectUids: projectId === null ? [] : staff.get(projectId) ?? [] },
  ]));
}

/** Όλα τα γεγονότα της αλυσίδας για τα ακίνητα που εμφανίζονται στο μητρώο ενός γραφείου. */
export async function readOfficeResponsibility(
  db: Firestore,
  companyId: string,
  properties: ScopedProperties,
): Promise<OfficeResponsibilityFacts> {
  const [members, companyFacts, mandates] = await Promise.all([
    listActiveWorkspaceMembers(db, companyId),
    companyPropertyFacts(db, companyId, idsOfScope(properties, 'property')),
    mandateResponsibles(db, companyId, idsOfScope(properties, 'owner-property')),
  ]);
  const mandateFacts = Object.fromEntries([...mandates.entries()].map(([id, uid]) => [id, { explicitUid: uid, projectUids: [] }]));
  return {
    activeUids: new Set(members.map((member) => member.uid)),
    documentManagers: members.filter((m) => m.permissionSetIds.includes(DOCUMENT_MANAGER_SET_ID)).map((m) => m.uid),
    administrators: members.filter((member) => isActiveWorkspaceAdministrator(member)).map((member) => member.uid),
    properties: { ...companyFacts, ...mandateFacts },
  };
}
