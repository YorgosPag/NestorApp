/**
 * =============================================================================
 * Conveyance — πλαίσιο υπόθεσης από τα δεδομένα του ακινήτου (ADR-901 §5.1 · §5.11)
 * =============================================================================
 *
 * Διαβάζει το ακίνητο (και το έργο του) **μία φορά** και παράγει:
 * - το αντικείμενο της υπόθεσης (ακίνητο + κτίριο + έργο + παρακολουθήματα πώλησης)
 * - τα μέρη (εταιρεία-πωλητής = `project.linkedCompanyId`, ADR-232 · αγοραστές = `commercial.owners`)
 * - τις πηγές των παραγόμενων γεγονότων (τύπος, παρακολουθήματα, οικοπεδούχοι ⇒ αντιπαροχή)
 * - τη νομική φάση (ADR-230) — από αυτήν παράγεται το `signed`
 *
 * Ο έλεγχος μισθωτή γίνεται ΠΡΙΝ φτάσουμε εδώ (`requirePropertyInTenantScope` στο route)·
 * εδώ ξαναελέγχεται ως belt-and-suspenders (N.7.2 #4).
 *
 * @module services/conveyance/conveyance-subject.server
 */

import 'server-only';

import type { Firestore } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import { ownedOrNull } from '@/lib/auth/tenant-ownership';
import { normalizePropertyType } from '@/constants/property-type-aliases';
import { isLegalPhase, type LegalPhase } from '@/constants/legal-phases';
import type { ConveyanceProfile } from '@/config/conveyance-checklist/types';
import type { FactSources } from '@/lib/conveyance/derive-facts';
import type {
  ConveyanceAppurtenanceRef,
  ConveyanceCaseParties,
  ConveyanceCaseSubject,
} from '@/types/conveyance-case';

export interface ConveyanceSubjectContext {
  readonly propertyName: string | null;
  readonly projectId: string | null;
  readonly subject: ConveyanceCaseSubject;
  readonly parties: ConveyanceCaseParties;
  readonly factSources: FactSources;
  readonly legalPhase: LegalPhase | null;
}

/** Η εταιρεία μισθωτής πουλά ακίνητα των έργων της ⇒ πάντα νεόδμητο-εταιρικό (ADR-901 §5.11). */
const COMPANY_PROFILE: ConveyanceProfile = 'new_build_company';

type DocData = Record<string, unknown>;

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asRecord(value: unknown): DocData {
  return value !== null && typeof value === 'object' ? (value as DocData) : {};
}

/** Τα παρακολουθήματα που **πωλούνται μαζί** (ADR-199 `includedInSale`). */
function appurtenancesOf(property: DocData): ConveyanceAppurtenanceRef[] {
  const spaces = Array.isArray(property.linkedSpaces) ? property.linkedSpaces : [];
  return spaces.flatMap((raw): ConveyanceAppurtenanceRef[] => {
    const space = asRecord(raw);
    const spaceId = stringOrNull(space.spaceId);
    if (spaceId === null || space.includedInSale === false) return [];
    if (space.spaceType === 'parking') return [{ entityType: 'parking_spot', entityId: spaceId }];
    if (space.spaceType === 'storage') return [{ entityType: 'storage', entityId: spaceId }];
    return [];
  });
}

function buyersOf(property: DocData): ConveyanceCaseParties['buyers'] {
  const owners = asRecord(property.commercial).owners;
  if (!Array.isArray(owners)) return [];
  return owners
    .map((owner) => stringOrNull(asRecord(owner).contactId))
    .filter((contactId): contactId is string => contactId !== null)
    .map((contactId) => ({ contactId }));
}

async function readProject(db: Firestore, projectId: string | null, companyId: string): Promise<DocData | null> {
  if (projectId === null) return null;
  const snap = await db.collection(COLLECTIONS.PROJECTS).doc(projectId).get();
  return ownedOrNull(snap.data(), companyId, { resource: 'project', resourceId: projectId, path: 'conveyance' });
}

/**
 * Η **καθαρή** παραγωγή του πλαισίου από τα δύο έγγραφα — ο ΙΔΙΟΣ μετασχηματισμός για τον loader και για τον
 * αποδέκτη CDC (ADR-905 §6), που τη συγκρίνει πριν/μετά μιας αλλαγής ακινήτου ή έργου.
 */
export function subjectContextOf(propertyId: string, property: DocData, project: DocData | null): ConveyanceSubjectContext {
  const projectId = stringOrNull(property.projectId);
  const appurtenances = appurtenancesOf(property);
  const landowners = project && Array.isArray(project.landownerContactIds) ? project.landownerContactIds.length : null;
  const rawPhase = asRecord(property.commercial).legalPhase;
  const legalPhase = isLegalPhase(rawPhase) ? rawPhase : null;

  return {
    propertyName: stringOrNull(property.name),
    projectId,
    subject: { kind: 'property', propertyId, buildingId: stringOrNull(property.buildingId), projectId, appurtenances },
    parties: {
      seller: { contactId: stringOrNull(project?.linkedCompanyId), kind: 'legal_entity' },
      buyers: buyersOf(property),
    },
    factSources: {
      profile: COMPANY_PROFILE,
      propertyType: normalizePropertyType(property.type),
      appurtenanceCount: appurtenances.length,
      landownerCount: landowners,
    },
    legalPhase,
  };
}

/**
 * Ό,τι από το πλαίσιο **φαίνεται** σε μια ήδη ανοιχτή υπόθεση: όνομα · πηγές γεγονότων · νομική φάση. Το
 * `subject`/`parties` της υπόθεσης είναι **στιγμιότυπο** του ανοίγματος (`newCase`) — η αλλαγή τους στο ακίνητο
 * δεν αλλάζει την όψη, άρα δεν είναι λόγος σήματος.
 */
export function subjectViewFacts(context: ConveyanceSubjectContext): Pick<ConveyanceSubjectContext, 'propertyName' | 'factSources' | 'legalPhase'> {
  return { propertyName: context.propertyName, factSources: context.factSources, legalPhase: context.legalPhase };
}

/** Το έργο του ακινήτου, αν ανήκει στον μισθωτή. */
export function readSubjectProject(db: Firestore, property: DocData, companyId: string): Promise<DocData | null> {
  return readProject(db, stringOrNull(property.projectId), companyId);
}

/** `null` ⇒ το ακίνητο δεν υπάρχει ή δεν ανήκει στον μισθωτή. */
export async function loadConveyanceSubject(
  db: Firestore,
  companyId: string,
  propertyId: string,
): Promise<ConveyanceSubjectContext | null> {
  const snap = await db.collection(COLLECTIONS.PROPERTIES).doc(propertyId).get();
  const property = ownedOrNull(snap.data(), companyId, { resource: 'property', resourceId: propertyId, path: 'conveyance' });
  if (!property) return null;
  return subjectContextOf(propertyId, property, await readSubjectProject(db, property, companyId));
}
