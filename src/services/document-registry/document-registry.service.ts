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
 * 🔒 **Εμβέλεια**: το `companyId` έρχεται από το `ctx` του `withAuth`, **ποτέ** από το αίτημα. Κάθε ερώτημα το ονομάζει
 *    στατικά (CHECK 3.10/3.35)· κάθε ακίνητο ελέγχεται ότι είναι της εταιρείας πριν δώσει «τι σταματά» ή όνομα.
 * ⚠️ **Κανένας σύνθετος δείκτης**: ισότητες + `in`, μετρημένα ζωντανά (§11.3). Ταξινόμηση στη μνήμη (επείγον =
 *    υπολογισμένο, όχι πεδίο).
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { conveyanceToday, nextConveyanceDayStart } from '@/lib/conveyance/conveyance-calendar';
import { documentRegistry } from '@/lib/document-validity/document-registry';
import { createModuleLogger } from '@/lib/telemetry';
import type { ConveyanceCase } from '@/types/conveyance-case';
import {
  DOCUMENT_REGISTRY_CAPS,
  REGISTRY_SOURCES,
  type DocumentRegistryResponse,
  type RegistryLabel,
  type RegistrySource,
} from './document-registry.types';
import { readRegistryFiles, registryDocumentsOf, type RegistryFile } from './registry-documents.server';
import { readCompanyProperties, readDeclaredCertificateProperties, type RegistryProperty } from './registry-properties.server';
import { listingRequirements, openCaseRequirements, readOpenCases } from './registry-requirements.server';

const logger = createModuleLogger('document-registry.service');

/** Ό,τι διάβασαν τα τρία ερωτήματα, μαζί με όποια πηγή κόπηκε. */
interface RegistrySources {
  readonly files: readonly RegistryFile[];
  readonly declared: readonly RegistryProperty[];
  readonly cases: readonly ConveyanceCase[];
  readonly truncatedSources: readonly RegistrySource[];
}

async function readSources(db: AdminFirestore, companyId: string): Promise<RegistrySources> {
  const [files, declared, cases] = await Promise.all([
    readRegistryFiles(db, companyId, DOCUMENT_REGISTRY_CAPS.files),
    readDeclaredCertificateProperties(db, companyId, DOCUMENT_REGISTRY_CAPS.declared),
    readOpenCases(db, companyId, DOCUMENT_REGISTRY_CAPS.cases),
  ]);
  const cut: Record<RegistrySource, boolean> = { files: files.truncated, declared: declared.truncated, cases: cases.truncated };
  const truncatedSources = REGISTRY_SOURCES.filter((source) => cut[source]);
  if (truncatedSources.length > 0) {
    logger.warn('Το μητρώο λήξεων χτύπησε όριο ανάγνωσης', { data: { companyId, truncatedSources } });
  }
  return { files: files.files, declared: declared.properties, cases: cases.cases, truncatedSources };
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

function labelsOf<T>(items: readonly T[], idOf: (item: T) => string, nameOf: (item: T) => string | null): Record<string, RegistryLabel> {
  return Object.fromEntries(items.map((item) => [idOf(item), { name: nameOf(item) }]));
}

/**
 * **Το μητρώο λήξεων της εταιρείας.**
 *
 * @param companyId — **από το `ctx.companyId`**, ποτέ από το αίτημα
 * @param now — **ένα** ρολόι για όλες τις γραμμές
 */
export async function readDocumentRegistry(db: AdminFirestore, companyId: string, now: Date): Promise<DocumentRegistryResponse> {
  const asOf = conveyanceToday(now);
  const sources = await readSources(db, companyId);
  const wanted = [
    ...sources.files.map((file) => file.propertyId).filter((id): id is string => id !== null),
    ...sources.cases.map((record) => record.subject.propertyId),
  ];
  const properties = await readProperties(db, companyId, sources.declared, wanted);
  const documents = registryDocumentsOf(sources.files, sources.declared, properties);
  const documentPropertyIds = documents.map((document) => document.propertyId).filter((id): id is string => id !== null);
  const requirements = [
    ...openCaseRequirements(sources.cases, properties),
    ...(await listingRequirements(db, documentPropertyIds)),
  ];
  const registry = documentRegistry({ documents, requirements, asOf });
  return {
    ...registry,
    asOf,
    freshUntil: nextConveyanceDayStart(now).toISOString(),
    truncated: sources.truncatedSources.length > 0,
    truncatedSources: sources.truncatedSources,
    properties: labelsOf([...properties.values()], (property) => property.id, (property) => property.name),
    files: labelsOf<RegistryFile>(sources.files, (file) => file.fileId, (file) => file.name),
  };
}
