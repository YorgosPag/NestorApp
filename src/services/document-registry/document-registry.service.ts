/**
 * @fileoverview **ΤΟ ΜΗΤΡΩΟ ΛΗΞΕΩΝ ΕΓΓΡΑΦΩΝ** — η ανάγνωση διακομιστή (ADR-915 Φ4β).
 * @related lib/document-validity/document-registry.ts (ο πυρήνας) · services/mandate/mandate-catalog.service.ts (το ιδίωμα)
 * @module services/document-registry/document-registry.service
 *
 * `ctx.companyId + τώρα → μητρώο`. Συλλέγει έγγραφα και απαιτήσεις και τα δίνει στον **ΕΝΑ** πυρήνα
 * (`documentRegistry`): κατάσταση, ασυμφωνία, αντικατάσταση και «τι σταματά» υπολογίζονται εκεί — εδώ **μόνο** I/O.
 *
 * 🔑 **Τίποτα δεν αποθηκεύεται** (Ε2): καμία `expiresOn`, καμία σημαία «έληξε».
 * 🔑 **Ένα ρολόι**: η «σήμερα» της Ελλάδας (`conveyanceToday`) για όλες τις γραμμές, και η στιγμή που αλλάζει
 *    (`freshUntil`) — η οθόνη ξαναρωτά τότε αντί για polling (ADR-901 §14.8).
 * 🔑 **Κανένα φίλτρο διακομιστή**: η οθόνη φιλτράρει με `matchesRegistryFilter` — ένας ταξινομητής.
 * 🔑 **Φ4δ**: πέντε πηγές (αρχεία · δηλώσεις · υποθέσεις · εντολές υπό θεματοφυλακή · αγγελίες με το όνομα του γραφείου),
 *    ώστε ο πυρήνας να βλέπει **και** τις απαιτήσεις χωρίς έγγραφο — το «λείπει». Εκτός εμβέλειας ⇒ `unscopedListings`.
 * 🔒 **Εμβέλεια**: το `companyId` έρχεται από το `ctx` του `withAuth`, **ποτέ** από το αίτημα. Κάθε ερώτημα το ονομάζει
 *    στατικά (CHECK 3.10/3.35)· κάθε ακίνητο ελέγχεται ότι είναι της εταιρείας πριν δώσει «τι σταματά» ή όνομα.
 * ⚠️ **Κανένας σύνθετος δείκτης**: ισότητες + `in`, μετρημένα ζωντανά (§11.3). Ταξινόμηση στη μνήμη (επείγον =
 *    υπολογισμένο, όχι πεδίο).
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { conveyanceToday, nextConveyanceDayStart } from '@/lib/conveyance/conveyance-calendar';
import {
  documentRegistry,
  registryRowKindOf,
  registryRowPartyOf,
  registryRowPropertyIdOf,
  type DocumentRegistry,
} from '@/lib/document-validity/document-registry';
import { needsProfessionalSearch } from '@/lib/document-validity/document-next-step';
import { createModuleLogger } from '@/lib/telemetry';
import type { ConveyanceCase } from '@/types/conveyance-case';
import type { PublicListing } from '@/types/public-listing';
import {
  DOCUMENT_REGISTRY_CAPS,
  REGISTRY_SOURCES,
  type DocumentRegistryResponse,
  type RegistryLabel,
  type RegistryPropertyLabel,
  type RegistrySource,
} from './document-registry.types';
import { readRegistryFiles, registryDocumentsOf, type RegistryFile } from './registry-documents.server';
import { listingRequirementsOf, readAgencyListings, readListingsById } from './registry-listings.server';
import { readOfficeOwnerProperties } from './registry-owner-properties.server';
import { readRegistryOwners } from './registry-owners.server';
import { readRegistryPropertyAreas } from './registry-property-area.server';
import { readCompanyProperties, readDeclaredCertificateProperties, type RegistryProperty } from './registry-properties.server';
import { openCaseRequirements, readOpenCases } from './registry-requirements.server';

const logger = createModuleLogger('document-registry.service');

/** Ό,τι διάβασαν τα πέντε ερωτήματα, μαζί με όποια πηγή κόπηκε. */
interface RegistrySources {
  readonly files: readonly RegistryFile[];
  readonly declared: readonly RegistryProperty[];
  readonly cases: readonly ConveyanceCase[];
  /** Ακίνητα ιδιωτών υπό θεματοφυλακή του γραφείου (Φ4δ Ε10). */
  readonly owners: readonly RegistryProperty[];
  /** Αγγελίες με το όνομα του γραφείου (Φ4δ Ε11). */
  readonly listings: readonly PublicListing[];
  readonly truncatedSources: readonly RegistrySource[];
}

async function readSources(db: AdminFirestore, companyId: string): Promise<RegistrySources> {
  const [files, declared, cases, owners, listings] = await Promise.all([
    readRegistryFiles(db, companyId, DOCUMENT_REGISTRY_CAPS.files),
    readDeclaredCertificateProperties(db, companyId, DOCUMENT_REGISTRY_CAPS.declared),
    readOpenCases(db, companyId, DOCUMENT_REGISTRY_CAPS.cases),
    readOfficeOwnerProperties(db, companyId, DOCUMENT_REGISTRY_CAPS['owner-properties']),
    readAgencyListings(db, companyId, DOCUMENT_REGISTRY_CAPS.listings),
  ]);
  const cut: Record<RegistrySource, boolean> = {
    files: files.truncated, declared: declared.truncated, cases: cases.truncated,
    'owner-properties': owners.truncated, listings: listings.truncated,
  };
  const truncatedSources = REGISTRY_SOURCES.filter((source) => cut[source]);
  if (truncatedSources.length > 0) {
    logger.warn('Το μητρώο λήξεων χτύπησε όριο ανάγνωσης', { data: { companyId, truncatedSources } });
  }
  return {
    files: files.files, declared: declared.properties, cases: cases.cases,
    owners: owners.properties, listings: listings.listings, truncatedSources,
  };
}

/** Τα ακίνητα εταιρείας που πρέπει να διαβαστούν: όσα ονομάζουν αρχεία, υποθέσεις και αγγελίες (όχι εντολές). */
function wantedPropertyIds(sources: RegistrySources): readonly string[] {
  const owners = new Set(sources.owners.map((owner) => owner.id));
  return [
    ...sources.files.map((file) => file.propertyId).filter((id): id is string => id !== null),
    ...sources.cases.map((record) => record.subject.propertyId),
    ...sources.listings.map((listing) => listing.id).filter((id) => !owners.has(id)),
  ];
}

/**
 * Οι αγγελίες: όσες έχουν το όνομα του γραφείου ∪ όσες βρίσκονται από τα ήδη γνωστά ακίνητα (παλιές προβολές με
 * `agencyId: null` — μέχρι να ξαναπροβληθούν). Καμία διπλή ανάγνωση.
 */
async function readListings(db: AdminFirestore, sources: RegistrySources, known: readonly string[]): Promise<readonly PublicListing[]> {
  const found = new Set(sources.listings.map((listing) => listing.id));
  const more = await readListingsById(db, known.filter((id) => !found.has(id)));
  return [...sources.listings, ...more];
}

/** Δηλωμένα ακίνητα (ήδη διαβασμένα) + όσα ονομάζουν αρχεία και υποθέσεις — ένα `getAll` για τα υπόλοιπα. */
async function readProperties(
  db: AdminFirestore,
  companyId: string,
  declared: readonly RegistryProperty[],
  wanted: readonly string[],
): Promise<Map<string, RegistryProperty>> {
  const known = new Map(declared.map((property) => [property.id, property]));
  const missing = wanted.filter((id) => !known.has(id));
  const fetched = await readCompanyProperties(db, companyId, missing);
  return new Map([...known, ...fetched]);
}

function fileLabelsOf(files: readonly RegistryFile[]): Record<string, RegistryLabel> {
  return Object.fromEntries(files.map((file) => [file.fileId, { name: file.name }]));
}

function propertyLabelsOf(
  subjects: ReadonlyMap<string, RegistryProperty>,
  areas: ReadonlyMap<string, string | null>,
  owners: ReadonlyMap<string, readonly string[]>,
): Record<string, RegistryPropertyLabel> {
  return Object.fromEntries([...subjects.values()].map((p) => [p.id, {
    name: p.name, scope: p.scope, areaId: areas.get(p.id) ?? null, ownerContactIds: owners.get(p.id) ?? null,
  }]));
}

/**
 * ADR-915 §25 — τα ακίνητα που δείχνουν «Το φέρνει»: όσα έχουν γραμμή. ⚠️ Χωρίς φίλτρο «όχι αντικατεστημένη»: η
 * αντικατεστημένη έχει **πάντα** τρέχουσα στο ίδιο ακίνητο (Α5 — ίδια ομάδα), άρα το φίλτρο ήταν ισοδύναμη μετάλλαξη.
 */
function obligorPropertyIds(rows: DocumentRegistry['rows']): ReadonlySet<string> {
  return new Set(rows.map(registryRowPropertyIdOf).filter((id): id is string => id !== null));
}

/** ADR-915 §25 (5γ) — οι επαφές των γραμμών ανά πρόσωπο: το «Το φέρνει» τους λέει **αυτό** το πρόσωπο. */
function partyContactIdsOf(rows: DocumentRegistry['rows']): readonly string[] {
  return rows.flatMap((row) => {
    const contactId = registryRowPartyOf(row)?.contactId ?? null;
    return contactId === null ? [] : [contactId];
  });
}

/** Τα ακίνητα που θα δείξουν «Βρες επαγγελματία» — ο ΙΔΙΟΣ πυρήνας με την οθόνη (`needsProfessionalSearch`, ADR-915 §24). */
function professionalSearchPropertyIds(rows: DocumentRegistry['rows']): ReadonlySet<string> {
  const ids = rows.flatMap((row) => {
    const propertyId = registryRowPropertyIdOf(row);
    return propertyId !== null && needsProfessionalSearch(registryRowKindOf(row), row.state) ? [propertyId] : [];
  });
  return new Set(ids);
}

/**
 * **Το μητρώο λήξεων της εταιρείας** — ακίνητα εταιρείας **και** ακίνητα ιδιωτών υπό θεματοφυλακή του γραφείου.
 *
 * @param companyId — **από το `ctx.companyId`**, ποτέ από το αίτημα
 * @param now — **ένα** ρολόι για όλες τις γραμμές
 */
export async function readDocumentRegistry(db: AdminFirestore, companyId: string, now: Date): Promise<DocumentRegistryResponse> {
  const asOf = conveyanceToday(now);
  const sources = await readSources(db, companyId);
  const properties = await readProperties(db, companyId, sources.declared, wantedPropertyIds(sources));
  // Ό,τι είναι «του γραφείου»: ακίνητο εταιρείας (κρίθηκε στο `readCompanyProperties`) ή εντολή υπό θεματοφυλακή του.
  const subjects = new Map<string, RegistryProperty>([...properties, ...sources.owners.map((owner) => [owner.id, owner] as const)]);
  const documents = registryDocumentsOf(sources.files, [...sources.declared, ...sources.owners], properties);
  const allListings = await readListings(db, sources, [...subjects.keys()]);
  const listings = listingRequirementsOf(allListings, new Set(subjects.keys()));
  const requirements = [...openCaseRequirements(sources.cases, properties), ...listings.requirements];
  const registry = documentRegistry({ documents, requirements, asOf });
  const [areas, owners] = await Promise.all([
    readRegistryPropertyAreas(db, { wanted: professionalSearchPropertyIds(registry.rows), subjects, listings: allListings, now }),
    readRegistryOwners(db, companyId, {
      wanted: obligorPropertyIds(registry.rows), subjects, cases: sources.cases, partyContactIds: partyContactIdsOf(registry.rows),
    }),
  ]);
  return {
    ...registry,
    asOf,
    freshUntil: nextConveyanceDayStart(now).toISOString(),
    truncated: sources.truncatedSources.length > 0,
    truncatedSources: sources.truncatedSources,
    unscopedListings: listings.unscoped,
    properties: propertyLabelsOf(subjects, areas, owners.owners),
    files: fileLabelsOf(sources.files),
    people: owners.people,
  };
}
