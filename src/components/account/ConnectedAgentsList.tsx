'use client';

/**
 * Οθόνη «συνδεδεμένοι πράκτορες» (ADR-738 §6, §10)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΟ ΑΛΛΟ ΜΙΣΟ ΤΗΣ ΣΥΓΚΑΤΑΘΕΣΗΣ
 * ─────────────────────────────────────────────────────────────────────────────
 * Η οθόνη συγκατάθεσης ρωτά «να του δώσω;». Αυτή απαντά «τι του έχω δώσει, και
 * πώς το παίρνω πίσω;». Ένας authorization server που μπορεί μόνο να **δίνει**
 * είναι μισός: χωρίς ανάκληση, το μοναδικό διαθέσιμο αντίμετρο σε χαμένο
 * μηχάνημα ή πράκτορα που ξέφυγε είναι η αναμονή της λήξης — **έως 30 ημέρες**.
 *
 * ⚠️ Οι περιγραφές των scopes έρχονται από το **ίδιο** SSoT με την οθόνη
 * συγκατάθεσης (`describeOAuthScope`). Αν αποκλίνουν, ο χρήστης εγκρίνει ένα
 * κείμενο και βλέπει αργότερα άλλο για την ίδια εξουσία.
 *
 * ⚠️ Εμφανίζεται το **hostname** του `client_id`, όχι μόνο το φιλικό όνομα: το
 * όνομα το δηλώνει ο ίδιος ο client στο CIMD του και μπορεί να λέει ό,τι θέλει.
 * Η προέλευση είναι το μόνο στοιχείο που δεν μπορεί να πλαστογραφήσει.
 *
 * @module components/account/ConnectedAgentsList
 */

import { Bot, AlertTriangle, RefreshCw, Unlink } from 'lucide-react';

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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { describeOAuthScope } from '@/components/oauth/oauth-scope-labels';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { useTypography } from '@/hooks/useTypography';
import { COMMON_NAMESPACES } from '@/i18n/namespace-bundles';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { useConnectedAgents, type ConnectedAgent } from './useConnectedAgents';

/** Το namespace `auth` κρατά τις περιγραφές scopes — βλ. `describeOAuthScope`. */
const AGENT_NAMESPACES = [...COMMON_NAMESPACES, 'auth'] as const;

/**
 * Το hostname του `client_id`, ή `null` αν δεν είναι αναλύσιμο URL.
 *
 * Δεν πετάει: ένα κακοσχηματισμένο `client_id` δεν πρέπει να ρίξει ολόκληρη την
 * οθόνη ασφαλείας — απλώς εμφανίζεται ως άγνωστη προέλευση.
 */
function clientHostname(clientId: string): string | null {
  try {
    return new URL(clientId).hostname;
  } catch {
    return null;
  }
}

// ============================================================================
// ΚΕΛΥΦΟΣ
// ============================================================================

interface ShellProps {
  readonly title: string;
  readonly description?: string;
  readonly count?: number;
  readonly children: React.ReactNode;
}

function AgentsCard({ title, description, count, children }: ShellProps) {
  const borders = useBorderTokens();
  const layout = useLayoutClasses();
  const iconSizes = useIconSizes();

  return (
    <Card className={borders.getElementBorder('card', 'default')}>
      <CardHeader>
        <CardTitle className={layout.flexCenterGap2}>
          <Bot className={iconSizes.md} aria-hidden="true" />
          {title}
          {count !== undefined && count > 0 && (
            <Badge variant="secondary" className="ml-2">
              {count}
            </Badge>
          )}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className={layout.flexColGap4}>{children}</CardContent>
    </Card>
  );
}

// ============================================================================
// ΓΡΑΜΜΗ
// ============================================================================

interface RowProps {
  readonly agent: ConnectedAgent;
  readonly isRevoking: boolean;
  readonly onRevoke: (consentId: string) => void;
}

function AgentRow({ agent, isRevoking, onRevoke }: RowProps) {
  const { t } = useTranslation(AGENT_NAMESPACES);
  const colors = useSemanticColors();
  const borders = useBorderTokens();
  const layout = useLayoutClasses();
  const iconSizes = useIconSizes();
  const typography = useTypography();

  const hostname = clientHostname(agent.clientId);
  const grantedOn = t('account.security.agentsGrantedOn', {
    date: new Date(agent.createdAt).toLocaleDateString(),
  });

  return (
    <li className={cn(layout.flexCenterBetween, layout.padding3, borders.radiusClass.md, 'bg-muted/30')}>
      <section>
        <header className={layout.flexCenterGap2}>
          <h4 className={cn(typography.body.base, 'font-medium')}>{agent.clientName}</h4>
          <span className={cn(typography.body.sm, colors.text.muted)}>
            {hostname ?? t('account.security.agentsUnknownClient')}
          </span>
        </header>

        <ul className={cn('mt-1 list-disc pl-5', typography.body.sm, colors.text.muted)}>
          {agent.scopes.map((scope) => (
            <li key={scope}>{describeOAuthScope(t, scope)}</li>
          ))}
        </ul>

        <time
          dateTime={new Date(agent.createdAt).toISOString()}
          className={cn('mt-1 block', typography.body.sm, colors.text.muted)}
        >
          {grantedOn}
        </time>
      </section>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={isRevoking}
            aria-label={`${t('account.security.agentsRevoke')} — ${agent.clientName}`}
          >
            <Unlink className={cn(iconSizes.sm, isRevoking && 'animate-pulse')} aria-hidden="true" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('account.security.agentsRevokeTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('account.security.agentsRevokeDescription', { clientName: agent.clientName })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => onRevoke(agent.consentId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRevoking
                ? t('account.security.agentsRevoking')
                : t('account.security.agentsRevoke')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}

// ============================================================================
// ΟΘΟΝΗ
// ============================================================================

export function ConnectedAgentsList() {
  const { t } = useTranslation(AGENT_NAMESPACES);
  const colors = useSemanticColors();
  const borders = useBorderTokens();
  const layout = useLayoutClasses();
  const iconSizes = useIconSizes();
  const typography = useTypography();

  const { agents, isLoading, loadFailed, revokingId, revokeFailed, reload, revoke } =
    useConnectedAgents();

  const title = t('account.security.agentsTitle');

  if (isLoading) {
    return (
      <AgentsCard title={title}>
        <figure className={cn(layout.flexCenterGap2, layout.padding4)} role="status">
          <RefreshCw className={cn(iconSizes.sm, 'animate-spin')} aria-hidden="true" />
          <figcaption className={cn(typography.body.sm, colors.text.muted)}>
            {t('common.loading')}
          </figcaption>
        </figure>
      </AgentsCard>
    );
  }

  if (loadFailed) {
    return (
      <AgentsCard title={title}>
        <figure
          className={cn(layout.flexCenterGap2, layout.padding4, borders.radiusClass.md, colors.bg.error)}
        >
          <AlertTriangle className={cn(iconSizes.sm, colors.text.error)} aria-hidden="true" />
          <figcaption className={cn(typography.body.sm, colors.text.error)}>
            {t('account.security.agentsLoadError')}
          </figcaption>
        </figure>
        <Button variant="outline" onClick={() => void reload()}>
          <RefreshCw className={cn(iconSizes.xs, 'mr-2')} aria-hidden="true" />
          {t('common.retry')}
        </Button>
      </AgentsCard>
    );
  }

  if (agents.length === 0) {
    return (
      <AgentsCard title={title} description={t('account.security.agentsDescription')}>
        <p className={cn(typography.body.sm, colors.text.muted)}>
          {t('account.security.agentsEmpty')}
        </p>
      </AgentsCard>
    );
  }

  return (
    <AgentsCard
      title={title}
      description={t('account.security.agentsDescription')}
      count={agents.length}
    >
      {revokeFailed && (
        <output
          role="status"
          className={cn(
            layout.padding3,
            borders.radiusClass.md,
            typography.body.sm,
            colors.bg.error,
            colors.text.error,
          )}
        >
          {t('account.security.agentsRevokeError')}
        </output>
      )}

      <ul className={layout.flexColGap2} aria-label={title}>
        {agents.map((agent) => (
          <AgentRow
            key={agent.consentId}
            agent={agent}
            isRevoking={revokingId === agent.consentId}
            onRevoke={(consentId) => void revoke(consentId)}
          />
        ))}
      </ul>
    </AgentsCard>
  );
}

export default ConnectedAgentsList;
