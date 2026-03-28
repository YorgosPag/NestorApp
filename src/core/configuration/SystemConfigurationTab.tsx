/**
 * ============================================================================
 * SystemConfigurationTab
 * ============================================================================
 *
 * System configuration display for the admin interface.
 * Shows application settings, security settings, and integration webhooks.
 *
 * Extracted from admin-interface.tsx for SRP compliance (ADR N.7.1).
 * ============================================================================
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardTitle, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Settings,
  Database,
  Shield,
  Activity,
  Clock
} from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { SystemConfiguration } from './enterprise-config-management';

// ============================================================================
// Types
// ============================================================================

export interface SystemConfigurationTabProps {
  readonly system: SystemConfiguration | null;
  readonly showSensitiveData: boolean;
}

// ============================================================================
// Component
// ============================================================================

export const SystemConfigurationTab: React.FC<SystemConfigurationTabProps> = ({
  system,
  showSensitiveData
}) => {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const [editedSystem, setEditedSystem] = useState<SystemConfiguration | null>(system);

  useEffect(() => {
    setEditedSystem(system);
  }, [system]);

  if (!editedSystem) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <Settings className={`mx-auto ${iconSizes.xl3} ${colors.text.muted} mb-4`} />
          <p className="text-lg font-medium">System configuration not available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-bold tracking-tight">System Configuration</h2>
        <p className={colors.text.muted}>
          Application settings, security, and integrations
        </p>
      </header>

      <div className="grid gap-6">
        {/* Application Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className={iconSizes.md} />
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
              <Shield className={iconSizes.md} />
              Security Settings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Session Timeout</Label>
                <div className="flex items-center gap-2">
                  <Clock className={`${iconSizes.sm} ${colors.text.muted}`} />
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
              <Database className={iconSizes.md} />
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
