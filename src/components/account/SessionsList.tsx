'use client';

/**
 * 🔐 SESSIONS LIST COMPONENT
 *
 * Enterprise component for displaying and managing active sessions.
 * Follows Google/Microsoft patterns for session management UI.
 *
 * @module components/account/SessionsList
 * @enterprise-ready true
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Monitor,
  Smartphone,
  Tablet,
  Globe,
  LogOut,
  RefreshCw,
  Shield,
  AlertTriangle,
  Check
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTypography } from '@/hooks/useTypography';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { db } from '@/lib/firebase';
import { sessionService } from '@/services/session';
import type { SessionDisplayItem, DeviceType, BrowserType } from '@/services/session';

// ============================================================================
// COMPONENT PROPS
// ============================================================================

interface SessionsListProps {
  /** User ID to fetch sessions for */
  userId: string;
  /** Callback when sessions change */
  onSessionsChange?: () => void;
}

// ============================================================================
// ICON HELPERS
// ============================================================================

/**
 * Get device icon based on device type
 */
function getDeviceIcon(deviceType: DeviceType, className: string): React.ReactNode {
  switch (deviceType) {
    case 'mobile':
      return <Smartphone className={className} aria-hidden="true" />;
    case 'tablet':
      return <Tablet className={className} aria-hidden="true" />;
    case 'desktop':
    default:
      return <Monitor className={className} aria-hidden="true" />;
  }
}

/**
 * Get browser icon color based on browser type
 */
function getBrowserColor(browserType: BrowserType): string {
  switch (browserType) {
    case 'Chrome':
      return 'text-green-500';
    case 'Firefox':
      return 'text-orange-500';
    case 'Safari':
      return 'text-blue-500';
    case 'Edge':
      return 'text-cyan-500';
    default:
      return 'text-gray-500';
  }
}

// ============================================================================
// SESSIONS LIST COMPONENT
// ============================================================================

export function SessionsList({ userId, onSessionsChange }: SessionsListProps) {
  const { t } = useTranslation('common');
  const colors = useSemanticColors();
  const borders = useBorderTokens();
  const layout = useLayoutClasses();
  const iconSizes = useIconSizes();
  const typography = useTypography();

  // State
  const [sessions, setSessions] = useState<SessionDisplayItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);
  const [isRevokingAll, setIsRevokingAll] = useState(false);

  // Initialize session service
  useEffect(() => {
    if (db) {
      sessionService.initialize(db);
    }
  }, []);

  // Fetch sessions
  const fetchSessions = useCallback(async () => {
    if (!userId) return;

    setIsLoading(true);
    setError(null);

    try {
      const sessionsList = await sessionService.getSessionsForDisplay(userId);
      setSessions(sessionsList);
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
      setError(t('account.security.sessionsLoadError') || 'Failed to load sessions');
    } finally {
      setIsLoading(false);
    }
  }, [userId, t]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Revoke single session
  const handleRevokeSession = async (sessionId: string) => {
    setRevokingSessionId(sessionId);

    try {
      const result = await sessionService.revokeSession(userId, sessionId, 'user_requested');

      if (result.success) {
        setSessions(prev => prev.filter(s => s.id !== sessionId));
        onSessionsChange?.();
      } else {
        setError(result.error || 'Failed to revoke session');
      }
    } catch (err) {
      console.error('Failed to revoke session:', err);
      setError('Failed to revoke session');
    } finally {
      setRevokingSessionId(null);
    }
  };

  // Revoke all other sessions
  const handleRevokeAllOther = async () => {
    setIsRevokingAll(true);

    try {
      const result = await sessionService.revokeAllOtherSessions(userId);

      if (result.success) {
        setSessions(prev => prev.filter(s => s.isCurrent));
        onSessionsChange?.();
      } else {
        setError(result.error || 'Failed to revoke sessions');
      }
    } catch (err) {
      console.error('Failed to revoke all sessions:', err);
      setError('Failed to revoke sessions');
    } finally {
      setIsRevokingAll(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <Card className={borders.getElementBorder('card', 'default')}>
        <CardHeader>
          <CardTitle className={layout.flexCenterGap2}>
            <Shield className={iconSizes.md} aria-hidden="true" />
            {t('account.security.sessionsTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <figure
            className={cn(layout.flexCenterGap2, layout.padding4)}
            role="status"
            aria-label="Loading sessions"
          >
            <RefreshCw className={cn(iconSizes.sm, 'animate-spin')} aria-hidden="true" />
            <figcaption className={cn(typography.body.sm, colors.text.muted)}>
              {t('common.loading') || 'Loading...'}
            </figcaption>
          </figure>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className={borders.getElementBorder('card', 'default')}>
        <CardHeader>
          <CardTitle className={layout.flexCenterGap2}>
            <Shield className={iconSizes.md} aria-hidden="true" />
            {t('account.security.sessionsTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <figure
            className={cn(
              layout.flexCenterGap2,
              layout.padding4,
              borders.radiusClass.md,
              colors.bg.error
            )}
          >
            <AlertTriangle className={cn(iconSizes.sm, colors.text.error)} aria-hidden="true" />
            <figcaption className={cn(typography.body.sm, colors.text.error)}>
              {error}
            </figcaption>
          </figure>
          <Button
            variant="outline"
            onClick={fetchSessions}
            className="mt-4"
          >
            <RefreshCw className={cn(iconSizes.xs, 'mr-2')} aria-hidden="true" />
            {t('common.retry') || 'Retry'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // No sessions state
  if (sessions.length === 0) {
    return (
      <Card className={borders.getElementBorder('card', 'default')}>
        <CardHeader>
          <CardTitle className={layout.flexCenterGap2}>
            <Shield className={iconSizes.md} aria-hidden="true" />
            {t('account.security.sessionsTitle')}
          </CardTitle>
          <CardDescription>
            {t('account.security.sessionsDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className={cn(typography.body.sm, colors.text.muted)}>
            {t('account.security.noSessions') || 'No active sessions found'}
          </p>
        </CardContent>
      </Card>
    );
  }

  // Sessions list
  return (
    <Card className={borders.getElementBorder('card', 'default')}>
      <CardHeader>
        <CardTitle className={layout.flexCenterGap2}>
          <Shield className={iconSizes.md} aria-hidden="true" />
          {t('account.security.sessionsTitle')}
          <Badge variant="secondary" className="ml-2">
            {sessions.length}
          </Badge>
        </CardTitle>
        <CardDescription>
          {t('account.security.sessionsDescription')}
        </CardDescription>
      </CardHeader>

      <CardContent className={layout.flexColGap4}>
        {/* Sessions List */}
        <ul className={layout.flexColGap2} role="list" aria-label="Active sessions">
          {sessions.map(session => (
            <li
              key={session.id}
              className={cn(
                layout.flexCenterBetween,
                layout.padding3,
                borders.radiusClass.md,
                'bg-muted/30',
                session.isCurrent && 'ring-2 ring-primary/50'
              )}
            >
              <article className={layout.flexCenterGap4}>
                {/* Device Icon */}
                <figure
                  className={cn(
                    layout.padding2,
                    borders.radiusClass.md,
                    'bg-background',
                    getBrowserColor(session.browserType)
                  )}
                >
                  {getDeviceIcon(session.deviceType, iconSizes.md)}
                </figure>

                {/* Session Info */}
                <section>
                  <header className={layout.flexCenterGap2}>
                    <h4 className={cn(typography.body.base, 'font-medium')}>
                      {session.displayLabel}
                    </h4>
                    {session.isCurrent && (
                      <Badge variant="default" className="text-xs">
                        <Check className={cn(iconSizes.xs, 'mr-1')} aria-hidden="true" />
                        {t('account.security.thisDevice') || 'This device'}
                      </Badge>
                    )}
                  </header>

                  <footer className={cn(layout.flexCenterGap2, 'mt-1')}>
                    <Globe className={cn(iconSizes.xs, colors.text.muted)} aria-hidden="true" />
                    <span className={cn(typography.body.sm, colors.text.muted)}>
                      {session.locationDisplay}
                    </span>
                    <span className={cn(typography.body.sm, colors.text.muted)}>•</span>
                    <time className={cn(typography.body.sm, colors.text.muted)}>
                      {session.lastActiveRelative}
                    </time>
                  </footer>
                </section>
              </article>

              {/* Revoke Button (not for current session) */}
              {!session.isCurrent && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={revokingSessionId === session.id}
                      aria-label={`Revoke session ${session.displayLabel}`}
                    >
                      <LogOut className={iconSizes.sm} aria-hidden="true" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        {t('account.security.revokeSessionTitle') || 'Revoke Session'}
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        {t('account.security.revokeSessionDescription') ||
                          'This will sign out this device. The user will need to sign in again.'}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>
                        {t('common.cancel') || 'Cancel'}
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleRevokeSession(session.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {t('account.security.revokeSession') || 'Revoke'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </li>
          ))}
        </ul>

        {/* Revoke All Button */}
        {sessions.filter(s => !s.isCurrent).length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                className="w-full"
                disabled={isRevokingAll}
              >
                <LogOut className={cn(iconSizes.sm, 'mr-2')} aria-hidden="true" />
                {t('account.security.revokeAllOther') || 'Sign out all other devices'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {t('account.security.revokeAllTitle') || 'Sign Out All Other Devices'}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {t('account.security.revokeAllDescription') ||
                    'This will sign out all devices except this one. Other users will need to sign in again.'}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>
                  {t('common.cancel') || 'Cancel'}
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleRevokeAllOther}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {t('account.security.revokeAll') || 'Sign out all'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </CardContent>
    </Card>
  );
}

export default SessionsList;
