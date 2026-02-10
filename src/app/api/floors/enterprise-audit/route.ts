/**
 * 🛠️ UTILITY: ENTERPRISE DATABASE ARCHITECTURE AUDIT
 *
 * Complete analysis of database architecture for floors.
 *
 * @module api/floors/enterprise-audit
 * @version 2.0.0
 * @updated 2026-01-15 - AUTHZ PHASE 2: Added super_admin protection
 *
 * 🔒 SECURITY:
 * - Global Role: super_admin (break-glass utility)
 * - Admin SDK for secure server-side operations
 *
 * @rateLimit STANDARD (60 req/min) - Enterprise database architecture audit utility
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('FloorsEnterpriseAuditRoute');

interface EnterpriseDatabaseAudit {
  auditTimestamp: string;
  compliance: {
    level: 'ENTERPRISE' | 'ACCEPTABLE' | 'UNACCEPTABLE';
    score: number;
    blockers: string[];
  };
  collections: {
    normalizedFloors: {
      exists: boolean;
      documentCount: number;
      sampleDocuments: Record<string, unknown>[];
      idPatterns: {
        enterprise: { count: number; examples: string[] };
        mpakalikoNumeric: { count: number; examples: string[] };
      };
    };
    subcollectionFloors: {
      buildingsChecked: number;
      totalSubcollectionFloors: number;
      sampleStructure: Array<{
        buildingId: string;
        floorCount: number;
        floorIds: string[];
      }>;
    };
  };
  architecture: {
    currentPattern: 'NORMALIZED' | 'SUBCOLLECTIONS' | 'MIXED' | 'UNKNOWN';
    migrationRequired: boolean;
  };
  recommendations: {
    immediate: string[];
    migration: string[];
  };
}

const getHandler = async (request: NextRequest) => {
  const handler = withAuth<EnterpriseDatabaseAudit | { error: string }>(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse<EnterpriseDatabaseAudit | { error: string }>> => {
      try {
        logger.info('[Floors/EnterpriseAudit] Starting Admin SDK operations');
        logger.info('Auth context', { userId: ctx.uid, globalRole: ctx.globalRole, companyId: ctx.companyId });

        const audit: EnterpriseDatabaseAudit = {
          auditTimestamp: new Date().toISOString(),
          compliance: { level: 'UNACCEPTABLE', score: 0, blockers: [] },
          collections: {
            normalizedFloors: {
              exists: false, documentCount: 0, sampleDocuments: [],
              idPatterns: { enterprise: { count: 0, examples: [] }, mpakalikoNumeric: { count: 0, examples: [] } }
            },
            subcollectionFloors: { buildingsChecked: 0, totalSubcollectionFloors: 0, sampleStructure: [] }
          },
          architecture: { currentPattern: 'UNKNOWN', migrationRequired: false },
          recommendations: { immediate: [], migration: [] }
        };

        // ============================================================================
        // AUDIT 1: NORMALIZED FLOORS (Admin SDK)
        // ============================================================================

        logger.info('[AUDIT 1] Checking normalized floors collection');
        try {
          const floorsSnapshot = await getAdminFirestore().collection(COLLECTIONS.FLOORS).limit(50).get();
          audit.collections.normalizedFloors.exists = true;
          audit.collections.normalizedFloors.documentCount = floorsSnapshot.docs.length;

          if (floorsSnapshot.docs.length > 0) {
            audit.collections.normalizedFloors.sampleDocuments = floorsSnapshot.docs.slice(0, 2).map(doc => ({
              id: doc.id, ...doc.data()
            }));

            // ID Analysis
            floorsSnapshot.docs.forEach(doc => {
              const id = doc.id;
              if (id.match(/^floor_-?\d+$/)) {
                audit.collections.normalizedFloors.idPatterns.mpakalikoNumeric.count++;
                if (audit.collections.normalizedFloors.idPatterns.mpakalikoNumeric.examples.length < 3) {
                  audit.collections.normalizedFloors.idPatterns.mpakalikoNumeric.examples.push(id);
                }
              } else if (id.length >= 15) {
                audit.collections.normalizedFloors.idPatterns.enterprise.count++;
                if (audit.collections.normalizedFloors.idPatterns.enterprise.examples.length < 3) {
                  audit.collections.normalizedFloors.idPatterns.enterprise.examples.push(id);
                }
              }
            });
          }
          logger.info('Normalized floors count', { documentCount: audit.collections.normalizedFloors.documentCount });
        } catch (error) {
          logger.error('Normalized floors error', { error: error instanceof Error ? error.message : String(error) });
        }

        // ============================================================================
        // AUDIT 2: SUBCOLLECTIONS (Admin SDK)
        // ============================================================================

        logger.info('[AUDIT 2] Checking subcollections');
        try {
          const buildingsSnapshot = await getAdminFirestore().collection(COLLECTIONS.BUILDINGS).limit(10).get();
          const buildingsToCheck = buildingsSnapshot.docs.slice(0, 5);
          audit.collections.subcollectionFloors.buildingsChecked = buildingsToCheck.length;

          for (const buildingDoc of buildingsToCheck) {
            try {
              const floorsSnapshot = await getAdminFirestore()
                .collection(COLLECTIONS.BUILDINGS)
                .doc(buildingDoc.id)
                .collection(SUBCOLLECTIONS.BUILDING_FLOORS)
                .get();

              if (floorsSnapshot.docs.length > 0) {
                audit.collections.subcollectionFloors.totalSubcollectionFloors += floorsSnapshot.docs.length;
                audit.collections.subcollectionFloors.sampleStructure.push({
                  buildingId: buildingDoc.id,
                  floorCount: floorsSnapshot.docs.length,
                  floorIds: floorsSnapshot.docs.map(doc => doc.id)
                });
              }
            } catch (error) {
              logger.error('Error checking building subcollection', { buildingId: buildingDoc.id });
            }
          }
          logger.info('Subcollection floors count', { total: audit.collections.subcollectionFloors.totalSubcollectionFloors });
        } catch (error) {
          logger.error('Subcollections error', { error: error instanceof Error ? error.message : String(error) });
        }

        // ============================================================================
        // ANALYSIS
        // ============================================================================

        const hasNormalized = audit.collections.normalizedFloors.documentCount > 0;
        const hasSubcollection = audit.collections.subcollectionFloors.totalSubcollectionFloors > 0;

        if (hasNormalized && hasSubcollection) audit.architecture.currentPattern = 'MIXED';
        else if (hasSubcollection) audit.architecture.currentPattern = 'SUBCOLLECTIONS';
        else if (hasNormalized) audit.architecture.currentPattern = 'NORMALIZED';
        else audit.architecture.currentPattern = 'UNKNOWN';

        audit.architecture.migrationRequired = audit.architecture.currentPattern !== 'NORMALIZED';

        // ============================================================================
        // SCORING
        // ============================================================================

        let score = 0;
        if (audit.architecture.currentPattern === 'NORMALIZED') score += 50;
        else if (audit.architecture.currentPattern === 'SUBCOLLECTIONS') score += 25;

        const totalFloorIds = audit.collections.normalizedFloors.idPatterns.enterprise.count +
                             audit.collections.normalizedFloors.idPatterns.mpakalikoNumeric.count;
        if (totalFloorIds > 0) {
          const enterpriseRatio = audit.collections.normalizedFloors.idPatterns.enterprise.count / totalFloorIds;
          score += enterpriseRatio * 50;
        }

        audit.compliance.score = Math.round(score);
        if (audit.compliance.score >= 80) audit.compliance.level = 'ENTERPRISE';
        else if (audit.compliance.score >= 60) audit.compliance.level = 'ACCEPTABLE';
        else audit.compliance.level = 'UNACCEPTABLE';

        // ============================================================================
        // BLOCKERS
        // ============================================================================

        if (audit.collections.normalizedFloors.idPatterns.mpakalikoNumeric.count > 0) {
          audit.compliance.blockers.push('Legacy floor IDs detected');
          audit.recommendations.immediate.push('Replace legacy floor IDs with enterprise codes');
        }

        if (audit.architecture.currentPattern === 'SUBCOLLECTIONS') {
          audit.compliance.blockers.push('Subcollection architecture prevents efficient querying');
          audit.recommendations.migration.push('MIGRATE floors to normalized collection');
        }

        if (!hasNormalized && !hasSubcollection) {
          audit.compliance.blockers.push('NO FLOORS DATA found');
          audit.recommendations.immediate.push('CREATE floors data with enterprise architecture');
        }

        logger.info('[Floors/EnterpriseAudit] Complete', { level: audit.compliance.level, score: audit.compliance.score });

        return NextResponse.json(audit);

      } catch (error) {
        logger.error('[Floors/EnterpriseAudit] Error', {
          error: error instanceof Error ? error.message : 'Unknown error',
          userId: ctx.uid,
          companyId: ctx.companyId
        });

        return NextResponse.json({ error: 'Audit failed' }, { status: 500 });
      }
    },
    { requiredGlobalRoles: 'super_admin' }
  );

  return handler(request);
};

export const GET = withStandardRateLimit(getHandler);
