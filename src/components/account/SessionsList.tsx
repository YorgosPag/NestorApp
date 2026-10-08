'use client';

/**
 * 🔐 SESSIONS LIST COMPONENT
 *
 * Enterprise component for displaying and managing active sessions.
 * Follows Google «Your devices» / GitHub «Sessions» patterns.
 *
 * ADR-894: η τοποθεσία έρχεται ως **κωδικοί** από τον server (τοπική GeoIP) και αποδίδεται εδώ στη γλώσσα
 * του αναγνώστη· η «τρέχουσα συσκευή» είναι η εγγραφή αυτού του browser· η απόδοση CC BY του DB-IP είναι
 * υποχρέωση της άδειας σε κάθε σελίδα που δείχνει αποτελέσματα.
 *
 * @module components/account/SessionsList
 * @enterprise-ready true
 */

import { COMMON_NAMESPACES } from '@/i18n/namespace-bundles';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createStaleCache } from '@/lib/stale-cache';
import { LogOut, RefreshCw, Shield, AlertTriangle } from 'lucide-react';
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
import { OpenDataAttribution } from '@/components/market/OpenDataAttribution';
import { cn } from '@/lib/utils';
import { getDisplayNames } from '@/lib/intl-formatting';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTypography } from '@/hooks/useTypography';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { db } from '@/lib/firebase';
import { sessionService } from '@/services/session';
import type { SessionDisplayItem, SessionsOverviewDisplay } from '@/services/session';
import { createModuleLogger } from '@/lib/telemetry';
import { useAuth } from '@/auth/hooks/useAuth';
import { sessionLocationLabel } from './session-location-label';
import { SessionDeviceSummary, type Translate } from './session-device-summary';
import { EndedSessionsSection } from './EndedSessionsSection';
import '@/lib/design-system';

const logger = createModuleLogger('SessionsList');

const sessionsListCache = createStaleCache<SessionsOverviewDisplay>('account-sessions');
const EMPTY_OVERVIEW: SessionsOverviewDisplay = { live: [], ended: [] };

const DESTRUCTIVE_ACTION = 'bg-destructive text-destructive-foreground hover:bg-destructive/90';

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
// DATA HOOK
// ============================================================================

type SessionsSetter = React.Dispatch<React.SetStateAction<SessionsOverviewDisplay>>;

/** Ανάκληση — μία συσκευή ή όλες οι άλλες. Η λίστα ενημερώνεται μόνο μετά την επιβεβαίωση του server. */
function useSessionRevocation(userId: string, t: Translate, setSessions: SessionsSetter, setError: (e: string) => void, onSessionsChange?: () => void) {
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);
  const [isRevokingAll, setIsRevokingAll] = useState(false);
  const { signOut } = useAuth();

  // ADR-894 §10 Β1 — ανακλήθηκαν ΟΛΕΣ οι συνδέσεις και αυτή η συσκευή δεν πήρε νέο κλειδί ⇒ σύνδεση ξανά.
  const settle = (result: { success: boolean; signInRequired?: boolean }, keep: (s: SessionDisplayItem) => boolean) => {
    if (result.signInRequired) {
      void signOut({ reason: 'revoked' });
      return;
    }
    if (result.success) {
      setSessions(prev => ({ ...prev, live: prev.live.filter(keep) }));
      onSessionsChange?.();
    } else {
      setError(t('account.security.revokeError'));
    }
  };

  const revokeSession = async (sessionId: string) => {
    setRevokingSessionId(sessionId);
    const result = await sessionService.revokeSession(userId, sessionId);
    settle(result, s => s.id !== sessionId);
    setRevokingSessionId(null);
  };

  const revokeAllOther = async () => {
    setIsRevokingAll(true);
    const result = await sessionService.revokeAllOtherSessions(userId);
    settle(result, s => s.isCurrent);
    setIsRevokingAll(false);
  };

  return { revokingSessionId, isRevokingAll, revokeSession, revokeAllOther };
}

function useSessions(userId: string, t: Translate, onSessionsChange?: () => void) {
  const [overview, setOverview] = useState<SessionsOverviewDisplay>(sessionsListCache.get(userId) ?? EMPTY_OVERVIEW);
  const [isLoading, setIsLoading] = useState(!sessionsListCache.hasLoaded(userId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (db) sessionService.initialize(db);
  }, []);

  const fetchSessions = useCallback(async () => {
    if (!userId) return;
    if (!sessionsListCache.hasLoaded(userId)) setIsLoading(true);
    setError(null);
    try {
      const next = await sessionService.getSessionsForDisplay(userId);
      sessionsListCache.set(next, userId);
      setOverview(next);
    } catch (err) {
      logger.error('Failed to fetch sessions', { error: err });
      setError(t('account.security.sessionsLoadError'));
    } finally {
      setIsLoading(false);
    }
  }, [userId, t]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const revocation = useSessionRevocation(userId, t, setOverview, setError, onSessionsChange);
  return { sessions: overview.live, ended: overview.ended, isLoading, error, fetchSessions, ...revocation };
}

// ============================================================================
// PRESENTATION
// ============================================================================

interface SessionsCardProps {
  t: Translate;
  count?: number;
  withDescription?: boolean;
  children: React.ReactNode;
}

function SessionsCard({ t, count, withDescription = true, children }: SessionsCardProps) {
  const borders = useBorderTokens();
  const layout = useLayoutClasses();
  const iconSizes = useIconSizes();
  return (
    <Card className={borders.getElementBorder('card', 'default')}>
      <CardHeader>
        <CardTitle className={layout.flexCenterGap2}>
          <Shield className={iconSizes.md} aria-hidden="true" />
          {t('account.security.sessionsTitle')}
          {count !== undefined && <Badge variant="secondary" className="ml-2">{count}</Badge>}
        </CardTitle>
        {withDescription && <CardDescription>{t('account.security.sessionsDescription')}</CardDescription>}
      </CardHeader>
      {children}
    </Card>
  );
}

interface ConfirmDialogProps {
  t: Translate;
  title: string;
  description: string;
  action: string;
  onConfirm: () => void;
  children: React.ReactNode;
}

function ConfirmDialog({ t, title, description, action, onConfirm, children }: ConfirmDialogProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className={DESTRUCTIVE_ACTION}>{action}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface SessionRowProps {
  t: Translate;
  session: SessionDisplayItem;
  locationLabel: string;
  isRevoking: boolean;
  onRevoke: (sessionId: string) => void;
}

function SessionRow({ t, session, locationLabel, isRevoking, onRevoke }: SessionRowProps) {
  const borders = useBorderTokens();
  const layout = useLayoutClasses();
  const iconSizes = useIconSizes();
  const device = t('account.security.deviceLabel', { browser: session.browser, os: session.os });

  return (
    <li className={cn(layout.flexCenterBetween, layout.padding3, borders.radiusClass.md, 'bg-muted/30', session.isCurrent && 'ring-2 ring-primary/50')}>
      <SessionDeviceSummary
        t={t}
        session={session}
        device={device}
        locationLabel={locationLabel}
        when={{ label: session.lastActiveRelative, at: session.timestamps.lastActiveAt }}
      />
      {!session.isCurrent && (
        <ConfirmDialog
          t={t}
          title={t('account.security.revokeSessionTitle')}
          description={t('account.security.revokeSessionDescription')}
          action={t('account.security.revokeSession')}
          onConfirm={() => onRevoke(session.id)}
        >
          <Button variant="ghost" size="sm" disabled={isRevoking} aria-label={t('account.security.revokeSessionAria', { device })}>
            <LogOut className={iconSizes.sm} aria-hidden="true" />
          </Button>
        </ConfirmDialog>
      )}
    </li>
  );
}

interface SessionsStatusCardProps {
  t: Translate;
  /** `loading` = περιστρεφόμενο εικονίδιο · `error` = μήνυμα + «Επανάληψη». Μία κάρτα κατάστασης, δύο τόνοι. */
  tone: 'loading' | 'error';
  message: string;
  onRetry?: () => void;
}

function SessionsStatusCard({ t, tone, message, onRetry }: SessionsStatusCardProps) {
  const colors = useSemanticColors();
  const borders = useBorderTokens();
  const layout = useLayoutClasses();
  const iconSizes = useIconSizes();
  const typography = useTypography();
  const isError = tone === 'error';
  const text = isError ? colors.text.error : colors.text.muted;
  return (
    <SessionsCard t={t} withDescription={false}>
      <CardContent>
        <figure
          className={cn(layout.flexCenterGap2, layout.padding4, isError && cn(borders.radiusClass.md, colors.bg.error))}
          {...(isError ? {} : { role: 'status', 'aria-label': t('account.security.sessionsLoading') })}
        >
          {isError
            ? <AlertTriangle className={cn(iconSizes.sm, colors.text.error)} aria-hidden="true" />
            : <RefreshCw className={cn(iconSizes.sm, 'animate-spin')} aria-hidden="true" />}
          <figcaption className={cn(typography.body.sm, text)}>{message}</figcaption>
        </figure>
        {onRetry && (
          <Button variant="outline" onClick={onRetry} className="mt-4">
            <RefreshCw className={cn(iconSizes.xs, 'mr-2')} aria-hidden="true" />
            {t('common.retry')}
          </Button>
        )}
      </CardContent>
    </SessionsCard>
  );
}

// ============================================================================
// SESSIONS LIST COMPONENT
// ============================================================================

type SessionsState = ReturnType<typeof useSessions>;

function RevokeAllOthersButton({ t, state }: { t: Translate; state: SessionsState }) {
  const iconSizes = useIconSizes();
  return (
    <ConfirmDialog
      t={t}
      title={t('account.security.revokeAllTitle')}
      description={t('account.security.revokeAllDescription')}
      action={t('account.security.revokeAll')}
      onConfirm={state.revokeAllOther}
    >
      <Button variant="outline" className="w-full" disabled={state.isRevokingAll}>
        <LogOut className={cn(iconSizes.sm, 'mr-2')} aria-hidden="true" />
        {t('account.security.revokeAllOther')}
      </Button>
    </ConfirmDialog>
  );
}

function SessionsListContent({ t, state }: { t: Translate; state: SessionsState }) {
  const colors = useSemanticColors();
  const layout = useLayoutClasses();
  const typography = useTypography();
  // Το `t` αλλάζει με τη γλώσσα ⇒ τα ονόματα χωρών ξαναβγαίνουν στη νέα γλώσσα.
  const regionNames = useMemo(() => getDisplayNames().region, [t]);
  const unknownLocation = t('account.security.locationUnknown');
  return (
    <CardContent className={layout.flexColGap4}>
      <ul className={layout.flexColGap2} role="list" aria-label={t('account.security.sessionsTitle')}>
        {state.sessions.map(session => (
          <SessionRow
            key={session.id}
            t={t}
            session={session}
            locationLabel={sessionLocationLabel(session.location, regionNames, unknownLocation)}
            isRevoking={state.revokingSessionId === session.id}
            onRevoke={state.revokeSession}
          />
        ))}
      </ul>
      {state.sessions.some(s => !s.isCurrent) && <RevokeAllOthersButton t={t} state={state} />}
      <EndedSessionsSection t={t} sessions={state.ended} />
      <p className={cn(typography.body.sm, colors.text.muted)}>{t('account.security.locationApproximateNote')}</p>
      <OpenDataAttribution source="ipGeolocation" />
    </CardContent>
  );
}

export function SessionsList({ userId, onSessionsChange }: SessionsListProps) {
  const { t } = useTranslation(COMMON_NAMESPACES);
  const colors = useSemanticColors();
  const typography = useTypography();
  const state = useSessions(userId, t, onSessionsChange);

  if (state.isLoading) return <SessionsStatusCard t={t} tone="loading" message={t('common.loading')} />;
  if (state.error) return <SessionsStatusCard t={t} tone="error" message={state.error} onRetry={state.fetchSessions} />;

  if (state.sessions.length === 0) {
    return (
      <SessionsCard t={t}>
        <CardContent>
          <p className={cn(typography.body.sm, colors.text.muted)}>{t('account.security.noSessions')}</p>
        </CardContent>
      </SessionsCard>
    );
  }

  return (
    <SessionsCard t={t} count={state.sessions.length}>
      <SessionsListContent t={t} state={state} />
    </SessionsCard>
  );
}

export default SessionsList;
