/**
 * @fileoverview Property search query engine for UC-003 (ADR-080)
 * @description Queries available units from Firestore, applies in-memory
 *              filtering by criteria, and builds draft reply emails.
 */

import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { arePropertyTypesEquivalent } from '@/constants/property-types';
import type { PropertySearchCriteria } from '@/services/property-search.service';
import type { ContactMatch } from '../../shared/contact-lookup';

// ============================================================================
// TYPES
// ============================================================================

export interface MatchedUnit {
  id: string;
  name: string;
  type: string;
  area: number;
  floor: number;
  building: string;
  buildingId: string;
  price: number | null;
  status: string;
  rooms: number | null;
}

export interface PropertySearchLookupData {
  senderEmail: string;
  senderName: string;
  senderContact: ContactMatch | null;
  isKnownContact: boolean;
  criteria: PropertySearchCriteria;
  matchingUnits: MatchedUnit[];
  totalAvailable: number;
  originalSubject: string;
  companyId: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Statuses that indicate a unit is no longer available for sale/inquiry.
 * Uses both legacy `status` and new `PropertyStatus` values.
 */
const EXCLUDED_STATUSES = new Set([
  'sold', 'reserved', 'landowner', 'rented', 'off-market', 'unavailable',
]);

// ============================================================================
// QUERY ENGINE
// ============================================================================

/**
 * Query available units from Firestore using Admin SDK.
 * Fetches all units, then filters in-memory by availability + criteria.
 *
 * Domain separation:
 * - `operationalStatus: 'ready'` = physically ready (new schema)
 * - `status` ∉ EXCLUDED_STATUSES = not sold/reserved (legacy + new schema)
 *
 * Firestore limitation: Cannot combine multiple range filters or OR conditions.
 * Strategy: Fetch all units → in-memory filtering.
 */
export async function queryAvailableUnits(
  companyId: string,
  criteria: PropertySearchCriteria
): Promise<{ matching: MatchedUnit[]; totalAvailable: number }> {
  const adminDb = getAdminFirestore();

  const snapshot = await adminDb
    .collection(COLLECTIONS.PROPERTIES)
    .limit(200)
    .get();

  const allAvailable: MatchedUnit[] = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const status = (data.status as string) ?? '';
    const operationalStatus = (data.operationalStatus as string) ?? '';

    if (EXCLUDED_STATUSES.has(status)) continue;
    if (operationalStatus && operationalStatus !== 'ready') continue;

    const areas = data.areas as { gross?: number } | undefined;
    const resolvedArea = (areas?.gross ?? data.area ?? 0) as number;
    const layout = data.layout as { bedrooms?: number } | undefined;

    allAvailable.push({
      id: doc.id,
      name: (data.name ?? '') as string,
      type: (data.type ?? '') as string,
      area: resolvedArea,
      floor: (data.floor ?? 0) as number,
      building: (data.building ?? '') as string,
      buildingId: (data.buildingId ?? '') as string,
      price: typeof data.price === 'number' ? data.price : null,
      status: operationalStatus || status || 'unknown',
      rooms: layout?.bedrooms ?? null,
    });
  }

  const totalAvailable = allAvailable.length;

  const matching = allAvailable.filter(unit => {
    if (criteria.minArea && unit.area > 0) {
      const lowerBound = criteria.minArea * 0.8;
      const upperBound = (criteria.maxArea ?? criteria.minArea * 1.2);
      if (unit.area < lowerBound || unit.area > upperBound) return false;
    }

    if (criteria.type) {
      if (!matchUnitType(unit.type, criteria.type)) return false;
    }

    if (criteria.rooms) {
      const unitRooms = unit.rooms ?? extractRoomsFromType(unit.type);
      if (unitRooms !== null && unitRooms !== criteria.rooms) return false;
    }

    if (criteria.maxPrice && unit.price !== null) {
      if (unit.price > criteria.maxPrice) return false;
    }
    if (criteria.minPrice && unit.price !== null) {
      if (unit.price < criteria.minPrice) return false;
    }

    if (criteria.floor && typeof criteria.floor === 'number') {
      if (unit.floor !== criteria.floor) return false;
    }

    return true;
  });

  return { matching, totalAvailable };
}

// ============================================================================
// TYPE MATCHING
// ============================================================================

/**
 * Match a stored unit type against a search type input.
 *
 * ADR-287 Batch 11A — delegates to SSoT resolver (@/constants/property-types).
 * Both `unitType` (Firestore) and `searchType` (AI-extracted criteria) are
 * normalized to canonical `PropertyTypeCanonical`, then compared with apartment
 * family expansion. Previously this was a hardcoded `typeAliases` map.
 */
function matchUnitType(unitType: string, searchType: string): boolean {
  return arePropertyTypesEquivalent(unitType, searchType);
}

function extractRoomsFromType(unitType: string): number | null {
  if (unitType.includes('1br') || unitType.includes('Γκαρσονιέρα')) return 1;
  if (unitType.includes('2br') || unitType.includes('2Δ')) return 2;
  if (unitType.includes('3br') || unitType.includes('3Δ')) return 3;
  if (unitType.includes('studio') || unitType.includes('Στούντιο')) return 0;
  return null;
}

// ============================================================================
// DRAFT REPLY BUILDER
// ============================================================================

export function buildDraftReply(
  senderName: string,
  criteria: PropertySearchCriteria,
  units: MatchedUnit[]
): string {
  const greeting = `Αγαπητέ/ή ${senderName},`;
  const thanks = 'Σας ευχαριστούμε για το ενδιαφέρον σας.';

  const criteriaParts: string[] = [];
  if (criteria.type) criteriaParts.push(criteria.type);
  if (criteria.rooms) criteriaParts.push(`${criteria.rooms} δωματίων`);
  if (criteria.minArea) criteriaParts.push(`~${criteria.minArea} τ.μ.`);
  if (criteria.maxPrice) criteriaParts.push(`έως ${criteria.maxPrice.toLocaleString('el-GR')}€`);
  const criteriaSummary = criteriaParts.length > 0
    ? criteriaParts.join(', ')
    : 'ακίνητο';

  if (units.length === 0) {
    return [
      greeting,
      '',
      thanks,
      '',
      `Σχετικά με το αίτημά σας για ${criteriaSummary}, δυστυχώς αυτή τη στιγμή δεν διαθέτουμε ακίνητα που ταιριάζουν ακριβώς στα κριτήριά σας.`,
      '',
      'Μπορούμε να σας ενημερώσουμε μόλις υπάρξει κάτι κατάλληλο, ή να σας προτείνουμε εναλλακτικές επιλογές.',
      '',
      'Με εκτίμηση,',
    ].join('\n');
  }

  const unitLines = units.slice(0, 5).map((unit, idx) => {
    const parts: string[] = [`${idx + 1}. ${unit.name}`];
    if (unit.area > 0) parts.push(`${unit.area} τ.μ.`);
    if (unit.floor > 0) parts.push(`${unit.floor}ος όροφος`);
    if (unit.building) parts.push(unit.building);
    if (unit.price !== null) parts.push(`${unit.price.toLocaleString('el-GR')}€`);
    return parts.join(' — ');
  });

  const moreText = units.length > 5
    ? `\n...και ${units.length - 5} ακόμα επιλογές.`
    : '';

  return [
    greeting,
    '',
    thanks,
    '',
    `Βάσει του αιτήματός σας (${criteriaSummary}), σας ενημερώνουμε ότι διαθέτουμε τα παρακάτω ακίνητα:`,
    '',
    ...unitLines,
    moreText,
    '',
    'Θα χαρούμε να σας τα παρουσιάσουμε αυτοπροσώπως.',
    'Επικοινωνήστε μαζί μας για κλείσιμο ραντεβού επίσκεψης.',
    '',
    'Με εκτίμηση,',
  ].join('\n');
}
