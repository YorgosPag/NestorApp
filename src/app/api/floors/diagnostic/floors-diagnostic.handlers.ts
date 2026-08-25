/**
 * =============================================================================
 * FIRESTORE CONNECTIVITY DIAGNOSTIC — η λογική (ADR-585 / N.7.1)
 * =============================================================================
 *
 * Βγήκε από το `route.ts` επειδή το CHECK 4 μπλόκαρε στις **386/300** γραμμές.
 * Το όριο των API routes είναι αυστηρότερο (300, όχι 500) με λόγο: ένα route
 * είναι **σύνορο** — μόλις γίνει «το αρχείο όπου ζει το χαρακτηριστικό», κανείς
 * δεν μπορεί πια να δει με μια ματιά ποιος επιτρέπεται και τι επιστρέφεται.
 *
 * ⚠️ **Κάθε βήμα γράφει ΜΟΝΟ στο δικό του κλαδί** του `result` και **ποτέ δεν
 * πετά**: το διαγνωστικό οφείλει να απαντήσει ακόμα κι όταν κάθε δοκιμή αποτύχει
 * — αυτό είναι όλο του το νόημα. Οι κρίσιμες αστοχίες συσσωρεύονται στο
 * `summary.criticalIssues` αντί να διακόπτουν τη ροή.
 *
 * @module api/floors/diagnostic/handlers
 */

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { nowISO } from '@/lib/date-local';

import type { FirestoreDiagnosticResult } from './floors-diagnostic.types';

const logger = createModuleLogger('FloorsDiagnosticRoute');

const REQUIRED_ENV_VARS = [
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
];

const COLLECTIONS_TO_TEST = ['PROJECTS', 'BUILDINGS', 'FLOORS', 'CONTACTS'];

/**
 * Χρονικό όριο γύρω από ένα ερώτημα Firestore.
 *
 * ⚠️ Ήταν γραμμένο **τρεις φορές** inline ως `Promise.race` + `setTimeout`, και
 * **καμία** από τις τρεις δεν καθάριζε τον timer: μια γρήγορη απάντηση άφηνε
 * ζωντανό χρονόμετρο μέχρι να λήξει. Εδώ ο timer ακυρώνεται πάντα.
 */
async function withTimeout<T>(operation: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Timeout after ${label}`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** `TIMEOUT` όταν έληξε το χρονικό όριο, `FAIL` για κάθε άλλη αστοχία. */
function failureStatus(error: unknown): 'TIMEOUT' | 'FAIL' {
  return error instanceof Error && error.message.includes('Timeout') ? 'TIMEOUT' : 'FAIL';
}

/** Η αφετηρία: **χειρότερη περίπτωση παντού**, και κάθε δοκιμή τη βελτιώνει. */
export function createEmptyResult(): FirestoreDiagnosticResult {
  return {
    timestamp: nowISO(),
    summary: { overallHealth: 'FAILED', criticalIssues: [], recommendedActions: [] },
    connection: { status: 'FAILED' },
    environment: { hasRequiredVars: false, missingVars: [], collections: {} },
    collections: {},
    specificTests: {
      floorsNormalized: { status: 'FAIL', details: 'Not tested' },
      floorsSubcollections: { status: 'FAIL', details: 'Not tested' },
      buildingsAccess: { status: 'FAIL', details: 'Not tested' },
    },
  };
}

/** TEST 1 — μεταβλητές περιβάλλοντος. */
function checkEnvironment(result: FirestoreDiagnosticResult): void {
  logger.info('TEST 1: Environment variables check');
  result.environment.collections = COLLECTIONS;

  REQUIRED_ENV_VARS.forEach((varName) => {
    if (!process.env[varName]) result.environment.missingVars.push(varName);
  });

  result.environment.hasRequiredVars = result.environment.missingVars.length === 0;

  if (!result.environment.hasRequiredVars) {
    result.summary.criticalIssues.push(
      `Missing environment variables: ${result.environment.missingVars.join(', ')}`
    );
  }
}

/** TEST 2 — βασική σύνδεση. */
async function checkConnection(result: FirestoreDiagnosticResult): Promise<void> {
  logger.info('TEST 2: Basic Firestore connection');
  const started = Date.now();

  try {
    await getAdminFirestore().collection(COLLECTIONS.PROJECTS).limit(1).get();
    result.connection.status = 'CONNECTED';
    result.connection.latency = Date.now() - started;
    logger.info('Connection successful', { latencyMs: result.connection.latency });
  } catch (error) {
    result.connection.status = 'FAILED';
    result.connection.errorMessage = getErrorMessage(error, 'Unknown connection error');
    result.summary.criticalIssues.push(`Firestore connection failed: ${result.connection.errorMessage}`);
    logger.error('Connection failed', { error: result.connection.errorMessage });
  }
}

/** TEST 3 — προσβασιμότητα συλλογών. */
async function checkCollections(result: FirestoreDiagnosticResult): Promise<void> {
  logger.info('TEST 3: Collection accessibility');

  for (const collectionName of COLLECTIONS_TO_TEST) {
    const collectionPath = COLLECTIONS[collectionName as keyof typeof COLLECTIONS];
    if (!collectionPath) continue;

    const started = Date.now();
    logger.info('Testing collection', { collectionName, collectionPath });

    try {
      const snapshot = await getAdminFirestore().collection(collectionPath).limit(5).get();
      const first = snapshot.docs[0];
      result.collections[collectionName] = {
        accessible: true,
        documentCount: snapshot.docs.length,
        latency: Date.now() - started,
        sampleDocument: first ? { id: first.id, ...first.data() } : null,
      };
      logger.info('Collection accessible', { collectionName, docCount: snapshot.docs.length });
    } catch (error) {
      result.collections[collectionName] = {
        accessible: false,
        latency: Date.now() - started,
        errorMessage: getErrorMessage(error),
      };
      logger.error('Collection inaccessible', {
        collectionName,
        error: result.collections[collectionName].errorMessage,
      });
      result.summary.criticalIssues.push(`${collectionName} collection inaccessible`);
    }
  }
}

/** TEST 4a — κανονικοποιημένη συλλογή ορόφων. */
async function checkNormalizedFloors(result: FirestoreDiagnosticResult): Promise<void> {
  logger.info('Testing normalized floors collection');
  const started = Date.now();

  try {
    const snapshot = await withTimeout(
      getAdminFirestore().collection(COLLECTIONS.FLOORS).limit(10).get(),
      10000,
      '10 seconds'
    );
    result.specificTests.floorsNormalized = {
      status: 'PASS',
      details: `Found ${snapshot.docs.length} floors in normalized collection`,
      latency: Date.now() - started,
    };
    logger.info('Normalized floors accessible', { docCount: snapshot.docs.length });
  } catch (error) {
    result.specificTests.floorsNormalized = {
      status: failureStatus(error),
      details: getErrorMessage(error),
      latency: Date.now() - started,
    };
    logger.error('Normalized floors failed', { details: result.specificTests.floorsNormalized.details });
  }
}

/** TEST 4c — υποσυλλογή ορόφων του πρώτου κτηρίου. */
async function checkSubcollectionFloors(
  result: FirestoreDiagnosticResult,
  buildingId: string
): Promise<void> {
  logger.info('Testing subcollection floors');
  const started = Date.now();

  try {
    const snapshot = await withTimeout(
      getAdminFirestore()
        .collection(COLLECTIONS.BUILDINGS)
        .doc(buildingId)
        .collection(SUBCOLLECTIONS.BUILDING_FLOORS)
        .get(),
      5000,
      '5 seconds'
    );
    result.specificTests.floorsSubcollections = {
      status: 'PASS',
      details: `Found ${snapshot.docs.length} floors in building ${buildingId} subcollection`,
      latency: Date.now() - started,
    };
    logger.info('Subcollection floors accessible', { docCount: snapshot.docs.length });
  } catch (error) {
    result.specificTests.floorsSubcollections = {
      status: failureStatus(error),
      details: getErrorMessage(error),
      latency: Date.now() - started,
    };
    logger.error('Subcollection floors failed', {
      details: result.specificTests.floorsSubcollections.details,
    });
  }
}

/** TEST 4b — πρόσβαση σε κτήρια· η υποσυλλογή δοκιμάζεται **μόνο** αν υπάρχει κτήριο. */
async function checkBuildingsAccess(result: FirestoreDiagnosticResult): Promise<void> {
  logger.info('Testing buildings access');
  const started = Date.now();

  try {
    const snapshot = await withTimeout(
      getAdminFirestore().collection(COLLECTIONS.BUILDINGS).limit(5).get(),
      5000,
      '5 seconds'
    );
    result.specificTests.buildingsAccess = {
      status: 'PASS',
      details: `Found ${snapshot.docs.length} buildings`,
      latency: Date.now() - started,
    };
    logger.info('Buildings access OK', { docCount: snapshot.docs.length });

    const firstBuilding = snapshot.docs[0];
    if (firstBuilding) await checkSubcollectionFloors(result, firstBuilding.id);
  } catch (error) {
    result.specificTests.buildingsAccess = {
      status: failureStatus(error),
      details: getErrorMessage(error),
      latency: Date.now() - started,
    };
    logger.error('Buildings access failed', { details: result.specificTests.buildingsAccess.details });
  }
}

/** Σύνδεση 40 · περιβάλλον 20 · προσβάσιμες συλλογές 40. */
function scoreHealth(result: FirestoreDiagnosticResult): number {
  let score = 0;
  if (result.connection.status === 'CONNECTED') score += 40;
  if (result.environment.hasRequiredVars) score += 20;

  const total = Object.keys(result.collections).length;
  if (total > 0) {
    const accessible = Object.values(result.collections).filter((c) => c.accessible).length;
    score += (accessible / total) * 40;
  }
  return score;
}

/** Οι συστάσεις **παράγονται** από τα ευρήματα — καμία δεύτερη κρίση. */
function recommend(result: FirestoreDiagnosticResult): void {
  if (result.connection.status === 'FAILED') {
    result.summary.recommendedActions.push('🚨 IMMEDIATE: Fix Firestore connection configuration');
  }
  if (!result.environment.hasRequiredVars) {
    result.summary.recommendedActions.push('🔧 IMMEDIATE: Set missing environment variables');
  }
  if (result.specificTests.floorsNormalized.status === 'TIMEOUT') {
    result.summary.recommendedActions.push(
      '🏗️ CRITICAL: Floors normalized collection has query timeout - check Firestore indexes'
    );
  }
  if (result.specificTests.floorsSubcollections.status === 'TIMEOUT') {
    result.summary.recommendedActions.push(
      '📁 CRITICAL: Floors subcollections have query timeout - check permissions'
    );
  }
}

/** ANALYSIS — συνολική υγεία + συστάσεις. */
function assessHealth(result: FirestoreDiagnosticResult): void {
  logger.info('ANALYSIS: Overall health assessment');
  const score = scoreHealth(result);

  if (score >= 90) result.summary.overallHealth = 'HEALTHY';
  else if (score >= 70) result.summary.overallHealth = 'DEGRADED';
  else if (score >= 30) result.summary.overallHealth = 'CRITICAL';
  else result.summary.overallHealth = 'FAILED';

  recommend(result);
}

/**
 * Τρέχει ολόκληρο το διαγνωστικό. **Ποτέ δεν πετά** — επιστρέφει πάντα αναφορά.
 *
 * @returns `ok: false` όταν απέτυχε το ίδιο το διαγνωστικό (⇒ HTTP 500), αλλιώς `true`.
 */
export async function runFloorsDiagnostic(
  auditContext: Record<string, unknown>
): Promise<{ ok: boolean; result: FirestoreDiagnosticResult }> {
  const startedAt = Date.now();
  logger.info('[Floors/Diagnostic] Starting Admin SDK operations');
  logger.info('Auth context', auditContext);

  const result = createEmptyResult();

  try {
    checkEnvironment(result);
    await checkConnection(result);
    await checkCollections(result);
    logger.info('TEST 4: Specific floors diagnostics');
    await checkNormalizedFloors(result);
    await checkBuildingsAccess(result);
    assessHealth(result);

    logger.info('[Floors/Diagnostic] Complete', {
      overallHealth: result.summary.overallHealth,
      durationMs: Date.now() - startedAt,
    });
    return { ok: true, result };
  } catch (error) {
    logger.error('[Floors/Diagnostic] Error', { error: getErrorMessage(error), ...auditContext });

    result.summary.overallHealth = 'FAILED';
    result.summary.criticalIssues.push(`Diagnostic system failure: ${getErrorMessage(error)}`);
    result.summary.recommendedActions.push('🚨 EMERGENCY: Fix diagnostic system before proceeding');
    return { ok: false, result };
  }
}
