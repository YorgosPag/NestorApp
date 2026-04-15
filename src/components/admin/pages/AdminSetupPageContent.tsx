'use client';

/**
 * =============================================================================
 * 🔧 ADMIN SETUP PAGE - First-Time Configuration
 * =============================================================================
 *
 * Allows the currently logged-in user to configure themselves as the primary
 * admin for error notifications and system alerts.
 *
 * @route /admin/setup
 * @enterprise One-time admin configuration
 * @created 2026-01-24
 * @performance ADR-294 Batch 5 — lazy-loaded via LazyRoutes
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Shield, Bell, Mail } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { createModuleLogger } from '@/lib/telemetry';
import { API_ROUTES } from '@/config/domain-constants';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { createStaleCache } from '@/lib/stale-cache';
const logger = createModuleLogger('AdminSetupPage');

// ADR-300: Module-level cache — admin setup config, survives re-navigation
const adminConfigCache = createStaleCache<AdminConfig | null>('admin-setup-config');

// =============================================================================
// TYPES
// =============================================================================

interface AdminConfig {
  primaryAdminUid: string;
  adminEmail: string;
  additionalAdminUids: string[];
  enableErrorReporting: boolean;
}

interface SetupResponse {
  success: boolean;
  message: string;
  config?: AdminConfig;
  error?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function AdminSetupPageContent() {
  const { t } = useTranslation('admin');
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const colors = useSemanticColors();
  const router = useRouter();

  // ADR-300: Seed from module-level cache → zero flash on re-navigation
  const [currentConfig, setCurrentConfig] = useState<AdminConfig | null>(adminConfigCache.get() ?? null);
  const [checkingConfig, setCheckingConfig] = useState(!adminConfigCache.hasLoaded());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // ==========================================================================
  // CHECK CURRENT CONFIG — Deferred to avoid blocking main thread
  // ==========================================================================

  const checkCurrentConfig = useCallback(async () => {
    // Lazy import Firebase auth to avoid blocking module load
    const { auth } = await import('@/lib/firebase');
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return;

    // ADR-300: Only show spinner on first load — not on re-navigation
    if (!adminConfigCache.hasLoaded()) setCheckingConfig(true);
    setError(null);

    try {
      const token = await firebaseUser.getIdToken();
      const response = await fetch(API_ROUTES.ADMIN.SETUP_CONFIG, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data: SetupResponse = await response.json();

      if (data.success && data.config) {
        // ADR-300: Write to module-level cache so next remount skips spinner
        adminConfigCache.set(data.config);
        setCurrentConfig(data.config);
      } else if (data.error === 'NOT_CONFIGURED' || data.error === 'ADMIN_SECTION_MISSING') {
        adminConfigCache.set(null);
        setCurrentConfig(null);
      }
    } catch (err) {
      logger.error('Failed to check config', { error: err });
      setError(t('setup.errors.checkFailed'));
    } finally {
      setCheckingConfig(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && user) {
      // Defer config check — yield main thread for user interactions first
      const timerId = setTimeout(checkCurrentConfig, 50);
      return () => clearTimeout(timerId);
    }
  }, [isAuthenticated, user, checkCurrentConfig]);

  // ==========================================================================
  // SETUP ADMIN — Proper async handler (no IIFE)
  // ==========================================================================

  const setupAdmin = async () => {
    const { auth } = await import('@/lib/firebase');
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      setError(t('setup.errors.notLoggedIn'));
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const token = await firebaseUser.getIdToken();
      const response = await fetch(API_ROUTES.ADMIN.SETUP_CONFIG, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          enableErrorReporting: true
        })
      });

      const data: SetupResponse = await response.json();

      if (data.success && data.config) {
        setCurrentConfig(data.config);
        setSuccess(true);
      } else {
        setError(data.error || data.message || t('setup.errors.saveFailed'));
      }
    } catch (err) {
      logger.error('Failed to setup admin', { error: err });
      setError(t('setup.errors.connectionFailed'));
    } finally {
      setSaving(false);
    }
  };

  // ==========================================================================
  // LOADING STATES
  // ==========================================================================

  if (authLoading) {
    return (
      <main className="container mx-auto py-10">
        <div className="flex items-center justify-center min-h-[400px]">
          <Spinner size="large" />
        </div>
      </main>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <main className="container mx-auto py-10">
        <Card className="max-w-lg mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              {t('setup.loginRequired')}
            </CardTitle>
            <CardDescription>
              {t('setup.loginRequiredDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/login')}>
              {t('setup.loginButton')}
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  // ==========================================================================
  // MAIN RENDER
  // ==========================================================================

  return (
    <main className="container mx-auto py-10">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <header>
          <h1 className="text-3xl font-bold">{t('setup.title')}</h1>
          <p className={cn("mt-2", colors.text.muted)}>
            {t('setup.subtitle')}
          </p>
        </header>

        {/* Current User Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('setup.currentUser')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Mail className={cn("h-4 w-4", colors.text.muted)} />
              <span className="font-medium">Email:</span>
              <code className="bg-muted px-2 py-1 rounded text-sm">
                {user.email}
              </code>
            </div>
            <div className="flex items-center gap-2">
              <Shield className={cn("h-4 w-4", colors.text.muted)} />
              <span className="font-medium">UID:</span>
              <code className="bg-muted px-2 py-1 rounded text-sm font-mono text-xs">
                {user.uid}
              </code>
            </div>
          </CardContent>
        </Card>

        {/* Current Config Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Bell className="h-5 w-5" />
              {t('setup.configStatus')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {checkingConfig ? (
              <div className={cn("flex items-center gap-2", colors.text.muted)}>
                <Spinner size="small" />
                {t('setup.checkingConfig')}
              </div>
            ) : currentConfig ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <span className="font-medium text-green-700">{t('setup.configActive')}</span>
                </div>
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className={colors.text.muted}>{t('setup.primaryAdmin')}</span>
                    <code className="font-mono text-xs">{currentConfig.primaryAdminUid}</code>
                  </div>
                  <div className="flex justify-between">
                    <span className={colors.text.muted}>Email:</span>
                    <span>{currentConfig.adminEmail}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className={colors.text.muted}>{t('setup.errorReporting')}</span>
                    <Badge variant={currentConfig.enableErrorReporting ? 'default' : 'secondary'}>
                      {currentConfig.enableErrorReporting ? t('setup.enabled') : t('setup.disabled')}
                    </Badge>
                  </div>
                  {currentConfig.additionalAdminUids.length > 0 && (
                    <div className="flex justify-between">
                      <span className={colors.text.muted}>{t('setup.additionalAdmins')}</span>
                      <span>{currentConfig.additionalAdminUids.length}</span>
                    </div>
                  )}
                </div>

                {currentConfig.primaryAdminUid === user.uid ? (
                  <div className="mt-4 space-y-3">
                    <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                      <p className="text-sm text-green-800">
                        <CheckCircle2 className="h-4 w-4 inline mr-1" />
                        {t('setup.youArePrimaryAdmin')}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={setupAdmin}
                      disabled={saving}
                    >
                      {saving ? (
                        <>
                          <Spinner size="small" color="inherit" className="mr-2" />
                          {t('setup.updating')}
                        </>
                      ) : (
                        t('setup.updateSettings')
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                    <p className="text-sm text-yellow-800">
                      {t('setup.differentAdmin')}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={setupAdmin}
                      disabled={saving}
                    >
                      {saving ? (
                        <>
                          <Spinner size="small" color="inherit" className="mr-2" />
                          {t('setup.saving')}
                        </>
                      ) : (
                        t('setup.setAsPrimary')
                      )}
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-yellow-500" />
                  <span className="font-medium text-yellow-700">{t('setup.notConfigured')}</span>
                </div>
                <p className={cn("text-sm", colors.text.muted)}>
                  {t('setup.notConfiguredDescription')}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Setup Button */}
        {!currentConfig && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('setup.initialSetup')}</CardTitle>
              <CardDescription>
                {t('setup.initialSetupDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={setupAdmin}
                disabled={saving}
                className="w-full"
                size="lg"
              >
                {saving ? (
                  <>
                    <Spinner size="small" color="inherit" className="mr-2" />
                    {t('setup.savingSettings')}
                  </>
                ) : (
                  <>
                    <Shield className="h-4 w-4 mr-2" />
                    {t('setup.setAsPrimaryAdmin')}
                  </>
                )}
              </Button>

              <p className={cn("text-xs text-center", colors.text.muted)}>
                {t('setup.uidSaveNote', { uid: user.uid.substring(0, 8) + '...' })}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800 flex items-center gap-2">
              <XCircle className="h-4 w-4" />
              {error}
            </p>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-800 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              {t('setup.successMessage')}
            </p>
          </div>
        )}

        {/* Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('setup.howItWorks')}</CardTitle>
          </CardHeader>
          <CardContent className={cn("space-y-2 text-sm", colors.text.muted)}>
            <p>{t('setup.step1')}</p>
            <p>{t('setup.step2')}</p>
            <p>{t('setup.step3')}</p>
            <p>{t('setup.step4')}</p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export default AdminSetupPageContent;
