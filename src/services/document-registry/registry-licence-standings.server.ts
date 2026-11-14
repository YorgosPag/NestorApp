/**
 * @fileoverview Μητρώο λήξεων — **η τάξη που μετρά** για κάθε επαφή με άδεια που έχει τάξεις (ADR-915 §40.7 Φ3).
 * @related lib/professional/registry-check-judgment.ts (`judgeRegistryCheck` · `licenceStandingOf` — η κρίση) ·
 *   services/professional-registry/registry-check-record.service.ts (`readRegistryCheckRecords` — η ανάγνωση) ·
 *   registry-owners.server.ts (ο καλών: η ΙΔΙΑ ανάγνωση επαφών που δίνει τα ονόματα)
 * @module services/document-registry/registry-licence-standings.server
 *
 * 🔑 **Καμία νέα ανάγνωση επαφών**: τα έγγραφα έρχονται από το `readPeople` (ήδη με έλεγχο μισθωτή). Νέα ανάγνωση
 *    γίνεται **μόνο** για τους αποθηκευμένους ελέγχους, κατά ταυτότητα, και **μόνο** για άδειες με `gradeScheme`.
 * 🔑 **Η αρχή πάνω από τη δήλωση**, και μόνο για τον **τρέχοντα** αριθμό και επώνυμο (`judgeRegistryCheck`).
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { PROFESSIONAL_LICENCE_SPECS, type ProfessionalLicence } from '@/config/professional-licences';
import { chunkArray } from '@/lib/array-utils';
import { readContactLicences } from '@/lib/contacts/contact-licences';
import { judgeRegistryCheck, licenceStandingOf } from '@/lib/professional/registry-check-judgment';
import {
  readRegistryCheckRecords,
  registryCheckDocId,
  type RegistryCheckKey,
} from '@/services/professional-registry/registry-check-record.service';
import { registryCheckSubjectOf } from '@/services/professional-registry/registry-check.service';
import type { ContactLicence } from '@/types/contacts/contact-licences';
import type { LicenceStanding, ProfessionalRegistryCheckRecord } from '@/types/professional-registry-check';
import { REGISTRY_GET_ALL_CHUNK } from './document-registry.types';

type DocData = Readonly<Record<string, unknown>>;

/** Επαφή → (άδεια → τάξη που μετρά). Επαφή χωρίς άδεια με τάξεις λείπει. */
export type LicenceStandings = ReadonlyMap<string, Readonly<Partial<Record<ProfessionalLicence, LicenceStanding>>>>;

interface GradedHolding extends RegistryCheckKey {
  readonly contact: DocData;
  readonly held: ContactLicence;
}

/** Οι άδειες με τάξεις που κρατά κάθε επαφή — οι μόνες που ρωτούν το αποθηκευμένο μητρώο. */
function gradedHoldingsOf(contacts: ReadonlyMap<string, DocData>): readonly GradedHolding[] {
  return [...contacts].flatMap(([contactId, contact]) => readContactLicences(contact.licences)
    .filter((held) => PROFESSIONAL_LICENCE_SPECS[held.licence].gradeScheme !== null)
    .map((held) => ({ contactId, licence: held.licence, contact, held })));
}

async function recordsOf(
  db: AdminFirestore,
  companyId: string,
  holdings: readonly GradedHolding[],
): Promise<ReadonlyMap<string, ProfessionalRegistryCheckRecord>> {
  const records = new Map<string, ProfessionalRegistryCheckRecord>();
  for (const group of chunkArray([...holdings], REGISTRY_GET_ALL_CHUNK)) {
    for (const [id, record] of await readRegistryCheckRecords(db, companyId, group)) records.set(id, record);
  }
  return records;
}

/** **Η τάξη που μετρά**, ανά επαφή και άδεια — αρχή (`verified`) αλλιώς δήλωση. */
export async function readLicenceStandings(
  db: AdminFirestore,
  companyId: string,
  contacts: ReadonlyMap<string, DocData>,
): Promise<LicenceStandings> {
  const holdings = gradedHoldingsOf(contacts);
  if (holdings.length === 0) return new Map();
  const records = await recordsOf(db, companyId, holdings);
  const standings = new Map<string, Partial<Record<ProfessionalLicence, LicenceStanding>>>();
  for (const { contactId, licence, contact, held } of holdings) {
    const record = records.get(registryCheckDocId(contactId, licence)) ?? null;
    const judgment = judgeRegistryCheck(registryCheckSubjectOf(contact, licence), record);
    standings.set(contactId, { ...standings.get(contactId), [licence]: licenceStandingOf(held, judgment) });
  }
  return standings;
}
