/**
 * =============================================================================
 * 🔍 SEARCH INDEX BACKFILL - ADMIN INTERFACE
 * =============================================================================
 *
 * Admin page for backfilling search index documents.
 * Allows super_admin to populate the searchDocuments collection.
 *
 * @module app/admin/search-backfill
 * @enterprise ADR-029 - Global Search v1
 */

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Search,
  PlayCircle,
  Eye,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Database,
  User,
  Car,
} from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { cn } from '@/lib/utils';
// 🏢 ENTERPRISE: Import from centralized navigation entities (ZERO duplicates)
import { NAVIGATION_ENTITIES, type NavigationEntityType } from '@/components/navigation/config/navigation-entities';

// =============================================================================
// TYPES
// =============================================================================

interface BackfillStats {
  processed: number;
  indexed: number;
  skipped: number;
  errors: number;
}

interface MigrationStats {
  total: number;
  migrated: number;
  skipped: number;
  errors: number;
  noCreator: number;
}

interface MigrationResponse {
  mode: 'DRY_RUN' | 'EXECUTE';
  stats: MigrationStats;
  duration: number;
  timestamp: string;
}

interface ParkingFKMigrationStats {
  total: number;
  migrated: number;
  alreadyCorrect: number;
  errors: number;
}

interface ParkingFKMigrationResponse {
  mode: 'DRY_RUN' | 'EXECUTE';
  message: string;
  stats: ParkingFKMigrationStats;
  details: Array<{
    id: string;
    action: string;
    changes?: Record<string, unknown>;
    error?: string;
  }>;
  executionTimeMs: number;
}

interface BackfillResponse {
  mode: 'DRY_RUN' | 'EXECUTE';
  stats: Record<string, BackfillStats>;
  totalStats: BackfillStats;
  duration: number;
  timestamp: string;
}

interface IndexStatus {
  system: {
    name: string;
    version: string;
    security: string;
  };
  currentIndex: {
    collection: string;
    totalDocuments: number;
    byEntityType: Record<string, number>;
  };
  availableTypes: string[];
}

// =============================================================================
// ENTITY ICONS (🏢 ENTERPRISE: Uses centralized NAVIGATION_ENTITIES)
// =============================================================================

/**
 * Get icon for entity type from centralized config.
 * Falls back to a generic icon if entity type not found.
 */
function getEntityIcon(entityType: string): React.ElementType {
  if (entityType in NAVIGATION_ENTITIES) {
    return NAVIGATION_ENTITIES[entityType as NavigationEntityType].icon;
  }
  // Fallback for unknown types
  return NAVIGATION_ENTITIES.file.icon;
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function SearchBackfillPage() {
  const iconSizes = useIconSizes();

  // State
  const [status, setStatus] = useState<IndexStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [isParkingMigrating, setIsParkingMigrating] = useState(false);
  const [isParkingReseeding, setIsParkingReseeding] = useState(false);
  const [result, setResult] = useState<BackfillResponse | null>(null);
  const [migrationResult, setMigrationResult] = useState<MigrationResponse | null>(null);
  const [parkingMigrationResult, setParkingMigrationResult] = useState<ParkingFKMigrationResponse | null>(null);
  const [parkingReseedResult, setParkingReseedResult] = useState<{ deleted: number; created: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  // =============================================================================
  // LOGGING
  // =============================================================================

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString('el-GR');
    setLogs(prev => [...prev.slice(-29), `[${timestamp}] ${message}`]);
  }, []);

  // =============================================================================
  // FETCH STATUS
  // =============================================================================

  const fetchStatus = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    addLog('Fetching index status...');

    try {
      const response = await apiClient.get<IndexStatus>('/api/admin/search-backfill');
      setStatus(response);
      addLog(`Index has ${response.currentIndex.totalDocuments} documents`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch status';
      setError(message);
      addLog(`Error: ${message}`);
    } finally {
      setIsLoading(false);
    }
  }, [addLog]);

  // Initial fetch
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // =============================================================================
  // EXECUTE BACKFILL
  // =============================================================================

  const executeBackfill = useCallback(async (dryRun: boolean) => {
    setIsExecuting(true);
    setError(null);
    setResult(null);

    const mode = dryRun ? 'DRY-RUN' : 'EXECUTE';
    addLog(`Starting ${mode}...`);

    try {
      // 🏢 ENTERPRISE: Extended timeout (120s) for admin backfill operations
      // User lookups for tenant resolution may take longer than default 30s
      const response = await apiClient.post<BackfillResponse>(
        '/api/admin/search-backfill',
        { dryRun },
        { timeout: 120000 }  // 2 minutes
      );

      setResult(response);
      addLog(`${mode} complete: ${response.totalStats.indexed} documents indexed`);

      // Refresh status after execute
      if (!dryRun) {
        await fetchStatus();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Backfill failed';
      setError(message);
      addLog(`Error: ${message}`);
    } finally {
      setIsExecuting(false);
    }
  }, [addLog, fetchStatus]);

  // =============================================================================
  // CONTACT MIGRATION
  // =============================================================================

  const executeMigration = useCallback(async (dryRun: boolean) => {
    setIsMigrating(true);
    setError(null);
    setMigrationResult(null);

    const mode = dryRun ? 'DRY-RUN' : 'EXECUTE';
    addLog(`Starting Contact Migration ${mode}...`);

    try {
      // 🏢 ENTERPRISE: Default companyId for orphan contacts
      const DEFAULT_COMPANY_ID = 'pzNUy8ksddGCtcQMqumR';

      // 🏢 ENTERPRISE: Extended timeout (120s) for admin migration operations
      const response = await apiClient.patch<MigrationResponse>(
        '/api/admin/search-backfill',
        { dryRun, defaultCompanyId: DEFAULT_COMPANY_ID },
        { timeout: 120000 }  // 2 minutes
      );

      setMigrationResult(response);
      addLog(`${mode} complete: ${response.stats.migrated} contacts migrated`);

      // Refresh status after execute
      if (!dryRun) {
        await fetchStatus();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Migration failed';
      setError(message);
      addLog(`Error: ${message}`);
    } finally {
      setIsMigrating(false);
    }
  }, [addLog, fetchStatus]);

  // =============================================================================
  // PARKING FK MIGRATION
  // =============================================================================

  const executeParkingMigration = useCallback(async (dryRun: boolean) => {
    setIsParkingMigrating(true);
    setError(null);
    setParkingMigrationResult(null);

    const mode = dryRun ? 'DRY-RUN' : 'EXECUTE';
    addLog(`Starting Parking FK Migration ${mode}...`);

    try {
      const response = await apiClient.patch<ParkingFKMigrationResponse>(
        '/api/admin/seed-parking',
        { dryRun }
      );

      setParkingMigrationResult(response);
      addLog(`${mode} complete: ${response.stats.migrated} parking spots migrated`);

      // Refresh status after execute to see updated counts
      if (!dryRun) {
        await fetchStatus();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Parking FK Migration failed';
      setError(message);
      addLog(`Error: ${message}`);
    } finally {
      setIsParkingMigrating(false);
    }
  }, [addLog, fetchStatus]);

  // =============================================================================
  // PARKING RE-SEED (DELETE + POST)
  // =============================================================================

  const executeParkingReseed = useCallback(async () => {
    setIsParkingReseeding(true);
    setError(null);
    setParkingReseedResult(null);

    addLog('Starting Parking Re-seed (DELETE + CREATE)...');

    try {
      // Step 1: DELETE all existing parking spots
      addLog('Step 1: Deleting existing parking spots...');
      const deleteResponse = await apiClient.delete<{
        success: boolean;
        deleted: { count: number }
      }>('/api/admin/seed-parking');

      addLog(`Deleted ${deleteResponse.deleted.count} parking spots`);

      // Step 2: CREATE new parking spots with correct IDs
      addLog('Step 2: Creating new parking spots with correct IDs...');
      const createResponse = await apiClient.post<{
        success: boolean;
        created: { count: number }
      }>('/api/admin/seed-parking', {});

      addLog(`Created ${createResponse.created.count} parking spots`);

      setParkingReseedResult({
        deleted: deleteResponse.deleted.count,
        created: createResponse.created.count,
      });

      addLog('✅ Parking Re-seed complete! Run Search Backfill to index them.');

      // Refresh status
      await fetchStatus();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Parking Re-seed failed';
      setError(message);
      addLog(`Error: ${message}`);
    } finally {
      setIsParkingReseeding(false);
    }
  }, [addLog, fetchStatus]);

  // =============================================================================
  // RENDER
  // =============================================================================

  return (
    <main className="container mx-auto py-8 px-4 max-w-4xl">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Search className={cn(iconSizes.lg, 'text-primary')} />
          <h1 className="text-2xl font-bold">Search Index Backfill</h1>
        </div>
        <p className="text-muted-foreground">
          Populate the search index with existing data for Global Search functionality.
        </p>
      </header>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className={iconSizes.sm} />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Current Index Status */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className={iconSizes.md} />
              <CardTitle>Current Index Status</CardTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchStatus}
              disabled={isLoading}
            >
              <RefreshCw className={cn(iconSizes.sm, 'mr-2', isLoading && 'animate-spin')} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {status ? (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Badge variant="secondary" className="text-lg px-3 py-1">
                  {status.currentIndex.totalDocuments} documents
                </Badge>
                <span className="text-sm text-muted-foreground">
                  in {status.currentIndex.collection}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {Object.entries(status.currentIndex.byEntityType).map(([type, count]) => {
                  const Icon = getEntityIcon(type);
                  return (
                    <div
                      key={type}
                      className="flex flex-col items-center p-3 rounded-lg bg-muted/50"
                    >
                      <Icon className={cn(iconSizes.md, 'text-muted-foreground mb-1')} />
                      <span className="font-semibold">{count}</span>
                      <span className="text-xs text-muted-foreground capitalize">{type}s</span>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : (
            <p className="text-muted-foreground">Loading...</p>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Actions</CardTitle>
          <CardDescription>
            First run a dry-run to preview changes, then execute to apply.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => executeBackfill(true)}
              disabled={isExecuting}
            >
              <Eye className={cn(iconSizes.sm, 'mr-2')} />
              Dry Run (Preview)
            </Button>

            <Button
              variant="default"
              onClick={() => executeBackfill(false)}
              disabled={isExecuting}
            >
              <PlayCircle className={cn(iconSizes.sm, 'mr-2')} />
              Execute Backfill
            </Button>
          </div>

          {isExecuting && (
            <div className="mt-4 flex items-center gap-2 text-muted-foreground">
              <RefreshCw className={cn(iconSizes.sm, 'animate-spin')} />
              <span>Processing... This may take a moment.</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contact Migration */}
      <Card className="mb-6 border-orange-200">
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className={cn(iconSizes.md, 'text-orange-500')} />
            <CardTitle>Contact Tenant Migration</CardTitle>
          </div>
          <CardDescription>
            Migrate contacts to add companyId from their creator. Required for tenant isolation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4">
            <AlertTriangle className={iconSizes.sm} />
            <AlertTitle>Enterprise Security Fix</AlertTitle>
            <AlertDescription>
              This migration adds companyId to contacts that don&apos;t have it, using the creator&apos;s companyId.
              This enables proper tenant isolation for the Global Search.
            </AlertDescription>
          </Alert>

          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => executeMigration(true)}
              disabled={isMigrating}
            >
              <Eye className={cn(iconSizes.sm, 'mr-2')} />
              Preview Migration
            </Button>

            <Button
              variant="default"
              className="bg-orange-500 hover:bg-orange-600"
              onClick={() => executeMigration(false)}
              disabled={isMigrating}
            >
              <PlayCircle className={cn(iconSizes.sm, 'mr-2')} />
              Execute Migration
            </Button>
          </div>

          {isMigrating && (
            <div className="mt-4 flex items-center gap-2 text-muted-foreground">
              <RefreshCw className={cn(iconSizes.sm, 'animate-spin')} />
              <span>Migrating contacts... This may take a moment.</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Parking FK Migration */}
      <Card className="mb-6 border-blue-200">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Car className={cn(iconSizes.md, 'text-blue-500')} />
            <CardTitle>Parking Foreign Key Migration</CardTitle>
          </div>
          <CardDescription>
            Normalize parking spot references to use canonical ID format (with prefixes).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Re-seed Section */}
          <Alert className="mb-4 border-orange-300 bg-orange-50">
            <AlertTriangle className={cn(iconSizes.sm, 'text-orange-600')} />
            <AlertTitle className="text-orange-800">Parking Re-seed</AlertTitle>
            <AlertDescription className="text-orange-700">
              Delete all parking spots and recreate with correct IDs (without prefix).
              Use this if parking spots have incorrect buildingId/projectId references.
            </AlertDescription>
          </Alert>

          <div className="flex flex-wrap gap-3 mb-6">
            <Button
              variant="destructive"
              onClick={executeParkingReseed}
              disabled={isParkingReseeding || isParkingMigrating}
            >
              <RefreshCw className={cn(iconSizes.sm, 'mr-2', isParkingReseeding && 'animate-spin')} />
              {isParkingReseeding ? 'Re-seeding...' : 'Re-seed Parking Spots'}
            </Button>
          </div>

          {/* Re-seed Result */}
          {parkingReseedResult && (
            <div className="mb-6 p-4 rounded-lg border border-green-300 bg-green-50">
              <div className="flex items-center gap-2 text-green-800 font-medium mb-2">
                <CheckCircle className={iconSizes.sm} />
                Parking Re-seed Complete
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-2 rounded bg-red-100">
                  <div className="text-xl font-bold text-red-600">{parkingReseedResult.deleted}</div>
                  <div className="text-xs text-red-700">Deleted</div>
                </div>
                <div className="text-center p-2 rounded bg-green-100">
                  <div className="text-xl font-bold text-green-600">{parkingReseedResult.created}</div>
                  <div className="text-xs text-green-700">Created</div>
                </div>
              </div>
            </div>
          )}

          {/* FK Validation Section (NO-OP - for verification only) */}
          <Alert className="mb-4 border-gray-300 bg-gray-50">
            <AlertTriangle className={cn(iconSizes.sm, 'text-gray-600')} />
            <AlertTitle className="text-gray-800">FK Validation (Verification Only)</AlertTitle>
            <AlertDescription className="text-gray-700">
              ⚠️ This is now a <strong>validation-only</strong> endpoint. It checks if parking spots have
              correct non-prefixed IDs. Prefixed IDs break tenant resolution because Firestore
              documents don&apos;t have prefixes in their IDs.
            </AlertDescription>
          </Alert>

          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => executeParkingMigration(true)}
              disabled={isParkingMigrating || isParkingReseeding}
            >
              <Eye className={cn(iconSizes.sm, 'mr-2')} />
              Validate IDs (Check Only)
            </Button>
          </div>

          {isParkingMigrating && (
            <div className="mt-4 flex items-center gap-2 text-muted-foreground">
              <RefreshCw className={cn(iconSizes.sm, 'animate-spin')} />
              <span>Migrating parking spots... This may take a moment.</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Parking Migration Results */}
      {parkingMigrationResult && (
        <Card className="mb-6 border-blue-200">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle className={cn(iconSizes.md, 'text-green-500')} />
              <CardTitle>
                {parkingMigrationResult.mode === 'DRY_RUN' ? 'Parking Migration Preview' : 'Parking Migration Results'}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center p-3 rounded-lg bg-blue-500/10">
                <div className="text-2xl font-bold text-blue-600">
                  {parkingMigrationResult.stats.total}
                </div>
                <div className="text-sm text-muted-foreground">Total</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-green-500/10">
                <div className="text-2xl font-bold text-green-600">
                  {parkingMigrationResult.stats.migrated}
                </div>
                <div className="text-sm text-muted-foreground">Migrated</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-gray-500/10">
                <div className="text-2xl font-bold text-gray-600">
                  {parkingMigrationResult.stats.alreadyCorrect}
                </div>
                <div className="text-sm text-muted-foreground">Already Correct</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-red-500/10">
                <div className="text-2xl font-bold text-red-600">
                  {parkingMigrationResult.stats.errors}
                </div>
                <div className="text-sm text-muted-foreground">Errors</div>
              </div>
            </div>

            <div className="mt-4 text-sm text-muted-foreground">
              {parkingMigrationResult.message} | Duration: {parkingMigrationResult.executionTimeMs}ms
            </div>
          </CardContent>
        </Card>
      )}

      {/* Migration Results */}
      {migrationResult && (
        <Card className="mb-6 border-orange-200">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle className={cn(iconSizes.md, 'text-green-500')} />
              <CardTitle>
                {migrationResult.mode === 'DRY_RUN' ? 'Migration Preview' : 'Migration Results'}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              <div className="text-center p-3 rounded-lg bg-blue-500/10">
                <div className="text-2xl font-bold text-blue-600">
                  {migrationResult.stats.total}
                </div>
                <div className="text-sm text-muted-foreground">Total</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-green-500/10">
                <div className="text-2xl font-bold text-green-600">
                  {migrationResult.stats.migrated}
                </div>
                <div className="text-sm text-muted-foreground">Migrated</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-yellow-500/10">
                <div className="text-2xl font-bold text-yellow-600">
                  {migrationResult.stats.skipped}
                </div>
                <div className="text-sm text-muted-foreground">Skipped</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-orange-500/10">
                <div className="text-2xl font-bold text-orange-600">
                  {migrationResult.stats.noCreator}
                </div>
                <div className="text-sm text-muted-foreground">No Creator</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-red-500/10">
                <div className="text-2xl font-bold text-red-600">
                  {migrationResult.stats.errors}
                </div>
                <div className="text-sm text-muted-foreground">Errors</div>
              </div>
            </div>

            <div className="mt-4 text-sm text-muted-foreground">
              Duration: {migrationResult.duration}ms | {migrationResult.timestamp}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && (
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle className={cn(iconSizes.md, 'text-green-500')} />
              <CardTitle>
                {result.mode === 'DRY_RUN' ? 'Dry Run Results' : 'Execution Results'}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {/* Total Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="text-center p-3 rounded-lg bg-blue-500/10">
                <div className="text-2xl font-bold text-blue-600">
                  {result.totalStats.processed}
                </div>
                <div className="text-sm text-muted-foreground">Processed</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-green-500/10">
                <div className="text-2xl font-bold text-green-600">
                  {result.totalStats.indexed}
                </div>
                <div className="text-sm text-muted-foreground">Indexed</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-yellow-500/10">
                <div className="text-2xl font-bold text-yellow-600">
                  {result.totalStats.skipped}
                </div>
                <div className="text-sm text-muted-foreground">Skipped</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-red-500/10">
                <div className="text-2xl font-bold text-red-600">
                  {result.totalStats.errors}
                </div>
                <div className="text-sm text-muted-foreground">Errors</div>
              </div>
            </div>

            {/* Per-Type Stats */}
            <h4 className="font-medium mb-3">By Entity Type</h4>
            <div className="space-y-2">
              {Object.entries(result.stats).map(([type, stats]) => {
                const Icon = getEntityIcon(type);
                return (
                  <div
                    key={type}
                    className="flex items-center justify-between p-2 rounded bg-muted/30"
                  >
                    <div className="flex items-center gap-2">
                      <Icon className={cn(iconSizes.sm, 'text-muted-foreground')} />
                      <span className="capitalize font-medium">{type}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span>{stats.processed} processed</span>
                      <span className="text-green-600">{stats.indexed} indexed</span>
                      {stats.skipped > 0 && (
                        <span className="text-yellow-600">{stats.skipped} skipped</span>
                      )}
                      {stats.errors > 0 && (
                        <span className="text-red-600">{stats.errors} errors</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 text-sm text-muted-foreground">
              Duration: {result.duration}ms | {result.timestamp}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-muted/50 rounded-lg p-3 h-48 overflow-y-auto font-mono text-xs">
            {logs.length > 0 ? (
              logs.map((log, i) => (
                <div key={i} className="py-0.5">
                  {log}
                </div>
              ))
            ) : (
              <span className="text-muted-foreground">No logs yet...</span>
            )}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
