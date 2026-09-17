/**
 * =============================================================================
 * «ΣΕ ΠΟΙΟ ΕΡΓΟ ΖΕΙ ΑΥΤΟ ΤΟ ΔΟΧΕΙΟ;» — Ο ΕΝΑΣ ΑΝΑΛΥΤΗΣ (ADR-862 Φ0 Β14)
 * =============================================================================
 *
 * 🌐 Σε Procore, ACC και ProjectWise κάθε έγγραφο CDE ζει **μέσα σε έργο**: δεν υπάρχει
 * έγγραφο «σε κατάσταση ISO 19650» χωρίς το έργο του. Εδώ το αρχείο δένεται με
 * **οντότητα** (ακίνητο · κτίριο · όροφος · έργο), και το `projectId` του `FileRecord` είναι
 * προαιρετικό — μετρημένο 2026-09-17: ένα από τα δύο ζωντανά `SUPERSEDED` **δεν** το είχε,
 * ενώ το ακίνητό του το είχε. Ο κριτής (`container-subject.ts`) χωρίς έργο δεν βρίσκει μέλος
 * ⇒ το αρχείο γίνεται αόρατο **σε όλους, για πάντα**.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΠΑΡΑΓΕΤΑΙ ΑΠΟ ΤΟΝ SERVER, ΠΟΤΕ ΑΠΟ ΤΟΝ ΠΕΛΑΤΗ
 * ─────────────────────────────────────────────────────────────────────────────
 * Το έργο αποφασίζει **ποιος βλέπει** το δοχείο. Αν το έδινε το σώμα αιτήματος, ο αιτών θα
 * διάλεγε σε ποια υπόθεση είναι μέλος (ίδιο δόγμα με το `ContainerSubjectQuery.projectId`).
 * ⇒ Διαβάζονται **μόνο** αποθηκευμένα έγγραφα, και **κάθε** βήμα της αλυσίδας πρέπει να
 * ανήκει στον **ίδιο** μισθωτή με το αρχείο (ADR-742: το κενό δεν είναι tenant).
 *
 * ⚠️ **ΓΙΑΤΙ ΔΕΝ ΚΑΛΕΙ ΤΟ `resolveProjectIdFromBuilding`** (`property-creation-policy.ts`):
 * εκείνο **ρίχνει** `BUILDING_NOT_FOUND` (σωστό για τη δημιουργία ακινήτου, όπου λείπον
 * κτίριο είναι σφάλμα πελάτη), διαβάζει **έξω** από συναλλαγή και **δεν** ελέγχει μισθωτή.
 * Εδώ το λείπον κτίριο είναι **ονομασμένη έκβαση**, όχι εξαίρεση. Άλλη ερώτηση, όχι αντίγραφο.
 *
 * @module lib/files/container-project
 * @see services/iso19650/container-custody — ο καταναλωτής, στην είσοδο στο CDE
 */

import 'server-only';

import { trimmedStringOrNull as text } from '@/lib/type-guards';

import type { DocumentReference, Firestore, Transaction } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { ENTITY_COLLECTION_MAP } from '@/config/audit-entity-collection-map';
import { isPayloadOwnedByCompany } from '@/lib/auth/tenant-ownership';

/** Γιατί **δεν** βρέθηκε έργο — ονομασμένο, ποτέ `null` που σημαίνει πολλά. */
export type ContainerProjectAbsence =
  /** Το αρχείο δεν δηλώνει ούτε `projectId` ούτε οντότητα. */
  | 'no-entity'
  /** Η οντότητα είναι είδος που **δεν ζει σε έργο** (επαφή · αγγελία ιδιοκτήτη …). */
  | 'entity-outside-projects'
  /** Η οντότητα / το κτίριο / το έργο δεν υπάρχει ή ανήκει σε **άλλο** μισθωτή. */
  | 'chain-broken'
  /** Η οντότητα υπάρχει αλλά **δεν** έχει έργο. */
  | 'entity-without-project';

export type ContainerProjectResolution =
  /** Το `FileRecord` το δηλώνει ήδη — κανένα γράψιμο δεν χρειάζεται. */
  | { readonly outcome: 'declared'; readonly projectId: string }
  /** Παράχθηκε από την οντότητα — **προς σφράγιση** στο αρχείο. */
  | { readonly outcome: 'derived'; readonly projectId: string }
  | { readonly outcome: 'none'; readonly why: ContainerProjectAbsence };

/** Αναγνώστης εγγράφων — η συναλλαγή του καλούντος, ώστε η κρίση να είναι CAS. */
type Reader = Pick<Transaction, 'get'>;


/**
 * **Σε ποιο έργο ζει αυτό το αρχείο;**
 *
 * Σειρά: (1) δηλωμένο `projectId` · (2) οντότητα `project` · (3) `projectId` της οντότητας ·
 * (4) `buildingId` της οντότητας → `projectId` του κτιρίου. Κάθε παραγόμενο έργο
 * **επαληθεύεται** ότι υπάρχει στον ίδιο μισθωτή.
 *
 * @param raw Το `FileRecord` όπως βγήκε από τη βάση.
 */
export async function resolveContainerProject(
  reader: Reader,
  db: Firestore,
  raw: Readonly<Record<string, unknown>>,
): Promise<ContainerProjectResolution> {
  const declared = text(raw.projectId);
  if (declared !== null) return { outcome: 'declared', projectId: declared };

  const companyId = text(raw.companyId);
  const entityType = text(raw.entityType);
  const entityId = text(raw.entityId);
  if (companyId === null || entityType === null || entityId === null) {
    return { outcome: 'none', why: 'no-entity' };
  }

  const candidate = await projectOfEntity(reader, db, companyId, entityType, entityId);
  if (typeof candidate !== 'string') return { outcome: 'none', why: candidate.why };

  const project = await ownedData(reader, db.collection(COLLECTIONS.PROJECTS).doc(candidate), companyId);
  return project === null
    ? { outcome: 'none', why: 'chain-broken' }
    : { outcome: 'derived', projectId: candidate };
}

/** Η αλυσίδα οντότητα → (κτίριο) → έργο, **χωρίς** την τελική επαλήθευση του έργου. */
async function projectOfEntity(
  reader: Reader,
  db: Firestore,
  companyId: string,
  entityType: string,
  entityId: string,
): Promise<string | { readonly why: ContainerProjectAbsence }> {
  if (entityType === 'project') return entityId;

  const collection = ENTITY_COLLECTION_MAP[entityType];
  if (collection === undefined) return { why: 'entity-outside-projects' };

  const entity = await ownedData(reader, db.collection(collection).doc(entityId), companyId);
  if (entity === null) return { why: 'chain-broken' };

  const direct = text(entity.projectId);
  if (direct !== null) return direct;

  const buildingId = text(entity.buildingId);
  if (buildingId === null) return { why: 'entity-without-project' };

  const building = await ownedData(reader, db.collection(COLLECTIONS.BUILDINGS).doc(buildingId), companyId);
  if (building === null) return { why: 'chain-broken' };
  return text(building.projectId) ?? { why: 'entity-without-project' };
}

/** Το έγγραφο **μόνο** αν υπάρχει **και** ανήκει στον μισθωτή· αλλιώς `null`. */
async function ownedData(
  reader: Reader,
  ref: DocumentReference,
  companyId: string,
): Promise<Record<string, unknown> | null> {
  const snapshot = await reader.get(ref);
  if (!snapshot.exists) return null;
  const data = (snapshot.data() ?? {}) as Record<string, unknown>;
  return isPayloadOwnedByCompany({ companyId: text(data.companyId) }, companyId) ? data : null;
}
