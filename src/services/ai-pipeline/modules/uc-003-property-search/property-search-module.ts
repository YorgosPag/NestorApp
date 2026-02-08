/**
 * =============================================================================
 * 🏢 ENTERPRISE: UC-003 PROPERTY SEARCH MODULE
 * =============================================================================
 *
 * Handles `property_search` intents — customers inquiring about available units.
 *
 * Pipeline steps implemented:
 *   Step 3 LOOKUP  → Parse criteria from email, query available units in Firestore
 *   Step 4 PROPOSE → Build unit list + draft reply email for operator approval
 *   Step 6 EXECUTE → Log action (Phase 2: send email via Mailgun)
 *   Step 7 ACKNOWLEDGE → Log confirmation (Phase 2: track delivery)
 *
 * @module services/ai-pipeline/modules/uc-003-property-search
 * @see ADR-080 (Pipeline Implementation)
 * @see IUCModule interface (src/types/ai-pipeline.ts)
 */

import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { PIPELINE_PROTOCOL_CONFIG } from '@/config/ai-pipeline-config';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { extractSearchCriteria, type PropertySearchCriteria } from '@/services/property-search.service';
import {
  PipelineIntentType,
  PipelineChannel,
} from '@/types/ai-pipeline';
import type {
  IUCModule,
  PipelineContext,
  Proposal,
  ExecutionResult,
  AcknowledgmentResult,
  PipelineIntentTypeValue,
  PipelineChannelValue,
} from '@/types/ai-pipeline';

// ============================================================================
// LOGGER
// ============================================================================

const logger = createModuleLogger('UC_003_PROPERTY_SEARCH');

// ============================================================================
// TYPES
// ============================================================================

interface ContactMatch {
  contactId: string;
  name: string;
}

interface MatchedUnit {
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

interface PropertySearchLookupData {
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
// HELPERS
// ============================================================================

/**
 * Server-side contact lookup by email using Admin SDK.
 * Same pattern as UC-001 — reused here for sender identification.
 */
async function findContactByEmail(
  email: string,
  companyId: string
): Promise<ContactMatch | null> {
  const adminDb = getAdminFirestore();

  const snapshot = await adminDb
    .collection(COLLECTIONS.CONTACTS)
    .where('companyId', '==', companyId)
    .limit(50)
    .get();

  const normalizedEmail = email.toLowerCase().trim();

  for (const doc of snapshot.docs) {
    const data = doc.data();

    // Check emails array (common pattern: [{ email: "...", label: "work" }])
    const emails = data.emails as Array<{ email?: string }> | undefined;
    if (emails?.some(e => e.email?.toLowerCase().trim() === normalizedEmail)) {
      return {
        contactId: doc.id,
        name: (data.displayName ?? data.firstName ?? data.companyName ?? 'Unknown') as string,
      };
    }

    // Check flat email field
    const flatEmail = data.email as string | undefined;
    if (flatEmail?.toLowerCase().trim() === normalizedEmail) {
      return {
        contactId: doc.id,
        name: (data.displayName ?? data.firstName ?? data.companyName ?? 'Unknown') as string,
      };
    }
  }

  return null;
}

/**
 * Statuses that indicate a unit is no longer available for sale/inquiry.
 * Uses both legacy `status` and new `PropertyStatus` values.
 */
const EXCLUDED_STATUSES = new Set([
  'sold', 'reserved', 'landowner', 'rented', 'off-market', 'unavailable',
]);

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
async function queryAvailableUnits(
  companyId: string,
  criteria: PropertySearchCriteria
): Promise<{ matching: MatchedUnit[]; totalAvailable: number }> {
  const adminDb = getAdminFirestore();

  // Fetch all units (no status filter — handled in-memory for dual-schema support)
  const snapshot = await adminDb
    .collection(COLLECTIONS.UNITS)
    .limit(200)
    .get();

  const allAvailable: MatchedUnit[] = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const status = (data.status as string) ?? '';
    const operationalStatus = (data.operationalStatus as string) ?? '';

    // Skip units that are sold/reserved/off-market
    if (EXCLUDED_STATUSES.has(status)) continue;

    // Skip units not physically ready (if operationalStatus exists)
    if (operationalStatus && operationalStatus !== 'ready') continue;

    // Resolve area: prefer `areas.gross`, fallback to `area`
    const areas = data.areas as { gross?: number } | undefined;
    const resolvedArea = (areas?.gross ?? data.area ?? 0) as number;

    // Resolve rooms from layout.bedrooms
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

  // In-memory filtering by criteria
  const matching = allAvailable.filter(unit => {
    // Area filter: ±20% tolerance
    if (criteria.minArea && unit.area > 0) {
      const lowerBound = criteria.minArea * 0.8;
      const upperBound = (criteria.maxArea ?? criteria.minArea * 1.2);
      if (unit.area < lowerBound || unit.area > upperBound) return false;
    }

    // Type filter (apartment type matching)
    if (criteria.type) {
      const typeMatches = matchUnitType(unit.type, criteria.type);
      if (!typeMatches) return false;
    }

    // Rooms filter: prefer layout.bedrooms, fallback to type parsing
    if (criteria.rooms) {
      const unitRooms = unit.rooms ?? extractRoomsFromType(unit.type);
      if (unitRooms !== null && unitRooms !== criteria.rooms) return false;
    }

    // Price filter
    if (criteria.maxPrice && unit.price !== null) {
      if (unit.price > criteria.maxPrice) return false;
    }
    if (criteria.minPrice && unit.price !== null) {
      if (unit.price < criteria.minPrice) return false;
    }

    // Floor filter
    if (criteria.floor && typeof criteria.floor === 'number') {
      if (unit.floor !== criteria.floor) return false;
    }

    return true;
  });

  return { matching, totalAvailable };
}

/**
 * Match unit type against search criteria type.
 * Handles legacy Greek type names and English codes.
 */
function matchUnitType(unitType: string, searchType: string): boolean {
  const normalized = unitType.toLowerCase();
  const searchNormalized = searchType.toLowerCase();

  const typeAliases: Record<string, string[]> = {
    apartment: ['apartment', 'apartment_1br', 'apartment_2br', 'apartment_3br', 'διαμέρισμα', 'διαμέρισμα 2δ', 'διαμέρισμα 3δ'],
    maisonette: ['maisonette', 'μεζονέτα'],
    store: ['shop', 'store', 'κατάστημα'],
    studio: ['studio', 'στούντιο'],
  };

  const aliases = typeAliases[searchNormalized] ?? [searchNormalized];
  return aliases.some(alias => normalized.includes(alias));
}

/**
 * Extract number of bedrooms from unit type code.
 */
function extractRoomsFromType(unitType: string): number | null {
  if (unitType.includes('1br') || unitType.includes('Γκαρσονιέρα')) return 1;
  if (unitType.includes('2br') || unitType.includes('2Δ')) return 2;
  if (unitType.includes('3br') || unitType.includes('3Δ')) return 3;
  if (unitType.includes('studio') || unitType.includes('Στούντιο')) return 0;
  return null;
}

/**
 * Build a draft reply email based on search results.
 */
function buildDraftReply(
  senderName: string,
  criteria: PropertySearchCriteria,
  units: MatchedUnit[]
): string {
  const greeting = `Αγαπητέ/ή ${senderName},`;
  const thanks = 'Σας ευχαριστούμε για το ενδιαφέρον σας.';

  // Build criteria summary
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

  // Build unit list
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

// ============================================================================
// UC-003 MODULE
// ============================================================================

export class PropertySearchModule implements IUCModule {
  readonly moduleId = 'UC-003';
  readonly displayName = 'Αναζήτηση Ακινήτου';
  readonly handledIntents: readonly PipelineIntentTypeValue[] = [
    PipelineIntentType.PROPERTY_SEARCH,
  ];
  readonly requiredRoles: readonly string[] = ['salesManager'];

  // ── Step 3: LOOKUP ──────────────────────────────────────────────────────

  async lookup(ctx: PipelineContext): Promise<Record<string, unknown>> {
    const senderEmail = ctx.intake.normalized.sender.email ?? '';
    const senderName = ctx.intake.normalized.sender.name ?? senderEmail;
    const emailText = ctx.intake.normalized.contentText ?? ctx.intake.normalized.subject ?? '';

    logger.info('UC-003 LOOKUP: Parsing search criteria from email', {
      requestId: ctx.requestId,
      senderEmail,
      companyId: ctx.companyId,
    });

    // 1. Extract search criteria from email text (reuse existing NL parser)
    const criteria = extractSearchCriteria(emailText);

    logger.info('UC-003 LOOKUP: Criteria extracted', {
      requestId: ctx.requestId,
      criteria,
    });

    // 2. Query available units
    const { matching, totalAvailable } = await queryAvailableUnits(ctx.companyId, criteria);

    logger.info('UC-003 LOOKUP: Units query complete', {
      requestId: ctx.requestId,
      matchingCount: matching.length,
      totalAvailable,
    });

    // 3. Find sender contact
    let senderContact: ContactMatch | null = null;
    if (senderEmail) {
      try {
        senderContact = await findContactByEmail(senderEmail, ctx.companyId);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.warn('UC-003 LOOKUP: Contact search failed (non-fatal)', {
          requestId: ctx.requestId,
          error: msg,
        });
      }
    }

    const lookupData: PropertySearchLookupData = {
      senderEmail,
      senderName,
      senderContact,
      isKnownContact: senderContact !== null,
      criteria,
      matchingUnits: matching,
      totalAvailable,
      originalSubject: ctx.intake.normalized.subject ?? '',
      companyId: ctx.companyId,
    };

    logger.info('UC-003 LOOKUP: Complete', {
      requestId: ctx.requestId,
      isKnownContact: lookupData.isKnownContact,
      matchingUnits: matching.length,
      totalAvailable,
    });

    return lookupData as unknown as Record<string, unknown>;
  }

  // ── Step 4: PROPOSE ─────────────────────────────────────────────────────

  async propose(ctx: PipelineContext): Promise<Proposal> {
    const lookup = ctx.lookupData as unknown as PropertySearchLookupData | undefined;

    const senderDisplay = lookup?.senderName ?? lookup?.senderEmail ?? 'Άγνωστος αποστολέας';
    const criteria = lookup?.criteria ?? {};
    const units = lookup?.matchingUnits ?? [];
    const totalAvailable = lookup?.totalAvailable ?? 0;

    // Build criteria summary for display
    const criteriaParts: string[] = [];
    if (criteria.type) criteriaParts.push(criteria.type);
    if (criteria.rooms) criteriaParts.push(`${criteria.rooms} δωματίων`);
    if (criteria.minArea) criteriaParts.push(`~${criteria.minArea} τ.μ.`);
    const criteriaSummary = criteriaParts.length > 0
      ? criteriaParts.join(', ')
      : 'ακίνητο';

    const resultText = units.length > 0
      ? `Βρέθηκαν ${units.length} διαθέσιμα (από ${totalAvailable} συνολικά)`
      : `Δεν βρέθηκαν ακίνητα (${totalAvailable} διαθέσιμα συνολικά)`;

    const summary = `Αναζήτηση: ${criteriaSummary} — ${resultText} — από ${senderDisplay}`;

    // Build draft reply email
    const draftReply = buildDraftReply(senderDisplay, criteria, units);

    logger.info('UC-003 PROPOSE: Generating proposal', {
      requestId: ctx.requestId,
      matchingUnits: units.length,
      summary,
    });

    return {
      messageId: ctx.intake.id,
      suggestedActions: [
        {
          type: 'reply_property_list',
          params: {
            senderEmail: lookup?.senderEmail,
            senderName: senderDisplay,
            contactId: lookup?.senderContact?.contactId ?? null,
            isKnownContact: lookup?.isKnownContact ?? false,
            criteriaSummary,
            matchingUnitsCount: units.length,
            matchingUnits: units.slice(0, 10).map(u => ({
              id: u.id,
              name: u.name,
              type: u.type,
              area: u.area,
              floor: u.floor,
              building: u.building,
              price: u.price,
              rooms: u.rooms,
            })),
            totalAvailable,
            draftReply,
            companyId: ctx.companyId,
          },
        },
      ],
      requiredApprovals: ['salesManager'],
      autoApprovable: false, // ΚΑΝΟΝΑΣ: Πάντα ανθρώπινη έγκριση — αφορά πωλήσεις
      summary,
      schemaVersion: PIPELINE_PROTOCOL_CONFIG.SCHEMA_VERSION,
    };
  }

  // ── Step 6: EXECUTE ─────────────────────────────────────────────────────

  async execute(ctx: PipelineContext): Promise<ExecutionResult> {
    logger.info('UC-003 EXECUTE: Processing property search response', {
      requestId: ctx.requestId,
    });

    try {
      // Use modified actions from operator if available, otherwise use original proposal
      const actions = ctx.approval?.modifiedActions ?? ctx.proposal?.suggestedActions ?? [];
      const replyAction = actions.find(a => a.type === 'reply_property_list');

      if (!replyAction) {
        return {
          success: false,
          sideEffects: [],
          error: 'No reply_property_list action found in approved actions',
        };
      }

      const params = replyAction.params;

      // MVP: Log the approved action — Phase 2 will send via Mailgun
      logger.info('UC-003 EXECUTE: Property search response approved', {
        requestId: ctx.requestId,
        senderEmail: params.senderEmail,
        matchingUnits: params.matchingUnitsCount,
        approvedBy: ctx.approval?.approvedBy ?? null,
      });

      // Record the lead inquiry in the audit trail
      const adminDb = getAdminFirestore();
      const leadInquiry = {
        type: 'property_search_inquiry',
        companyId: ctx.companyId,
        pipelineRequestId: ctx.requestId,
        sender: {
          email: (params.senderEmail as string) ?? null,
          name: (params.senderName as string) ?? null,
          contactId: (params.contactId as string) ?? null,
          isKnownContact: (params.isKnownContact as boolean) ?? false,
        },
        searchCriteria: (params.criteriaSummary as string) ?? null,
        matchingUnitsCount: (params.matchingUnitsCount as number) ?? 0,
        totalAvailable: (params.totalAvailable as number) ?? 0,
        status: 'approved_pending_send',
        approvedBy: ctx.approval?.approvedBy ?? null,
        approvedAt: ctx.approval?.decidedAt ?? null,
        createdAt: new Date().toISOString(),
      };

      const docRef = await adminDb
        .collection(COLLECTIONS.AI_PIPELINE_AUDIT)
        .add(leadInquiry);

      return {
        success: true,
        sideEffects: [
          `lead_inquiry_recorded:${docRef.id}`,
          `matching_units:${params.matchingUnitsCount ?? 0}`,
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error('UC-003 EXECUTE: Failed', {
        requestId: ctx.requestId,
        error: errorMessage,
      });

      return {
        success: false,
        sideEffects: [],
        error: `Failed to process property search: ${errorMessage}`,
      };
    }
  }

  // ── Step 7: ACKNOWLEDGE ─────────────────────────────────────────────────

  async acknowledge(ctx: PipelineContext): Promise<AcknowledgmentResult> {
    // MVP: Log that reply email would be sent
    // Phase 2: Send real email via Mailgun with the approved draft
    const channel = (ctx.intake.channel ?? PipelineChannel.EMAIL) as PipelineChannelValue;

    logger.info('UC-003 ACKNOWLEDGE: Response pending (Phase 2: email sending)', {
      requestId: ctx.requestId,
      channel,
      senderEmail: ctx.intake.normalized.sender.email,
    });

    return {
      sent: false,
      channel,
    };
  }

  // ── Health Check ────────────────────────────────────────────────────────

  async healthCheck(): Promise<boolean> {
    try {
      const adminDb = getAdminFirestore();
      await adminDb.collection(COLLECTIONS.UNITS).limit(1).get();
      return true;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('UC-003 HEALTH CHECK: Failed', { error: msg });
      return false;
    }
  }
}
