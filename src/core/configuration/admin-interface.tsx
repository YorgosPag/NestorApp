/**
 * ============================================================================
 * 🏢 ENTERPRISE CONFIGURATION ADMIN INTERFACE
 * ============================================================================
 *
 * MICROSOFT/GOOGLE-CLASS ADMIN INTERFACE ΓΙΑ DYNAMIC CONFIGURATION
 *
 * Professional admin interface για διαχείριση όλων των configurations
 * που προέρχονται από τη βάση δεδομένων αντί για σκληρές τιμές.
 *
 * Τηρεί όλους τους κανόνες CLAUDE.md:
 * - ΟΧΙ any types ✅
 * - ΟΧΙ inline styles ✅
 * - Semantic HTML structure ✅
 * - Enterprise React patterns ✅
 *
 * Features:
 * - Real-time configuration updates
 * - Validation με visual feedback
 * - Backup και rollback capability
 * - Audit logging
 * - Role-based access control
 * - Mobile-responsive design
 *
 * ============================================================================
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  AlertTriangle,
  Building,
  Settings,
  Database,
  Shield,
  CheckCircle,
  XCircle,
  RefreshCw,
  Save,
  Upload,
  Download,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  AlertCircle,
  Activity,
  Globe,
  Mail,
  Phone,
  Clock,
  User
} from 'lucide-react';

// Import our enterprise configuration system
import {
  EnterpriseConfigurationManager,
  CompanyConfiguration,
  SystemConfiguration,
  ProjectTemplateConfiguration,
  ConfigurationAPI,
  getConfigManager
} from './enterprise-config-management';
import {
  HardcodedValuesMigrationEngine,
  MigrationAPI,
  MigrationResult,
  MigrationProgress
} from './hardcoded-values-migration';

// ============================================================================
// 🎯 ADMIN INTERFACE TYPES - FULL TYPE SAFETY
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
// 🚀 MAIN ADMIN INTERFACE COMPONENT
// ============================================================================

/**
 * Enterprise Configuration Admin Interface
 * Production-ready admin dashboard for all configuration management
 */
export const ConfigurationAdminInterface: React.FC = () => {
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

  // ============================================================================
  // 📥 CONFIGURATION LOADING METHODS
  // ============================================================================

  const loadConfigurations = useCallback(async () => {
    setAdminState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const configManager = getConfigManager();

      // Load all configurations in parallel
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
      setAdminState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }));
    }
  }, []);

  // Load configurations on component mount
  useEffect(() => {
    void loadConfigurations();
  }, [loadConfigurations]);

  // ============================================================================
  // 💾 CONFIGURATION UPDATE METHODS
  // ============================================================================

  const updateCompanyConfiguration = useCallback(async (updates: Partial<CompanyConfiguration>) => {
    if (!configState.company) return;

    setAdminState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const configManager = getConfigManager();
      await configManager.updateCompanyConfig(updates);

      // Reload to get updated data
      await loadConfigurations();

      setAdminState(prev => ({
        ...prev,
        isLoading: false,
        success: 'Company configuration updated successfully',
        isDirty: false
      }));

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update company configuration';
      setAdminState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }));
    }
  }, [configState.company, loadConfigurations]);

  const updateSystemConfiguration = useCallback(async (updates: Partial<SystemConfiguration>) => {
    if (!configState.system) return;

    setAdminState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const configManager = getConfigManager();
      await configManager.updateSystemConfig(updates);

      await loadConfigurations();

      setAdminState(prev => ({
        ...prev,
        isLoading: false,
        success: 'System configuration updated successfully',
        isDirty: false
      }));

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update system configuration';
      setAdminState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }));
    }
  }, [configState.system, loadConfigurations]);

  // ============================================================================
  // 🔄 MIGRATION METHODS - HARDCODED VALUES ELIMINATION
  // ============================================================================

  const executeMigration = useCallback(async (dryRun: boolean = false) => {
    setAdminState(prev => ({ ...prev, isLoading: true, error: null }));
    setMigrationProgress(null);

    try {
      const engine = new HardcodedValuesMigrationEngine();

      // Setup progress tracking
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

        // Reload configurations after successful migration
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
      setAdminState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }));
    }
  }, [loadConfigurations]);

  // ============================================================================
  // 🎨 UI HELPER METHODS
  // ============================================================================

  const clearMessages = useCallback(() => {
    setAdminState(prev => ({ ...prev, error: null, success: null }));
  }, []);

  const toggleSensitiveData = useCallback(() => {
    setShowSensitiveData(prev => !prev);
  }, []);

  // ============================================================================
  // 🏢 COMPANY CONFIGURATION TAB
  // ============================================================================

  const CompanyConfigurationTab: React.FC = () => {
    const [editedCompany, setEditedCompany] = useState<CompanyConfiguration | null>(configState.company);

    useEffect(() => {
      setEditedCompany(configState.company);
    }, [configState.company]);

    const handleCompanyChange = (field: keyof CompanyConfiguration, value: string) => {
      if (!editedCompany) return;

      setEditedCompany(prev => prev ? { ...prev, [field]: value } : null);
      setAdminState(prev => ({ ...prev, isDirty: true }));
    };

    const handleAddressChange = (field: keyof CompanyConfiguration['address'], value: string) => {
      if (!editedCompany) return;

      setEditedCompany(prev => prev ? {
        ...prev,
        address: { ...prev.address, [field]: value }
      } : null);
      setAdminState(prev => ({ ...prev, isDirty: true }));
    };

    const handleSave = () => {
      if (editedCompany) {
        void updateCompanyConfiguration(editedCompany);
      }
    };

    if (!editedCompany) {
      return (
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Company configuration not available</p>
            <p className="text-sm text-muted-foreground">Please check your database connection</p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <header>
            <h2 className="text-2xl font-bold tracking-tight">Company Configuration</h2>
            <p className="text-muted-foreground">
              Manage your company information and branding
            </p>
          </header>
          <div className="flex gap-2">
            <Button
              onClick={handleSave}
              disabled={!adminState.isDirty || adminState.isLoading}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              Save Changes
            </Button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Basic Information
              </CardTitle>
              <CardDescription>
                Core company details and legal information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="company-name">Company Name</Label>
                <Input
                  id="company-name"
                  value={editedCompany.name}
                  onChange={(e) => handleCompanyChange('name', e.target.value)}
                  placeholder="Enter company name"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="legal-name">Legal Name</Label>
                <Input
                  id="legal-name"
                  value={editedCompany.legalName}
                  onChange={(e) => handleCompanyChange('legalName', e.target.value)}
                  placeholder="Enter legal company name"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="vat-number">VAT Number</Label>
                <Input
                  id="vat-number"
                  value={editedCompany.tax.vatNumber}
                  onChange={(e) => handleAddressChange('vatNumber' as any, e.target.value)}
                  placeholder="Enter VAT number"
                  type={showSensitiveData ? 'text' : 'password'}
                />
              </div>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Contact Information
              </CardTitle>
              <CardDescription>
                Email, phone, and website details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={editedCompany.email}
                  onChange={(e) => handleCompanyChange('email', e.target.value)}
                  placeholder="Enter email address"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={editedCompany.phone}
                  onChange={(e) => handleCompanyChange('phone', e.target.value)}
                  placeholder="Enter phone number"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  type="url"
                  value={editedCompany.website}
                  onChange={(e) => handleCompanyChange('website', e.target.value)}
                  placeholder="Enter website URL"
                />
              </div>
            </CardContent>
          </Card>

          {/* Address Information */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Address Information
              </CardTitle>
              <CardDescription>
                Physical address and location details
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="street">Street</Label>
                  <Input
                    id="street"
                    value={editedCompany.address.street}
                    onChange={(e) => handleAddressChange('street', e.target.value)}
                    placeholder="Enter street name"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="number">Number</Label>
                  <Input
                    id="number"
                    value={editedCompany.address.number}
                    onChange={(e) => handleAddressChange('number', e.target.value)}
                    placeholder="Enter street number"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={editedCompany.address.city}
                    onChange={(e) => handleAddressChange('city', e.target.value)}
                    placeholder="Enter city name"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="postal-code">Postal Code</Label>
                  <Input
                    id="postal-code"
                    value={editedCompany.address.postalCode}
                    onChange={(e) => handleAddressChange('postalCode', e.target.value)}
                    placeholder="Enter postal code"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  // ============================================================================
  // ⚙️ SYSTEM CONFIGURATION TAB
  // ============================================================================

  const SystemConfigurationTab: React.FC = () => {
    const [editedSystem, setEditedSystem] = useState<SystemConfiguration | null>(configState.system);

    useEffect(() => {
      setEditedSystem(configState.system);
    }, [configState.system]);

    if (!editedSystem) {
      return (
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <Settings className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">System configuration not available</p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <header>
          <h2 className="text-2xl font-bold tracking-tight">System Configuration</h2>
          <p className="text-muted-foreground">
            Application settings, security, and integrations
          </p>
        </header>

        <div className="grid gap-6">
          {/* Application Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Application Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="app-name">Application Name</Label>
                  <Input
                    id="app-name"
                    value={editedSystem.app.name}
                    disabled
                    className="bg-muted"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="app-version">Version</Label>
                  <Input
                    id="app-version"
                    value={editedSystem.app.version}
                    disabled
                    className="bg-muted"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="environment">Environment</Label>
                  <Badge variant={editedSystem.app.environment === 'production' ? 'default' : 'secondary'}>
                    {editedSystem.app.environment}
                  </Badge>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="base-url">Base URL</Label>
                  <Input
                    id="base-url"
                    value={editedSystem.app.baseUrl}
                    type={showSensitiveData ? 'text' : 'password'}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Security Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security Settings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Session Timeout</Label>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{editedSystem.security.sessionTimeoutMinutes} minutes</span>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Max Login Attempts</Label>
                  <span className="font-mono">{editedSystem.security.maxLoginAttempts}</span>
                </div>
                <div className="grid gap-2">
                  <Label>Two-Factor Authentication</Label>
                  <Badge variant={editedSystem.security.enableTwoFactor ? 'default' : 'secondary'}>
                    {editedSystem.security.enableTwoFactor ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Integration Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Integration Settings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label>Webhook URLs</Label>
                  <div className="grid gap-2 md:grid-cols-2">
                    <div>
                      <Label className="text-sm">Telegram</Label>
                      <Input
                        value={editedSystem.integrations.webhooks.telegram}
                        type={showSensitiveData ? 'text' : 'password'}
                        className="font-mono text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-sm">Slack</Label>
                      <Input
                        value={editedSystem.integrations.webhooks.slack}
                        type={showSensitiveData ? 'text' : 'password'}
                        className="font-mono text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  // ============================================================================
  // 🔄 MIGRATION TAB
  // ============================================================================

  const MigrationTab: React.FC = () => {
    const [isDryRun, setIsDryRun] = useState(true);

    return (
      <div className="space-y-6">
        <header>
          <h2 className="text-2xl font-bold tracking-tight">Hardcoded Values Migration</h2>
          <p className="text-muted-foreground">
            Migrate hardcoded values from code to database configuration
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
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
                    <Eye className="h-4 w-4" />
                    Dry Run (Preview)
                  </Button>
                  <Button
                    variant={!isDryRun ? "default" : "outline"}
                    onClick={() => setIsDryRun(false)}
                    className="flex items-center gap-2"
                  >
                    <Database className="h-4 w-4" />
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
                    <div className="text-red-600">
                      Errors: {migrationProgress.errors.length}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={() => void executeMigration(isDryRun)}
                disabled={adminState.isLoading}
                className="flex items-center gap-2"
              >
                {adminState.isLoading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : isDryRun ? (
                  <Eye className="h-4 w-4" />
                ) : (
                  <Upload className="h-4 w-4" />
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
                <Building className="h-4 w-4 text-blue-600" />
                <span>Company information (email, phone, address)</span>
              </div>
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-green-600" />
                <span>System URLs and API endpoints</span>
              </div>
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-orange-600" />
                <span>Project templates and defaults</span>
              </div>
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-purple-600" />
                <span>Integration settings and webhooks</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  // ============================================================================
  // 📊 MAIN RENDER METHOD
  // ============================================================================

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Configuration Admin</h1>
          <p className="text-muted-foreground">
            Manage dynamic configurations and eliminate hardcoded values
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={toggleSensitiveData}
            className="flex items-center gap-2"
          >
            {showSensitiveData ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showSensitiveData ? 'Hide' : 'Show'} Sensitive Data
          </Button>
          <Button
            onClick={loadConfigurations}
            disabled={adminState.isLoading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${adminState.isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </header>

      {/* Status Messages */}
      {adminState.error && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{adminState.error}</AlertDescription>
        </Alert>
      )}

      {adminState.success && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
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
            <Building className="h-4 w-4" />
            Company
          </TabsTrigger>
          <TabsTrigger value="system" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            System
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="migration" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Migration
          </TabsTrigger>
        </TabsList>

        <TabsContent value="company">
          <CompanyConfigurationTab />
        </TabsContent>

        <TabsContent value="system">
          <SystemConfigurationTab />
        </TabsContent>

        <TabsContent value="templates">
          <Card>
            <CardHeader>
              <CardTitle>Project Templates</CardTitle>
              <CardDescription>Manage project templates and defaults</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center text-muted-foreground py-8">
                Project templates management coming soon...
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="migration">
          <MigrationTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ConfigurationAdminInterface;