/**
 * =============================================================================
 * 🔍 SEARCH INDEX BACKFILL - ADMIN INTERFACE
 * =============================================================================
 *
 * Admin page for backfilling search index documents.
 * Split: search-backfill-types (types), useSearchBackfillState (hook).
 *
 * @module app/admin/search-backfill
 * @enterprise ADR-029 - Global Search v1
 */

'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Search, PlayCircle, Eye, CheckCircle,
  AlertTriangle, RefreshCw, Database, User, Car,
} from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { getEntityIcon } from './search-backfill-types';
import { useSearchBackfillState } from './useSearchBackfillState';

export default function SearchBackfillPage() {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const s = useSearchBackfillState();

  return (
    <main className="container mx-auto py-8 px-4 max-w-4xl">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Search className={cn(iconSizes.lg, 'text-primary')} />
          <h1 className="text-2xl font-bold">Search Index Backfill</h1>
        </div>
        <p className={colors.text.muted}>
          Populate the search index with existing data for Global Search functionality.
        </p>
      </header>

      {/* Error Alert */}
      {s.error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className={iconSizes.sm} />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{s.error}</AlertDescription>
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
            <Button variant="outline" size="sm" onClick={s.fetchStatus} disabled={s.isLoading}>
              <RefreshCw className={cn(iconSizes.sm, 'mr-2', s.isLoading && 'animate-spin')} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {s.status ? (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Badge variant="secondary" className="text-lg px-3 py-1">
                  {s.status.currentIndex.totalDocuments} documents
                </Badge>
                <span className={cn('text-sm', colors.text.muted)}>
                  in {s.status.currentIndex.collection}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {Object.entries(s.status.currentIndex.byEntityType).map(([type, count]) => {
                  const Icon = getEntityIcon(type);
                  return (
                    <div key={type} className="flex flex-col items-center p-3 rounded-lg bg-muted/50">
                      <Icon className={cn(iconSizes.md, 'mb-1', colors.text.muted)} />
                      <span className="font-semibold">{count}</span>
                      <span className={cn('text-xs capitalize', colors.text.muted)}>{type}s</span>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : (
            <p className={colors.text.muted}>Loading...</p>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Actions</CardTitle>
          <CardDescription>First run a dry-run to preview changes, then execute to apply.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => s.executeBackfill(true)} disabled={s.isExecuting}>
              <Eye className={cn(iconSizes.sm, 'mr-2')} />
              Dry Run (Preview)
            </Button>
            <Button variant="default" onClick={() => s.executeBackfill(false)} disabled={s.isExecuting}>
              <PlayCircle className={cn(iconSizes.sm, 'mr-2')} />
              Execute Backfill
            </Button>
          </div>
          {s.isExecuting && (
            <div className={cn('mt-4 flex items-center gap-2', colors.text.muted)}>
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
            <Button variant="outline" onClick={() => s.executeMigration(true)} disabled={s.isMigrating}>
              <Eye className={cn(iconSizes.sm, 'mr-2')} />
              Preview Migration
            </Button>
            <Button variant="default" className="bg-orange-500 hover:bg-orange-600" onClick={() => s.executeMigration(false)} disabled={s.isMigrating}>
              <PlayCircle className={cn(iconSizes.sm, 'mr-2')} />
              Execute Migration
            </Button>
          </div>
          {s.isMigrating && (
            <div className={cn('mt-4 flex items-center gap-2', colors.text.muted)}>
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
              onClick={s.executeParkingReseed}
              disabled={s.isParkingReseeding || s.isParkingMigrating}
            >
              <RefreshCw className={cn(iconSizes.sm, 'mr-2', s.isParkingReseeding && 'animate-spin')} />
              {s.isParkingReseeding ? 'Re-seeding...' : 'Re-seed Parking Spots'}
            </Button>
          </div>

          {/* Re-seed Result */}
          {s.parkingReseedResult && (
            <div className="mb-6 p-4 rounded-lg border border-green-300 bg-green-50">
              <div className="flex items-center gap-2 text-green-800 font-medium mb-2">
                <CheckCircle className={iconSizes.sm} />
                Parking Re-seed Complete
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-2 rounded bg-red-100">
                  <div className="text-xl font-bold text-red-600">{s.parkingReseedResult.deleted}</div>
                  <div className="text-xs text-red-700">Deleted</div>
                </div>
                <div className="text-center p-2 rounded bg-green-100">
                  <div className="text-xl font-bold text-green-600">{s.parkingReseedResult.created}</div>
                  <div className="text-xs text-green-700">Created</div>
                </div>
              </div>
            </div>
          )}

          {/* FK Validation Section */}
          <Alert className="mb-4 border-gray-300 bg-gray-50">
            <AlertTriangle className={cn(iconSizes.sm, 'text-gray-600')} />
            <AlertTitle className="text-gray-800">FK Validation (Verification Only)</AlertTitle>
            <AlertDescription className="text-gray-700">
              This is now a <strong>validation-only</strong> endpoint. It checks if parking spots have
              correct non-prefixed IDs.
            </AlertDescription>
          </Alert>

          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => s.executeParkingMigration(true)}
              disabled={s.isParkingMigrating || s.isParkingReseeding}
            >
              <Eye className={cn(iconSizes.sm, 'mr-2')} />
              Validate IDs (Check Only)
            </Button>
          </div>

          {s.isParkingMigrating && (
            <div className={cn('mt-4 flex items-center gap-2', colors.text.muted)}>
              <RefreshCw className={cn(iconSizes.sm, 'animate-spin')} />
              <span>Migrating parking spots... This may take a moment.</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Parking Migration Results */}
      {s.parkingMigrationResult && (
        <Card className="mb-6 border-blue-200">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle className={cn(iconSizes.md, 'text-green-500')} />
              <CardTitle>
                {s.parkingMigrationResult.mode === 'DRY_RUN' ? 'Parking Migration Preview' : 'Parking Migration Results'}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { value: s.parkingMigrationResult.stats.total, label: 'Total', color: 'blue' },
                { value: s.parkingMigrationResult.stats.migrated, label: 'Migrated', color: 'green' },
                { value: s.parkingMigrationResult.stats.alreadyCorrect, label: 'Already Correct', color: 'gray' },
                { value: s.parkingMigrationResult.stats.errors, label: 'Errors', color: 'red' },
              ].map(({ value, label, color }) => (
                <div key={label} className={`text-center p-3 rounded-lg bg-${color}-500/10`}>
                  <div className={`text-2xl font-bold text-${color}-600`}>{value}</div>
                  <div className={cn('text-sm', colors.text.muted)}>{label}</div>
                </div>
              ))}
            </div>
            <div className={cn('mt-4 text-sm', colors.text.muted)}>
              {s.parkingMigrationResult.message} | Duration: {s.parkingMigrationResult.executionTimeMs}ms
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contact Migration Results */}
      {s.migrationResult && (
        <Card className="mb-6 border-orange-200">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle className={cn(iconSizes.md, 'text-green-500')} />
              <CardTitle>
                {s.migrationResult.mode === 'DRY_RUN' ? 'Migration Preview' : 'Migration Results'}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              {[
                { value: s.migrationResult.stats.total, label: 'Total', color: 'blue' },
                { value: s.migrationResult.stats.migrated, label: 'Migrated', color: 'green' },
                { value: s.migrationResult.stats.skipped, label: 'Skipped', color: 'yellow' },
                { value: s.migrationResult.stats.noCreator, label: 'No Creator', color: 'orange' },
                { value: s.migrationResult.stats.errors, label: 'Errors', color: 'red' },
              ].map(({ value, label, color }) => (
                <div key={label} className={`text-center p-3 rounded-lg bg-${color}-500/10`}>
                  <div className={`text-2xl font-bold text-${color}-600`}>{value}</div>
                  <div className={cn('text-sm', colors.text.muted)}>{label}</div>
                </div>
              ))}
            </div>
            <div className={cn('mt-4 text-sm', colors.text.muted)}>
              Duration: {s.migrationResult.duration}ms | {s.migrationResult.timestamp}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Backfill Results */}
      {s.result && (
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle className={cn(iconSizes.md, 'text-green-500')} />
              <CardTitle>
                {s.result.mode === 'DRY_RUN' ? 'Dry Run Results' : 'Execution Results'}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              {[
                { value: s.result.totalStats.processed, label: 'Processed', color: 'blue' },
                { value: s.result.totalStats.indexed, label: 'Indexed', color: 'green' },
                { value: s.result.totalStats.skipped, label: 'Skipped', color: 'yellow' },
                { value: s.result.totalStats.errors, label: 'Errors', color: 'red' },
              ].map(({ value, label, color }) => (
                <div key={label} className={`text-center p-3 rounded-lg bg-${color}-500/10`}>
                  <div className={`text-2xl font-bold text-${color}-600`}>{value}</div>
                  <div className={cn('text-sm', colors.text.muted)}>{label}</div>
                </div>
              ))}
            </div>

            <h4 className="font-medium mb-3">By Entity Type</h4>
            <div className="space-y-2">
              {Object.entries(s.result.stats).map(([type, stats]) => {
                const Icon = getEntityIcon(type);
                return (
                  <div key={type} className="flex items-center justify-between p-2 rounded bg-muted/30">
                    <div className="flex items-center gap-2">
                      <Icon className={cn(iconSizes.sm, colors.text.muted)} />
                      <span className="capitalize font-medium">{type}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span>{stats.processed} processed</span>
                      <span className="text-green-600">{stats.indexed} indexed</span>
                      {stats.skipped > 0 && <span className="text-yellow-600">{stats.skipped} skipped</span>}
                      {stats.errors > 0 && <span className="text-red-600">{stats.errors} errors</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className={cn('mt-4 text-sm', colors.text.muted)}>
              Duration: {s.result.duration}ms | {s.result.timestamp}
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
            {s.logs.length > 0 ? (
              s.logs.map((log, i) => (
                <div key={i} className="py-0.5">{log}</div>
              ))
            ) : (
              <span className={colors.text.muted}>No logs yet...</span>
            )}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
