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
  Building2,
  FolderKanban,
  Home,
  User,
  FileText,
} from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { cn } from '@/lib/utils';

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
// ENTITY ICONS
// =============================================================================

const ENTITY_ICONS: Record<string, React.ElementType> = {
  project: FolderKanban,
  building: Building2,
  unit: Home,
  contact: User,
  file: FileText,
};

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
  const [result, setResult] = useState<BackfillResponse | null>(null);
  const [migrationResult, setMigrationResult] = useState<MigrationResponse | null>(null);
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
      const response = await apiClient.post<BackfillResponse>(
        '/api/admin/search-backfill',
        { dryRun }
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

      const response = await apiClient.patch<MigrationResponse>(
        '/api/admin/search-backfill',
        { dryRun, defaultCompanyId: DEFAULT_COMPANY_ID }
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
                  const Icon = ENTITY_ICONS[type] || FileText;
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
                const Icon = ENTITY_ICONS[type] || FileText;
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
