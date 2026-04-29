'use client';

import { useCallback, useState } from 'react';
import { Copy, Link, Mail, Plus, RotateCcw } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { BadgeVariantProps } from '@/components/ui/badge';
import type { ComboboxOption } from '@/components/ui/searchable-combobox-types';
import type { InviteStatus, DeliveryChannel } from '../types/vendor-invite';
import { useVendorInvites } from '../hooks/useVendorInvites';
import { VendorInviteDialog } from './VendorInviteDialog';

// ============================================================================
// TIMESTAMP HELPER
// ============================================================================

interface SerializedTimestamp {
  seconds?: number;
  _seconds?: number;
  nanoseconds?: number;
}

function tsToMs(ts: SerializedTimestamp | null | undefined): number | null {
  if (!ts) return null;
  const secs = ts.seconds ?? ts._seconds;
  return secs != null ? secs * 1000 : null;
}

function formatExpiry(ts: SerializedTimestamp | null | undefined): string {
  const ms = tsToMs(ts);
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ============================================================================
// STATUS BADGE
// ============================================================================

const STATUS_VARIANTS: Record<InviteStatus, BadgeVariantProps['variant']> = {
  pending: 'outline',
  sent: 'secondary',
  opened: 'info',
  submitted: 'success',
  declined: 'destructive',
  expired: 'muted',
};

function StatusBadge({ status }: { status: InviteStatus }) {
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

interface InviteRowProps {
  invite: ReturnType<typeof useVendorInvites>['invites'][number];
  vendorName: string;
  onRevoke: (id: string) => Promise<void>;
}

function InviteRow({ invite, vendorName, onRevoke }: InviteRowProps) {
  const { t } = useTranslation('quotes');
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState(false);

  const canRevoke = invite.status === 'pending' || invite.status === 'sent' || invite.status === 'opened';

  const handleCopy = useCallback(() => {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? '';
    const url = `${base}/vendor/quote/${encodeURIComponent(invite.token)}`;
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [invite.token]);

  const handleRevoke = useCallback(async () => {
    if (!confirm(t('invites.confirmRevoke'))) return;
    setRevoking(true);
    try { await onRevoke(invite.id); } finally { setRevoking(false); }
  }, [invite.id, onRevoke, t]);

  return (
    <tr className="border-b last:border-0">
      <td className="py-2 pr-4 text-sm">{vendorName}</td>
      <td className="py-2 pr-4">
        <ChannelIcon channel={invite.deliveryChannel} />
      </td>
      <td className="py-2 pr-4">
        <StatusBadge status={invite.status} />
      </td>
      <td className="py-2 pr-4 text-sm tabular-nums">
        {formatExpiry(invite.expiresAt as unknown as SerializedTimestamp)}
      </td>
      <td className="py-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleCopy} title={t('invites.copyLink')}>
            <Copy className="h-3.5 w-3.5" />
            <span className="ml-1 text-xs">{copied ? t('invites.linkCopied') : t('invites.copyLink')}</span>
          </Button>
          {canRevoke && (
            <Button variant="ghost" size="sm" onClick={handleRevoke} disabled={revoking} title={t('invites.revoke')}>
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ============================================================================
// MAIN SECTION
// ============================================================================

interface VendorInviteSectionProps {
  rfqId: string;
}

export function VendorInviteSection({ rfqId }: VendorInviteSectionProps) {
  const { t } = useTranslation('quotes');
  const { invites, vendorContacts, loading, contactsLoading, createInvite, revokeInvite } =
    useVendorInvites(rfqId);
  const [dialogOpen, setDialogOpen] = useState(false);

  const vendorContactOptions: ComboboxOption[] = vendorContacts.map((c) => ({
    value: c.id,
    label: c.displayName,
    secondaryLabel: c.email ?? undefined,
  }));

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
        <Button size="sm" onClick={() => setDialogOpen(true)}>
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
                  onRevoke={revokeInvite}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <VendorInviteDialog
        rfqId={rfqId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        vendorContacts={vendorContactOptions}
        contactsLoading={contactsLoading}
        onCreate={createInvite}
      />
    </section>
  );
}
