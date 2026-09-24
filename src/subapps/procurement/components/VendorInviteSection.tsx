'use client';

import { Fragment, useCallback, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Copy, Link, Mail, Plus, RotateCcw } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { normalizeToDate } from '@/lib/date-local';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { BadgeVariantProps } from '@/components/ui/badge';
import type { DeliveryChannel } from '../types/vendor-invite';
import {
  isLiveInviteStatus,
  normalizeInviteStatus,
  vendorInviteDisplayStatus,
  type VendorInviteDisplayStatus,
} from '../utils/vendor-invite-status';
import type { SetupLockState } from '@/subapps/procurement/utils/rfq-lock-state';
import { useVendorInvites } from '../hooks/useVendorInvites';
import { VendorInviteDialog } from './VendorInviteDialog';
import { VendorInviteLinksPanel } from './VendorInviteLinksPanel';
import type { RFQ } from '../types/rfq';

// ============================================================================
// TIMESTAMP HELPER
// ============================================================================

function formatExpiry(ts: unknown): string {
  const date = normalizeToDate(ts);
  if (!date) return '—';
  return date.toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ============================================================================
// STATUS BADGE
// ============================================================================

// ADR-876 §5: `revoked` = απόφαση του γραφείου (αποθηκευμένη)· `expired` = παράγωγη από το `expiresAt`.
const STATUS_VARIANTS: Record<VendorInviteDisplayStatus, BadgeVariantProps['variant']> = {
  pending: 'outline',
  sent: 'secondary',
  opened: 'info',
  submitted: 'success',
  declined: 'destructive',
  revoked: 'muted',
  expired: 'warning',
};

function StatusBadge({ status }: { status: VendorInviteDisplayStatus }) {
  const { t } = useTranslation('quotes');
  return (
    <Badge variant={STATUS_VARIANTS[status]}>
      {t(`invites.statuses.${status}`)}
    </Badge>
  );
}

// ============================================================================
// CHANNEL ICON
// ============================================================================

function ChannelIcon({ channel }: { channel: DeliveryChannel }) {
  if (channel === 'email') return <Mail className="h-4 w-4 shrink-0" aria-label="email" />;
  return <Link className="h-4 w-4 shrink-0" aria-label="copy_link" />;
}

// ============================================================================
// INVITE ROW
// ============================================================================

type InviteLinkActions = Pick<
  ReturnType<typeof useVendorInvites>,
  'revokeInvite' | 'issueCopyLink' | 'listLinks' | 'revokeLink'
>;

interface InviteRowProps {
  invite: ReturnType<typeof useVendorInvites>['invites'][number];
  vendorName: string;
  actions: InviteLinkActions;
  lockState: SetupLockState;
}

const INVITE_COLUMNS = 5;
const COPIED_FEEDBACK_MS = 2000;

type CopyState = 'idle' | 'copying' | 'copied' | 'failed';

const COPY_LABEL_KEYS: Record<CopyState, string> = {
  idle: 'invites.copyLink',
  copying: 'invites.copyLink',
  copied: 'invites.linkCopied',
  failed: 'invites.errors.copyFailed',
};

function InviteRow({ invite, vendorName, actions, lockState }: InviteRowProps) {
  const { t } = useTranslation('quotes');
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const [revoking, setRevoking] = useState(false);
  const [linksOpen, setLinksOpen] = useState(false);
  const [linksRevision, setLinksRevision] = useState(0);

  const live = isLiveInviteStatus(normalizeInviteStatus(invite.status));
  // awardLocked: cancel still allowed (housekeeping). poLocked: full lock (§5.G.1)
  const canRevoke = live && lockState !== 'poLocked';

  // ADR-876 §5: ΝΕΟΣ σύνδεσμος ανά αντιγραφή (το URL επιστρέφεται μία φορά)· ο browser δεν διαβάζει
  // πια token από το έγγραφο της πρόσκλησης, ούτε χτίζει μόνος του το URL.
  const handleCopy = useCallback(async () => {
    setCopyState('copying');
    try {
      await navigator.clipboard.writeText(await actions.issueCopyLink(invite.id));
      setCopyState('copied');
      setLinksRevision((n) => n + 1);
      setTimeout(() => setCopyState('idle'), COPIED_FEEDBACK_MS);
    } catch {
      setCopyState('failed');
    }
  }, [actions, invite.id]);

  const handleRevoke = useCallback(async () => {
    if (!confirm(t('invites.confirmRevoke'))) return;
    setRevoking(true);
    try { await actions.revokeInvite(invite.id); } finally { setRevoking(false); }
  }, [actions, invite.id, t]);

  return (
    <Fragment>
      <tr className="border-b last:border-0">
        <td className="py-2 pr-4 text-sm">{vendorName}</td>
        <td className="py-2 pr-4">
          <ChannelIcon channel={invite.deliveryChannel} />
        </td>
        <td className="py-2 pr-4">
          <StatusBadge status={vendorInviteDisplayStatus(invite, Date.now())} />
        </td>
        <td className="py-2 pr-4 text-sm tabular-nums">
          {formatExpiry(invite.expiresAt)}
        </td>
        <td className="py-2">
          <div className="flex items-center gap-2">
            {live && (
              <Button variant="ghost" size="sm" onClick={handleCopy} disabled={copyState === 'copying'}>
                <Copy className="h-3.5 w-3.5" />
                <span className="ml-1 text-xs">{t(COPY_LABEL_KEYS[copyState])}</span>
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setLinksOpen((open) => !open)} aria-expanded={linksOpen}>
              {linksOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              <span className="ml-1 text-xs">{t('invites.links.toggle')}</span>
            </Button>
            {canRevoke && (
              <Button variant="ghost" size="sm" onClick={handleRevoke} disabled={revoking} aria-label={t('invites.revoke')}>
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </td>
      </tr>
      {linksOpen && (
        <tr className="border-b bg-muted/40">
          <td colSpan={INVITE_COLUMNS} className="px-2 py-2">
            <VendorInviteLinksPanel
              inviteId={invite.id}
              listLinks={actions.listLinks}
              revokeLink={actions.revokeLink}
              revision={linksRevision}
            />
          </td>
        </tr>
      )}
    </Fragment>
  );
}

// ============================================================================
// MAIN SECTION
// ============================================================================

interface VendorInviteSectionProps {
  rfqId: string;
  rfq?: RFQ | null;
  lockState?: SetupLockState;
  onViewInvites?: () => void;
}

export function VendorInviteSection({ rfqId, rfq, lockState = 'unlocked', onViewInvites }: VendorInviteSectionProps) {
  const { t } = useTranslation('quotes');
  const {
    invites, vendorContacts, loading, contactsLoading,
    createInvite, revokeInvite, issueCopyLink, listLinks, revokeLink, refetch,
  } = useVendorInvites(rfqId);
  const [dialogOpen, setDialogOpen] = useState(false);

  const actions = useMemo<InviteLinkActions>(
    () => ({ revokeInvite, issueCopyLink, listLinks, revokeLink }),
    [revokeInvite, issueCopyLink, listLinks, revokeLink],
  );

  const alreadyInvitedIds = useMemo(
    () => new Set(
      invites
        .filter((i) => isLiveInviteStatus(normalizeInviteStatus(i.status)))
        .map((i) => i.vendorContactId)
        .filter(Boolean) as string[],
    ),
    [invites],
  );

  const vendorNameMap = new Map(vendorContacts.map((c) => [c.id, c.displayName]));

  const resolveVendorName = useCallback(
    (invite: ReturnType<typeof useVendorInvites>['invites'][number]): string => {
      if (invite.recipientName) return invite.recipientName;
      if (invite.vendorContactId) {
        return vendorNameMap.get(invite.vendorContactId) ?? invite.vendorContactId;
      }
      return invite.recipientEmail ?? '—';
    },
    [vendorNameMap],
  );

  return (
    <section aria-labelledby="vendor-invites-heading" className="space-y-4 rounded-lg border p-4">
      <header className="flex items-center justify-between">
        <h2 id="vendor-invites-heading" className="text-base font-semibold">
          {t('invites.title')}
        </h2>
        <Button size="sm" disabled={lockState !== 'unlocked'} onClick={() => setDialogOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          {t('invites.button')}
        </Button>
      </header>

      {loading ? (
        <p className="text-sm text-muted-foreground">{t('quotes.loading')}</p>
      ) : invites.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('invites.empty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b text-xs uppercase text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">{t('invites.table.vendor')}</th>
                <th className="pb-2 pr-4 font-medium">{t('invites.table.channel')}</th>
                <th className="pb-2 pr-4 font-medium">{t('invites.table.status')}</th>
                <th className="pb-2 pr-4 font-medium">{t('invites.table.expires')}</th>
                <th className="pb-2 font-medium">{t('invites.table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {invites.map((invite) => (
                <InviteRow
                  key={invite.id}
                  invite={invite}
                  vendorName={resolveVendorName(invite)}
                  actions={actions}
                  lockState={lockState}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <VendorInviteDialog
        rfqId={rfqId}
        rfq={rfq ?? null}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        vendorContacts={vendorContacts}
        contactsLoading={contactsLoading}
        alreadyInvitedIds={alreadyInvitedIds}
        onCreate={createInvite}
        onAfterSend={refetch}
        onViewInvites={onViewInvites}
      />
    </section>
  );
}
