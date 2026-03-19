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
const logger = createModuleLogger('AdminSetupPage');

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

export default function AdminSetupPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();

  const [currentConfig, setCurrentConfig] = useState<AdminConfig | null>(null);
  const [checkingConfig, setCheckingConfig] = useState(true);
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

    setCheckingConfig(true);
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
        setCurrentConfig(data.config);
      } else if (data.error === 'NOT_CONFIGURED' || data.error === 'ADMIN_SECTION_MISSING') {
        setCurrentConfig(null);
      }
    } catch (err) {
      logger.error('Failed to check config', { error: err });
      setError('Αποτυχία ελέγχου ρυθμίσεων');
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
      setError('Δεν είσαι συνδεδεμένος');
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
        setError(data.error || data.message || 'Αποτυχία αποθήκευσης');
      }
    } catch (err) {
      logger.error('Failed to setup admin', { error: err });
      setError('Αποτυχία σύνδεσης με τον server');
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
              Απαιτείται Σύνδεση
            </CardTitle>
            <CardDescription>
              Πρέπει να συνδεθείς για να αποκτήσεις πρόσβαση στις ρυθμίσεις admin.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/login')}>
              Σύνδεση
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
          <h1 className="text-3xl font-bold">Ρύθμιση Admin</h1>
          <p className="text-muted-foreground mt-2">
            Διαμόρφωση των ρυθμίσεων διαχειριστή για ειδοποιήσεις σφαλμάτων
          </p>
        </header>

        {/* Current User Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Τρέχων Χρήστης</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Email:</span>
              <code className="bg-muted px-2 py-1 rounded text-sm">
                {user.email}
              </code>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
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
              Κατάσταση Ρυθμίσεων
            </CardTitle>
          </CardHeader>
          <CardContent>
            {checkingConfig ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Spinner size="small" />
                Έλεγχος ρυθμίσεων...
              </div>
            ) : currentConfig ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <span className="font-medium text-green-700">Ρυθμίσεις Ενεργές</span>
                </div>
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Primary Admin:</span>
                    <code className="font-mono text-xs">{currentConfig.primaryAdminUid}</code>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Email:</span>
                    <span>{currentConfig.adminEmail}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Error Reporting:</span>
                    <Badge variant={currentConfig.enableErrorReporting ? 'default' : 'secondary'}>
                      {currentConfig.enableErrorReporting ? 'Ενεργό' : 'Ανενεργό'}
                    </Badge>
                  </div>
                  {currentConfig.additionalAdminUids.length > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Επιπλέον Admins:</span>
                      <span>{currentConfig.additionalAdminUids.length}</span>
                    </div>
                  )}
                </div>

                {currentConfig.primaryAdminUid === user.uid ? (
                  <div className="mt-4 space-y-3">
                    <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                      <p className="text-sm text-green-800">
                        <CheckCircle2 className="h-4 w-4 inline mr-1" />
                        Είσαι ο κύριος διαχειριστής. Θα λαμβάνεις τα error notifications!
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
                          Ενημέρωση...
                        </>
                      ) : (
                        'Ενημέρωση Ρυθμίσεων'
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                    <p className="text-sm text-yellow-800">
                      Ο κύριος διαχειριστής είναι διαφορετικός χρήστης.
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
                          Αποθήκευση...
                        </>
                      ) : (
                        'Ορισμός ως κύριος διαχειριστής'
                      )}
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-yellow-500" />
                  <span className="font-medium text-yellow-700">Δεν έχουν ρυθμιστεί</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Οι ρυθμίσεις admin δεν έχουν διαμορφωθεί ακόμα.
                  Κάνε click στο κουμπί παρακάτω για να οριστείς ως ο κύριος διαχειριστής.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Setup Button */}
        {!currentConfig && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Αρχική Ρύθμιση</CardTitle>
              <CardDescription>
                Ορίσου ως ο κύριος διαχειριστής για να λαμβάνεις ειδοποιήσεις σφαλμάτων
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
                    Αποθήκευση ρυθμίσεων...
                  </>
                ) : (
                  <>
                    <Shield className="h-4 w-4 mr-2" />
                    Ορισμός ως Κύριος Διαχειριστής
                  </>
                )}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                Αυτή η ενέργεια θα αποθηκεύσει το UID σου ({user.uid.substring(0, 8)}...)
                ως τον κύριο διαχειριστή για error notifications.
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
              Οι ρυθμίσεις αποθηκεύτηκαν επιτυχώς! Θα λαμβάνεις τα error notifications στο bell icon.
            </p>
          </div>
        )}

        {/* Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Πώς Λειτουργεί</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>1. Όταν χρήστης βλέπει error → Πατάει &quot;Αναφορά Σφάλματος&quot;</p>
            <p>2. Το email πηγαίνει στο errors@nestor-app.com</p>
            <p>3. Το Mailgun webhook δημιουργεί in-app notification</p>
            <p>4. Βλέπεις το notification στο bell icon 🔔</p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
