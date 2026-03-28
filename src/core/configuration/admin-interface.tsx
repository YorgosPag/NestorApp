/**
 * ============================================================================
 * Enterprise Configuration Admin Interface
 * ============================================================================
 *
 * MICROSOFT/GOOGLE-CLASS ADMIN INTERFACE for dynamic configuration.
 *
 * Tab components extracted for SRP compliance (ADR N.7.1):
 * - CompanyConfigurationTab.tsx
 * - SystemConfigurationTab.tsx
 * - MigrationTab.tsx
 *
 * ============================================================================
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Building,
  Settings,
  Database,
  CheckCircle,
  XCircle,
  RefreshCw,
  Upload,
  Eye,
  EyeOff
} from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';

import {
  CompanyConfiguration,
  SystemConfiguration,
  ProjectTemplateConfiguration,
  getConfigManager
} from './enterprise-config-management';
import {
  HardcodedValuesMigrationEngine,
  MigrationProgress
} from './hardcoded-values-migration';
import '@/lib/design-system';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';

// Re-exported extracted tab components for backward compatibility
export { CompanyConfigurationTab } from './CompanyConfigurationTab';
export { SystemConfigurationTab } from './SystemConfigurationTab';
export { MigrationTab } from './MigrationTab';

import { CompanyConfigurationTab } from './CompanyConfigurationTab';
import { SystemConfigurationTab } from './SystemConfigurationTab';
import { MigrationTab } from './MigrationTab';

// ============================================================================
// Types
// ============================================================================

interface AdminState {
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly success: string | null;
  readonly isDirty: boolean;
  readonly isValidating: boolean;
}

interface ValidationError {
  readonly field: string;
  readonly message: string;
  readonly severity: 'error' | 'warning' | 'info';
}

interface ConfigurationTabState {
  readonly activeTab: 'company' | 'system' | 'templates' | 'migration' | 'audit';
  readonly company: CompanyConfiguration | null;
  readonly system: SystemConfiguration | null;
  readonly templates: readonly ProjectTemplateConfiguration[];
  readonly validationErrors: readonly ValidationError[];
}

// ============================================================================
// Main Admin Interface Component
// ============================================================================

/**
 * Enterprise Configuration Admin Interface
 * Production-ready admin dashboard for all configuration management
 */
export const ConfigurationAdminInterface: React.FC = () => {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const [adminState, setAdminState] = useState<AdminState>({
    isLoading: false,
    error: null,
    success: null,
    isDirty: false,
    isValidating: false
  });

  const [configState, setConfigState] = useState<ConfigurationTabState>({
    activeTab: 'company',
    company: null,
    system: null,
    templates: [],
    validationErrors: []
  });

  const [migrationProgress, setMigrationProgress] = useState<MigrationProgress | null>(null);
  const [showSensitiveData, setShowSensitiveData] = useState(false);

  // --------------------------------------------------------------------------
  // Configuration Loading
  // --------------------------------------------------------------------------

  const loadConfigurations = useCallback(async () => {
    setAdminState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const configManager = getConfigManager();
      const [company, system, templates] = await Promise.all([
        configManager.getCompanyConfig(),
        configManager.getSystemConfig(),
        configManager.getProjectTemplates()
      ]);

      setConfigState(prev => ({
        ...prev,
        company,
        system,
        templates,
        validationErrors: []
      }));

      setAdminState(prev => ({
        ...prev,
        isLoading: false,
        success: 'Configurations loaded successfully'
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load configurations';
      setAdminState(prev => ({ ...prev, isLoading: false, error: errorMessage }));
    }
  }, []);

  useEffect(() => {
    void loadConfigurations();
  }, [loadConfigurations]);

  // --------------------------------------------------------------------------
  // Configuration Updates
  // --------------------------------------------------------------------------

  const updateCompanyConfiguration = useCallback(async (updates: Partial<CompanyConfiguration>) => {
    if (!configState.company) return;
    setAdminState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const configManager = getConfigManager();
      await configManager.updateCompanyConfig(updates);
      await loadConfigurations();
      setAdminState(prev => ({
        ...prev,
        isLoading: false,
        success: 'Company configuration updated successfully',
        isDirty: false
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update company configuration';
      setAdminState(prev => ({ ...prev, isLoading: false, error: errorMessage }));
    }
  }, [configState.company, loadConfigurations]);

  // --------------------------------------------------------------------------
  // Migration
  // --------------------------------------------------------------------------

  const executeMigration = useCallback(async (dryRun: boolean = false) => {
    setAdminState(prev => ({ ...prev, isLoading: true, error: null }));
    setMigrationProgress(null);

    try {
      const engine = new HardcodedValuesMigrationEngine();
      engine.onProgress((progress: MigrationProgress) => {
        setMigrationProgress(progress);
      });

      const result = await engine.executeMigration({
        createBackup: true,
        validateBeforeMigration: true,
        dryRun
      });

      if (result.success) {
        setAdminState(prev => ({
          ...prev,
          isLoading: false,
          success: `Migration ${dryRun ? 'validation' : 'execution'} completed successfully. ${result.itemsMigrated} items migrated.`
        }));
        if (!dryRun) {
          await loadConfigurations();
        }
      } else {
        setAdminState(prev => ({
          ...prev,
          isLoading: false,
          error: `Migration failed: ${result.errors.join(', ')}`
        }));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Migration execution failed';
      setAdminState(prev => ({ ...prev, isLoading: false, error: errorMessage }));
    }
  }, [loadConfigurations]);

  // --------------------------------------------------------------------------
  // UI Helpers
  // --------------------------------------------------------------------------

  const toggleSensitiveData = useCallback(() => {
    setShowSensitiveData(prev => !prev);
  }, []);

  const handleDirtyChange = useCallback((isDirty: boolean) => {
    setAdminState(prev => ({ ...prev, isDirty }));
  }, []);

  const handleCompanySave = useCallback((updates: Partial<CompanyConfiguration>) => {
    void updateCompanyConfiguration(updates);
  }, [updateCompanyConfiguration]);

  const handleExecuteMigration = useCallback((dryRun: boolean) => {
    void executeMigration(dryRun);
  }, [executeMigration]);

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Configuration Admin</h1>
          <p className={colors.text.muted}>
            Manage dynamic configurations and eliminate hardcoded values
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={toggleSensitiveData}
            className="flex items-center gap-2"
          >
            {showSensitiveData ? <EyeOff className="${iconSizes.sm}" /> : <Eye className="${iconSizes.sm}" />}
            {showSensitiveData ? 'Hide' : 'Show'} Sensitive Data
          </Button>
          <Button
            onClick={loadConfigurations}
            disabled={adminState.isLoading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`${iconSizes.sm} ${adminState.isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </header>

      {/* Status Messages */}
      {adminState.error && (
        <Alert variant="destructive">
          <XCircle className="${iconSizes.sm}" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{adminState.error}</AlertDescription>
        </Alert>
      )}

      {adminState.success && (
        <Alert>
          <CheckCircle className="${iconSizes.sm}" />
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>{adminState.success}</AlertDescription>
        </Alert>
      )}

      {/* Main Content */}
      <Tabs
        value={configState.activeTab}
        onValueChange={(value) =>
          setConfigState(prev => ({ ...prev, activeTab: value as ConfigurationTabState['activeTab'] }))
        }
        className="space-y-6"
      >
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="company" className="flex items-center gap-2">
            <Building className="${iconSizes.sm}" />
            Company
          </TabsTrigger>
          <TabsTrigger value="system" className="flex items-center gap-2">
            <Settings className="${iconSizes.sm}" />
            System
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <Database className="${iconSizes.sm}" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="migration" className="flex items-center gap-2">
            <Upload className="${iconSizes.sm}" />
            Migration
          </TabsTrigger>
        </TabsList>

        <TabsContent value="company">
          <CompanyConfigurationTab
            company={configState.company}
            isDirty={adminState.isDirty}
            isLoading={adminState.isLoading}
            showSensitiveData={showSensitiveData}
            onSave={handleCompanySave}
            onDirtyChange={handleDirtyChange}
          />
        </TabsContent>

        <TabsContent value="system">
          <SystemConfigurationTab
            system={configState.system}
            showSensitiveData={showSensitiveData}
          />
        </TabsContent>

        <TabsContent value="templates">
          <Card>
            <CardHeader>
              <CardTitle>Project Templates</CardTitle>
              <CardDescription>Manage project templates and defaults</CardDescription>
            </CardHeader>
            <CardContent>
              <div className={cn("text-center py-8", colors.text.muted)}>
                Project templates management coming soon...
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="migration">
          <MigrationTab
            isLoading={adminState.isLoading}
            migrationProgress={migrationProgress}
            onExecuteMigration={handleExecuteMigration}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ConfigurationAdminInterface;
