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
 * 🔑 **§35**: οι αποφάσεις μόνιμης υποχρέωσης είναι **τρίτος παραγωγός** απαιτήσεων (`upkeepRequirementsOf`), δίπλα στη
 *    μεταβίβαση και την αγγελία — ο ΙΔΙΟΣ πυρήνας λέει «λείπει» / «τι σταματά». Απόφαση για ακίνητο που δεν είναι πια του
 *    γραφείου **αγνοείται** (ποτέ κενό για ξένο ακίνητο).
 * 🔑 **§36**: η ενότητα βλέπει **κάθε** ακίνητο της εταιρείας (πηγή `company-properties`) — και το ακίνητο χωρίς κανένα
 *    έγγραφο, που είναι ακριβώς αυτό που πιθανότατα του λείπει η ΥΔΕ. Αποσυρμένο (κάδος · αρχείο) ⇒ εκτός ενότητας.
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
import { normalizeOperationalStatus } from '@/constants/operational-statuses';
import { resolvedPropertyClassOf } from '@/constants/property-classification';
import { upkeepItemsOf, upkeepRequirementsOf } from '@/lib/document-validity/property-upkeep';
import type { ConveyanceCase } from '@/types/conveyance-case';
import type { PublicListing } from '@/types/public-listing';
import {
  DOCUMENT_REGISTRY_CAPS,
  REGISTRY_SOURCES,
  type DocumentRegistryResponse,
  type RegistryFileLabel,
  type RegistryPropertyLabel,
  type RegistrySource,
} from './document-registry.types';
import { readRegistryFiles, readUndeclaredFiles, registryDocumentsOf, type RegistryFile } from './registry-documents.server';
import { listingRequirementsOf, readAgencyListings, readListingsById } from './registry-listings.server';
import { readOfficeOwnerProperties } from './registry-owner-properties.server';
import { readRegistryIssuance, type RegistryIssuanceReading } from './registry-issuance.server';
import { readRegistryOwners, type RegistryOwners, type RegistryOwnersQuestion } from './registry-owners.server';
import { readRegistryPropertyAreas } from './registry-property-area.server';
import {
  readCompanyProperties,
  readCompanyPropertyPortfolio,
  readDeclaredCertificateProperties,
  type RegistryProperty,
} from './registry-properties.server';
import { openCaseRequirements, readOpenCases } from './registry-requirements.server';
import type { StoredUpkeepDeclaration } from './upkeep-declaration-schema';
import { readUpkeepDeclarations } from './upkeep-declarations.server';
import { isRetiredRegistryProperty, upkeepSubjectOf } from './upkeep-subject.server';

const logger = createModuleLogger('document-registry.service');

/** Ό,τι διάβασαν τα πέντε ερωτήματα, μαζί με όποια πηγή κόπηκε. */
interface RegistrySources {
  /** Αρχεία με γεγονότα **και** (ADR-915 §33) αρχεία χωρίς στοιχεία — ξένα σύνολα (`facts` υπάρχει ή όχι). */
  readonly files: readonly RegistryFile[];
  readonly declared: readonly RegistryProperty[];
  /** §36 — όλα τα ακίνητα της εταιρείας (φραγμένα): υποκείμενα της μόνιμης υποχρέωσης, και γνωστά χωρίς δεύτερη ανάγνωση. */
  readonly portfolio: readonly RegistryProperty[];
  readonly cases: readonly ConveyanceCase[];
  /** Ακίνητα ιδιωτών υπό θεματοφυλακή του γραφείου (Φ4δ Ε10). */
  readonly owners: readonly RegistryProperty[];
  /** Αγγελίες με το όνομα του γραφείου (Φ4δ Ε11). */
  readonly listings: readonly PublicListing[];
  /** §35 — οι αποφάσεις μόνιμης υποχρέωσης του γραφείου (πριν το φίλτρο «είναι ακόμη του γραφείου;»). */
  readonly upkeep: readonly StoredUpkeepDeclaration[];
  readonly truncatedSources: readonly RegistrySource[];
}

async function readSources(db: AdminFirestore, companyId: string): Promise<RegistrySources> {
  const [files, declared, cases, owners, listings, undeclared, upkeep, portfolio] = await Promise.all([
    readRegistryFiles(db, companyId, DOCUMENT_REGISTRY_CAPS.files),
    readDeclaredCertificateProperties(db, companyId, DOCUMENT_REGISTRY_CAPS.declared),
    readOpenCases(db, companyId, DOCUMENT_REGISTRY_CAPS.cases),
    readOfficeOwnerProperties(db, companyId, DOCUMENT_REGISTRY_CAPS['owner-properties']),
    readAgencyListings(db, companyId, DOCUMENT_REGISTRY_CAPS.listings),
    readUndeclaredFiles(db, companyId, DOCUMENT_REGISTRY_CAPS['undeclared-files']),
    readUpkeepDeclarations(db, companyId, DOCUMENT_REGISTRY_CAPS['upkeep-declarations']),
    readCompanyPropertyPortfolio(db, companyId, DOCUMENT_REGISTRY_CAPS['company-properties']),
  ]);
  const cut: Record<RegistrySource, boolean> = {
    files: files.truncated, declared: declared.truncated, cases: cases.truncated,
    'owner-properties': owners.truncated, listings: listings.truncated,
    // §27 — ο κατάλογος αναθέσεων διαβάζεται ΜΕΤΑ τις γραμμές (μόνο όπου δείχνεται «Ανάθεση»)· το όριό του μπαίνει εκεί.
    'issuance-assignments': false,
    'undeclared-files': undeclared.truncated,
    'upkeep-declarations': upkeep.truncated,
    'company-properties': portfolio.truncated,
  };
  const truncatedSources = REGISTRY_SOURCES.filter((source) => cut[source]);
  if (truncatedSources.length > 0) {
    logger.warn('Το μητρώο λήξεων χτύπησε όριο ανάγνωσης', { data: { companyId, truncatedSources } });
  }
  return {
    files: [...files.files, ...undeclared.files], declared: declared.properties, portfolio: portfolio.properties, cases: cases.cases,
    owners: owners.properties, listings: listings.listings, upkeep: upkeep.declarations, truncatedSources,
  };
}

/**
 * Τα ακίνητα εταιρείας που πρέπει να διαβαστούν: όσα ονομάζουν αρχεία, υποθέσεις, αγγελίες **και** (§35) αποφάσεις
 * μόνιμης υποχρέωσης — αλλιώς ένα επιβεβαιωμένο ακίνητο χωρίς κανένα έγγραφο δεν θα έλεγε ποτέ «λείπει». Όχι εντολές.
 */
function wantedPropertyIds(sources: RegistrySources): readonly string[] {
  const owners = new Set(sources.owners.map((owner) => owner.id));
  return [
    ...sources.files.map((file) => file.propertyId).filter((id): id is string => id !== null),
    ...sources.cases.map((record) => record.subject.propertyId),
    ...sources.listings.map((listing) => listing.id).filter((id) => !owners.has(id)),
    ...sources.upkeep.filter((declaration) => declaration.scope === 'property').map((declaration) => declaration.propertyId),
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

/**
 * Τα ακίνητα εταιρείας του μητρώου: δηλωμένα · §36 τα **ζωντανά** του χαρτοφυλακίου · όσα ονομάζουν αρχεία, υποθέσεις,
 * αγγελίες, αποφάσεις. Ό,τι είναι ήδη διαβασμένο δεν ξαναδιαβάζεται — ένα `getAll` μόνο για όσα λείπουν (π.χ. πέρα από
 * το όριο του χαρτοφυλακίου). Αποσυρμένο ακίνητο του χαρτοφυλακίου μπαίνει **μόνο** αν το ονομάζει κάτι (όπως πριν).
 */
async function readProperties(
  db: AdminFirestore,
  companyId: string,
  sources: Pick<RegistrySources, 'declared' | 'portfolio'>,
  wanted: readonly string[],
): Promise<Map<string, RegistryProperty>> {
  const known = new Map([...sources.declared, ...sources.portfolio].map((property) => [property.id, property]));
  const fetched = await readCompanyProperties(db, companyId, wanted.filter((id) => !known.has(id)));
  const named = wanted.flatMap((id) => {
    const property = known.get(id);
    return property === undefined ? [] : [property];
  });
  const live = sources.portfolio.filter((property) => !isRetiredRegistryProperty(property));
  return new Map([...sources.declared, ...live, ...named, ...fetched.values()].map((property) => [property.id, property]));
}

function fileLabelsOf(files: readonly RegistryFile[]): Record<string, RegistryFileLabel> {
  return Object.fromEntries(files.map((file) => [file.fileId, { name: file.name, storagePath: file.storagePath }]));
}

function propertyLabelsOf(
  subjects: ReadonlyMap<string, RegistryProperty>,
  areas: ReadonlyMap<string, string | null>,
  owners: Pick<RegistryOwners, 'owners' | 'leads' | 'shares'>,
): Record<string, RegistryPropertyLabel> {
  return Object.fromEntries([...subjects.values()].map((p) => [p.id, {
    name: p.name,
    scope: p.scope,
    areaId: areas.get(p.id) ?? null,
    ownerContactIds: owners.owners.get(p.id) ?? null,
    obligorLead: owners.leads.get(p.id) ?? null,
    ownerShares: owners.shares.get(p.id) ?? {},
    propertyClass: resolvedPropertyClassOf(p.data.type),
    phase: normalizeOperationalStatus(p.data.operationalStatus),
  }]));
}

/**
 * §35 — οι αποφάσεις **των ακινήτων του γραφείου** (ό,τι έπαψε να είναι του γραφείου αγνοείται), οι απαιτήσεις τους, και
 * η ενότητα «Μόνιμες υποχρεώσεις» πάνω στα ΙΔΙΑ γεγονότα (`upkeepSubjectOf`) με την καρτέλα και την πράξη.
 * §36 — **ζωντανά** μόνο: ακίνητο στον κάδο ή στο αρχείο δεν προτείνεται και δεν γεννά «λείπει» (ίδιο φίλτρο με τον κριτή).
 */
function upkeepOf(sources: RegistrySources, subjects: ReadonlyMap<string, RegistryProperty>) {
  const live = [...subjects.values()].filter((property) => !isRetiredRegistryProperty(property));
  const liveIds = new Set(live.map((property) => property.id));
  const declarations = sources.upkeep.filter((declaration) => liveIds.has(declaration.propertyId));
  return { requirements: upkeepRequirementsOf(declarations), items: upkeepItemsOf(live.map(upkeepSubjectOf), declarations) };
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
  const properties = await readProperties(db, companyId, sources, wantedPropertyIds(sources));
  // Ό,τι είναι «του γραφείου»: ακίνητο εταιρείας (κρίθηκε στο `readCompanyProperties`) ή εντολή υπό θεματοφυλακή του.
  const subjects = new Map<string, RegistryProperty>([...properties, ...sources.owners.map((owner) => [owner.id, owner] as const)]);
  const documents = registryDocumentsOf(sources.files, [...sources.declared, ...sources.owners], properties);
  const allListings = await readListings(db, sources, [...subjects.keys()]);
  const listings = listingRequirementsOf(allListings, new Set(subjects.keys()));
  const upkeep = upkeepOf(sources, subjects);
  const requirements = [...openCaseRequirements(sources.cases, properties), ...listings.requirements, ...upkeep.requirements];
  const registry = documentRegistry({ documents, requirements, asOf });
  const [areas, { owners, issuance }] = await Promise.all([
    readRegistryPropertyAreas(db, { wanted: professionalSearchPropertyIds(registry.rows), subjects, listings: allListings, now }),
    readOwnersAndIssuance(db, companyId, registry.rows, { subjects, cases: sources.cases }),
  ]);
  const truncatedSources = issuance.truncated ? [...sources.truncatedSources, 'issuance-assignments' as const] : sources.truncatedSources;
  return {
    ...registry,
    asOf,
    freshUntil: nextConveyanceDayStart(now).toISOString(),
    truncated: truncatedSources.length > 0,
    truncatedSources,
    unscopedListings: listings.unscoped,
    properties: propertyLabelsOf(subjects, areas, owners),
    files: fileLabelsOf(sources.files),
    people: owners.people,
    issuance: issuance.issuance,
    issuanceKnown: issuance.known,
    upkeep: upkeep.items,
  };
}

/**
 * §27 — πρώτα οι αναθέσεις (ένα ερώτημα), μετά οι ιδιοκτήτες: οι επαγγελματίες και οι υποψήφιοι **ονομάζονται** στην
 * ΙΔΙΑ ανάγνωση επαφών με τους ιδιοκτήτες (ίδιος έλεγχος μισθωτή — ξένη ≡ ανύπαρκτη).
 */
async function readOwnersAndIssuance(
  db: AdminFirestore,
  companyId: string,
  rows: DocumentRegistry['rows'],
  known: Pick<RegistryOwnersQuestion, 'subjects' | 'cases'>,
): Promise<{ readonly owners: RegistryOwners; readonly issuance: RegistryIssuanceReading }> {
  const issuance = await readRegistryIssuance(db, companyId, rows);
  const owners = await readRegistryOwners(db, companyId, {
    ...known,
    wanted: obligorPropertyIds(rows),
    partyContactIds: [...partyContactIdsOf(rows), ...issuance.contactIds],
  });
  return { owners, issuance };
}
