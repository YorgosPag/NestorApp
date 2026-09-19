/**
 * Centralized Firestore → API Mappers — Single Source of Truth
 *
 * Κάθε mapper παράγει τον τύπο από το αντίστοιχο TypeScript interface.
 * Αν αλλάξει το interface → ο mapper ενημερώνεται ΕΔΩ ΜΟΝΟ.
 *
 * @see ADR-index for centralization decision
 */

import type { Storage, StorageType } from '@/types/storage/contracts';
import type {
  ParkingSpot,
  ParkingSpotType,
  ParkingLocationZone,
} from '@/types/parking';
import type {
  Property,
  LegacySalesStatus,
  LinkedSpace,
  PropertyLevel,
  LevelData,
  PropertyCommercialData,
  PropertyCoverage,
} from '@/types/property';
import type { SpaceCommercialData } from '@/types/sales-shared';
import type { CommercialStatus } from '@/constants/commercial-statuses';
import type { OperationalStatus } from '@/constants/operational-statuses';
import { resolveSpaceStatuses, type SpaceStatuses } from '@/lib/spaces/space-status-split';
import { normalizePropertyType } from '@/constants/property-type-aliases';
import { normalizeToDate } from '@/lib/date-local';

/**
 * **Τα πεδία παρακολουθήματος πώλησης** (ADR-199) — χιλιοστά, εμπορική κατάσταση, όροι.
 *
 * 🔴 **ΗΤΑΝ ΓΡΑΜΜΕΝΑ ΔΥΟ ΦΟΡΕΣ, ΑΥΤΟΛΕΞΕΙ** — στον `mapStorageDoc` και στον
 * `mapParkingDoc`. Το `jscpd` (N.18 / CHECK 3.28) τα ανέφερε ως κλώνο **13 γραμμών**
 * ενόσω το αρχείο αγγιζόταν για το ADR-842 §7.6.12. Ο κλώνος **προϋπήρχε**· η επιλογή
 * ήταν *«παράκαμψη με `SKIP_JSCPD_DIFF=1`»* ή *«εξαγωγή»* — και μια παράκαμψη διδάσκει
 * τον επόμενο να παρακάμπτει (N.0.2, κανόνας προσκόπου).
 *
 * 🔑 **Αποθήκη και θέση στάθμευσης είναι ΚΑΙ ΟΙ ΔΥΟ «χώρος-παρακολούθημα»** — η ίδια
 * πρόταση του τομέα, όχι τυχαία ομοιότητα κειμένου. Γι' αυτό η εξαγωγή είναι σωστή και
 * όχι απλώς βολική: την ημέρα που το ADR-199 αποκτήσει τέταρτο πεδίο, θα το γράψει
 * **κανείς μία φορά** αντί να το ξεχάσει στη μία από τις δύο.
 *
 * ⚠️ **Το `undefined` και το `null` ΔΕΝ συγχέονται** στα χιλιοστά: `null` = *«δηλώθηκε
 * ρητά ότι δεν έχει»*, απουσία = *«κανείς δεν ρώτησε»*. Η τριάδα διατηρείται αυτούσια
 * από την αρχική γραφή.
 */
function spaceAppurtenanceFields(data: Record<string, unknown>): SpaceStatuses & {
  readonly millesimalShares: number | null | undefined;
  readonly commercial: SpaceCommercialData | undefined;
} {
  return {
    millesimalShares:
      typeof data.millesimalShares === 'number'
        ? data.millesimalShares
        : data.millesimalShares === null
          ? null
          : undefined,
    // ADR-777 §8.60.20 — κάδος · διάθεση · λειτουργία από τον ΕΝΑ αναγνώστη: τα νέα πεδία
    // κερδίζουν, το παλιό ανάμεικτο `status` συμπληρώνει μόνο ό,τι λείπει, καμία μαντεψιά.
    ...resolveSpaceStatuses(data),
    commercial: data.commercial as SpaceCommercialData | undefined,
  };
}

// =============================================================================
// STORAGE MAPPER
// =============================================================================

const VALID_STORAGE_TYPES: readonly string[] = [
  'storage', 'large', 'small', 'basement', 'ground', 'special', 'garage', 'warehouse', 'parking',
];

export function isValidStorageType(value: string): value is StorageType {
  return VALID_STORAGE_TYPES.includes(value);
}

/**
 * Map a Firestore storage document to a type-safe Storage object.
 *
 * Covers every field declared in `Storage` (types/storage/contracts.ts).
 * Connection fields (buildingId, floorId, projectId, …) are always optional
 * because entities are created autonomously — links come later.
 */
export function mapStorageDoc(docId: string, data: Record<string, unknown>): Storage {
  const rawType = (data.type as string) || 'small';

  return {
    id: docId,
    name: (data.name as string) || `Storage ${docId.substring(0, 6)}`,
    code: data.code as string | undefined,
    type: isValidStorageType(rawType) ? rawType : 'small',
    building: (data.building as string) || '',
    buildingId: data.buildingId as string | undefined,
    companyId: data.companyId as string | undefined,
    linkedCompanyId: (data.linkedCompanyId as string | null) ?? undefined,
    floor: (data.floor as string) || '',
    floorId: data.floorId as string | undefined,
    area: typeof data.area === 'number' ? data.area : 0,
    description: data.description as string | undefined,
    price: typeof data.price === 'number' ? data.price : undefined,
    projectId: data.projectId as string | undefined,
    owner: data.owner as string | undefined,
    notes: data.notes as string | undefined,
    lastUpdated: normalizeToDate(data.lastUpdated) || undefined,
    ...spaceAppurtenanceFields(data),
  };
}

// =============================================================================
// PARKING MAPPER
// =============================================================================

const VALID_PARKING_TYPES: readonly string[] = [
  'standard', 'handicapped', 'motorcycle', 'electric', 'visitor',
];

const VALID_LOCATION_ZONES: readonly string[] = [
  'pilotis', 'underground', 'open_space', 'rooftop', 'covered_outdoor',
];

/**
 * Map a Firestore parking document to a type-safe ParkingSpot object.
 *
 * Covers every field declared in `ParkingSpot` (types/parking.ts).
 * Connection fields (buildingId, projectId, …) are always optional.
 * ADR-145: parking has no floorId — floor is a free string only.
 */
export function mapParkingDoc(docId: string, data: Record<string, unknown>): ParkingSpot {
  const rawType = data.type as string | undefined;
  const rawZone = data.locationZone as string | null | undefined;

  return {
    id: docId,
    number: (data.number as string) || `P-${docId.slice(0, 4)}`,
    code: data.code as string | undefined,
    buildingId: (data.buildingId as string) || null,
    projectId: data.projectId as string | undefined,
    locationZone: rawZone && VALID_LOCATION_ZONES.includes(rawZone)
      ? rawZone as ParkingLocationZone
      : (rawZone === null ? null : undefined),
    type: rawType && VALID_PARKING_TYPES.includes(rawType)
      ? rawType as ParkingSpotType
      : undefined,
    floor: data.floor as string | undefined,
    location: data.location as string | undefined,
    area: typeof data.area === 'number' ? data.area : undefined,
    price: typeof data.price === 'number' ? data.price : undefined,
    description: data.description as string | undefined,
    notes: data.notes as string | undefined,
    companyId: data.companyId as string | undefined,
    linkedCompanyId: (data.linkedCompanyId as string | null) ?? undefined,
    createdBy: data.createdBy as string | undefined,
    createdAt: normalizeToDate(data.createdAt) || undefined,
    updatedAt: normalizeToDate(data.updatedAt) || undefined,
    ...spaceAppurtenanceFields(data),
  };
}

// =============================================================================
// PROPERTY (UNIT) MAPPER
// =============================================================================

const VALID_PROPERTY_STATUSES: readonly string[] = [
  'for-sale', 'for-rent', 'for-sale-and-rent', 'reserved', 'sold',
  'landowner', 'rented', 'under-negotiation', 'coming-soon',
  'off-market', 'unavailable', 'deleted',
];

function isValidPropertyStatus(value: string): value is LegacySalesStatus {
  return VALID_PROPERTY_STATUSES.includes(value);
}

/**
 * Map a Firestore property document to a type-safe Property object.
 *
 * Required fields get explicit defaults; optional fields pass through with safe casts.
 * Nested objects (areas, layout, commercial, etc.) are trusted from our write path.
 */
export function mapPropertyDoc(docId: string, data: Record<string, unknown>): Property {
  const rawStatus = (data.status as string) || 'unavailable';

  return {
    id: docId,
    name: (data.name as string) || `Unit ${docId.substring(0, 6)}`,
    // 🔴 **ΚΑΝΟΝΙΚΟΠΟΙΕΙ, ΔΕΝ ΕΠΙΚΥΡΩΝΕΙ** (ADR-842 §7.6.12 / §8 #11). Ρωτούσε *«είναι
    //    **γνωστή** τιμή;»* πάνω σε λίστα που περιλάμβανε τις παρωχημένες και τις
    //    παλαιές ελληνικές — άρα τις **περνούσε αυτούσιες** στον τομέα — και ό,τι δεν
    //    αναγνώριζε το **βάφτιζε `'apartment'`**. Δύο ελαττώματα σε μία γραμμή. Πλέον
    //    ρωτά *«ποια είναι η **κανονική** μορφή;»*, και το «δεν ξέρω» λέγεται `null`.
    //
    // ⚠️ Ο `ALL_VALID_PROPERTY_TYPES` + ο `isValidPropertyType` **διαγράφηκαν**: ήταν ο
    //    ασθενής κριτής του §7.6.11 σε τρίτο αντίγραφο, και υπήρχαν **μόνο** γι' αυτή τη
    //    γραμμή.
    type: normalizePropertyType(data.type),
    building: (data.building as string) || '',
    buildingId: (data.buildingId as string) || '',
    floor: typeof data.floor === 'number' ? data.floor : 0,
    floorId: (data.floorId as string) || '',
    project: (data.project as string) || (data.projectId as string) || '',
    status: isValidPropertyStatus(rawStatus) ? rawStatus : 'unavailable',
    // Optional identity
    code: data.code as string | undefined,
    propertyName: data.propertyName as string | undefined,
    useCategory: data.useCategory as Property['useCategory'],
    linkedCompanyId: (data.linkedCompanyId as string | null) ?? undefined,
    // Optional commercial (legacy)
    price: typeof data.price === 'number' ? data.price : undefined,
    soldTo: (data.soldTo as string | null) ?? undefined,
    saleDate: data.saleDate as string | undefined,
    // Area + layout (trusted from write path)
    area: typeof data.area === 'number' ? data.area : undefined,
    areas: data.areas as Property['areas'],
    layout: data.layout as Property['layout'],
    description: data.description as string | undefined,
    // Status fields
    operationalStatus: data.operationalStatus as OperationalStatus | undefined,
    commercialStatus: data.commercialStatus as CommercialStatus | undefined,
    commercial: data.commercial as PropertyCommercialData | undefined,
    // Coverage
    propertyCoverage: data.propertyCoverage as PropertyCoverage | undefined,
    // Features
    orientations: data.orientations as Property['orientations'],
    views: data.views as Property['views'],
    condition: data.condition as Property['condition'],
    renovationYear: typeof data.renovationYear === 'number' ? data.renovationYear : undefined,
    deliveryDate: data.deliveryDate as Property['deliveryDate'],
    systemsOverride: data.systemsOverride as Property['systemsOverride'],
    energy: data.energy as Property['energy'],
    finishes: data.finishes as Property['finishes'],
    interiorFeatures: data.interiorFeatures as Property['interiorFeatures'],
    securityFeatures: data.securityFeatures as Property['securityFeatures'],
    propertyAmenities: data.propertyAmenities as Property['propertyAmenities'],
    // Ownership
    millesimalShares: typeof data.millesimalShares === 'number' ? data.millesimalShares : (data.millesimalShares === null ? null : undefined),
    // Linked spaces
    linkedSpaces: data.linkedSpaces as LinkedSpace[] | undefined,
    // Multi-level (ADR-236)
    isMultiLevel: data.isMultiLevel === true ? true : undefined,
    levels: data.levels as PropertyLevel[] | undefined,
    levelData: data.levelData as Record<string, LevelData> | undefined,
    // Soft archive (ADR-329)
    archivedAt: data.archivedAt as Property['archivedAt'],
    archivedBy: data.archivedBy as string | null | undefined,
  };
}
