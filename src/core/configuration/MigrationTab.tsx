/**
 * ============================================================================
 * MigrationTab
 * ============================================================================
 *
 * Hardcoded values migration tab for the admin interface.
 * Provides migration control, progress tracking, and informational display.
 *
 * Extracted from admin-interface.tsx for SRP compliance (ADR N.7.1).
 * ============================================================================
 */

'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  Building,
  Settings,
  Database,
  RefreshCw,
  Upload,
  Eye,
  Globe
} from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';
import { MigrationProgress } from './hardcoded-values-migration';

// ============================================================================
// Types
// ============================================================================

export interface MigrationTabProps {
  readonly isLoading: boolean;
  readonly migrationProgress: MigrationProgress | null;
  readonly onExecuteMigration: (dryRun: boolean) => void;
}

// ============================================================================
// Component
// ============================================================================

export const MigrationTab: React.FC<MigrationTabProps> = ({
  isLoading,
  migrationProgress,
  onExecuteMigration
}) => {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const [isDryRun, setIsDryRun] = useState(true);

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-bold tracking-tight">Hardcoded Values Migration</h2>
        <p className={colors.text.muted}>
          Migrate hardcoded values from code to database configuration
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className={iconSizes.md} />
            Migration Control
          </CardTitle>
          <CardDescription>
            Execute migration to move hardcoded values to database
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <h4 className="font-medium">Migration Mode</h4>
              <div className="flex items-center gap-4">
                <Button
                  variant={isDryRun ? "default" : "outline"}
                  onClick={() => setIsDryRun(true)}
                  className="flex items-center gap-2"
                >
                  <Eye className={iconSizes.sm} />
                  Dry Run (Preview)
                </Button>
                <Button
                  variant={!isDryRun ? "default" : "outline"}
                  onClick={() => setIsDryRun(false)}
                  className="flex items-center gap-2"
                >
                  <Database className={iconSizes.sm} />
                  Execute Migration
                </Button>
              </div>
            </div>
          </div>

          <Separator />

          {migrationProgress && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Migration Progress</h4>
                <Badge variant="outline">{migrationProgress.phase}</Badge>
              </div>
              <Progress value={migrationProgress.percentage} className="w-full" />
              <div className="grid gap-2 text-sm">
                <div>Current: {migrationProgress.currentItem}</div>
                <div>Progress: {migrationProgress.itemsProcessed} / {migrationProgress.totalItems}</div>
                {migrationProgress.errors.length > 0 && (
                  <div className={COLOR_BRIDGE.text.error}>
                    Errors: {migrationProgress.errors.length}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={() => onExecuteMigration(isDryRun)}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              {isLoading ? (
                <RefreshCw className={`${iconSizes.sm} animate-spin`} />
              ) : isDryRun ? (
                <Eye className={iconSizes.sm} />
              ) : (
                <Upload className={iconSizes.sm} />
              )}
              {isDryRun ? 'Preview Migration' : 'Execute Migration'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Migration Information */}
      <Card>
        <CardHeader>
          <CardTitle>What will be migrated?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Building className={`${iconSizes.sm} ${COLOR_BRIDGE.text.info}`} />
              <span>Company information (email, phone, address)</span>
            </div>
            <div className="flex items-center gap-2">
              <Globe className={`${iconSizes.sm} ${COLOR_BRIDGE.text.success}`} />
              <span>System URLs and API endpoints</span>
            </div>
            <div className="flex items-center gap-2">
              <Database className={`${iconSizes.sm} ${COLOR_BRIDGE.text.warning}`} />
              <span>Project templates and defaults</span>
            </div>
            <div className="flex items-center gap-2">
              <Settings className={`${iconSizes.sm} ${COLOR_BRIDGE.text.secondary}`} />
              <span>Integration settings and webhooks</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
