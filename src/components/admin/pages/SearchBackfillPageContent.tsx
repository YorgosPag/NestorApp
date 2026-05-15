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
 * @performance ADR-294 Batch 5 — lazy-loaded via LazyRoutes
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
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { getEntityIcon } from '../search-backfill/search-backfill-types';
import { useSearchBackfillState } from '../search-backfill/useSearchBackfillState';

export function SearchBackfillPageContent() {
  const { t } = useTranslation('admin');
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const s = useSearchBackfillState();

  return (
    <main className="container mx-auto py-8 px-4 max-w-4xl">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Search className={cn(iconSizes.lg, 'text-primary')} />
          <h1 className="text-2xl font-bold">{t('searchBackfill.title')}</h1>
        </div>
        <p className={colors.text.muted}>
          {t('searchBackfill.subtitle')}
        </p>
      </header>

      {/* Error Alert */}
      {s.error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className={iconSizes.sm} />
          <AlertTitle>{t('searchBackfill.error')}</AlertTitle>
          <AlertDescription>{s.error}</AlertDescription>
        </Alert>
      )}

      {/* Current Index Status */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className={iconSizes.md} />
              <CardTitle>{t('searchBackfill.indexStatus.title')}</CardTitle>
            </div>
            <Button variant="outline" size="sm" onClick={s.fetchStatus} disabled={s.isLoading}>
              <RefreshCw className={cn(iconSizes.sm, 'mr-2', s.isLoading && 'animate-spin')} />
              {t('searchBackfill.indexStatus.refresh')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {s.status ? (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Badge variant="secondary" className="text-lg px-3 py-1">
                  {t('searchBackfill.indexStatus.documents', { count: s.status.currentIndex.totalDocuments })}
                </Badge>
                <span className={cn('text-sm', colors.text.muted)}>
                  {t('searchBackfill.indexStatus.inCollection', { collection: s.status.currentIndex.collection })}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {Object.entries(s.status.currentIndex.byEntityType).map(([type, count]) => {
                  const Icon = getEntityIcon(type);
                  return (
                    <div key={type} className="flex flex-col items-center p-3 rounded-lg bg-muted/50">
                      <Icon className={cn(iconSizes.md, 'mb-1', colors.text.muted)} />
                      <span className="font-semibold">{count}</span>
                      <span className={cn('text-xs', colors.text.muted)}>
                        {t(`searchBackfill.entityTypes.${type}`)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : (
            <p className={colors.text.muted}>{t('searchBackfill.indexStatus.loading')}</p>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{t('searchBackfill.actions.title')}</CardTitle>
          <CardDescription>{t('searchBackfill.actions.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => s.executeBackfill(true)} disabled={s.isExecuting}>
              <Eye className={cn(iconSizes.sm, 'mr-2')} />
              {t('searchBackfill.actions.dryRun')}
            </Button>
            <Button variant="default" onClick={() => s.executeBackfill(false)} disabled={s.isExecuting}>
              <PlayCircle className={cn(iconSizes.sm, 'mr-2')} />
              {t('searchBackfill.actions.execute')}
            </Button>
          </div>
          {s.isExecuting && (
            <div className={cn('mt-4 flex items-center gap-2', colors.text.muted)}>
              <RefreshCw className={cn(iconSizes.sm, 'animate-spin')} />
              <span>{t('searchBackfill.actions.processing')}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contact Migration */}
      <Card className="mb-6 border-orange-200">
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className={cn(iconSizes.md, 'text-orange-500')} />
            <CardTitle>{t('searchBackfill.contactMigration.title')}</CardTitle>
          </div>
          <CardDescription>
            {t('searchBackfill.contactMigration.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4">
            <AlertTriangle className={iconSizes.sm} />
            <AlertTitle>{t('searchBackfill.contactMigration.alertTitle')}</AlertTitle>
            <AlertDescription>
              {t('searchBackfill.contactMigration.alertDescription')}
            </AlertDescription>
          </Alert>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => s.executeMigration(true)} disabled={s.isMigrating}>
              <Eye className={cn(iconSizes.sm, 'mr-2')} />
              {t('searchBackfill.contactMigration.preview')}
            </Button>
            <Button variant="default" className="bg-orange-500 hover:bg-orange-600" onClick={() => s.executeMigration(false)} disabled={s.isMigrating}>
              <PlayCircle className={cn(iconSizes.sm, 'mr-2')} />
              {t('searchBackfill.contactMigration.execute')}
            </Button>
          </div>
          {s.isMigrating && (
            <div className={cn('mt-4 flex items-center gap-2', colors.text.muted)}>
              <RefreshCw className={cn(iconSizes.sm, 'animate-spin')} />
              <span>{t('searchBackfill.contactMigration.processing')}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Parking FK Migration */}
      <Card className="mb-6 border-blue-200">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Car className={cn(iconSizes.md, 'text-blue-500')} />
            <CardTitle>{t('searchBackfill.parkingMigration.title')}</CardTitle>
          </div>
          <CardDescription>
            {t('searchBackfill.parkingMigration.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4 border-orange-300 bg-orange-50">
            <AlertTriangle className={cn(iconSizes.sm, 'text-orange-600')} />
            <AlertTitle className="text-orange-800">{t('searchBackfill.parkingMigration.reseedTitle')}</AlertTitle>
            <AlertDescription className="text-orange-700">
              {t('searchBackfill.parkingMigration.reseedDescription')}
            </AlertDescription>
          </Alert>

          <div className="flex flex-wrap gap-3 mb-6">
            <Button
              variant="destructive"
              onClick={s.executeParkingReseed}
              disabled={s.isParkingReseeding || s.isParkingMigrating}
            >
              <RefreshCw className={cn(iconSizes.sm, 'mr-2', s.isParkingReseeding && 'animate-spin')} />
              {s.isParkingReseeding
                ? t('searchBackfill.parkingMigration.reseeding')
                : t('searchBackfill.parkingMigration.reseedButton')}
            </Button>
          </div>

          {/* Re-seed Result */}
          {s.parkingReseedResult && (
            <div className="mb-6 p-4 rounded-lg border border-green-300 bg-green-50">
              <div className="flex items-center gap-2 text-green-800 font-medium mb-2">
                <CheckCircle className={iconSizes.sm} />
                {t('searchBackfill.parkingMigration.reseedComplete')}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-2 rounded bg-red-100">
                  <div className="text-xl font-bold text-red-600">{s.parkingReseedResult.deleted}</div>
                  <div className="text-xs text-red-700">{t('searchBackfill.stats.deleted')}</div>
                </div>
                <div className="text-center p-2 rounded bg-green-100">
                  <div className="text-xl font-bold text-green-600">{s.parkingReseedResult.created}</div>
                  <div className="text-xs text-green-700">{t('searchBackfill.stats.created')}</div>
                </div>
              </div>
            </div>
          )}

          {/* FK Validation Section */}
          <Alert className="mb-4 border-gray-300 bg-gray-50">
            <AlertTriangle className={cn(iconSizes.sm, 'text-gray-600')} />
            <AlertTitle className="text-gray-800">{t('searchBackfill.parkingMigration.fkValidationTitle')}</AlertTitle>
            <AlertDescription className="text-gray-700">
              {t('searchBackfill.parkingMigration.fkValidationDescription')}
            </AlertDescription>
          </Alert>

          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => s.executeParkingMigration(true)}
              disabled={s.isParkingMigrating || s.isParkingReseeding}
            >
              <Eye className={cn(iconSizes.sm, 'mr-2')} />
              {t('searchBackfill.parkingMigration.validateButton')}
            </Button>
          </div>

          {s.isParkingMigrating && (
            <div className={cn('mt-4 flex items-center gap-2', colors.text.muted)}>
              <RefreshCw className={cn(iconSizes.sm, 'animate-spin')} />
              <span>{t('searchBackfill.parkingMigration.processing')}</span>
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
                {s.parkingMigrationResult.mode === 'DRY_RUN' ? t('searchBackfill.results.parkingPreview') : t('searchBackfill.results.parkingResults')}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { id: 'total', value: s.parkingMigrationResult.stats.total, label: t('searchBackfill.stats.total'), color: 'blue' },
                { id: 'migrated', value: s.parkingMigrationResult.stats.migrated, label: t('searchBackfill.stats.migrated'), color: 'green' },
                { id: 'alreadyCorrect', value: s.parkingMigrationResult.stats.alreadyCorrect, label: t('searchBackfill.stats.alreadyCorrect'), color: 'gray' },
                { id: 'errors', value: s.parkingMigrationResult.stats.errors, label: t('searchBackfill.stats.errors'), color: 'red' },
              ].map(({ id, value, label, color }) => (
                <div key={id} className={`text-center p-3 rounded-lg bg-${color}-500/10`}>
                  <div className={`text-2xl font-bold text-${color}-600`}>{value}</div>
                  <div className={cn('text-sm', colors.text.muted)}>{label}</div>
                </div>
              ))}
            </div>
            <div className={cn('mt-4 text-sm', colors.text.muted)}>
              {s.parkingMigrationResult.message} | {t('searchBackfill.results.duration', { ms: s.parkingMigrationResult.executionTimeMs })}
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
                {s.migrationResult.mode === 'DRY_RUN' ? t('searchBackfill.results.contactPreview') : t('searchBackfill.results.contactResults')}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              {[
                { id: 'total', value: s.migrationResult.stats.total, label: t('searchBackfill.stats.total'), color: 'blue' },
                { id: 'migrated', value: s.migrationResult.stats.migrated, label: t('searchBackfill.stats.migrated'), color: 'green' },
                { id: 'skipped', value: s.migrationResult.stats.skipped, label: t('searchBackfill.stats.skipped'), color: 'yellow' },
                { id: 'noCreator', value: s.migrationResult.stats.noCreator, label: t('searchBackfill.stats.noCreator'), color: 'orange' },
                { id: 'errors', value: s.migrationResult.stats.errors, label: t('searchBackfill.stats.errors'), color: 'red' },
              ].map(({ id, value, label, color }) => (
                <div key={id} className={`text-center p-3 rounded-lg bg-${color}-500/10`}>
                  <div className={`text-2xl font-bold text-${color}-600`}>{value}</div>
                  <div className={cn('text-sm', colors.text.muted)}>{label}</div>
                </div>
              ))}
            </div>
            <div className={cn('mt-4 text-sm', colors.text.muted)}>
              {t('searchBackfill.results.durationTimestamp', { ms: s.migrationResult.duration, timestamp: s.migrationResult.timestamp })}
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
                {s.result.mode === 'DRY_RUN' ? t('searchBackfill.results.dryRunResults') : t('searchBackfill.results.executionResults')}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              {[
                { id: 'processed', value: s.result.totalStats.processed, label: t('searchBackfill.stats.processed'), color: 'blue' },
                { id: 'indexed', value: s.result.totalStats.indexed, label: t('searchBackfill.stats.indexed'), color: 'green' },
                { id: 'skipped', value: s.result.totalStats.skipped, label: t('searchBackfill.stats.skipped'), color: 'yellow' },
                { id: 'errors', value: s.result.totalStats.errors, label: t('searchBackfill.stats.errors'), color: 'red' },
              ].map(({ id, value, label, color }) => (
                <div key={id} className={`text-center p-3 rounded-lg bg-${color}-500/10`}>
                  <div className={`text-2xl font-bold text-${color}-600`}>{value}</div>
                  <div className={cn('text-sm', colors.text.muted)}>{label}</div>
                </div>
              ))}
            </div>

            <h4 className="font-medium mb-3">{t('searchBackfill.results.byEntityType')}</h4>
            <div className="space-y-2">
              {Object.entries(s.result.stats).map(([type, stats]) => {
                const Icon = getEntityIcon(type);
                return (
                  <div key={type} className="flex items-center justify-between p-2 rounded bg-muted/30">
                    <div className="flex items-center gap-2">
                      <Icon className={cn(iconSizes.sm, colors.text.muted)} />
                      <span className="capitalize font-medium">{t(`searchBackfill.entityTypes.${type}`, type)}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span>{t('searchBackfill.stats.nProcessed', { n: stats.processed })}</span>
                      <span className="text-green-600">{t('searchBackfill.stats.nIndexed', { n: stats.indexed })}</span>
                      {stats.skipped > 0 && <span className="text-yellow-600">{t('searchBackfill.stats.nSkipped', { n: stats.skipped })}</span>}
                      {stats.errors > 0 && <span className="text-red-600">{t('searchBackfill.stats.nErrors', { n: stats.errors })}</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className={cn('mt-4 text-sm', colors.text.muted)}>
              {t('searchBackfill.results.durationTimestamp', { ms: s.result.duration, timestamp: s.result.timestamp })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Logs */}
      <Card>
        <CardHeader>
          <CardTitle>{t('searchBackfill.logs.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-muted/50 rounded-lg p-3 h-48 overflow-y-auto font-mono text-xs">
            {s.logs.length > 0 ? (
              s.logs.map((log, i) => (
                <div key={i} className="py-0.5">{log}</div>
              ))
            ) : (
              <span className={colors.text.muted}>{t('searchBackfill.logs.empty')}</span>
            )}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

export default SearchBackfillPageContent;
