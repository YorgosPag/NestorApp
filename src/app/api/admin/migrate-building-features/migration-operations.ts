import 'server-only';

import type { NextRequest } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { processAdminBatch, BATCH_SIZE_READ, BATCH_SIZE_WRITE } from '@/lib/admin-batch-utils';
import { isBuildingFeatureKey, type BuildingFeatureKey } from '@/types/building/features';
import { logMigrationExecuted, extractRequestMetadata } from '@/lib/auth';
import type { AuthContext } from '@/lib/auth';
import { getErrorMessage } from '@/lib/error-utils';
import { createModuleLogger } from '@/lib/telemetry';
import {
  FALLBACK_BUILDING_NAME,
  LEGACY_GREEK_TO_KEY,
  MIGRATION_AUDIT_KEY,
  MIGRATION_OPERATION_NAME,
  MIGRATION_TIMESTAMP_FIELD,
  type BuildingDoc,
  type MigrationPreview,
  type MigrationResultEntry,
} from './migration-config';

const logger = createModuleLogger('MigrateBuildingFeaturesRoute');

interface PreviewSummary {
  totalBuildings: number;
  needsMigration: number;
  alreadyCorrect: number;
  totalUnmappedFeatures: number;
}

interface ExecuteSummary {
  total: number;
  updated: number;
  skipped: number;
  errors: number;
  droppedUnmapped: number;
}

interface PreviewResponsePayload {
  success: true;
  mode: 'preview';
  summary: PreviewSummary;
  unmappedFeatures: string[];
  buildingPreviews: MigrationPreview[];
  executionTimeMs: number;
  message: string;
  warning?: string;
}

interface ExecuteResponsePayload {
  success: boolean;
  message: string;
  summary: ExecuteSummary;
  results: MigrationResultEntry[];
  executionTimeMs: number;
  warning?: string;
}

export interface ForbiddenPayload {
  success: false;
  error: string;
  code: string;
}

export const createForbiddenPayload = (error: string, code: string): ForbiddenPayload => ({
  success: false,
  error,
  code,
});

const migrateFeature = (feature: string): { key: BuildingFeatureKey | null; status: 'migrated' | 'already_key' | 'unmapped' } => {
  if (isBuildingFeatureKey(feature)) {
    return { key: feature, status: 'already_key' };
  }

  const mappedKey = LEGACY_GREEK_TO_KEY[feature];
  if (mappedKey) {
    return { key: mappedKey, status: 'migrated' };
  }

  const trimmedFeature = feature.trim();
  if (LEGACY_GREEK_TO_KEY[trimmedFeature]) {
    return { key: LEGACY_GREEK_TO_KEY[trimmedFeature], status: 'migrated' };
  }

  return { key: null, status: 'unmapped' };
};

const analyzeBuilding = (building: BuildingDoc): MigrationPreview => {
  const currentFeatures = building.features || [];
  const migratedFeatures: BuildingFeatureKey[] = [];
  const unmappedFeatures: string[] = [];
  const alreadyMigrated: string[] = [];

  for (const feature of currentFeatures) {
    const result = migrateFeature(feature);

    if (result.status === 'already_key' && result.key) {
      alreadyMigrated.push(result.key);
      migratedFeatures.push(result.key);
      continue;
    }

    if (result.status === 'migrated' && result.key) {
      migratedFeatures.push(result.key);
      continue;
    }

    unmappedFeatures.push(feature);
  }

  const uniqueMigrated = [...new Set(migratedFeatures)];

  return {
    id: building.id,
    name: building.name,
    currentFeatures,
    migratedFeatures: uniqueMigrated,
    unmappedFeatures,
    alreadyMigrated,
    needsMigration:
      uniqueMigrated.length !== currentFeatures.length ||
      unmappedFeatures.length > 0 ||
      alreadyMigrated.length !== currentFeatures.length,
  };
};

const loadBuildings = async (batchSize: number): Promise<BuildingDoc[]> => {
  const db = getAdminFirestore();
  const buildings: BuildingDoc[] = [];

  await processAdminBatch(
    db.collection(COLLECTIONS.BUILDINGS),
    batchSize,
    (docs) => {
      for (const docSnap of docs) {
        const data = docSnap.data();
        buildings.push({
          id: docSnap.id,
          name: (data.name as string) || FALLBACK_BUILDING_NAME,
          features: (data.features as string[]) || [],
        });
      }
    },
  );

  return buildings;
};

const collectUnmappedFeatures = (previews: MigrationPreview[]): string[] => {
  const unmapped = new Set<string>();
  previews.forEach((preview) => {
    preview.unmappedFeatures.forEach((feature) => {
      unmapped.add(feature);
    });
  });

  return Array.from(unmapped);
};

export const previewBuildingFeaturesMigration = async (): Promise<PreviewResponsePayload> => {
  const startTime = Date.now();
  logger.info('Analyzing buildings for feature migration...');

  const buildings = await loadBuildings(BATCH_SIZE_READ);
  const previews = buildings.map(analyzeBuilding);
  const needsMigration = previews.filter((preview) => preview.needsMigration);
  const alreadyCorrect = previews.filter((preview) => !preview.needsMigration);
  const unmappedFeatures = collectUnmappedFeatures(previews);

  return {
    success: true,
    mode: 'preview',
    summary: {
      totalBuildings: buildings.length,
      needsMigration: needsMigration.length,
      alreadyCorrect: alreadyCorrect.length,
      totalUnmappedFeatures: unmappedFeatures.length,
    },
    unmappedFeatures,
    buildingPreviews: previews,
    executionTimeMs: Date.now() - startTime,
    message: `Found ${needsMigration.length} buildings that need migration. Use POST to execute.`,
    warning: unmappedFeatures.length > 0
      ? `WARNING: ${unmappedFeatures.length} features could not be mapped. Add them to LEGACY_GREEK_TO_KEY before migration.`
      : undefined,
  };
};

const parseForceFlag = (request: NextRequest): boolean => {
  const { searchParams } = new URL(request.url);
  return searchParams.get('force') === 'true';
};

export const executeBuildingFeaturesMigration = async (
  request: NextRequest,
  ctx: AuthContext,
): Promise<ExecuteResponsePayload> => {
  const startTime = Date.now();
  logger.info('Starting building features migration...');

  const force = parseForceFlag(request);
  const buildings = await loadBuildings(BATCH_SIZE_WRITE);
  const previews = buildings.map(analyzeBuilding);
  const unmappedFeatures = collectUnmappedFeatures(previews);

  if (unmappedFeatures.length > 0 && !force) {
    throw new Error(JSON.stringify({
      type: 'UNMAPPED_FEATURES',
      unmappedFeatures,
      message: 'Add missing features to LEGACY_GREEK_TO_KEY mapping, or use POST?force=true to migrate anyway (unmapped features will be dropped).',
    }));
  }

  const db = getAdminFirestore();
  const results: MigrationResultEntry[] = [];

  for (const preview of previews) {
    if (!preview.needsMigration) {
      results.push({
        id: preview.id,
        name: preview.name,
        status: 'skipped',
      });
      continue;
    }

    try {
      const timestamp = new Date().toISOString();
      await db.collection(COLLECTIONS.BUILDINGS).doc(preview.id).update({
        features: preview.migratedFeatures,
        updatedAt: timestamp,
        [MIGRATION_TIMESTAMP_FIELD]: timestamp,
      });

      results.push({
        id: preview.id,
        name: preview.name,
        status: 'updated',
        oldFeatures: preview.currentFeatures,
        newFeatures: preview.migratedFeatures,
      });

      logger.info('Migrated building features', {
        buildingId: preview.id,
        buildingName: preview.name,
        featuresCount: preview.migratedFeatures.length,
      });
    } catch (error) {
      logger.error('Failed to migrate building features', { buildingId: preview.id, error });
      results.push({
        id: preview.id,
        name: preview.name,
        status: 'error',
        error: getErrorMessage(error),
      });
    }
  }

  const updated = results.filter((result) => result.status === 'updated').length;
  const skipped = results.filter((result) => result.status === 'skipped').length;
  const errors = results.filter((result) => result.status === 'error').length;
  const executionTimeMs = Date.now() - startTime;

  const metadata = extractRequestMetadata(request);
  await logMigrationExecuted(
    ctx,
    MIGRATION_AUDIT_KEY,
    {
      operation: MIGRATION_OPERATION_NAME,
      totalBuildings: results.length,
      buildingsUpdated: updated,
      buildingsSkipped: skipped,
      buildingsErrored: errors,
      unmappedFeaturesDropped: unmappedFeatures.length,
      forceFlag: force,
      updatedBuildings: results
        .filter((result) => result.status === 'updated')
        .map((result) => ({
          id: result.id,
          name: result.name,
          oldFeaturesCount: result.oldFeatures?.length || 0,
          newFeaturesCount: result.newFeatures?.length || 0,
        })),
      executionTimeMs,
      result: errors === 0 ? 'success' : 'partial_success',
      metadata,
    },
    `Building features migration (Greek→Keys) by ${ctx.globalRole} ${ctx.email}`,
  ).catch((error: unknown) => {
    logger.warn('Audit logging failed (non-blocking)', { error });
  });

  return {
    success: errors === 0,
    message: `Migration complete! Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}`,
    summary: {
      total: results.length,
      updated,
      skipped,
      errors,
      droppedUnmapped: unmappedFeatures.length,
    },
    results,
    executionTimeMs,
    warning: unmappedFeatures.length > 0
      ? `WARNING: ${unmappedFeatures.length} unmapped features were dropped: ${unmappedFeatures.join(', ')}`
      : undefined,
  };
};
