/**
 * @fileoverview Μητρώο λήξεων — τα ΑΚΙΝΗΤΑ της εταιρείας (ADR-915 Φ4β).
 * @module services/document-registry/registry-properties.server
 *
 * Δύο αναγνώσεις, καμία σάρωση όλων των ακινήτων:
 *  - **δηλωμένο ΠΕΑ** — `companyId ==` + `energy.class in ENERGY_CLASSES`. Ο {@link readEnergyCertificate} δίνει
 *    ημερομηνία **μόνο** με κλάση, άρα το ερώτημα πιάνει ακριβώς όσα δηλώνουν ΠΕΑ — **και** τα παλιά έγγραφα με
 *    `certificateDate`, που ένα εύρος στο `issuedOn` θα έχανε σιωπηλά (και θα ήθελε σύνθετο δείκτη).
 *    🔑 Μετρημένο ζωντανά 2026-10-15: `in` + `==` **χωρίς** σύνθετο δείκτη· ο μάρτυρας `== + >` απέτυχε
 *    `FAILED_PRECONDITION` ⇒ ο ανιχνευτής ήταν ευαίσθητος.
 *  - **ονομαστικά** — `getAll` σε ομάδες, για όσα ονομάζουν αρχεία και υποθέσεις. Ποτέ μία ανάγνωση ανά γραμμή.
 *
 * 🔒 **Εμβέλεια**: ακίνητο άλλης εταιρείας δεν επιστρέφεται ποτέ — ίδια απάντηση με το ανύπαρκτο.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { ENERGY_CLASSES } from '@/constants/energy-classes';
import { chunkArray } from '@/lib/array-utils';
import { readEnergyCertificate, type EnergyCertificate } from '@/lib/energy-certificate/energy-certificate';
import { trimmedStringOrNull } from '@/lib/type-guards';
import type { GeoPoint } from '@/types/geo/coordinates';
import { REGISTRY_GET_ALL_CHUNK, type RegistryPropertyScope } from './document-registry.types';

type DocData = Readonly<Record<string, unknown>>;

export interface RegistryProperty {
  readonly id: string;
  /** Ακίνητο εταιρείας (`properties`) ή ακίνητο ιδιώτη υπό θεματοφυλακή του γραφείου (`owner_properties`, Φ4δ Ε10). */
  readonly scope: RegistryPropertyScope;
  readonly name: string | null;
  readonly certificate: EnergyCertificate;
  /**
   * Το σημείο που **δήλωσε** ο ιδιώτης για το ακίνητό του (`OwnerProperty.place`, κλάδος `declared`) — για την περιοχή
   * του «Βρες επαγγελματία» (ADR-915 §24). `null` για ακίνητο εταιρείας: εκείνο βρίσκει θέση από κτίριο/έργο, και
   * μόνο όταν χρειαστεί (`registry-property-area.server.ts`).
   */
  readonly declaredPoint: GeoPoint | null;
  /** Το ωμό έγγραφο — για τον κοινό μετασχηματισμό της υπόθεσης (`subjectContextOf`). */
  readonly data: DocData;
}

/** Το πεδίο του μπλοκ ΠΕΑ στο έγγραφο ακινήτου — ένα όνομα για το ερώτημα και την ανάγνωση. */
const ENERGY_FIELD = 'energy';

function registryPropertyOf(id: string, data: DocData): RegistryProperty {
  return {
    id,
    scope: 'property',
    name: trimmedStringOrNull(data.name),
    certificate: readEnergyCertificate(data[ENERGY_FIELD]),
    declaredPoint: null,
    data,
  };
}

/** Τα ακίνητα με αυτές τις ταυτότητες **που ανήκουν στην εταιρεία**. */
export async function readCompanyProperties(
  db: AdminFirestore,
  companyId: string,
  ids: readonly string[],
): Promise<Map<string, RegistryProperty>> {
  const owned = new Map<string, RegistryProperty>();
  for (const group of chunkArray([...new Set(ids)], REGISTRY_GET_ALL_CHUNK)) {
    const snapshots = await db.getAll(...group.map((id) => db.collection(COLLECTIONS.PROPERTIES).doc(id)));
    for (const snapshot of snapshots) {
      const data = snapshot.exists ? snapshot.data() : undefined;
      if (data !== undefined && data[FIELDS.COMPANY_ID] === companyId) owned.set(snapshot.id, registryPropertyOf(snapshot.id, data));
    }
  }
  return owned;
}

interface DeclaredCertificateProperties {
  readonly properties: readonly RegistryProperty[];
  readonly truncated: boolean;
}

/** Τα ακίνητα της εταιρείας που **δηλώνουν** ΠΕΑ (κλάση) — με ή χωρίς αρχείο-πηγή. */
export async function readDeclaredCertificateProperties(
  db: AdminFirestore,
  companyId: string,
  cap: number,
): Promise<DeclaredCertificateProperties> {
  const snapshot = await db
    .collection(COLLECTIONS.PROPERTIES)
    .where(FIELDS.COMPANY_ID, '==', companyId)
    // Στατικό όνομα (όχι `${ENERGY_FIELD}.class`): αλλιώς η CHECK 3.91 το βλέπει «δυναμικό» και δεν το κρίνει.
    .where('energy.class', 'in', [...ENERGY_CLASSES])
    .limit(cap + 1)
    .get();
  return {
    properties: snapshot.docs.slice(0, cap).map((doc) => registryPropertyOf(doc.id, doc.data())),
    truncated: snapshot.size > cap,
  };
}
