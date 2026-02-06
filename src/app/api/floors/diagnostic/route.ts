/**
 * 🛠️ UTILITY: FIRESTORE CONNECTIVITY DIAGNOSTIC
 *
 * Root cause analysis for floors connectivity issues.
 *
 * @module api/floors/diagnostic
 * @version 2.0.0
 * @updated 2026-01-15 - AUTHZ PHASE 2: Added super_admin protection
 *
 * 🔒 SECURITY:
 * - Global Role: super_admin (break-glass utility)
 * - Admin SDK for secure server-side operations
 *
 * @rateLimit STANDARD (60 req/min) - Firestore connectivity diagnostic utility
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';

interface FirestoreDiagnosticResult {
  timestamp: string;
  summary: {
    overallHealth: 'HEALTHY' | 'DEGRADED' | 'CRITICAL' | 'FAILED';
    criticalIssues: string[];
    recommendedActions: string[];
  };
  connection: {
    status: 'CONNECTED' | 'FAILED' | 'UNKNOWN';
    latency?: number;
    errorMessage?: string;
  };
  environment: {
    hasRequiredVars: boolean;
    missingVars: string[];
    collections: Record<string, string>;
  };
  collections: {
    [key: string]: {
      accessible: boolean;
      documentCount?: number;
      latency?: number;
      errorMessage?: string;
      sampleDocument?: Record<string, unknown> | null;
    };
  };
  specificTests: {
    floorsNormalized: {
      status: 'PASS' | 'FAIL' | 'TIMEOUT';
      details: string;
      latency?: number;
    };
    floorsSubcollections: {
      status: 'PASS' | 'FAIL' | 'TIMEOUT';
      details: string;
      latency?: number;
    };
    buildingsAccess: {
      status: 'PASS' | 'FAIL' | 'TIMEOUT';
      details: string;
      latency?: number;
    };
  };
}

const getHandler = async (request: NextRequest) => {
  const handler = withAuth<FirestoreDiagnosticResult>(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse<FirestoreDiagnosticResult>> => {
      const diagnosticStart = Date.now();
      console.log('🔍 [Floors/Diagnostic] Starting Admin SDK operations...');
      console.log(`🔒 Auth Context: User ${ctx.uid} (${ctx.globalRole}), Company ${ctx.companyId}`);

      const result: FirestoreDiagnosticResult = {
        timestamp: new Date().toISOString(),
        summary: {
          overallHealth: 'FAILED',  // 🏢 ENTERPRISE: Default to worst case, updated after checks
          criticalIssues: [],
          recommendedActions: []
        },
        connection: {
          status: 'FAILED' as const  // Will be updated after connection test
        },
        environment: {
          hasRequiredVars: false,
          missingVars: [],
          collections: {}
        },
        collections: {},
        specificTests: {
          floorsNormalized: { status: 'FAIL', details: 'Not tested' },
          floorsSubcollections: { status: 'FAIL', details: 'Not tested' },
          buildingsAccess: { status: 'FAIL', details: 'Not tested' }
        }
      };

      try {
        // ============================================================================
        // TEST 1: ENVIRONMENT VARIABLES CHECK
        // ============================================================================

        console.log('🔧 TEST 1: Environment variables...');
        const requiredEnvVars = [
          'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
          'NEXT_PUBLIC_FIREBASE_API_KEY',
          'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'
        ];

        result.environment.collections = COLLECTIONS;

        requiredEnvVars.forEach(varName => {
          if (!process.env[varName]) {
            result.environment.missingVars.push(varName);
          }
        });

        result.environment.hasRequiredVars = result.environment.missingVars.length === 0;

        if (!result.environment.hasRequiredVars) {
          result.summary.criticalIssues.push(`Missing environment variables: ${result.environment.missingVars.join(', ')}`);
        }

        // ============================================================================
        // TEST 2: BASIC CONNECTION TEST (Admin SDK)
        // ============================================================================

        console.log('🔗 TEST 2: Basic Firestore connection...');
        const connectionStart = Date.now();

        try {
          const testSnapshot = await getAdminFirestore().collection(COLLECTIONS.PROJECTS).limit(1).get();
          const connectionLatency = Date.now() - connectionStart;

          result.connection.status = 'CONNECTED';
          result.connection.latency = connectionLatency;
          console.log(`   ✅ Connection successful (${connectionLatency}ms)`);

        } catch (error) {
          result.connection.status = 'FAILED';
          result.connection.errorMessage = error instanceof Error ? error.message : 'Unknown connection error';
          result.summary.criticalIssues.push(`Firestore connection failed: ${result.connection.errorMessage}`);
          console.log(`   ❌ Connection failed: ${result.connection.errorMessage}`);
        }

        // ============================================================================
        // TEST 3: COLLECTION ACCESSIBILITY TESTS (Admin SDK)
        // ============================================================================

        console.log('📚 TEST 3: Collection accessibility...');
        const collectionsToTest = ['PROJECTS', 'BUILDINGS', 'FLOORS', 'CONTACTS'];

        for (const collectionName of collectionsToTest) {
          const collectionPath = COLLECTIONS[collectionName as keyof typeof COLLECTIONS];
          if (!collectionPath) continue;

          const testStart = Date.now();
          console.log(`   Testing ${collectionName} (${collectionPath})...`);

          try {
            const testSnapshot = await getAdminFirestore().collection(collectionPath).limit(5).get();
            const testLatency = Date.now() - testStart;

            result.collections[collectionName] = {
              accessible: true,
              documentCount: testSnapshot.docs.length,
              latency: testLatency,
              sampleDocument: testSnapshot.docs[0] ? {
                id: testSnapshot.docs[0].id,
                ...testSnapshot.docs[0].data()
              } : null
            };

            console.log(`     ✅ ${collectionName}: ${testSnapshot.docs.length} docs (${testLatency}ms)`);

          } catch (error) {
            const testLatency = Date.now() - testStart;
            result.collections[collectionName] = {
              accessible: false,
              latency: testLatency,
              errorMessage: error instanceof Error ? error.message : 'Unknown error'
            };

            console.log(`     ❌ ${collectionName} failed (${testLatency}ms): ${result.collections[collectionName].errorMessage}`);
            result.summary.criticalIssues.push(`${collectionName} collection inaccessible`);
          }
        }

        // ============================================================================
        // TEST 4: SPECIFIC FLOORS DIAGNOSTICS (Admin SDK)
        // ============================================================================

        console.log('🏗️ TEST 4: Specific floors diagnostics...');

        // Test 4a: Normalized Floors Collection
        console.log('   Testing normalized floors collection...');
        const floorsNormalizedStart = Date.now();

        try {
          const floorsSnapshot = await Promise.race([
            getAdminFirestore().collection(COLLECTIONS.FLOORS).limit(10).get(),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timeout after 10 seconds')), 10000))
          ]);

          const floorsLatency = Date.now() - floorsNormalizedStart;

          result.specificTests.floorsNormalized = {
            status: 'PASS',
            details: `Found ${floorsSnapshot.docs.length} floors in normalized collection`,
            latency: floorsLatency
          };

          console.log(`     ✅ Normalized floors: ${floorsSnapshot.docs.length} docs (${floorsLatency}ms)`);

        } catch (error) {
          const floorsLatency = Date.now() - floorsNormalizedStart;

          result.specificTests.floorsNormalized = {
            status: error instanceof Error && error.message.includes('Timeout') ? 'TIMEOUT' : 'FAIL',
            details: error instanceof Error ? error.message : 'Unknown error',
            latency: floorsLatency
          };

          console.log(`     ❌ Normalized floors failed (${floorsLatency}ms): ${result.specificTests.floorsNormalized.details}`);
        }

        // Test 4b: Buildings Access (needed for subcollection test)
        console.log('   Testing buildings access...');
        const buildingsStart = Date.now();

        try {
          const buildingsSnapshot = await Promise.race([
            getAdminFirestore().collection(COLLECTIONS.BUILDINGS).limit(5).get(),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timeout after 5 seconds')), 5000))
          ]);

          const buildingsLatency = Date.now() - buildingsStart;

          result.specificTests.buildingsAccess = {
            status: 'PASS',
            details: `Found ${buildingsSnapshot.docs.length} buildings`,
            latency: buildingsLatency
          };

          console.log(`     ✅ Buildings access: ${buildingsSnapshot.docs.length} docs (${buildingsLatency}ms)`);

          // Test 4c: Subcollection Floors (only if buildings accessible)
          if (buildingsSnapshot.docs.length > 0) {
            console.log('   Testing subcollection floors...');
            const subcollectionStart = Date.now();

            try {
              const firstBuilding = buildingsSnapshot.docs[0];
              const subcollectionSnapshot = await Promise.race([
                getAdminFirestore()
                  .collection(COLLECTIONS.BUILDINGS)
                  .doc(firstBuilding.id)
                  .collection(SUBCOLLECTIONS.BUILDING_FLOORS)
                  .get(),
                new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timeout after 5 seconds')), 5000))
              ]);

              const subcollectionLatency = Date.now() - subcollectionStart;

              result.specificTests.floorsSubcollections = {
                status: 'PASS',
                details: `Found ${subcollectionSnapshot.docs.length} floors in building ${firstBuilding.id} subcollection`,
                latency: subcollectionLatency
              };

              console.log(`     ✅ Subcollection floors: ${subcollectionSnapshot.docs.length} docs (${subcollectionLatency}ms)`);

            } catch (error) {
              const subcollectionLatency = Date.now() - subcollectionStart;

              result.specificTests.floorsSubcollections = {
                status: error instanceof Error && error.message.includes('Timeout') ? 'TIMEOUT' : 'FAIL',
                details: error instanceof Error ? error.message : 'Unknown error',
                latency: subcollectionLatency
              };

              console.log(`     ❌ Subcollection floors failed (${subcollectionLatency}ms): ${result.specificTests.floorsSubcollections.details}`);
            }
          }

        } catch (error) {
          const buildingsLatency = Date.now() - buildingsStart;

          result.specificTests.buildingsAccess = {
            status: error instanceof Error && error.message.includes('Timeout') ? 'TIMEOUT' : 'FAIL',
            details: error instanceof Error ? error.message : 'Unknown error',
            latency: buildingsLatency
          };

          console.log(`     ❌ Buildings access failed (${buildingsLatency}ms): ${result.specificTests.buildingsAccess.details}`);
        }

        // ============================================================================
        // ANALYSIS: OVERALL HEALTH ASSESSMENT
        // ============================================================================

        console.log('📊 ANALYSIS: Overall health assessment...');

        let healthScore = 0;

        // Connection health (40 points)
        if (result.connection.status === 'CONNECTED') healthScore += 40;

        // Environment health (20 points)
        if (result.environment.hasRequiredVars) healthScore += 20;

        // Collection accessibility (40 points)
        const accessibleCollections = Object.values(result.collections).filter(c => c.accessible).length;
        const totalCollections = Object.keys(result.collections).length;
        if (totalCollections > 0) {
          healthScore += (accessibleCollections / totalCollections) * 40;
        }

        // Determine overall health
        if (healthScore >= 90) result.summary.overallHealth = 'HEALTHY';
        else if (healthScore >= 70) result.summary.overallHealth = 'DEGRADED';
        else if (healthScore >= 30) result.summary.overallHealth = 'CRITICAL';
        else result.summary.overallHealth = 'FAILED';

        // Generate Recommendations
        if (result.connection.status === 'FAILED') {
          result.summary.recommendedActions.push('🚨 IMMEDIATE: Fix Firestore connection configuration');
        }

        if (!result.environment.hasRequiredVars) {
          result.summary.recommendedActions.push('🔧 IMMEDIATE: Set missing environment variables');
        }

        if (result.specificTests.floorsNormalized.status === 'TIMEOUT') {
          result.summary.recommendedActions.push('🏗️ CRITICAL: Floors normalized collection has query timeout - check Firestore indexes');
        }

        if (result.specificTests.floorsSubcollections.status === 'TIMEOUT') {
          result.summary.recommendedActions.push('📁 CRITICAL: Floors subcollections have query timeout - check permissions');
        }

        const totalDiagnosticTime = Date.now() - diagnosticStart;
        console.log(`✅ [Floors/Diagnostic] Complete: ${result.summary.overallHealth} (${totalDiagnosticTime}ms)`);

        return NextResponse.json(result);

      } catch (error) {
        console.error('❌ [Floors/Diagnostic] Error:', {
          error: error instanceof Error ? error.message : 'Unknown error',
          userId: ctx.uid,
          companyId: ctx.companyId
        });

        result.summary.overallHealth = 'FAILED';
        result.summary.criticalIssues.push(`Diagnostic system failure: ${error instanceof Error ? error.message : 'Unknown error'}`);
        result.summary.recommendedActions.push('🚨 EMERGENCY: Fix diagnostic system before proceeding');

        return NextResponse.json(result, { status: 500 });
      }
    },
    { requiredGlobalRoles: 'super_admin' }
  );

  return handler(request);
};

export const GET = withStandardRateLimit(getHandler);
